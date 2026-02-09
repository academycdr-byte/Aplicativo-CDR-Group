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
  TrendingUp,
  Megaphone,
  BarChart3,
  Settings,
  Shield,
  FileText,
  Wallet,
  type LucideIcon,
  ChevronRight,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type NavItem = {
  name: string;
  href: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  internalOnly?: boolean;
};

// Apple Style NavLink
function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg text-[14px] font-medium transition-all duration-200 relative ${isActive
        ? "bg-primary/10 text-primary font-semibold"
        : "text-sidebar-text/70 hover:text-sidebar-text hover:bg-sidebar-hover"
        }`}
    >
      {isActive && (
        <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-primary rounded-r-full" />
      )}
      <Icon className={`w-5 h-5 shrink-0 transition-colors ${isActive ? "text-primary" : "text-sidebar-text/60 group-hover:text-sidebar-text"}`} strokeWidth={1.8} />
      <span>{item.name}</span>
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  const userRole = session?.user?.role;
  const isInternal = userRole === "OWNER" || userRole === "ADMIN" || userRole === "MEMBER";
  const isAdmin = userRole === "OWNER" || userRole === "ADMIN";

  const { filteredAiNav, filteredPlatformNav, filteredManagementNav } = useMemo(() => {
    const filterNav = (items: NavItem[]) =>
      items.filter((item) => {
        if (item.adminOnly) return isAdmin;
        if (item.internalOnly) return isInternal;
        return true;
      });

    const aiNavItems: NavItem[] = [
      { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    ];

    const platformNavItems: NavItem[] = [
      { name: "Pedidos", href: "/orders", icon: ShoppingBag },
      { name: "Vendas", href: "/sales", icon: TrendingUp },
      { name: "Mais Vendidos", href: "/best-sellers", icon: ShoppingBag },
      { name: "Anuncios", href: "/ads", icon: Megaphone },
      { name: "Financeiro", href: "/financeiro", icon: Wallet },
      { name: "Analytics", href: "/analytics", icon: BarChart3 },
      ...(isAdmin ? [{ name: "Relatórios", href: "/reports", icon: FileText }] : []),
    ];

    const managementNavItems: NavItem[] = [
      { name: "Integrações", href: "/integrations", icon: Link2, internalOnly: true },
      { name: "Configurações", href: "/settings", icon: Settings },
    ];

    return {
      filteredAiNav: filterNav(aiNavItems),
      filteredPlatformNav: filterNav(platformNavItems),
      filteredManagementNav: filterNav(managementNavItems),
    };
  }, [isAdmin, isInternal]);

  return (
    <aside className="hidden md:flex md:w-[260px] md:flex-col bg-sidebar-bg border-r border-sidebar-border h-screen sticky top-0 z-30">
      {/* Brand */}
      <div className="flex items-center gap-3 px-6 py-6 mb-2">
        <Image
          src="/logo-cdr.png"
          alt="CDR Group"
          width={52}
          height={52}
          className="rounded-lg"
          priority
        />
        <div>
          <p className="font-semibold text-base leading-tight text-white tracking-wide">CDR Group</p>
          <p className="text-xs text-sidebar-text/50 leading-tight font-medium">Performance</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 space-y-10 overflow-y-auto no-scrollbar py-2">
        {filteredAiNav.length > 0 && (
          <div className="space-y-1">
            <p className="px-3 mb-3 text-[11px] font-semibold uppercase tracking-widest text-sidebar-text/40">
              CDR AI
            </p>
            {filteredAiNav.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} />
            ))}
          </div>
        )}

        {filteredPlatformNav.length > 0 && (
          <div className="space-y-1">
            <p className="px-3 mb-3 text-[11px] font-semibold uppercase tracking-widest text-sidebar-text/40">
              Plataforma
            </p>
            {filteredPlatformNav.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} />
            ))}
          </div>
        )}

        {filteredManagementNav.length > 0 && (
          <div className="space-y-1">
            <p className="px-3 mb-3 text-[11px] font-semibold uppercase tracking-widest text-sidebar-text/40">
              Gestão
            </p>
            {filteredManagementNav.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} />
            ))}
          </div>
        )}
      </nav>

      {/* User User Profile (Apple Style) */}
      <div className="px-4 py-4 border-t border-sidebar-border mt-auto bg-black/10">
        <div className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-white/5 transition-colors cursor-pointer group">
          <Avatar className="h-10 w-10 border border-white/10 shadow-sm">
            <AvatarImage src={session?.user?.image || ""} />
            <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
              {session?.user?.name?.charAt(0) || "U"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-medium text-sidebar-text truncate group-hover:text-white transition-colors">
              {session?.user?.name || "Usuário"}
            </p>
            <p className="text-[11px] text-sidebar-text/50 truncate">
              {session?.user?.email}
            </p>
          </div>
          <Settings className="w-4 h-4 text-sidebar-text/30 group-hover:text-sidebar-text/70 transition-colors" />
        </div>
      </div>
    </aside>
  );
}
