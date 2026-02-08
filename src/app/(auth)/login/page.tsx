"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { loginUser } from "@/actions/auth";
import { validateLoginForm } from "@/lib/validation";

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

    try {
      const result = await loginUser({ email, password });
      if (result?.error) {
        setError(result.error);
      }
    } catch {
      // signIn redirects on success, which throws a NEXT_REDIRECT error
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="flex justify-center mb-4">
        </div>
        <CardTitle className="text-2xl">Entrar</CardTitle>
        <CardDescription>Acesse o painel da CDR Group</CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg p-3 mb-4">
            {error}
          </div>
        )}

        <div className="flex bg-muted p-1 rounded-lg mb-6">
          <button
            type="button"
            onClick={() => setLoginType("CLIENT")}
            className={`flex-1 text-sm font-medium py-2 rounded-md transition-all ${loginType === "CLIENT"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
              }`}
          >
            Sou Cliente
          </button>
          <button
            type="button"
            onClick={() => setLoginType("ADMIN")}
            className={`flex-1 text-sm font-medium py-2 rounded-md transition-all ${loginType === "ADMIN"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
              }`}
          >
            Sou Administrador
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              placeholder="seu@email.com"
              maxLength={255}
            />
            {fieldErrors.email && (
              <p className="text-xs text-destructive">{fieldErrors.email}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              placeholder="Sua senha"
              minLength={6}
              maxLength={128}
            />
            {fieldErrors.password && (
              <p className="text-xs text-destructive">{fieldErrors.password}</p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Nao tem conta?{" "}
          <Link href="/register" className="text-primary font-medium hover:underline">
            Criar conta
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
