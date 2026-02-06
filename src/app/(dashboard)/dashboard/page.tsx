import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Receita Total" value="R$ 0,00" change="+0%" />
        <KPICard title="Pedidos" value="0" change="+0%" />
        <KPICard title="Gasto com Ads" value="R$ 0,00" change="+0%" />
        <KPICard title="ROAS" value="0.0x" change="+0%" />
      </div>

      {/* Charts placeholder */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Receita ao longo do tempo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
              Conecte uma plataforma para ver os dados
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pedidos por plataforma</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
              Conecte uma plataforma para ver os dados
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent orders placeholder */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pedidos recentes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
            Nenhum pedido ainda. Conecte suas plataformas em{" "}
            <Link href="/integrations" className="text-primary ml-1 hover:underline">
              Integracoes
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function KPICard({
  title,
  value,
  change,
}: {
  title: string;
  value: string;
  change: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="text-2xl font-bold mt-1">{value}</p>
        <p className="text-xs text-success mt-1">{change}</p>
      </CardContent>
    </Card>
  );
}
