import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import { auth } from "@/auth";

export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" });

        const integration = await prisma.integration.findFirst({
            where: { platform: "FACEBOOK_ADS", status: "CONNECTED" },
        });

        if (!integration || !integration.accessToken) {
            return NextResponse.json({ error: "No Facebook integration found" });
        }

        const accessToken = decrypt(integration.accessToken);
        const adAccountId = integration.externalAccountId;

        // 1. Fetch recent ad IDs
        const insightsUrl = `https://graph.facebook.com/v21.0/act_${adAccountId}/insights?level=ad&date_preset=last_30d&limit=10&access_token=${accessToken}`;
        const insightsRes = await fetch(insightsUrl);
        const insightsData = await insightsRes.json();

        const adIds = insightsData.data?.map((i: any) => i.ad_id) || [];

        // 2. Try fetching video data for these ads
        const debugVideos: any = {};
        if (adIds.length > 0) {
            const ids = adIds.join(",");

            // Test query A: video_id
            const resA = await fetch(`https://graph.facebook.com/v21.0/?ids=${ids}&fields=creative{video_id,object_story_spec{video_data{video_id}}}&access_token=${accessToken}`);
            debugVideos.step1_creative = await resA.json();

            // Extract video IDs
            const videoIds = [];
            for (const [adId, data] of Object.entries(debugVideos.step1_creative)) {
                const creative = (data as any).creative;
                if (creative?.video_id) videoIds.push(creative.video_id);
                if (creative?.object_story_spec?.video_data?.video_id) videoIds.push(creative.object_story_spec.video_data.video_id);
            }

            // Test query B: source
            if (videoIds.length > 0) {
                const uniqueVideoIds = [...new Set(videoIds)];
                const resB = await fetch(`https://graph.facebook.com/v21.0/?ids=${uniqueVideoIds.join(",")}&fields=source&access_token=${accessToken}`);
                debugVideos.step2_source = await resB.json();
            }
        }

        // 3. Check DB state
        const dbSample = await prisma.adMetric.findMany({
            where: { platform: "FACEBOOK_ADS" },
            orderBy: { date: "desc" },
            take: 5,
            select: { adId: true, videoUrl: true, thumbnailUrl: true }
        });

        return NextResponse.json({
            adAccountId,
            adIds,
            debugVideos,
            dbSample
        });

    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message, stack: error.stack });
    }
}
