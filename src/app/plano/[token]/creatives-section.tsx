"use client";

import { useState } from "react";
import Image from "next/image";
import { VideoModal } from "@/components/ads/video-modal";
import type { TopCreative } from "@/actions/action-plan";

const CDR_GREEN = "#c4ff00";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const fmtNum = (v: number, d = 2) =>
  new Intl.NumberFormat("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);

export function CreativesSection({ creatives }: { creatives: TopCreative[] }) {
  const [selected, setSelected] = useState<TopCreative | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  if (creatives.length === 0) return null;

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {creatives.map((c, i) => (
          <div
            key={i}
            className="group rounded-xl overflow-hidden cursor-pointer border border-white/[0.06] bg-white/[0.02] hover:border-[#c4ff00]/30 transition-all duration-300"
            onClick={() => { setSelected(c); setIsOpen(true); }}
          >
            <div className="aspect-square relative overflow-hidden">
              {c.thumbnailUrl ? (
                <>
                  <Image
                    src={c.thumbnailUrl}
                    alt={c.name}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                    unoptimized
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-300 flex items-center justify-center">
                    <span className="opacity-0 group-hover:opacity-100 text-[11px] font-semibold px-3 py-1.5 rounded-full border transition-opacity duration-300" style={{ background: `${CDR_GREEN}20`, borderColor: `${CDR_GREEN}40`, color: CDR_GREEN }}>
                      Ver criativo
                    </span>
                  </div>
                </>
              ) : (
                <div className="w-full h-full bg-white/[0.03] flex items-center justify-center">
                  <span className="text-3xl font-bold text-white/[0.06]">{i + 1}</span>
                </div>
              )}
              <div className="absolute top-2 left-2">
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ background: `${CDR_GREEN}20`, color: CDR_GREEN }}>
                  #{i + 1}
                </span>
              </div>
            </div>

            <div className="p-3 space-y-2">
              <p className="text-[11px] font-medium truncate text-white/50">{c.name}</p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
                <div>
                  <p className="text-white/20">Gasto</p>
                  <p className="font-semibold text-white/70">{fmt(c.spend)}</p>
                </div>
                <div>
                  <p className="text-white/20">Vendas</p>
                  <p className="font-semibold text-white/70">{c.sales}</p>
                </div>
                <div>
                  <p className="text-white/20">ROAS</p>
                  <p className="font-semibold text-white/70">{fmtNum(c.roas)}x</p>
                </div>
                <div>
                  <p className="text-white/20">Score</p>
                  <p className="font-semibold" style={{ color: CDR_GREEN }}>{fmtNum(c.score * 100, 0)}</p>
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
