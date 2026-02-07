
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

        // 1. Fetch creative ID from Ad ID
        const adResponse = await fetch(
            `https://graph.facebook.com/${FB_GRAPH_VERSION}/${adId}?fields=creative{id,video_id,object_story_spec{video_data{video_id}}}&access_token=${accessToken}`
        );

        if (!adResponse.ok) {
            const error = await adResponse.text();
            console.error("Facebook Ad fetch error:", error);
            return NextResponse.json({ error: "Failed to fetch ad details" }, { status: adResponse.status });
        }

        const adData = await adResponse.json();
        const creative = adData.creative;
        let videoId = creative?.video_id || creative?.object_story_spec?.video_data?.video_id;

        // If no video ID found directly, try fetches for object_story_id if available (not implemented here for brevity, assuming direct video or video data)

        if (!videoId) {
            return NextResponse.json({ error: "No video found for this ad" }, { status: 404 });
        }

        // 2. Fetch Video Source
        const videoResponse = await fetch(
            `https://graph.facebook.com/${FB_GRAPH_VERSION}/${videoId}?fields=source&access_token=${accessToken}`
        );

        if (!videoResponse.ok) {
            return NextResponse.json({ error: "Failed to fetch video source" }, { status: videoResponse.status });
        }

        const videoData = await videoResponse.json();

        // Update database asynchronously to cache it for next time
        if (videoData.source) {
            await prisma.adMetric.updateMany({
                where: { adId: adId },
                data: { videoUrl: videoData.source }
            });
        }

        return NextResponse.json({ videoUrl: videoData.source });

    } catch (error: any) {
        console.error("Error fetching video:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
