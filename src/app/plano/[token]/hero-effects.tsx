"use client";

// Stripe-inspired animated gradient mesh blobs
// Uses CSS classes defined in globals.css for the animation
// Client component because it wraps interactive content (scroll indicator)

export function GradientMesh() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <div className="plan-blob plan-blob-1" />
      <div className="plan-blob plan-blob-2" />
      <div className="plan-blob plan-blob-3" />
      <div className="plan-blob plan-blob-4" />
    </div>
  );
}
