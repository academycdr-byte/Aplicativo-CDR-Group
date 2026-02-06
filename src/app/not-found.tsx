import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-7xl font-bold text-primary mb-4">404</h1>
        <h2 className="text-2xl font-semibold mb-2">Pagina nao encontrada</h2>
        <p className="text-muted-foreground mb-8">
          A pagina que voce esta procurando nao existe ou foi movida.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Button asChild>
            <Link href="/dashboard">Ir ao Dashboard</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/">Pagina inicial</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
