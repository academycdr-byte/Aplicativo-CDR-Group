const platforms = [
  {
    name: "Shopify",
    description: "Conecte sua loja Shopify para sincronizar pedidos e produtos.",
    status: "disconnected" as const,
    authType: "OAuth",
    color: "#96BF48",
  },
  {
    name: "Nuvemshop",
    description: "Conecte sua Nuvemshop para sincronizar pedidos e produtos.",
    status: "disconnected" as const,
    authType: "OAuth",
    color: "#2B35AF",
  },
  {
    name: "Cartpanda",
    description: "Conecte sua Cartpanda usando sua API Key.",
    status: "disconnected" as const,
    authType: "API Key",
    color: "#FF6B35",
  },
  {
    name: "Yampi",
    description: "Conecte sua Yampi usando suas credenciais de API.",
    status: "disconnected" as const,
    authType: "API Key",
    color: "#7C3AED",
  },
  {
    name: "Facebook Ads",
    description: "Conecte sua conta de anuncios do Facebook/Meta.",
    status: "disconnected" as const,
    authType: "OAuth",
    color: "#1877F2",
  },
  {
    name: "Google Ads",
    description: "Conecte sua conta do Google Ads.",
    status: "disconnected" as const,
    authType: "OAuth",
    color: "#4285F4",
  },
  {
    name: "Reportana",
    description: "Conecte o Reportana usando sua API Key.",
    status: "disconnected" as const,
    authType: "API Key",
    color: "#E91E63",
  },
];

export default function IntegrationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Plataformas</h2>
        <p className="text-[var(--muted-foreground)] text-sm mt-1">
          Conecte suas plataformas para centralizar os dados no dashboard.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {platforms.map((platform) => (
          <div
            key={platform.name}
            className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 flex flex-col"
          >
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-xs"
                style={{ backgroundColor: platform.color }}
              >
                {platform.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h3 className="font-semibold">{platform.name}</h3>
                <span className="text-xs text-[var(--muted-foreground)]">
                  {platform.authType}
                </span>
              </div>
            </div>

            <p className="text-sm text-[var(--muted-foreground)] mb-4 flex-1">
              {platform.description}
            </p>

            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs">
                <span className="w-2 h-2 rounded-full bg-[var(--muted-foreground)]" />
                Desconectado
              </span>
              <button className="px-4 py-2 text-sm font-medium bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors">
                Conectar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
