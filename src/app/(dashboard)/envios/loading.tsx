export default function EnviosLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-8 w-32 rounded-lg bg-muted" />
        <div className="h-10 w-28 rounded-lg bg-muted" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 rounded-[20px] bg-muted" />
        ))}
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
