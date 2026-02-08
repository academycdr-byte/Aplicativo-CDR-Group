"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { registerUser } from "@/actions/auth";
import { validateRegisterForm } from "@/lib/validation";
import { Loader2, ArrowRight, UserPlus } from "lucide-react";

export default function RegisterPage() {
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setFieldErrors({});

    const formData = new FormData(e.currentTarget);
    const name = (formData.get("name") as string).trim();
    const email = (formData.get("email") as string).trim();
    const password = formData.get("password") as string;

    // Note: The previous validation function name in the file was validateRegisterForm
    // but in login it was validateLoginForm. I'll stick to what was there or updated.
    // The previous file content showed validateRegisterForm.

    const validation = validateRegisterForm({ name, email, password });
    if (!validation.valid) {
      setFieldErrors(validation.errors);
      return;
    }

    setLoading(true);

    try {
      const result = await registerUser({ name, email, password });
      if (result?.error) {
        setError(result.error);
      }
    } catch {
      // Automatic redirect on success in server action
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full border-white/10 bg-white/5 backdrop-blur-2xl shadow-2xl">
      <CardHeader className="text-center space-y-2 pb-6">
        <div className="mx-auto w-12 h-12 rounded-2xl bg-secondary/30 flex items-center justify-center mb-2 ring-1 ring-white/10 shadow-glow">
          <UserPlus className="w-6 h-6 text-foreground" />
        </div>
        <CardTitle className="text-2xl font-bold tracking-tight">Crie sua conta</CardTitle>
        <CardDescription className="text-base">
          Comece agora mesmo a monitorar suas campanhas
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium rounded-xl p-3 text-center animate-in fade-in slide-in-from-top-1">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="ml-1">Nome completo</Label>
              <Input
                id="name"
                name="name"
                type="text"
                required
                placeholder="Seu nome"
                maxLength={255}
                className="h-11 bg-secondary/30 focus:bg-background transition-colors"
              />
              {fieldErrors.name && (
                <p className="text-xs text-destructive font-medium ml-1">{fieldErrors.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="ml-1">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                placeholder="seu@email.com"
                maxLength={255}
                className="h-11 bg-secondary/30 focus:bg-background transition-colors"
              />
              {fieldErrors.email && (
                <p className="text-xs text-destructive font-medium ml-1">{fieldErrors.email}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="ml-1">Senha</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                placeholder="••••••••"
                minLength={6}
                maxLength={128}
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
                Criando conta...
              </>
            ) : (
              <>
                Criar conta
                <ArrowRight className="w-5 h-5 ml-2 opacity-50" />
              </>
            )}
          </Button>
        </form>

        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            Já tem uma conta?{" "}
            <Link href="/login" className="text-primary font-semibold hover:text-primary/80 transition-colors">
              Entrar
            </Link>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
