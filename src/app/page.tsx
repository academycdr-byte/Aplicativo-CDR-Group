import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart3, Link2, ShoppingBag, TrendingUp, Megaphone, Shield } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-bold text-sm">
            CDR
          </div>
          <span className="font-semibold text-lg">CDR Group</span>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" asChild>
            <Link href="/login">Entrar</Link>
          </Button>
          <Button asChild>
            <Link href="/register">Criar conta</Link>
          </Button>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1">
        <section className="flex items-center justify-center px-6 py-20 md:py-32">
          <div className="max-w-3xl text-center">
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
              Todas as suas plataformas em um{" "}
              <span className="text-primary">unico lugar</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Conecte Shopify, Nuvemshop, Cartpanda, Yampi, Facebook Ads, Google
              Ads e Reportana. Veja todos os seus dados unificados em um dashboard
              simples e poderoso.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Button size="lg" asChild>
                <Link href="/register">Comece agora gratis</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/login">Ja tenho conta</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="px-6 py-16 bg-muted/30">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">
              Tudo que voce precisa para gerenciar suas vendas
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <FeatureCard
                icon={Link2}
                title="7 Plataformas"
                description="Conecte Shopify, Cartpanda, Yampi, Nuvemshop, Facebook Ads, Google Ads e Reportana em minutos."
              />
              <FeatureCard
                icon={BarChart3}
                title="Dashboard Unificado"
                description="Veja receita, pedidos, gastos com anuncios e ROAS em um unico painel com graficos interativos."
              />
              <FeatureCard
                icon={ShoppingBag}
                title="Pedidos Centralizados"
                description="Todos os pedidos de todas as lojas em uma unica tabela com filtros e paginacao."
              />
              <FeatureCard
                icon={Megaphone}
                title="Metricas de Ads"
                description="Acompanhe impressoes, cliques, gastos, conversoes e ROAS do Facebook e Google Ads."
              />
              <FeatureCard
                icon={TrendingUp}
                title="Analytics de Vendas"
                description="Graficos de receita ao longo do tempo, vendas por plataforma e analise por status."
              />
              <FeatureCard
                icon={Shield}
                title="Seguro e Criptografado"
                description="Seus tokens e credenciais sao criptografados com AES-256-GCM. Seus dados estao seguros."
              />
            </div>
          </div>
        </section>

        {/* Platforms */}
        <section className="px-6 py-16">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl font-bold mb-8">Plataformas suportadas</h2>
            <div className="flex items-center justify-center gap-6 md:gap-10 flex-wrap">
              {[
                { name: "Shopify", color: "#96BF48" },
                { name: "Nuvemshop", color: "#2B35AF" },
                { name: "Cartpanda", color: "#FF6B35" },
                { name: "Yampi", color: "#7C3AED" },
                { name: "Facebook Ads", color: "#1877F2" },
                { name: "Google Ads", color: "#4285F4" },
                { name: "Reportana", color: "#E91E63" },
              ].map((p) => (
                <div key={p.name} className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs"
                    style={{ backgroundColor: p.color }}
                  >
                    {p.name.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium">{p.name}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="px-6 py-16 bg-primary text-primary-foreground">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">
              Pronto para centralizar seus dados?
            </h2>
            <p className="text-primary-foreground/80 mb-8">
              Crie sua conta gratuitamente e conecte suas plataformas em minutos.
            </p>
            <Button size="lg" variant="secondary" asChild>
              <Link href="/register">Criar conta gratis</Link>
            </Button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t px-6 py-6 text-center text-sm text-muted-foreground">
        &copy; {new Date().getFullYear()} CDR Group. Todos os direitos reservados.
      </footer>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <h3 className="font-semibold mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}
