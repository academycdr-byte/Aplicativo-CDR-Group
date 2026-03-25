"use client";

import { useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
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
  type LucideIcon,
  ChevronRight,
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
      className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg text-[14px] font-medium transition-all duration-300 relative ${isActive
        ? "bg-primary/10 text-primary font-semibold"
        : "text-sidebar-text/60 hover:text-sidebar-text hover:bg-sidebar-hover"
        }`}
    >
      {isActive && (
        <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-primary rounded-r-full" />
      )}
      <Icon className={`w-5 h-5 shrink-0 transition-colors duration-300 ${isActive ? "text-primary" : "text-sidebar-text/50 group-hover:text-sidebar-text"}`} strokeWidth={1.8} />
      <span className="transition-colors duration-800">{item.name}</span>
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
    <aside className="hidden md:flex md:w-[260px] md:flex-col bg-sidebar-bg border-r border-sidebar-border h-screen sticky top-0 z-30" role="navigation" aria-label="Menu principal">
      {/* Brand */}
      <div className="flex items-center gap-3 px-6 py-6 mb-2">
        <Image
          src="/logo-cdr.png"
          alt="CDR Group"
          width={40}
          height={40}
          className="rounded-xl"
          priority
        />
        <div>
          <p className="font-semibold text-[15px] leading-tight text-sidebar-foreground tracking-tight">CDR Group</p>
          <p className="text-[10px] text-sidebar-text/40 leading-tight font-medium tracking-widest uppercase mt-0.5">Performance</p>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-6 mb-4 h-px bg-sidebar-border" />

      {/* Navigation */}
      <nav className="flex-1 px-4 space-y-8 overflow-y-auto no-scrollbar py-2" aria-label="Navegação principal">
        {filteredAiNav.length > 0 && (
          <div className="space-y-1">
            <p className="section-label-accent px-3 mb-3">
              CDR AI
            </p>
            {filteredAiNav.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} />
            ))}
          </div>
        )}

        {filteredPlatformNav.length > 0 && (
          <div className="space-y-1">
            <p className="section-label px-3 mb-3 text-sidebar-text/40">
              Plataforma
            </p>
            {filteredPlatformNav.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} />
            ))}
          </div>
        )}

        {filteredManagementNav.length > 0 && (
          <div className="space-y-1">
            <p className="section-label px-3 mb-3 text-sidebar-text/40">
              Gestão
            </p>
            {filteredManagementNav.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} />
            ))}
          </div>
        )}
      </nav>

      {/* User Profile (Academia Glass Style) */}
      <div className="px-4 py-4 border-t border-sidebar-border mt-auto">
        <Link
          href="/settings"
          aria-label={`Perfil de ${session?.user?.name || "Usuário"} - Configurações`}
          className="flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-sidebar-hover transition-all duration-300 cursor-pointer group"
        >
          <Avatar className="h-10 w-10 border border-white/10 shadow-sm">
            <AvatarImage src={avatarUrl || ""} />
            <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
              {session?.user?.name?.charAt(0) || "U"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-medium text-sidebar-text truncate group-hover:text-white transition-colors duration-300">
              {session?.user?.name || "Usuário"}
            </p>
            <p className="text-[11px] text-sidebar-text/40 truncate">
              {session?.user?.email}
            </p>
          </div>
          <ChevronRight className="w-4 h-4 text-sidebar-text/20 group-hover:text-sidebar-text/50 transition-all duration-300 group-hover:translate-x-0.5" />
        </Link>
      </div>
    </aside>
  );
}
