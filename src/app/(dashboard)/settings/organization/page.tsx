"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserPlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  getOrganization,
  updateOrganization,
  getMembers,
  inviteMember,
  updateMemberRole,
  removeMember,
} from "@/actions/organization";

type Member = {
  id: string;
  role: string;
  userId: string;
  name: string | null;
  email: string;
  joinedAt: Date;
};

const roleLabels: Record<string, string> = {
  OWNER: "Proprietario",
  ADMIN: "Administrador",
  MEMBER: "Membro",
  CLIENT: "Cliente",
};

const roleBadgeVariant: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  OWNER: "default",
  ADMIN: "secondary",
  MEMBER: "outline",
  CLIENT: "outline",
};

export default function OrganizationPage() {
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [orgRole, setOrgRole] = useState("");
  const [orgMsg, setOrgMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const [members, setMembers] = useState<Member[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("MEMBER");
  const [inviteMsg, setInviteMsg] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const org = await getOrganization();
    if (org) {
      setOrgName(org.name);
      setOrgSlug(org.slug);
      setOrgRole(org.role);
    }
    const membersList = await getMembers();
    setMembers(membersList);
  }

  async function handleOrgSubmit(e: React.FormEvent) {
    e.preventDefault();
    setOrgMsg("");
    setLoading(true);
    const result = await updateOrganization({ name: orgName, slug: orgSlug });
    if (result.error) {
      setOrgMsg(result.error);
    } else {
      setOrgMsg("Organizacao atualizada com sucesso!");
    }
    setLoading(false);
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteMsg("");
    setInviteLoading(true);
    const result = await inviteMember({
      email: inviteEmail,
      role: inviteRole as "ADMIN" | "MEMBER" | "CLIENT",
    });
    if (result.error) {
      setInviteMsg(result.error);
    } else {
      setInviteMsg("Membro adicionado com sucesso!");
      setInviteEmail("");
      loadData();
    }
    setInviteLoading(false);
  }

  async function handleRoleChange(membershipId: string, newRole: string) {
    const result = await updateMemberRole({
      membershipId,
      role: newRole as "ADMIN" | "MEMBER" | "CLIENT",
    });
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Funcao atualizada!");
      loadData();
    }
  }

  async function handleRemoveMember(membershipId: string) {
    if (!confirm("Tem certeza que deseja remover este membro?")) return;
    const result = await removeMember(membershipId);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Membro removido.");
      loadData();
    }
  }

  const isOwnerOrAdmin = orgRole === "OWNER" || orgRole === "ADMIN";

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-xl font-bold">Organizacao</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Gerencie sua organizacao e equipe.
        </p>
      </div>

      {/* Organization Info */}
      <Card>
        <CardHeader>
          <CardTitle>Dados da organizacao</CardTitle>
          <CardDescription>Nome e identificador da sua organizacao.</CardDescription>
        </CardHeader>
        <CardContent>
          {orgMsg && (
            <div className={`text-sm rounded-lg p-3 mb-4 ${orgMsg.includes("sucesso") ? "bg-green-500/10 border border-green-500/20 text-green-700" : "bg-destructive/10 border border-destructive/20 text-destructive"}`}>
              {orgMsg}
            </div>
          )}
          <form onSubmit={handleOrgSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="orgName">Nome da organizacao</Label>
              <Input
                id="orgName"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                disabled={!isOwnerOrAdmin}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="orgSlug">Slug (identificador unico)</Label>
              <Input
                id="orgSlug"
                value={orgSlug}
                onChange={(e) => setOrgSlug(e.target.value)}
                disabled={!isOwnerOrAdmin}
              />
              <p className="text-xs text-muted-foreground">
                Usado na URL. Apenas letras minusculas, numeros e hifens.
              </p>
            </div>
            {isOwnerOrAdmin && (
              <Button type="submit" disabled={loading}>
                {loading ? "Salvando..." : "Salvar"}
              </Button>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Members */}
      <Card>
        <CardHeader>
          <CardTitle>Membros da equipe</CardTitle>
          <CardDescription>
            Gerencie quem tem acesso a esta organizacao.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Invite form */}
          {isOwnerOrAdmin && (
            <div className="border rounded-lg p-4">
              {inviteMsg && (
                <div className={`text-sm rounded-lg p-3 mb-4 ${inviteMsg.includes("sucesso") ? "bg-green-500/10 border border-green-500/20 text-green-700" : "bg-destructive/10 border border-destructive/20 text-destructive"}`}>
                  {inviteMsg}
                </div>
              )}
              <form onSubmit={handleInvite} className="flex gap-3 items-end flex-wrap">
                <div className="flex-1 min-w-[200px] space-y-2">
                  <Label htmlFor="inviteEmail">Email do usuario</Label>
                  <Input
                    id="inviteEmail"
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="email@exemplo.com"
                    required
                  />
                </div>
                <div className="w-40 space-y-2">
                  <Label>Funcao</Label>
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ADMIN">Administrador</SelectItem>
                      <SelectItem value="MEMBER">Membro</SelectItem>
                      <SelectItem value="CLIENT">Cliente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" disabled={inviteLoading}>
                  <UserPlus className="w-4 h-4 mr-2" />
                  {inviteLoading ? "Adicionando..." : "Adicionar"}
                </Button>
              </form>
            </div>
          )}

          {/* Members table */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Funcao</TableHead>
                {isOwnerOrAdmin && <TableHead className="w-[80px]">Acoes</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="font-medium">
                    {member.name || "Sem nome"}
                  </TableCell>
                  <TableCell>{member.email}</TableCell>
                  <TableCell>
                    {orgRole === "OWNER" && member.role !== "OWNER" ? (
                      <Select
                        value={member.role}
                        onValueChange={(val) => handleRoleChange(member.id, val)}
                      >
                        <SelectTrigger className="w-[150px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ADMIN">Administrador</SelectItem>
                          <SelectItem value="MEMBER">Membro</SelectItem>
                          <SelectItem value="CLIENT">Cliente</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant={roleBadgeVariant[member.role] || "outline"}>
                        {roleLabels[member.role] || member.role}
                      </Badge>
                    )}
                  </TableCell>
                  {isOwnerOrAdmin && (
                    <TableCell>
                      {member.role !== "OWNER" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleRemoveMember(member.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
