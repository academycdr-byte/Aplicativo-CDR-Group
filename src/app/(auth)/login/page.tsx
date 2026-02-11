"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { loginUser } from "@/actions/auth";
import { validateLoginForm } from "@/lib/validation";
import { cn } from "@/lib/utils";
import { Loader2, ArrowRight, ShieldCheck, User } from "lucide-react";

export default function LoginPage() {
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [loginType, setLoginType] = useState<"CLIENT" | "ADMIN">("CLIENT");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setFieldErrors({});

    const formData = new FormData(e.currentTarget);
    const email = (formData.get("email") as string).trim();
    const password = formData.get("password") as string;

    const validation = validateLoginForm({ email, password });
    if (!validation.valid) {
      setFieldErrors(validation.errors);
      return;
    }

    setLoading(true);

    // Safety timeout: if login takes too long, stop loading
    const timeout = setTimeout(() => {
      setLoading(false);
      setError("Tempo de conexão esgotado. Tente novamente.");
    }, 15000);

    try {
      const result = await loginUser({ email, password, loginType });
      if (result?.error) {
        setError(result.error);
      }
    } catch {
      // signIn redirects on success
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  }

  return (
    <Card className="w-full border-white/10 bg-white/5 backdrop-blur-2xl shadow-2xl">
      <CardHeader className="text-center space-y-2 pb-6">
        <div className="mx-auto w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center mb-2 ring-1 ring-primary/30 shadow-glow">
          <ShieldCheck className="w-6 h-6 text-primary" />
        </div>
        <CardTitle className="text-2xl font-bold tracking-tight">Bem-vindo de volta</CardTitle>
        <CardDescription className="text-base">
          Acesse sua conta para continuar
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium rounded-xl p-3 text-center animate-in fade-in slide-in-from-top-1">
            {error}
          </div>
        )}

        {/* Segmented Control */}
        <div className="relative p-1 bg-secondary/50 rounded-xl flex">
          <div
            className={cn(
              "absolute top-1 bottom-1 w-[calc(50%-4px)] bg-background rounded-lg shadow-sm transition-all duration-300 ease-apple",
              loginType === "ADMIN" ? "translate-x-[calc(100%+4px)]" : "translate-x-0"
            )}
          />
          <button
            type="button"
            onClick={() => setLoginType("CLIENT")}
            className={cn(
              "flex-1 relative z-10 text-sm font-medium py-2 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2",
              loginType === "CLIENT" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <User className="w-4 h-4" />
            Cliente
          </button>
          <button
            type="button"
            onClick={() => setLoginType("ADMIN")}
            className={cn(
              "flex-1 relative z-10 text-sm font-medium py-2 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2",
              loginType === "ADMIN" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <ShieldCheck className="w-4 h-4" />
            Admin
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="ml-1">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                placeholder="seu@email.com"
                className="h-11 bg-secondary/30 focus:bg-background transition-colors"
              />
              {fieldErrors.email && (
                <p className="text-xs text-destructive font-medium ml-1">{fieldErrors.email}</p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between ml-1">
                <Label htmlFor="password">Senha</Label>
                <Link href="/forgot-password" className="text-xs text-primary hover:text-primary/80 transition-colors">
                  Esqueceu a senha?
                </Link>
              </div>
              <Input
                id="password"
                name="password"
                type="password"
                required
                placeholder="••••••••"
                minLength={6}
                className="h-11 bg-secondary/30 focus:bg-background transition-colors"
              />
              {fieldErrors.password && (
                <p className="text-xs text-destructive font-medium ml-1">{fieldErrors.password}</p>
              )}
            </div>
          </div>

          <Button type="submit" size="lg" className="w-full text-base font-semibold shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all duration-300" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Entrando...
              </>
            ) : (
              <>
                Entrar
                <ArrowRight className="w-5 h-5 ml-2 opacity-50" />
              </>
            )}
          </Button>
        </form>

        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            Não tem uma conta?{" "}
            <Link href="/register" className="text-primary font-semibold hover:text-primary/80 transition-colors">
              Criar conta
            </Link>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
