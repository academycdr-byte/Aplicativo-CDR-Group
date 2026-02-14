export default function IntegrationsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-44 rounded-lg bg-muted" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 rounded-2xl bg-muted p-6">
            <div className="h-12 w-12 shrink-0 rounded-xl bg-muted-foreground/10" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 rounded bg-muted-foreground/10" />
              <div className="h-3 w-48 rounded bg-muted-foreground/10" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
