export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Relatorios</h2>
        <p className="text-[var(--muted-foreground)] text-sm mt-1">
          Visualize relatorios e dados do Reportana.
        </p>
      </div>

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
        <div className="h-64 flex items-center justify-center text-[var(--muted-foreground)] text-sm">
          Conecte o Reportana para ver seus relatorios aqui.
        </div>
      </div>
    </div>
  );
}
