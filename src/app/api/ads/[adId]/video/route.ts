
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import { auth } from "@/auth";

const FB_GRAPH_VERSION = "v21.0";

async function fbGet(path: string, accessToken: string) {
    const res = await fetch(
        `https://graph.facebook.com/${FB_GRAPH_VERSION}/${path}${path.includes("?") ? "&" : "?"}access_token=${accessToken}`
    );
    if (!res.ok) return null;
    return res.json();
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ adId: string }> }
) {
    try {
        const { adId } = await params;
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const forceRefresh = request.nextUrl.searchParams.get("refresh") === "1";

        // Check cache first (unless force refresh)
        if (!forceRefresh) {
            const cached = await prisma.adMetric.findFirst({
                where: { adId, organizationId: session.user.organizationId },
                select: { videoUrl: true, thumbnailUrl: true },
                orderBy: { date: "desc" },
            });
            if (cached?.videoUrl) {
                return NextResponse.json({
                    videoUrl: cached.videoUrl,
                    imageUrl: null,
                    type: "video",
                });
            }
        }

        // Get integration token
        const integration = await prisma.integration.findFirst({
            where: {
                organizationId: session.user.organizationId,
                platform: "FACEBOOK_ADS",
                status: "CONNECTED",
            },
        });

        if (!integration?.accessToken) {
            return NextResponse.json({ error: "No Facebook integration" }, { status: 404 });
        }

        const accessToken = decrypt(integration.accessToken);

        // Step 1: Fetch ad with extended creative fields
        const adData = await fbGet(
            `${adId}?fields=creative{id,video_id,image_url,thumbnail_url,effective_object_story_id,object_story_spec{video_data{video_id},link_data{picture,image_hash}}}`,
            accessToken
        );

        if (!adData?.creative) {
            return NextResponse.json({ videoUrl: null, imageUrl: null, type: "none" });
        }

        const creative = adData.creative;

        // Step 2: Try to find video_id from multiple sources
        let videoId: string | null =
            creative.video_id ||
            creative.object_story_spec?.video_data?.video_id ||
            null;

        // Step 3: If no direct video_id, try effective_object_story_id (post-based creatives)
        if (!videoId && creative.effective_object_story_id) {
            const storyId = creative.effective_object_story_id;

            // 3a: Try fetching the post directly — video posts have 'source' at top level
            const storyData = await fbGet(
                `${storyId}?fields=source,type,full_picture,attachments{media{source,image{src,width,height}},type,subattachments{media{source,image{src}},type}}`,
                accessToken
            );

            if (storyData) {
                // 3b: Video source directly on the post (most reliable for video posts)
                if (storyData.source) {
                    await prisma.adMetric.updateMany({
                        where: { adId },
                        data: { videoUrl: storyData.source },
                    });
                    if (storyData.full_picture) {
                        await prisma.adMetric.updateMany({
                            where: { adId },
                            data: { thumbnailUrl: storyData.full_picture },
                        });
                    }
                    return NextResponse.json({
                        videoUrl: storyData.source,
                        imageUrl: storyData.full_picture || null,
                        type: "video",
                    });
                }

                // 3c: Check attachments for video source
                const attachments = storyData.attachments?.data;
                if (attachments) {
                    for (const att of attachments) {
                        if (att.media?.source) {
                            await prisma.adMetric.updateMany({
                                where: { adId },
                                data: { videoUrl: att.media.source },
                            });
                            const hiResImage = att.media.image?.src || storyData.full_picture;
                            if (hiResImage) {
                                await prisma.adMetric.updateMany({
                                    where: { adId },
                                    data: { thumbnailUrl: hiResImage },
                                });
                            }
                            return NextResponse.json({
                                videoUrl: att.media.source,
                                imageUrl: hiResImage || null,
                                type: "video",
                            });
                        }

                        // Check subattachments (carousel with videos)
                        if (att.subattachments?.data) {
                            for (const sub of att.subattachments.data) {
                                if (sub.media?.source) {
                                    return NextResponse.json({
                                        videoUrl: sub.media.source,
                                        imageUrl: sub.media.image?.src || null,
                                        type: "video",
                                    });
                                }
                            }
                        }

                        // High-res image from attachment (image ads)
                        if (att.media?.image?.src) {
                            const hiResImage = att.media.image.src;
                            await prisma.adMetric.updateMany({
                                where: { adId },
                                data: { thumbnailUrl: hiResImage },
                            });
                            return NextResponse.json({
                                videoUrl: null,
                                imageUrl: hiResImage,
                                type: "image",
                            });
                        }
                    }
                }

                // 3d: Try extracting video_id from the story ID itself
                // Story IDs for video posts: {page_id}_{video_id}
                const parts = storyId.split("_");
                if (parts.length >= 2) {
                    const possibleVideoId = parts[parts.length - 1];
                    const videoCheck = await fbGet(
                        `${possibleVideoId}?fields=source,picture`,
                        accessToken
                    );
                    if (videoCheck?.source) {
                        await prisma.adMetric.updateMany({
                            where: { adId },
                            data: { videoUrl: videoCheck.source },
                        });
                        if (videoCheck.picture) {
                            await prisma.adMetric.updateMany({
                                where: { adId },
                                data: { thumbnailUrl: videoCheck.picture },
                            });
                        }
                        return NextResponse.json({
                            videoUrl: videoCheck.source,
                            imageUrl: videoCheck.picture || storyData.full_picture || null,
                            type: "video",
                        });
                    }
                }

                // 3e: Fallback to full_picture (high-res image, better than thumbnail_url)
                if (storyData.full_picture) {
                    await prisma.adMetric.updateMany({
                        where: { adId },
                        data: { thumbnailUrl: storyData.full_picture },
                    });
                    return NextResponse.json({
                        videoUrl: null,
                        imageUrl: storyData.full_picture,
                        type: "image",
                    });
                }
            }
        }

        // Step 4: We have a video_id — fetch the video source
        if (videoId) {
            const videoData = await fbGet(
                `${videoId}?fields=source,picture`,
                accessToken
            );

            if (videoData?.source) {
                // Cache video URL and high-res thumbnail
                const updateData: { videoUrl: string; thumbnailUrl?: string } = {
                    videoUrl: videoData.source,
                };
                if (videoData.picture) {
                    updateData.thumbnailUrl = videoData.picture;
                }
                await prisma.adMetric.updateMany({
                    where: { adId },
                    data: updateData,
                });

                return NextResponse.json({
                    videoUrl: videoData.source,
                    imageUrl: videoData.picture || null,
                    type: "video",
                });
            }
        }

        // Step 5: No video — get highest quality image available
        // Priority: image_url > full_picture from story > link_data.picture > thumbnail_url
        const imageUrl =
            creative.image_url ||
            creative.object_story_spec?.link_data?.picture ||
            null;

        if (imageUrl) {
            // Update thumbnail in DB with higher quality
            await prisma.adMetric.updateMany({
                where: { adId },
                data: { thumbnailUrl: imageUrl },
            });

            return NextResponse.json({
                videoUrl: null,
                imageUrl,
                type: "image",
            });
        }

        // Last resort: thumbnail_url (low res)
        if (creative.thumbnail_url) {
            return NextResponse.json({
                videoUrl: null,
                imageUrl: creative.thumbnail_url,
                type: "image",
            });
        }

        return NextResponse.json({
            videoUrl: null,
            imageUrl: null,
            type: "none",
        });

    } catch (error: unknown) {
        console.error("Error fetching creative media:", error);
        return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
    }
}
