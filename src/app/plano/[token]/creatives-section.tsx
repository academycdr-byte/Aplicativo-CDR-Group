"use client";

import { useState } from "react";
import Image from "next/image";
import { VideoModal } from "@/components/ads/video-modal";
import type { TopCreative } from "@/actions/action-plan";

const P = "#BEE000";
const BG = "#000000";
const BORDER = "#1A1A1A";
const MUTED = "#B3B3B3";

const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const fmtN = (v: number, d = 2) => new Intl.NumberFormat("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);

export function CreativesSection({ creatives }: { creatives: TopCreative[] }) {
  const [selected, setSelected] = useState<TopCreative | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  if (creatives.length === 0) return null;

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {creatives.map((c, i) => (
          <div
            key={i}
            className="group rounded-[10px] overflow-hidden cursor-pointer transition-all"
            style={{ border: `1px solid ${BORDER}66`, background: "rgba(255,255,255,0.08)", backdropFilter: "blur(12px) saturate(150%)" }}
            onClick={() => { setSelected(c); setIsOpen(true); }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${P}44`; e.currentTarget.style.transform = "translateY(-2px)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = `${BORDER}66`; e.currentTarget.style.transform = "translateY(0)"; }}
          >
            <div className="aspect-square relative overflow-hidden">
              {c.thumbnailUrl ? (
                <>
                  <Image src={c.thumbnailUrl} alt={c.name} fill className="object-cover group-hover:scale-105 transition-transform duration-300" unoptimized />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                    <span className="opacity-0 group-hover:opacity-100 rounded-[200px] px-3 py-1.5 transition-opacity" style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.5px", background: `${P}22`, border: `1px solid ${P}44`, color: P }}>
                      VER CRIATIVO
                    </span>
                  </div>
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center" style={{ background: `${BORDER}44` }}>
                  <span style={{ fontSize: "32px", fontWeight: 700, color: `${MUTED}15` }}>{i + 1}</span>
                </div>
              )}
              <div className="absolute top-2 left-2">
                <span className="rounded-[8px] px-1.5 py-0.5" style={{ fontSize: "10px", fontWeight: 700, background: `${P}22`, color: P }}>#{i + 1}</span>
              </div>
            </div>
            <div className="p-3 space-y-2">
              <p className="truncate" style={{ fontSize: "12px", fontWeight: 500, color: `${MUTED}99` }}>{c.name}</p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                <div><p style={{ fontSize: "10px", color: `${MUTED}44` }}>Gasto</p><p style={{ fontSize: "12px", fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>{fmt(c.spend)}</p></div>
                <div><p style={{ fontSize: "10px", color: `${MUTED}44` }}>Vendas</p><p style={{ fontSize: "12px", fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>{c.sales}</p></div>
                <div><p style={{ fontSize: "10px", color: `${MUTED}44` }}>ROAS</p><p style={{ fontSize: "12px", fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>{fmtN(c.roas)}x</p></div>
                <div><p style={{ fontSize: "10px", color: `${MUTED}44` }}>Score</p><p style={{ fontSize: "12px", fontWeight: 600, color: P }}>{fmtN(c.score * 100, 0)}</p></div>
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
            adId: selected.adId, adName: selected.name, platform: "FACEBOOK_ADS",
            thumbnailUrl: selected.thumbnailUrl, videoUrl: selected.videoUrl,
            impressions: 0, clicks: 0, spend: selected.spend,
            conversions: selected.sales, revenue: selected.spend * selected.roas,
            ctr: 0, roas: selected.roas, cpc: 0, cpm: 0, campaignName: null,
          }}
        />
      )}
    </>
  );
}
