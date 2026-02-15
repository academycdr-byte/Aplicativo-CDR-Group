import { Card } from "@/components/ui/card";

export default function DREPerformanceLoading() {
  return (
    <div className="space-y-5 sm:space-y-6 animate-in fade-in duration-300">
      {/* Header skeleton */}
      <div className="space-y-2">
        <div className="h-7 w-48 bg-muted/40 rounded animate-pulse" />
        <div className="h-4 w-80 bg-muted/40 rounded animate-pulse" />
      </div>

      {/* Input panel skeleton */}
      <Card className="border border-border shadow-none rounded-lg p-5 sm:p-6">
        <div className="space-y-5 animate-pulse">
          <div className="h-5 w-32 bg-muted/40 rounded" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 w-24 bg-muted/40 rounded" />
                <div className="h-11 bg-muted/40 rounded" />
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* KPI grid skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="border border-border shadow-none rounded-lg p-3 sm:p-5">
            <div className="animate-pulse space-y-3">
              <div className="h-3 w-16 bg-muted/40 rounded" />
              <div className="h-7 w-24 bg-muted/40 rounded" />
            </div>
          </Card>
        ))}
      </div>

      {/* Charts skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[1, 2].map((i) => (
          <Card key={i} className="border border-border shadow-none rounded-lg p-5 sm:p-6">
            <div className="animate-pulse">
              <div className="h-4 w-40 bg-muted/40 rounded mb-4" />
              <div className="h-64 bg-muted/40 rounded" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
