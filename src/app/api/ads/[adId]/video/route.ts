
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

// In-memory cache for preview URLs (they expire after ~1h from Meta)
// Key: adId, Value: { data, timestamp }
const previewCache = new Map<string, { data: { videoUrl: string | null; imageUrl: string | null; previewUrl: string | null; type: string }; timestamp: number }>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

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

        const isRefresh = request.nextUrl.searchParams.get("refresh") === "1";

        // Check in-memory cache first (instant response for repeat opens)
        if (!isRefresh) {
            const cached = previewCache.get(adId);
            if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
                return NextResponse.json(cached.data, {
                    headers: { "X-Cache": "HIT" },
                });
            }
        }

        // Check DB cache: if we already have thumbnailUrl and/or videoUrl, return immediately
        // while still fetching previewUrl in parallel (which is the slowest call)
        if (!isRefresh) {
            const dbMetric = await prisma.adMetric.findFirst({
                where: { adId, thumbnailUrl: { not: null } },
                select: { thumbnailUrl: true, videoUrl: true },
                orderBy: { date: "desc" },
            });

            if (dbMetric?.thumbnailUrl) {
                const videoUrl = dbMetric.videoUrl || null;
                const imageUrl = dbMetric.thumbnailUrl;
                const type = videoUrl ? "video" : imageUrl ? "image" : "none";

                const result = { videoUrl, imageUrl, previewUrl: null as string | null, type };

                // Cache the DB result
                previewCache.set(adId, { data: result, timestamp: Date.now() });

                return NextResponse.json(result, {
                    headers: { "X-Cache": "DB" },
                });
            }
        }

        // No cache — fetch from Meta API
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

        // PARALLEL: Fire all independent requests at once
        // - Preview iframe (for video/carousel ads)
        // - Ad creative data (thumbnail, video_id)
        const [previewData, adData] = await Promise.all([
            fbGet(`${adId}/previews?ad_format=MOBILE_FEED_STANDARD`, accessToken),
            fbGet(`${adId}?fields=creative{id,thumbnail_url,image_url,video_id}`, accessToken),
        ]);

        // Extract preview URL from iframe HTML
        let previewUrl: string | null = null;
        if (previewData?.data?.[0]?.body) {
            const iframeMatch = previewData.data[0].body.match(/src="([^"]+)"/);
            if (iframeMatch?.[1]) {
                previewUrl = iframeMatch[1].replace(/&amp;/g, "&");
            }
        }

        const creative = adData?.creative;
        let thumbnailUrl = creative?.image_url || creative?.thumbnail_url || null;

        // PARALLEL: Fetch hi-res thumbnail + video source at the same time
        // (both depend on creative data from above, but are independent of each other)
        const creativeId = creative?.id;
        const videoId = creative?.video_id;

        const [creativeData, videoData] = await Promise.all([
            creativeId
                ? fbGet(`${creativeId}?fields=thumbnail_url,image_url&thumbnail_width=720&thumbnail_height=720`, accessToken)
                : Promise.resolve(null),
            videoId
                ? fbGet(`${videoId}?fields=source,picture`, accessToken)
                : Promise.resolve(null),
        ]);

        // Process hi-res thumbnail
        if (creativeData?.image_url) {
            thumbnailUrl = creativeData.image_url;
        } else if (creativeData?.thumbnail_url) {
            thumbnailUrl = creativeData.thumbnail_url;
        }

        // Process video source
        let videoUrl: string | null = null;
        if (videoData?.source) {
            videoUrl = videoData.source;
            if (videoData.picture) {
                thumbnailUrl = videoData.picture;
            }
        }

        // Cache to DB in background (non-blocking)
        const dbUpdates: Promise<unknown>[] = [];
        if (videoUrl) {
            dbUpdates.push(
                prisma.adMetric.updateMany({
                    where: { adId },
                    data: { videoUrl, ...(thumbnailUrl ? { thumbnailUrl } : {}) },
                })
            );
        } else if (thumbnailUrl) {
            dbUpdates.push(
                prisma.adMetric.updateMany({
                    where: { adId },
                    data: { thumbnailUrl },
                })
            );
        }
        // Fire and forget — don't block the response
        if (dbUpdates.length > 0) {
            Promise.all(dbUpdates).catch(() => { /* non-fatal */ });
        }

        const result = {
            videoUrl,
            imageUrl: thumbnailUrl,
            previewUrl,
            type: videoUrl ? "video" : previewUrl ? "preview" : thumbnailUrl ? "image" : "none",
        };

        // Cache the full result in memory
        previewCache.set(adId, { data: result, timestamp: Date.now() });

        return NextResponse.json(result, {
            headers: { "X-Cache": "MISS" },
        });

    } catch (error: unknown) {
        console.error("Error fetching creative media:", error);
        return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
    }
}
