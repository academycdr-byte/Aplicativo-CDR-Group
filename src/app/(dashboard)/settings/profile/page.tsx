"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { getProfile, updateProfile, changePassword } from "@/actions/auth";

export default function ProfilePage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [profileMsg, setProfileMsg] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    const profile = await getProfile();
    if (profile) {
      setName(profile.name || "");
      setEmail(profile.email);
    }
  }

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    setProfileMsg("");
    setProfileLoading(true);

    const result = await updateProfile({ name, email });
    if (result.error) {
      setProfileMsg(result.error);
    } else {
      toast.success("Perfil atualizado com sucesso!");
    }
    setProfileLoading(false);
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPasswordMsg("");

    if (newPassword !== confirmPassword) {
      setPasswordMsg("As senhas nao coincidem.");
      return;
    }

    if (newPassword.length < 6) {
      setPasswordMsg("A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }

    setPasswordLoading(true);

    const result = await changePassword({
      currentPassword,
      newPassword,
    });

    if (result.error) {
      setPasswordMsg(result.error);
    } else {
      toast.success("Senha alterada com sucesso!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
    setPasswordLoading(false);
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-xl font-bold">Meu Perfil</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Gerencie suas informacoes pessoais e senha.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informacoes pessoais</CardTitle>
          <CardDescription>Atualize seu nome e email.</CardDescription>
        </CardHeader>
        <CardContent>
          {profileMsg && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg p-3 mb-4">
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
                required
                minLength={2}
                maxLength={100}
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
                required
                maxLength={255}
              />
            </div>
            <Button type="submit" disabled={profileLoading}>
              {profileLoading ? "Salvando..." : "Salvar"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Alterar senha</CardTitle>
          <CardDescription>
            Para sua seguranca, informe a senha atual antes de definir uma nova.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {passwordMsg && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg p-3 mb-4">
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
                placeholder="Sua senha atual"
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
                placeholder="Minimo 6 caracteres"
                required
                minLength={6}
                maxLength={128}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a nova senha"
                required
                minLength={6}
                maxLength={128}
              />
            </div>
            <Button type="submit" disabled={passwordLoading}>
              {passwordLoading ? "Alterando..." : "Alterar senha"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
