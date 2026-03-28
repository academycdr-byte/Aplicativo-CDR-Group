"use client";

import { useState } from "react";
import Image from "next/image";
import { VideoModal } from "@/components/ads/video-modal";
import type { TopCreative } from "@/actions/action-plan";

const G = "#BEFF0A";
const MUTED = "#B3B3B3";
const CLASH = '"Clash", "Inter", sans-serif';

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(v);
const fmtN = (v: number, d = 2) =>
  new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  }).format(v);

export function CreativesSection({
  creatives,
}: {
  creatives: TopCreative[];
}) {
  const [selected, setSelected] = useState<TopCreative | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  if (creatives.length === 0) return null;

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {creatives.map((c, i) => (
          <div
            key={i}
            className="plan-glow-card group cursor-pointer"
            onClick={() => {
              setSelected(c);
              setIsOpen(true);
            }}
          >
            <div className="aspect-square relative overflow-hidden rounded-t-[15px]">
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
                    <span
                      className="opacity-0 group-hover:opacity-100 rounded-[200px] px-3.5 py-2 transition-all duration-300 translate-y-2 group-hover:translate-y-0"
                      style={{
                        fontSize: "10px",
                        fontWeight: 700,
                        letterSpacing: "1px",
                        background: `${G}22`,
                        border: `1px solid ${G}44`,
                        color: G,
                      }}
                    >
                      VER CRIATIVO
                    </span>
                  </div>
                </>
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center"
                  style={{ background: "rgba(255,255,255,0.03)" }}
                >
                  <span
                    style={{
                      fontFamily: CLASH,
                      fontSize: "40px",
                      fontWeight: 700,
                      color: `${G}12`,
                    }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
              )}
              <div className="absolute top-2.5 left-2.5">
                <span
                  className="rounded-lg px-2 py-1"
                  style={{
                    fontSize: "10px",
                    fontWeight: 700,
                    fontFamily: CLASH,
                    background: `${G}22`,
                    color: G,
                    backdropFilter: "blur(8px)",
                  }}
                >
                  #{String(i + 1).padStart(2, "0")}
                </span>
              </div>
            </div>
            <div className="p-3.5 space-y-2.5">
              <p
                className="truncate"
                style={{
                  fontSize: "12px",
                  fontWeight: 500,
                  color: `${MUTED}88`,
                }}
              >
                {c.name}
              </p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                <MiniStat label="Gasto" value={fmt(c.spend)} />
                <MiniStat label="Vendas" value={String(c.sales)} />
                <MiniStat label="ROAS" value={`${fmtN(c.roas)}x`} />
                <MiniStat
                  label="Score"
                  value={fmtN(c.score * 100, 0)}
                  accent
                />
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

function MiniStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div>
      <p style={{ fontSize: "9px", color: `${MUTED}44`, letterSpacing: "0.5px", textTransform: "uppercase" as const }}>{label}</p>
      <p
        style={{
          fontSize: "12px",
          fontWeight: 600,
          color: accent ? G : "rgba(255,255,255,0.7)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </p>
    </div>
  );
}
