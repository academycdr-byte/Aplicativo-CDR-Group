"use client";

/**
 * CDR Group — Hero visual effects for public plan page
 * Aurora gradient that bleeds naturally into the content below
 * No hard cuts — the gradient extends 150% of the header height
 */

export function GradientMesh() {
  return (
    <div
      className="absolute pointer-events-none"
      aria-hidden="true"
      style={{
        /* Extend 60% beyond the header boundary so it covers the first section */
        top: 0,
        left: 0,
        right: 0,
        bottom: "-60%",
        overflow: "hidden",
      }}
    >
      {/* Aurora blobs */}
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
      {/* Natural bottom fade — aurora dissolves gradually */}
      <div
        className="absolute"
        style={{
          width: "100%",
          height: "50%",
          bottom: "0",
          left: "0",
          background:
            "linear-gradient(to top, rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 0.6) 40%, transparent 100%)",
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
