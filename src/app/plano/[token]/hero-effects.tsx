"use client";

// Stripe-style animated gradient mesh blobs — CDR green palette
// Pure CSS blobs with heavy blur creating organic flowing gradients

export function GradientMesh() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {/* Primary large blob — top right */}
      <div
        className="absolute rounded-full"
        style={{
          width: "800px",
          height: "800px",
          top: "-150px",
          right: "-100px",
          background: "rgba(196, 255, 0, 0.25)",
          filter: "blur(120px)",
          animation: "plan-drift-1 16s ease-in-out infinite",
        }}
      />
      {/* Secondary blob — center right */}
      <div
        className="absolute rounded-full"
        style={{
          width: "600px",
          height: "600px",
          top: "100px",
          right: "150px",
          background: "rgba(74, 222, 128, 0.15)",
          filter: "blur(100px)",
          animation: "plan-drift-2 20s ease-in-out infinite",
        }}
      />
      {/* Accent blob — top center */}
      <div
        className="absolute rounded-full"
        style={{
          width: "500px",
          height: "500px",
          top: "-100px",
          right: "400px",
          background: "rgba(163, 230, 53, 0.12)",
          filter: "blur(110px)",
          animation: "plan-drift-3 22s ease-in-out infinite",
        }}
      />
      {/* Small accent — bottom glow */}
      <div
        className="absolute rounded-full"
        style={{
          width: "1200px",
          height: "400px",
          bottom: "-100px",
          left: "50%",
          transform: "translateX(-50%)",
          background: "rgba(196, 255, 0, 0.08)",
          filter: "blur(80px)",
          animation: "plan-glow-pulse 6s ease-in-out infinite",
        }}
      />
    </div>
  );
}
