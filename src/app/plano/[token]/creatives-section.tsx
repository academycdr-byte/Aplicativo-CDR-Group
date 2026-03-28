"use client";

import { useState } from "react";
import Image from "next/image";
import { VideoModal } from "@/components/ads/video-modal";
import type { TopCreative } from "@/actions/action-plan";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(v);

const fmtNum = (v: number, decimals = 2) =>
  new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(v);

export function CreativesSection({ creatives }: { creatives: TopCreative[] }) {
  const [selected, setSelected] = useState<TopCreative | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  if (creatives.length === 0) return null;

  return (
    <>
      <div className="grid md:grid-cols-5 gap-4">
        {creatives.map((c, i) => (
          <div
            key={i}
            className="rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-sm overflow-hidden cursor-pointer hover:border-primary/40 transition-colors"
            onClick={() => {
              setSelected(c);
              setIsOpen(true);
            }}
          >
            {c.thumbnailUrl ? (
              <div className="aspect-square relative">
                <Image
                  src={c.thumbnailUrl}
                  alt={c.name}
                  fill
                  className="object-cover"
                  unoptimized
                />
                <div className="absolute top-2 left-2">
                  <span className="px-2 py-1 rounded-lg bg-black/60 text-xs font-bold backdrop-blur-sm">
                    #{i + 1}
                  </span>
                </div>
                <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-colors flex items-center justify-center">
                  <span className="opacity-0 hover:opacity-100 text-white text-xs font-medium bg-black/60 px-3 py-1.5 rounded-lg backdrop-blur-sm transition-opacity">
                    Ver criativo
                  </span>
                </div>
              </div>
            ) : (
              <div className="aspect-square bg-white/5 flex items-center justify-center">
                <span className="text-4xl font-bold text-white/10">
                  {i + 1}
                </span>
              </div>
            )}
            <div className="p-4 space-y-2">
              <p className="text-xs font-medium truncate text-white/70">
                {c.name}
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-white/40">Gasto</p>
                  <p className="font-semibold">{fmt(c.spend)}</p>
                </div>
                <div>
                  <p className="text-white/40">Vendas</p>
                  <p className="font-semibold">{c.sales}</p>
                </div>
                <div>
                  <p className="text-white/40">ROAS</p>
                  <p className="font-semibold">{fmtNum(c.roas)}x</p>
                </div>
                <div>
                  <p className="text-white/40">Score</p>
                  <p className="font-semibold text-primary">
                    {fmtNum(c.score * 100, 0)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {isOpen && selected && (
        <VideoModal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          creative={{
            adId: selected.adId,
            adName: selected.name,
            platform: "FACEBOOK_ADS",
            thumbnailUrl: selected.thumbnailUrl,
            videoUrl: selected.videoUrl,
            impressions: 0,
            clicks: 0,
            spend: selected.spend,
            conversions: selected.sales,
            revenue: selected.spend * selected.roas,
            ctr: 0,
            roas: selected.roas,
            cpc: 0,
            cpm: 0,
            campaignName: null,
          }}
        />
      )}
    </>
  );
}
