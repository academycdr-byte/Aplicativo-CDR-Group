export default function OrdersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Pedidos</h2>
        <p className="text-[var(--muted-foreground)] text-sm mt-1">
          Veja todos os pedidos de todas as plataformas conectadas.
        </p>
      </div>

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl">
        {/* Table header */}
        <div className="grid grid-cols-5 gap-4 px-6 py-3 border-b border-[var(--border)] text-sm font-medium text-[var(--muted-foreground)]">
          <span>Pedido</span>
          <span>Cliente</span>
          <span>Plataforma</span>
          <span>Valor</span>
          <span>Status</span>
        </div>

        {/* Empty state */}
        <div className="px-6 py-16 text-center text-[var(--muted-foreground)] text-sm">
          Nenhum pedido encontrado. Conecte suas plataformas para sincronizar
          pedidos.
        </div>
      </div>
    </div>
  );
}
