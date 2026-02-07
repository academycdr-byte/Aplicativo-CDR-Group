"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Link2,
  ShoppingBag,
  TrendingUp,
  Megaphone,
  BarChart3,
  Settings,
  Shield,
  type LucideIcon,
} from "lucide-react";

type NavItem = { name: string; href: string; icon: LucideIcon };

const mainNav: NavItem[] = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Pedidos", href: "/orders", icon: ShoppingBag },
  { name: "Vendas", href: "/sales", icon: TrendingUp },
  { name: "Anuncios", href: "/ads", icon: Megaphone },
  { name: "Relatorios", href: "/reports", icon: BarChart3 },
];

const settingsNav: NavItem[] = [
  { name: "Integracoes", href: "/integrations", icon: Link2 },
  { name: "Configuracoes", href: "/settings", icon: Settings },
  { name: "Admin", href: "/admin", icon: Shield },
];

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={`group flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all relative ${
        isActive
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

  return (
    <aside className="hidden md:flex md:w-60 md:flex-col bg-sidebar-bg text-sidebar-text min-h-screen border-r border-white/5">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center text-primary-foreground font-bold text-[10px] tracking-wider">
          CDR
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
          {mainNav.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} />
          ))}
        </div>

        <div className="space-y-1">
          <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-sidebar-text/30">
            Gestao
          </p>
          {settingsNav.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} />
          ))}
        </div>
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-white/5">
        <p className="text-[10px] text-sidebar-text/30 text-center">CDR Group &copy; 2025</p>
      </div>
    </aside>
  );
}
