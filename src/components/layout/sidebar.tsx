"use client";

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
} from "lucide-react";

type NavItem = {
  name: string;
  href: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  internalOnly?: boolean;
};

// NavLink style updated to match Leverads
function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all relative ${isActive
        ? "bg-primary/8 text-primary"
        : "text-sidebar-text/70 hover:text-sidebar-text hover:bg-sidebar-hover"
        }`}
    >
      {isActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-primary rounded-r-full" />
      )}
      <Icon className="w-[18px] h-[18px] shrink-0" />
      {item.name}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  const userRole = session?.user?.role;
  const isInternal = userRole === "OWNER" || userRole === "ADMIN" || userRole === "MEMBER";
  const isAdmin = userRole === "OWNER" || userRole === "ADMIN";

  // CDR AI Group
  const aiNavItems = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  ];

  // PLATAFORMA Group
  const platformNavItems = [
    { name: "Pedidos", href: "/orders", icon: ShoppingBag },
    { name: "Vendas", href: "/sales", icon: TrendingUp },
    { name: "Mais Vendidos", href: "/best-sellers", icon: ShoppingBag },
    { name: "Anuncios", href: "/ads", icon: Megaphone },
    { name: "Financeiro", href: "/financeiro", icon: Wallet },
    { name: "Analytics", href: "/analytics", icon: BarChart3 },
  ];

  // Logic for Reports tab (restrict to specific email)
  if (session?.user?.email?.toLowerCase() === "academy.cdr@gmail.com") {
    platformNavItems.push({ name: "Relatórios", href: "/reports", icon: FileText } as any);
  }

  // GESTÃO Group
  const managementNavItems = [
    { name: "Integrações", href: "/integrations", icon: Link2, internalOnly: true },
    { name: "Configurações", href: "/settings", icon: Settings },
  ];

  const filterNav = (items: any[]) => {
    return items.filter(item => {
      if (item.adminOnly) return isAdmin;
      if (item.internalOnly) return isInternal;
      return true;
    });
  };

  const filteredAiNav = filterNav(aiNavItems);
  const filteredPlatformNav = filterNav(platformNavItems);
  const filteredManagementNav = filterNav(managementNavItems);

  return (
    <aside className="hidden md:flex md:w-56 md:flex-col bg-sidebar-bg text-sidebar-text min-h-screen border-r border-white/5">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 mb-2">
        <div className="relative w-8 h-8 flex items-center justify-center">
          <Image
            src="/logo.png.png"
            alt="CDR Group"
            fill
            className="object-contain"
            priority
          />
        </div>
        <div>
          <p className="font-semibold text-sm leading-tight text-white">CDR Group</p>
          <p className="text-[10px] text-sidebar-text/50 leading-tight">Performance</p>
        </div>
      </div>

      {/* Main navigation */}
      <nav className="flex-1 px-3 space-y-6 overflow-y-auto">
        {filteredAiNav.length > 0 && (
          <div className="space-y-1">
            <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-sidebar-text/30">
              CDR AI
            </p>
            {filteredAiNav.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} />
            ))}
          </div>
        )}

        {filteredPlatformNav.length > 0 && (
          <div className="space-y-1">
            <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-sidebar-text/30">
              Plataforma
            </p>
            {filteredPlatformNav.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} />
            ))}
          </div>
        )}

        {filteredManagementNav.length > 0 && (
          <div className="space-y-1">
            <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-sidebar-text/30">
              Gestão
            </p>
            {filteredManagementNav.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} />
            ))}
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-white/5 mt-auto">
        <div className="flex flex-col gap-1">
          {/* Org Name PlaceHolder - Assuming org name comes from somewhere else or static for now */}
          <p className="text-[10px] uppercase font-semibold text-sidebar-text/40">CDR Group</p>
          {session?.user && (
            <p className="text-[10px] text-sidebar-text/30 truncate">
              {session.user.email}
            </p>
          )}
        </div>
      </div>
    </aside>
  );
}
