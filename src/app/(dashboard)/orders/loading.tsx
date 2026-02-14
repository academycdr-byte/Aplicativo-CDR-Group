export default function OrdersLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-8 w-32 rounded-lg bg-muted" />
        <div className="flex gap-2">
          <div className="h-10 w-28 rounded-lg bg-muted" />
          <div className="h-10 w-20 rounded-lg bg-muted" />
        </div>
      </div>
      <div className="rounded-2xl bg-muted">
        <div className="h-12 border-b border-muted-foreground/5" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-14 border-b border-muted-foreground/5" />
        ))}
      </div>
    </div>
  );
}
