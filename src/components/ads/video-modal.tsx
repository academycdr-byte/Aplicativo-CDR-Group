"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import Image from "next/image";
import { Play, Loader2, ImageIcon, RefreshCw, Volume2, VolumeX, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState, useRef, useCallback } from "react";

interface Creative {
    adId: string;
    adName: string | null;
    platform: string;
    thumbnailUrl: string | null;
    videoUrl: string | null;
    impressions: number;
    clicks: number;
    spend: number;
    conversions: number;
    revenue: number;
    ctr: number;
    roas: number;
    cpc: number;
    cpm: number;
    campaignName: string | null;
}

interface VideoModalProps {
    isOpen: boolean;
    onClose: () => void;
    creative: Creative | null;
}

type MediaType = "video" | "image" | "preview" | "none" | "loading";

export function VideoModal({ isOpen, onClose, creative }: VideoModalProps) {
    const [mediaType, setMediaType] = useState<MediaType>("loading");
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [videoError, setVideoError] = useState(false);
    const [isMuted, setIsMuted] = useState(true);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const mediaContainerRef = useRef<HTMLDivElement>(null);

    const fetchCreativeMedia = useCallback(async (adId: string, refresh = false) => {
        setIsLoading(true);
        setVideoError(false);
        try {
            const url = `/api/ads/${adId}/video${refresh ? "?refresh=1" : ""}`;
            const res = await fetch(url);
            const data = await res.json();

            if (data.type === "video" && data.videoUrl) {
                setVideoUrl(data.videoUrl);
                setImageUrl(data.imageUrl || null);
                setPreviewUrl(null);
                setMediaType("video");
            } else if (data.type === "preview" && data.previewUrl) {
                setVideoUrl(null);
                setImageUrl(data.imageUrl || null);
                setPreviewUrl(data.previewUrl);
                setMediaType("preview");
            } else if (data.imageUrl) {
                setVideoUrl(null);
                setImageUrl(data.imageUrl);
                setPreviewUrl(data.previewUrl || null);
                setMediaType("image");
            } else {
                setMediaType("none");
            }
        } catch (err) {
            console.error("Failed to fetch creative media:", err);
            setMediaType("none");
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Reset and ALWAYS fetch from API to get high-res media + preview iframe
    // Cached thumbnails from DB are low-res (~130px) and don't include preview iframes
    useEffect(() => {
        if (!isOpen || !creative) return;

        setVideoUrl(null);
        setImageUrl(null);
        setPreviewUrl(null);
        setVideoError(false);
        setIsMuted(true);
        setIsFullscreen(false);

        if (creative.videoUrl) {
            // Show video immediately for fast UX, API will update if URL expired
            setVideoUrl(creative.videoUrl);
            setMediaType("video");
            setIsLoading(false);
        } else {
            // For image/catalog ads: always fetch from API to get preview iframe + high-res
            setMediaType("loading");
            fetchCreativeMedia(creative.adId);
        }
    }, [isOpen, creative, fetchCreativeMedia]);

    const handleVideoError = useCallback(() => {
        if (!creative || videoError) return;
        // Video URL likely expired — force re-fetch
        setVideoError(true);
        fetchCreativeMedia(creative.adId, true);
    }, [creative, videoError, fetchCreativeMedia]);

    const toggleMute = useCallback(() => {
        if (videoRef.current) {
            videoRef.current.muted = !videoRef.current.muted;
            setIsMuted(!isMuted);
        }
    }, [isMuted]);

    const toggleFullscreen = useCallback(() => {
        if (!mediaContainerRef.current) return;
        if (!document.fullscreenElement) {
            mediaContainerRef.current.requestFullscreen().catch(() => {});
            setIsFullscreen(true);
        } else {
            document.exitFullscreen().catch(() => {});
            setIsFullscreen(false);
        }
    }, []);

    // Listen for fullscreen change (user presses Esc)
    useEffect(() => {
        const handler = () => {
            if (!document.fullscreenElement) setIsFullscreen(false);
        };
        document.addEventListener("fullscreenchange", handler);
        return () => document.removeEventListener("fullscreenchange", handler);
    }, []);

    if (!creative) return null;

    function fmt(amount: number) {
        return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);
    }

    function fmtNum(n: number) {
        return new Intl.NumberFormat("pt-BR").format(n);
    }

    const showVideo = mediaType === "video" && videoUrl && !videoError;
    const showPreview = mediaType === "preview" && previewUrl;
    const showImage = !showVideo && !showPreview && !isLoading && (imageUrl || creative.thumbnailUrl);
    const displayImageUrl = imageUrl || creative.thumbnailUrl;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="w-full sm:max-w-2xl md:max-w-5xl h-[95vh] md:h-auto md:max-h-[85vh] p-3 sm:p-4 md:p-6 overflow-y-auto bg-card border-border flex flex-col">
                <DialogHeader>
                    <DialogTitle className="truncate pr-8">{creative.adName || "Detalhes do Criativo"}</DialogTitle>
                    <DialogDescription>
                        {creative.campaignName} &bull; {creative.platform === "FACEBOOK_ADS" ? "Facebook Ads" : creative.platform === "GOOGLE_ADS" ? "Google Ads" : creative.platform}
                    </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 mt-2 h-full">
                    {/* Media Column */}
                    <div className="space-y-3 flex flex-col">
                        <div
                            ref={mediaContainerRef}
                            className="relative w-full h-[35vh] sm:h-[45vh] md:h-[500px] lg:h-[600px] bg-black/90 rounded-lg overflow-hidden flex items-center justify-center border border-border/50 shadow-lg group"
                        >
                            {/* Loading State */}
                            {(isLoading || mediaType === "loading") && (
                                <div className="flex flex-col items-center gap-3 text-muted-foreground">
                                    <Loader2 className="w-10 h-10 animate-spin text-primary/60" />
                                    <span className="text-sm">Carregando criativo...</span>
                                </div>
                            )}

                            {/* Video Player */}
                            {showVideo && (
                                <>
                                    <video
                                        ref={videoRef}
                                        key={videoUrl}
                                        src={videoUrl!}
                                        controls
                                        autoPlay
                                        loop
                                        muted={isMuted}
                                        className="w-full h-full object-contain"
                                        poster={creative.thumbnailUrl || undefined}
                                        playsInline
                                        onError={handleVideoError}
                                    >
                                        Seu navegador não suporta reprodução de vídeo.
                                    </video>

                                    {/* Video Controls Overlay */}
                                    <div className="absolute bottom-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); toggleMute(); }}
                                            className="w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center backdrop-blur-sm hover:bg-black/80 transition-colors"
                                            aria-label={isMuted ? "Ativar som" : "Silenciar"}
                                        >
                                            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
                                            className="w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center backdrop-blur-sm hover:bg-black/80 transition-colors"
                                            aria-label="Tela cheia"
                                        >
                                            <Maximize2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </>
                            )}

                            {/* Video Error + Re-fetch */}
                            {videoError && isLoading && (
                                <div className="flex flex-col items-center gap-3 text-muted-foreground">
                                    <Loader2 className="w-10 h-10 animate-spin text-primary/60" />
                                    <span className="text-sm">Recarregando vídeo...</span>
                                </div>
                            )}

                            {/* Ad Preview (Facebook iframe — shows exact creative with video playback) */}
                            {showPreview && (
                                <iframe
                                    src={previewUrl!}
                                    className="w-full h-full border-0"
                                    title="Pré-visualização do criativo"
                                    allow="autoplay"
                                    sandbox="allow-scripts allow-same-origin allow-popups"
                                />
                            )}

                            {/* Image Display */}
                            {showImage && !isLoading && displayImageUrl && (
                                <>
                                    <Image
                                        src={displayImageUrl}
                                        alt={creative.adName || "Criativo"}
                                        fill
                                        className="object-contain"
                                        unoptimized
                                        sizes="(max-width: 768px) 100vw, 50vw"
                                    />
                                    {/* Fullscreen button for images */}
                                    <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
                                            className="w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center backdrop-blur-sm hover:bg-black/80 transition-colors"
                                            aria-label="Tela cheia"
                                        >
                                            <Maximize2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </>
                            )}

                            {/* No Media Available */}
                            {mediaType === "none" && !isLoading && !displayImageUrl && (
                                <div className="flex flex-col items-center gap-3 text-muted-foreground">
                                    <ImageIcon className="w-12 h-12 opacity-30" />
                                    <span className="text-sm">Visualização não disponível</span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => fetchCreativeMedia(creative.adId, true)}
                                        className="gap-2"
                                    >
                                        <RefreshCw className="w-3.5 h-3.5" />
                                        Tentar novamente
                                    </Button>
                                </div>
                            )}
                        </div>

                        {/* Media Type Indicator */}
                        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                            {showVideo && (
                                <>
                                    <Play className="w-3.5 h-3.5" />
                                    <span>Vídeo &bull; Clique no player para controlar</span>
                                </>
                            )}
                            {showPreview && (
                                <>
                                    <Play className="w-3.5 h-3.5" />
                                    <span>Pré-visualização do criativo &bull; Interaja diretamente</span>
                                </>
                            )}
                            {showImage && !isLoading && (
                                <>
                                    <ImageIcon className="w-3.5 h-3.5" />
                                    <span>Imagem &bull; Passe o mouse para ampliar</span>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Metrics Column */}
                    <div className="space-y-6">
                        {/* Primary Metrics */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 rounded-lg bg-muted/20 border border-muted/50">
                                <p className="text-sm text-muted-foreground mb-1">ROAS</p>
                                <p className={`text-2xl font-bold ${creative.roas >= 3 ? "text-success" : creative.roas >= 1 ? "text-warning" : "text-destructive"}`}>
                                    {creative.roas.toFixed(2)}x
                                </p>
                            </div>
                            <div className="p-4 rounded-lg bg-muted/20 border border-muted/50">
                                <p className="text-sm text-muted-foreground mb-1">Gasto</p>
                                <p className="text-2xl font-bold text-foreground">
                                    {fmt(creative.spend)}
                                </p>
                            </div>
                        </div>

                        <Separator />

                        {/* Detailed Metrics */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-4 sm:gap-y-6 gap-x-2">
                            <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider">Receita</p>
                                <p className="font-semibold mt-1">{fmt(creative.revenue)}</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider">Conversões</p>
                                <p className="font-semibold mt-1">{fmtNum(creative.conversions)}</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider">CPA</p>
                                <p className="font-semibold mt-1">{creative.conversions > 0 ? fmt(creative.spend / creative.conversions) : "-"}</p>
                            </div>

                            <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider">Impressões</p>
                                <p className="font-semibold mt-1">{fmtNum(creative.impressions)}</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider">Cliques</p>
                                <p className="font-semibold mt-1">{fmtNum(creative.clicks)}</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider">CTR</p>
                                <p className="font-semibold mt-1">{creative.ctr.toFixed(2)}%</p>
                            </div>

                            <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider">CPC</p>
                                <p className="font-semibold mt-1">{creative.cpc > 0 ? fmt(creative.cpc) : "-"}</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider">CPM</p>
                                <p className="font-semibold mt-1">{creative.cpm > 0 ? fmt(creative.cpm) : "-"}</p>
                            </div>
                        </div>

                        {/* Status Badge */}
                        <div className="pt-2">
                            <Badge
                                variant={creative.roas >= 3 ? "default" : creative.roas >= 1 ? "secondary" : "destructive"}
                                className="text-xs"
                            >
                                {creative.roas >= 3 ? "Validado" : creative.roas >= 1 ? "Testando" : "Negativo"}
                            </Badge>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
