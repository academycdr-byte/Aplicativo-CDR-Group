
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import { auth } from "@/auth";

const FB_GRAPH_VERSION = "v21.0";

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

        // Fetch creative details from Ad ID
        const adResponse = await fetch(
            `https://graph.facebook.com/${FB_GRAPH_VERSION}/${adId}?fields=creative{id,video_id,thumbnail_url,image_url,object_story_spec{video_data{video_id},link_data{image_hash,picture}}}&access_token=${accessToken}`
        );

        if (!adResponse.ok) {
            const error = await adResponse.text();
            console.error("Facebook Ad fetch error:", error);
            return NextResponse.json({ error: "Failed to fetch ad details" }, { status: adResponse.status });
        }

        const adData = await adResponse.json();
        const creative = adData.creative;
        const videoId = creative?.video_id || creative?.object_story_spec?.video_data?.video_id;

        // Try to get video source
        if (videoId) {
            const videoResponse = await fetch(
                `https://graph.facebook.com/${FB_GRAPH_VERSION}/${videoId}?fields=source&access_token=${accessToken}`
            );

            if (videoResponse.ok) {
                const videoData = await videoResponse.json();
                if (videoData.source) {
                    // Cache video URL
                    await prisma.adMetric.updateMany({
                        where: { adId },
                        data: { videoUrl: videoData.source },
                    });

                    return NextResponse.json({
                        videoUrl: videoData.source,
                        imageUrl: null,
                        type: "video",
                    });
                }
            }
        }

        // No video found — try to get full creative image
        const imageUrl =
            creative?.image_url ||
            creative?.thumbnail_url ||
            creative?.object_story_spec?.link_data?.picture ||
            null;

        if (imageUrl) {
            return NextResponse.json({
                videoUrl: null,
                imageUrl,
                type: "image",
            });
        }

        // Nothing found
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
