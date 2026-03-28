"use client";

/**
 * CDR Group — Hero visual effects for public plan page
 * Matches cdrgroup.com.br hero: aurora gradient mesh + circuit grid pattern
 */

export function GradientMesh() {
  return (
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none"
      aria-hidden="true"
    >
      {/* Aurora blobs — bigger and more vivid than before */}
      <div
        className="absolute rounded-full"
        style={{
          width: "1100px",
          height: "1100px",
          top: "-350px",
          right: "-250px",
          background: "rgba(190, 255, 10, 0.28)",
          filter: "blur(150px)",
          animation: "plan-drift-1 16s ease-in-out infinite",
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          width: "800px",
          height: "800px",
          top: "0",
          right: "250px",
          background: "rgba(190, 255, 10, 0.15)",
          filter: "blur(130px)",
          animation: "plan-drift-2 20s ease-in-out infinite",
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          width: "650px",
          height: "650px",
          top: "-120px",
          left: "5%",
          background: "rgba(190, 255, 10, 0.10)",
          filter: "blur(120px)",
          animation: "plan-drift-3 22s ease-in-out infinite",
        }}
      />
      {/* Bottom green glow band — fades smoothly into content */}
      <div
        className="absolute"
        style={{
          width: "100%",
          height: "60%",
          bottom: "0",
          left: "0",
          background:
            "linear-gradient(to top, rgba(190, 255, 10, 0.06) 0%, rgba(190, 255, 10, 0.10) 30%, transparent 100%)",
          animation: "plan-glow-pulse 6s ease-in-out infinite",
        }}
      />
      {/* Bottom black fade — smooth bridge to content below */}
      <div
        className="absolute"
        style={{
          width: "100%",
          height: "200px",
          bottom: "0",
          left: "0",
          background:
            "linear-gradient(to top, rgba(0, 0, 0, 0.8) 0%, rgba(0, 0, 0, 0.3) 50%, transparent 100%)",
        }}
      />
      {/* Circuit grid pattern overlay */}
      <div className="plan-grid-overlay" />
    </div>
  );
}

export function SectionGlow({
  position = "center",
  intensity = 0.04,
}: {
  position?: "center" | "left" | "right" | "bottom-left";
  intensity?: number;
}) {
  const posMap = {
    center: "center",
    left: "20% 50%",
    right: "80% 50%",
    "bottom-left": "20% 80%",
  };
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      aria-hidden="true"
      style={{
        background: `radial-gradient(ellipse at ${posMap[position]}, rgba(190, 255, 10, ${intensity}) 0%, transparent 70%)`,
      }}
    />
  );
}
