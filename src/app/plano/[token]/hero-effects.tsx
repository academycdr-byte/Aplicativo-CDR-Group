"use client";

// CDR Brand gradient mesh — exact colors from cdrgroup.com.br
// Primary: #BEE000 (hsl 73 100% 50%)

export function GradientMesh() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <div className="absolute rounded-full" style={{ width: "800px", height: "800px", top: "-200px", right: "-150px", background: "rgba(190, 224, 0, 0.22)", filter: "blur(120px)", animation: "plan-drift-1 16s ease-in-out infinite" }} />
      <div className="absolute rounded-full" style={{ width: "600px", height: "600px", top: "50px", right: "200px", background: "rgba(190, 224, 0, 0.12)", filter: "blur(100px)", animation: "plan-drift-2 20s ease-in-out infinite" }} />
      <div className="absolute rounded-full" style={{ width: "500px", height: "500px", top: "-80px", left: "10%", background: "rgba(190, 224, 0, 0.08)", filter: "blur(110px)", animation: "plan-drift-3 22s ease-in-out infinite" }} />
      {/* Bottom glow — like CDR homepage */}
      <div className="absolute" style={{ width: "100%", height: "300px", bottom: "0", left: "0", background: "linear-gradient(to top, rgba(190, 224, 0, 0.06), transparent)", animation: "plan-glow-pulse 6s ease-in-out infinite" }} />
    </div>
  );
}
