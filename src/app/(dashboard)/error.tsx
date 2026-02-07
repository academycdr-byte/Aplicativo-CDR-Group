"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6 text-center space-y-4">
          <AlertTriangle className="w-12 h-12 text-destructive mx-auto" />
          <h2 className="text-lg font-semibold">Algo deu errado</h2>
          <p className="text-sm text-muted-foreground">
            Ocorreu um erro inesperado. Tente novamente ou entre em contato com
            o suporte se o problema persistir.
          </p>
          <Button onClick={reset}>Tentar novamente</Button>
        </CardContent>
      </Card>
    </div>
  );
}
