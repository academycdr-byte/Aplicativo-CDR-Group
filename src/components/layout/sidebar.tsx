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
  type LucideIcon,
} from "lucide-react";

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
      className={`group flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all relative ${isActive
        ? "bg-primary/10 text-primary"
        : "text-sidebar-text/70 hover:text-sidebar-text hover:bg-sidebar-hover"
        }`}
    >
      {isActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary rounded-r-full" />
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
  // Internal team includes OWNER, ADMIN, and MEMBER
  const isInternal = userRole === "OWNER" || userRole === "ADMIN" || userRole === "MEMBER";
  // Admin access remains restricted to OWNER and ADMIN
  const isAdmin = userRole === "OWNER" || userRole === "ADMIN";

  // Navigation items with role-based visibility
  // If 'roles' is undefined, it's visible to everyone (including CLIENT)
  // If 'hideForClients' is true, it's hidden for CLIENT role but visible to others
  const mainNavItems = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Pedidos", href: "/orders", icon: ShoppingBag },
    { name: "Vendas", href: "/sales", icon: TrendingUp },
    { name: "Mais Vendidos", href: "/best-sellers", icon: ShoppingBag },
    { name: "Anuncios", href: "/ads", icon: Megaphone },
    // Relatórios restricted to internal team
    { name: "Relatorios", href: "/reports", icon: FileText, internalOnly: true },
  ];

  const settingsNavItems = [
    // Integrations usually for internal team/admins to configure
    { name: "Integracoes", href: "/integrations", icon: Link2, internalOnly: true },
    { name: "Configuracoes", href: "/settings", icon: Settings },
    { name: "Admin", href: "/admin", icon: Shield, adminOnly: true },
  ];

  // Helper to filter items
  const filterNav = (items: any[]) => {
    return items.filter(item => {
      if (item.adminOnly) return isAdmin;
      if (item.internalOnly) return isInternal;
      return true;
    });
  };

  const filteredMainNav = filterNav(mainNavItems);
  const filteredSettingsNav = filterNav(settingsNavItems);

  return (
    <aside className="hidden md:flex md:w-60 md:flex-col bg-sidebar-bg text-sidebar-text min-h-screen border-r border-white/5">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="relative w-9 h-9 flex items-center justify-center">
          <Image
            src="/logo.png.png"
            alt="CDR Group"
            fill
            className="object-contain"
            priority
          />
        </div>
        <div>
          <p className="font-semibold text-sm leading-tight">CDR Group</p>
          <p className="text-[11px] text-sidebar-text/50 leading-tight">Performance</p>
        </div>
      </div>

      {/* Main navigation */}
      <nav className="flex-1 px-3 pt-2 pb-4 space-y-5">
        <div className="space-y-1">
          <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-sidebar-text/30">
            Painel
          </p>
          {filteredMainNav.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} />
          ))}
        </div>

        <div className="space-y-1">
          <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-sidebar-text/30">
            Gestao
          </p>
          {filteredSettingsNav.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} />
          ))}
        </div>
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-white/5">
        <div className="flex flex-col gap-1">
          <p className="text-[10px] text-sidebar-text/30 text-center">CDR Group &copy; 2025</p>
          {userRole && (
            <p className="text-[9px] text-sidebar-text/20 text-center uppercase tracking-wider">
              {userRole}
            </p>
          )}
        </div>
      </div>
    </aside>
  );
}
