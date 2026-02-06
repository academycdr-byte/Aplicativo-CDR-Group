"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getProfile, updateProfile, updatePassword } from "@/actions/profile";

export default function ProfilePage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [profileMsg, setProfileMsg] = useState("");
  const [passwordMsg, setPasswordMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingPwd, setLoadingPwd] = useState(false);

  useEffect(() => {
    getProfile().then((user) => {
      if (user) {
        setName(user.name || "");
        setEmail(user.email);
      }
    });
  }, []);

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    setProfileMsg("");
    setLoading(true);
    const result = await updateProfile({ name, email });
    if (result.error) {
      setProfileMsg(result.error);
    } else {
      setProfileMsg("Perfil atualizado com sucesso!");
    }
    setLoading(false);
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPasswordMsg("");
    if (newPassword.length < 6) {
      setPasswordMsg("A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }
    setLoadingPwd(true);
    const result = await updatePassword({ currentPassword, newPassword });
    if (result.error) {
      setPasswordMsg(result.error);
    } else {
      setPasswordMsg("Senha atualizada com sucesso!");
      setCurrentPassword("");
      setNewPassword("");
    }
    setLoadingPwd(false);
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-xl font-bold">Meu Perfil</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Gerencie suas informacoes pessoais.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informacoes pessoais</CardTitle>
          <CardDescription>Atualize seu nome e email.</CardDescription>
        </CardHeader>
        <CardContent>
          {profileMsg && (
            <div className={`text-sm rounded-lg p-3 mb-4 ${profileMsg.includes("sucesso") ? "bg-green-500/10 border border-green-500/20 text-green-700" : "bg-destructive/10 border border-destructive/20 text-destructive"}`}>
              {profileMsg}
            </div>
          )}
          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
              />
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Salvar alteracoes"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Alterar senha</CardTitle>
          <CardDescription>Atualize sua senha de acesso.</CardDescription>
        </CardHeader>
        <CardContent>
          {passwordMsg && (
            <div className={`text-sm rounded-lg p-3 mb-4 ${passwordMsg.includes("sucesso") ? "bg-green-500/10 border border-green-500/20 text-green-700" : "bg-destructive/10 border border-destructive/20 text-destructive"}`}>
              {passwordMsg}
            </div>
          )}
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Senha atual</Label>
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">Nova senha</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
                placeholder="Minimo 6 caracteres"
              />
            </div>
            <Button type="submit" disabled={loadingPwd}>
              {loadingPwd ? "Alterando..." : "Alterar senha"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
