"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Auth error:", error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="max-w-md w-full text-center space-y-4 p-6">
        <AlertTriangle className="w-12 h-12 text-destructive mx-auto" />
        <h2 className="text-lg font-semibold">Erro de autenticacao</h2>
        <p className="text-sm text-muted-foreground">
          Ocorreu um erro inesperado. Tente novamente.
        </p>
        <Button onClick={reset}>Tentar novamente</Button>
      </div>
    </div>
  );
}
