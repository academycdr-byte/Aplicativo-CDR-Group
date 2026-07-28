"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import {
  LayoutDashboard,
  Link2,
  ShoppingBag,
  Megaphone,
  BarChart3,
  Settings,
  Wallet,
  Calculator,
  Layers,
  Target,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAvatar } from "@/contexts/avatar-context";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useSession } from "next-auth/react";

type NavItem = {
  name: string;
  href: string;
  icon: LucideIcon;
  internalOnly?: boolean;
};

export function MobileSidebar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { data: session } = useSession();
  const { avatarUrl } = useAvatar();

  const userName = session?.user?.name || "Usuário";
  const userInitial = userName.charAt(0).toUpperCase();
  const userRole = session?.user?.role;
  const isInternal = userRole === "OWNER" || userRole === "ADMIN" || userRole === "MEMBER";

  const aiNavItems: NavItem[] = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Plano de Ação", href: "/plano-de-acao", icon: Target },
  ];

  const platformNavItems: NavItem[] = [
    { name: "Envios", href: "/envios", icon: Truck },
    { name: "Mais Vendidos", href: "/best-sellers", icon: ShoppingBag },
    { name: "Anúncios", href: "/ads", icon: Megaphone },
    { name: "Esteira Criativos", href: "/esteira-criativos", icon: Layers },
    { name: "Financeiro", href: "/financeiro", icon: Wallet },
    { name: "Simulador", href: "/dre-performance", icon: Calculator },
    { name: "Analytics", href: "/analytics", icon: BarChart3 },
  ];

  const managementNavItems: NavItem[] = [
    { name: "Integrações", href: "/integrations", icon: Link2 },
    { name: "Configurações", href: "/settings", icon: Settings },
  ];

  const filterNav = (items: NavItem[]) =>
    items.filter((item) => (!item.internalOnly || isInternal));

  const filteredAiNav = filterNav(aiNavItems);
  const filteredPlatformNav = filterNav(platformNavItems);
  const filteredManagementNav = filterNav(managementNavItems);

  function NavLink({ item }: { item: NavItem }) {
    const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
    const Icon = item.icon;
    return (
      <Link
        href={item.href}
        onClick={() => setOpen(false)}
        aria-current={isActive ? "page" : undefined}
        className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-[16px] transition-colors ${
          isActive
            ? "bg-accent-surface text-primary font-semibold"
            : "text-muted-foreground hover:bg-bg-hover"
        }`}
      >
        <Icon className={`w-[22px] h-[22px] shrink-0 ${isActive ? "text-primary" : "text-text-tertiary"}`} strokeWidth={1.8} />
        {item.name}
      </Link>
    );
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label="Abrir menu de navegação">
          <Menu className="w-5 h-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[85vw] max-w-72 p-0 bg-card text-foreground flex flex-col">
        <SheetHeader className="px-6 py-5">
          <SheetTitle className="flex items-center gap-3 text-foreground">
            <Image src="/logo-cdr.png" alt="CDR Group" width={36} height={36} className="rounded-xl shrink-0" />
            <p className="font-bold text-[15px]">CDR Group</p>
          </SheetTitle>
        </SheetHeader>

        <nav className="flex-1 overflow-y-auto px-4 pb-4" aria-label="Navegação principal">
          {filteredAiNav.length > 0 && (
            <div className="mb-6">
              <p className="section-label px-4 mb-2">Visão Geral</p>
              <div className="space-y-0.5">
                {filteredAiNav.map((item) => <NavLink key={item.href} item={item} />)}
              </div>
            </div>
          )}
          {filteredPlatformNav.length > 0 && (
            <div className="mb-6">
              <p className="section-label px-4 mb-2">Plataforma</p>
              <div className="space-y-0.5">
                {filteredPlatformNav.map((item) => <NavLink key={item.href} item={item} />)}
              </div>
            </div>
          )}
          {filteredManagementNav.length > 0 && (
            <div className="mb-6">
              <p className="section-label px-4 mb-2">Gestão</p>
              <div className="space-y-0.5">
                {filteredManagementNav.map((item) => <NavLink key={item.href} item={item} />)}
              </div>
            </div>
          )}
        </nav>

        <div className="px-4 py-4 border-t border-border mt-auto">
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-2 py-2.5 rounded-2xl hover:bg-bg-hover transition-colors"
          >
            <Avatar className="h-9 w-9">
              <AvatarImage src={avatarUrl || ""} />
              <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
                {userInitial}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium truncate">{userName}</p>
              <p className="text-[11px] text-text-tertiary truncate">{session?.user?.email}</p>
            </div>
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}
