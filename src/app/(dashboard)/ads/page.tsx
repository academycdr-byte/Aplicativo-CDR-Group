export default function AdsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Anuncios</h2>
        <p className="text-[var(--muted-foreground)] text-sm mt-1">
          Acompanhe o desempenho dos seus anuncios no Facebook e Google.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
          <p className="text-sm text-[var(--muted-foreground)]">Gasto Total</p>
          <p className="text-2xl font-bold mt-1">R$ 0,00</p>
        </div>
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
          <p className="text-sm text-[var(--muted-foreground)]">Impressoes</p>
          <p className="text-2xl font-bold mt-1">0</p>
        </div>
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
          <p className="text-sm text-[var(--muted-foreground)]">Cliques</p>
          <p className="text-2xl font-bold mt-1">0</p>
        </div>
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
          <p className="text-sm text-[var(--muted-foreground)]">ROAS</p>
          <p className="text-2xl font-bold mt-1">0.0x</p>
        </div>
      </div>

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
        <div className="h-64 flex items-center justify-center text-[var(--muted-foreground)] text-sm">
          Conecte Facebook Ads ou Google Ads para ver as metricas.
        </div>
      </div>
    </div>
  );
}
