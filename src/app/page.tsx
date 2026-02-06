import Link from "next/link";
import { Button } from "@/components/ui/button";

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
      <main className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-2xl text-center">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
            Todas as suas plataformas em um{" "}
            <span className="text-primary">unico lugar</span>
          </h1>
          <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
            Conecte Shopify, Nuvemshop, Cartpanda, Yampi, Facebook Ads, Google
            Ads e Reportana. Veja todos os seus dados unificados em um dashboard
            simples e poderoso.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Button size="lg" asChild>
              <Link href="/register">Comece agora</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/login">Ja tenho conta</Link>
            </Button>
          </div>

          {/* Platform logos */}
          <div className="mt-16 flex items-center justify-center gap-8 flex-wrap text-muted-foreground text-sm">
            <span>Shopify</span>
            <span>Nuvemshop</span>
            <span>Cartpanda</span>
            <span>Yampi</span>
            <span>Facebook Ads</span>
            <span>Google Ads</span>
            <span>Reportana</span>
          </div>
        </div>
      </main>
    </div>
  );
}
