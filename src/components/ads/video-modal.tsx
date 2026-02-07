"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import Image from "next/image";
import { Play, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

// Re-using the Creative type structure roughly, or defining a props interface
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

export function VideoModal({ isOpen, onClose, creative }: VideoModalProps) {
    if (!creative) return null;

    // Since we don't have the actual video URL in the API response yet (usually requires a separate field or Graph API call), 
    // we will simulate the behavior or use the thumbnailUrl if it happens to be a video (rare).
    // FOR NOW: We will assume specific logic or fallback to an external link if we can't play it directly.
    // Real implementation often requires fetching the `video_id` -> `source` from Meta Graph API.
    // Given current data structure, we might only have thumbnail.
    // We will display the thumbnail large with a "Play" button that might link out OR just show the image if it's an image.

    // Checking if likely video from context is hard without specific field, but user requested "Play" icon overlay logic in parent.
    // Here we display the content.

    function fmt(amount: number) {
        return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);
    }

    function fmtNum(n: number) {
        return new Intl.NumberFormat("pt-BR").format(n);
    }

    const isVideo = false; // We don't have a reliable 'isVideo' flag yet from the backend transformation.
    // However, the prompt implies "If video cannot be loaded, show fallback".
    // We will try to show the thumbnail as the "media" for now.

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-card border-border">
                <DialogHeader>
                    <DialogTitle className="truncate pr-8">{creative.adName || "Detalhes do Criativo"}</DialogTitle>
                    <DialogDescription>
                        {creative.campaignName} • {creative.platform}
                    </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
                    {/* Media Column */}
                    <div className="space-y-4">
                        <div className="relative aspect-video w-full bg-black/50 rounded-lg overflow-hidden flex items-center justify-center border border-border/50">
                            {creative.videoUrl ? (
                                // Video player with controls
                                <video
                                    src={creative.videoUrl}
                                    controls
                                    autoPlay
                                    loop
                                    muted
                                    className="w-full h-full object-contain"
                                    poster={creative.thumbnailUrl || undefined}
                                    playsInline
                                >
                                    Seu navegador não suporta reprodução de vídeo.
                                </video>
                            ) : creative.thumbnailUrl ? (
                                <Image
                                    src={creative.thumbnailUrl}
                                    alt={creative.adName || "Creative"}
                                    fill
                                    className="object-contain"
                                    unoptimized
                                />
                            ) : (
                                <div className="text-muted-foreground p-10 text-center">
                                    Sem visualização disponivel
                                </div>
                            )}
                        </div>

                        {creative.videoUrl && (
                            <p className="text-xs text-muted-foreground text-center">
                                🎬 Clique no player acima para controlar o video
                            </p>
                        )}

                        <div className="flex flex-col items-center gap-2">
                            <Button variant="outline" className="gap-2" asChild>
                                <a
                                    href={`https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=BR&q=${encodeURIComponent(creative.adName || creative.adId)}`}
                                    target="_blank"
                                    rel="noreferrer"
                                >
                                    <ExternalLink className="w-4 h-4" />
                                    Buscar na Biblioteca de Anuncios
                                </a>
                            </Button>
                            <p className="text-xs text-muted-foreground text-center">
                                Nota: Resultados dependem do status do anuncio no Meta
                            </p>
                        </div>
                    </div>

                    {/* Metrics Column */}
                    <div className="space-y-6">
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

                        <div className="grid grid-cols-3 gap-y-6 gap-x-2">
                            <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider">Receita</p>
                                <p className="font-semibold mt-1">{fmt(creative.revenue)}</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider">Conversoes</p>
                                <p className="font-semibold mt-1">{fmtNum(creative.conversions)}</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider">CPA</p>
                                <p className="font-semibold mt-1">{creative.conversions > 0 ? fmt(creative.spend / creative.conversions) : "-"}</p>
                            </div>

                            <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider">Impressoes</p>
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
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
