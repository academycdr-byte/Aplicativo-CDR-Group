"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Camera, Trash2, Loader2 } from "lucide-react";
import { getProfile, updateProfile, changePassword } from "@/actions/auth";
import { useAvatar } from "@/contexts/avatar-context";

export default function ProfilePage() {
  const { data: session, update: updateSession } = useSession();
  const { setAvatarUrl } = useAvatar();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [profileMsg, setProfileMsg] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  const [avatarLoading, setAvatarLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    const profile = await getProfile();
    if (profile) {
      setName(profile.name || "");
      setEmail(profile.email);
      setImage(profile.image || null);
    }
  }

  async function handleAvatarUpload(file: File) {
    setAvatarLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload/avatar", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Erro ao enviar foto");
        return;
      }

      setImage(data.image);
      setAvatarUrl(data.image);
      toast.success("Foto de perfil atualizada!");
    } catch {
      toast.error("Erro ao enviar foto");
    } finally {
      setAvatarLoading(false);
    }
  }

  async function handleAvatarRemove() {
    setAvatarLoading(true);
    try {
      const res = await fetch("/api/upload/avatar", { method: "DELETE" });
      if (!res.ok) {
        toast.error("Erro ao remover foto");
        return;
      }

      setImage(null);
      setAvatarUrl(null);
      toast.success("Foto removida!");
    } catch {
      toast.error("Erro ao remover foto");
    } finally {
      setAvatarLoading(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Formato inválido. Use JPG, PNG ou WebP.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo: 2MB.");
      return;
    }

    handleAvatarUpload(file);
    e.target.value = "";
  }

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    setProfileMsg("");
    setProfileLoading(true);

    const result = await updateProfile({ name, email });
    if (result.error) {
      setProfileMsg(result.error);
    } else {
      await updateSession({ name: name.trim() });
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
    <div className="space-y-6 max-w-2xl animate-in fade-in duration-500">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Meu Perfil</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Gerencie suas informacoes pessoais e senha.
        </p>
      </div>

      {/* Avatar Upload Card */}
      <Card>
        <CardHeader>
          <CardTitle>Foto de perfil</CardTitle>
          <CardDescription>
            Sua foto aparece no menu e na barra lateral.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
            <div className="relative">
              <Avatar className="h-24 w-24 border-2 border-border">
                <AvatarImage src={image || ""} />
                <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">
                  {name?.charAt(0)?.toUpperCase() || session?.user?.name?.charAt(0)?.toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              {avatarLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/60 rounded-full">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={avatarLoading}
                >
                  <Camera className="w-4 h-4 mr-2" />
                  Alterar foto
                </Button>
                {image && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleAvatarRemove}
                    disabled={avatarLoading}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Remover
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Recomendado: 200x200px. Formatos: JPG, PNG, WebP. Max: 2MB.
              </p>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            className="hidden"
          />
        </CardContent>
      </Card>

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
