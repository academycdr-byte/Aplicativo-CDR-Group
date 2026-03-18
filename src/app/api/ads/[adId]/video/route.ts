
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

        // Step 1: Fetch ad with extended creative fields + object_story_id
        // Use thumbnail_width/height to get hi-res thumbnail (default is 64x64)
        const adData = await fbGet(
            `${adId}?fields=creative{id,video_id,image_url,thumbnail_url,effective_object_story_id,object_story_id,object_story_spec{video_data{video_id},link_data{picture,image_hash}}}&thumbnail_width=720&thumbnail_height=720`,
            accessToken
        );

        const isDebug = request.nextUrl.searchParams.get("debug") === "1";

        if (!adData?.creative) {
            return NextResponse.json({ videoUrl: null, imageUrl: null, type: "none", ...(isDebug ? { debug: { adData } } : {}) });
        }

        const creative = adData.creative;
        const creativeId = creative.id;

        // Step 1b: If no video_id from above, try fetching creative directly with more fields
        let videoId: string | null =
            creative.video_id ||
            creative.object_story_spec?.video_data?.video_id ||
            null;

        // Step 1c: Fetch creative directly with hi-res thumbnail (720px)
        if (creativeId) {
            const creativeData = await fbGet(
                `${creativeId}?fields=video_id,object_story_id,effective_object_story_id,image_url,thumbnail_url&thumbnail_width=720&thumbnail_height=720`,
                accessToken
            );
            if (creativeData?.video_id) {
                videoId = creativeData.video_id;
            }
            // Pick up missing fields + override thumbnail with hi-res version
            if (!creative.effective_object_story_id && creativeData?.effective_object_story_id) {
                creative.effective_object_story_id = creativeData.effective_object_story_id;
            }
            if (!creative.image_url && creativeData?.image_url) {
                creative.image_url = creativeData.image_url;
            }
            // Always prefer the hi-res thumbnail from creative endpoint
            if (creativeData?.thumbnail_url) {
                creative.thumbnail_url = creativeData.thumbnail_url;
            }
        }

        // Step 3: If no direct video_id, try effective_object_story_id (post-based creatives)
        if (!videoId && creative.effective_object_story_id) {
            const storyId = creative.effective_object_story_id;
            // Extract page ID from story ID format: {page_id}_{post_id}
            const pageId = storyId.split("_")[0];

            // 3-KEY: Get Page Token — required for reading post content (video source)
            // User Token can manage ads but Page Token is needed for pages_read_engagement
            let pageToken = accessToken; // fallback to user token
            let pageTokenObtained = false;
            if (pageId) {
                const pageData = await fbGet(
                    `${pageId}?fields=access_token`,
                    accessToken
                );
                if (pageData?.access_token) {
                    pageToken = pageData.access_token;
                    pageTokenObtained = true;
                }
            }

            // 3a: Fetch the post with Page Token — video posts have 'source' at top level
            // Use raw fetch to capture error details
            let storyData = null;
            let storyError = null;
            const storyUrl = `https://graph.facebook.com/${FB_GRAPH_VERSION}/${storyId}?fields=source,type,full_picture,object_id,attachments{media{source,image{src,width,height}},type,subattachments{media{source,image{src}},type}}&access_token=${pageToken}`;
            try {
                const storyRes = await fetch(storyUrl);
                if (storyRes.ok) {
                    storyData = await storyRes.json();
                } else {
                    storyError = await storyRes.text();
                }
            } catch (e) {
                storyError = e instanceof Error ? e.message : "fetch exception";
            }

            // 3a-alt: If story fetch failed, try just the post_id without page prefix
            if (!storyData) {
                const postId = storyId.split("_").slice(1).join("_");
                if (postId) {
                    const altData = await fbGet(
                        `${postId}?fields=source,type,full_picture,object_id`,
                        pageToken
                    );
                    if (altData) storyData = altData;
                }
            }

            // DEBUG: Return diagnostic info if debug mode
            if (isDebug && !storyData?.source && !videoId) {
                // Also try IG media API directly for debug
                const igPostId = storyId.split("_").pop();
                const igRes = igPostId ? await fbGet(`${igPostId}?fields=media_url,media_type,thumbnail_url`, pageToken) : null;

                return NextResponse.json({
                    videoUrl: null,
                    imageUrl: creative.thumbnail_url || null,
                    type: "image",
                    debug: {
                        pageId,
                        pageTokenObtained,
                        storyId,
                        storyFetched: !!storyData,
                        storyError: storyError ? storyError.substring(0, 300) : null,
                        storySource: storyData?.source || null,
                        storyType: storyData?.type || null,
                        storyObjectId: storyData?.object_id || null,
                        igMediaTest: igRes ? { media_type: igRes.media_type, has_media_url: !!igRes.media_url } : "ig_fetch_failed",
                    }
                });
            }

            // 3a-extra: If story has object_id, it might be the video ID
            if (storyData?.object_id && !storyData?.source) {
                const objVideo = await fbGet(
                    `${storyData.object_id}?fields=source,picture`,
                    pageToken
                );
                if (objVideo?.source) {
                    await prisma.adMetric.updateMany({
                        where: { adId },
                        data: { videoUrl: objVideo.source },
                    });
                    const poster = objVideo.picture || storyData.full_picture;
                    if (poster) {
                        await prisma.adMetric.updateMany({
                            where: { adId },
                            data: { thumbnailUrl: poster },
                        });
                    }
                    return NextResponse.json({
                        videoUrl: objVideo.source,
                        imageUrl: poster || null,
                        type: "video",
                    });
                }
            }

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
                        pageToken
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

                // 3e: Try Instagram Media API (for Instagram-placed ads)
                // Instagram media can be fetched via /{ig_media_id}?fields=media_url,media_type
                const igMediaId = storyId.split("_").pop();
                if (igMediaId) {
                    const igMedia = await fbGet(
                        `${igMediaId}?fields=media_url,media_type,thumbnail_url`,
                        pageToken
                    );
                    if (igMedia?.media_url) {
                        if (igMedia.media_type === "VIDEO") {
                            await prisma.adMetric.updateMany({
                                where: { adId },
                                data: { videoUrl: igMedia.media_url },
                            });
                            const poster = igMedia.thumbnail_url || storyData?.full_picture;
                            if (poster) {
                                await prisma.adMetric.updateMany({
                                    where: { adId },
                                    data: { thumbnailUrl: poster },
                                });
                            }
                            return NextResponse.json({
                                videoUrl: igMedia.media_url,
                                imageUrl: poster || null,
                                type: "video",
                            });
                        } else {
                            // It's an image — use the media_url (full res)
                            await prisma.adMetric.updateMany({
                                where: { adId },
                                data: { thumbnailUrl: igMedia.media_url },
                            });
                            return NextResponse.json({
                                videoUrl: null,
                                imageUrl: igMedia.media_url,
                                type: "image",
                            });
                        }
                    }
                }

                // 3f: Fallback to full_picture (high-res image, better than thumbnail_url)
                if (storyData?.full_picture) {
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
        // Priority: image_url (full-res) > link_data.picture > thumbnail_url (now 720px via API params)
        const imageUrl =
            creative.image_url ||
            creative.object_story_spec?.link_data?.picture ||
            null;

        if (imageUrl) {
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

        // Step 5b: Try fetching ad with adcreatives edge for video_id (different permission path)
        if (!videoId) {
            const adVideoDirect = await fbGet(
                `${adId}?fields=creative.fields(video_id)`,
                accessToken
            );
            if (adVideoDirect?.creative?.video_id) {
                const vData = await fbGet(
                    `${adVideoDirect.creative.video_id}?fields=source,picture`,
                    accessToken
                );
                if (vData?.source) {
                    await prisma.adMetric.updateMany({
                        where: { adId },
                        data: { videoUrl: vData.source },
                    });
                    if (vData.picture) {
                        await prisma.adMetric.updateMany({
                            where: { adId },
                            data: { thumbnailUrl: vData.picture },
                        });
                    }
                    return NextResponse.json({
                        videoUrl: vData.source,
                        imageUrl: vData.picture || null,
                        type: "video",
                    });
                }
            }
        }

        // Last resort: thumbnail_url (now returned at 720px thanks to thumbnail_width param)
        if (creative.thumbnail_url) {
            await prisma.adMetric.updateMany({
                where: { adId },
                data: { thumbnailUrl: creative.thumbnail_url },
            });

            return NextResponse.json({
                videoUrl: null,
                imageUrl: creative.thumbnail_url,
                type: "image",
                ...(isDebug ? { debug: { creative: { id: creativeId, video_id: creative.video_id || null, effective_object_story_id: creative.effective_object_story_id || null, has_image_url: !!creative.image_url }, note: "Video source requires pages_read_engagement permission for Instagram posts" } } : {}),
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
