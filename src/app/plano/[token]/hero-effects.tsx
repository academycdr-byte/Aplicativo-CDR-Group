"use client";

/**
 * CDR Group — Hero visual effects for public plan page
 * Aurora gradient + floating particles + shimmer scan + stagger entrance
 */

export function GradientMesh() {
  return (
    <div
      className="absolute pointer-events-none"
      aria-hidden="true"
      style={{
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

      {/* Floating particles — small green dots */}
      {[...Array(8)].map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            width: `${3 + (i % 3) * 2}px`,
            height: `${3 + (i % 3) * 2}px`,
            top: `${10 + i * 10}%`,
            left: `${8 + i * 11}%`,
            background: `rgba(190, 255, 10, ${0.15 + (i % 3) * 0.1})`,
            boxShadow: `0 0 ${6 + i * 2}px rgba(190, 255, 10, 0.2)`,
            animation: `plan-float-${(i % 3) + 1} ${8 + i * 2}s ease-in-out infinite`,
            animationDelay: `${i * 0.7}s`,
          }}
        />
      ))}

      {/* Shimmer scan line — sweeps across every 8s */}
      <div className="plan-shimmer-scan" />

      {/* Natural bottom fade */}
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
