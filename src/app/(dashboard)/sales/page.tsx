export default function SalesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Vendas</h2>
        <p className="text-[var(--muted-foreground)] text-sm mt-1">
          Analise suas vendas em todas as plataformas.
        </p>
      </div>

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
        <div className="h-64 flex items-center justify-center text-[var(--muted-foreground)] text-sm">
          Conecte suas plataformas para ver os dados de vendas.
        </div>
      </div>
    </div>
  );
}
