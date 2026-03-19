
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

        // Step 1: Get ad preview iframe (works with ads_read permission, no Instagram permissions needed)
        // This returns an iframe with the actual creative as it appears to users, including video playback
        const previewData = await fbGet(
            `${adId}/previews?ad_format=MOBILE_FEED_STANDARD`,
            accessToken
        );

        let previewUrl: string | null = null;
        if (previewData?.data?.[0]?.body) {
            // Extract iframe src from the preview HTML
            const iframeMatch = previewData.data[0].body.match(/src="([^"]+)"/);
            if (iframeMatch?.[1]) {
                // Decode HTML entities
                previewUrl = iframeMatch[1].replace(/&amp;/g, "&");
            }
        }

        // Step 2: Get hi-res thumbnail from creative endpoint
        const adData = await fbGet(
            `${adId}?fields=creative{id,thumbnail_url,image_url,video_id}`,
            accessToken
        );

        const creative = adData?.creative;
        let thumbnailUrl = creative?.image_url || creative?.thumbnail_url || null;

        // Get hi-res thumbnail from creative endpoint directly
        if (creative?.id) {
            const creativeData = await fbGet(
                `${creative.id}?fields=thumbnail_url,image_url&thumbnail_width=720&thumbnail_height=720`,
                accessToken
            );
            if (creativeData?.image_url) {
                thumbnailUrl = creativeData.image_url;
            } else if (creativeData?.thumbnail_url) {
                thumbnailUrl = creativeData.thumbnail_url;
            }
        }

        // Step 3: Try to get direct video source (works for ads with video_id on creative)
        let videoUrl: string | null = null;
        const videoId = creative?.video_id;
        if (videoId) {
            const videoData = await fbGet(
                `${videoId}?fields=source,picture`,
                accessToken
            );
            if (videoData?.source) {
                videoUrl = videoData.source;
                // Cache video URL
                await prisma.adMetric.updateMany({
                    where: { adId },
                    data: { videoUrl: videoData.source },
                });
                if (videoData.picture) {
                    thumbnailUrl = videoData.picture;
                }
            }
        }

        // Update thumbnail in DB
        if (thumbnailUrl) {
            await prisma.adMetric.updateMany({
                where: { adId },
                data: { thumbnailUrl },
            });
        }

        return NextResponse.json({
            videoUrl,
            imageUrl: thumbnailUrl,
            previewUrl,
            type: videoUrl ? "video" : previewUrl ? "preview" : thumbnailUrl ? "image" : "none",
        });

    } catch (error: unknown) {
        console.error("Error fetching creative media:", error);
        return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
    }
}
