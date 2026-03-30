"use client";

import { useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
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
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAvatar } from "@/contexts/avatar-context";

type NavItem = {
  name: string;
  href: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  internalOnly?: boolean;
};

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      aria-current={isActive ? "page" : undefined}
      className={`group flex items-center gap-2.5 px-4 py-2.5 rounded-2xl text-[13px] transition-colors duration-200 ${
        isActive
          ? "bg-accent-surface text-primary font-semibold"
          : "text-muted-foreground hover:bg-bg-hover"
      }`}
    >
      <Icon
        className={`w-[18px] h-[18px] shrink-0 ${
          isActive ? "text-primary" : "text-text-tertiary group-hover:text-muted-foreground"
        }`}
        strokeWidth={1.8}
      />
      <span>{item.name}</span>
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { avatarUrl } = useAvatar();

  const userRole = session?.user?.role;
  const isInternal = userRole === "OWNER" || userRole === "ADMIN" || userRole === "MEMBER";

  const { filteredAiNav, filteredPlatformNav, filteredManagementNav } = useMemo(() => {
    const filterNav = (items: NavItem[]) =>
      items.filter((item) => {
        if (item.internalOnly) return isInternal;
        return true;
      });

    const aiNavItems: NavItem[] = [
      { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { name: "Plano de Ação", href: "/plano-de-acao", icon: Target },
    ];

    const platformNavItems: NavItem[] = [
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

    return {
      filteredAiNav: filterNav(aiNavItems),
      filteredPlatformNav: filterNav(platformNavItems),
      filteredManagementNav: filterNav(managementNavItems),
    };
  }, [isInternal]);

  return (
    <aside
      className="hidden md:flex md:w-[240px] md:flex-col shrink-0 h-full"
      role="navigation"
      aria-label="Menu principal"
    >
      {/* Brand — Design System v2.1 §4.1 */}
      <div className="flex items-center gap-3 px-6 pt-6 pb-4">
        <Image
          src="/logo-cdr.png"
          alt="CDR Group"
          width={36}
          height={36}
          className="rounded-xl shrink-0"
          priority
        />
        <p className="font-bold text-[15px] text-foreground">CDR Group</p>
      </div>

      {/* Navigation — Design System v2.1 §4.2-4.3 */}
      <nav className="flex-1 px-4 overflow-y-auto no-scrollbar py-2" aria-label="Navegação principal">
        {filteredAiNav.length > 0 && (
          <div className="mb-6">
            <p className="section-label px-4 mb-2">Visão Geral</p>
            <div className="space-y-0.5">
              {filteredAiNav.map((item) => (
                <NavLink key={item.href} item={item} pathname={pathname} />
              ))}
            </div>
          </div>
        )}

        {filteredPlatformNav.length > 0 && (
          <div className="mb-6">
            <p className="section-label px-4 mb-2">Plataforma</p>
            <div className="space-y-0.5">
              {filteredPlatformNav.map((item) => (
                <NavLink key={item.href} item={item} pathname={pathname} />
              ))}
            </div>
          </div>
        )}

        {filteredManagementNav.length > 0 && (
          <div className="mb-6">
            <p className="section-label px-4 mb-2">Gestão</p>
            <div className="space-y-0.5">
              {filteredManagementNav.map((item) => (
                <NavLink key={item.href} item={item} pathname={pathname} />
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* Footer — Design System v2.1 §4.4 */}
      <div className="px-4 py-4 border-t border-border mt-auto">
        <Link
          href="/settings"
          aria-label={`Perfil de ${session?.user?.name || "Usuário"} - Configurações`}
          className="flex items-center gap-3 px-2 py-2.5 rounded-2xl hover:bg-bg-hover transition-colors duration-200 cursor-pointer group"
        >
          <Avatar className="h-9 w-9">
            <AvatarImage src={avatarUrl || ""} />
            <AvatarFallback className="bg-accent-surface text-primary text-xs font-bold">
              {session?.user?.name?.charAt(0) || "U"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-medium text-foreground truncate">
              {session?.user?.name || "Usuário"}
            </p>
            <p className="text-[11px] text-text-tertiary truncate">
              {session?.user?.email}
            </p>
          </div>
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-3 w-full px-4 py-2.5 mt-1 rounded-2xl text-destructive hover:bg-danger-surface transition-colors duration-200 text-sm"
        >
          <LogOut className="w-[22px] h-[22px]" strokeWidth={1.8} />
          Sair
        </button>
      </div>
    </aside>
  );
}
