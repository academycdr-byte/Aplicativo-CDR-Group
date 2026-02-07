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

const navigation: { name: string; href: string; icon: LucideIcon }[] = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Integracoes", href: "/integrations", icon: Link2 },
  { name: "Pedidos", href: "/orders", icon: ShoppingBag },
  { name: "Vendas", href: "/sales", icon: TrendingUp },
  { name: "Anuncios", href: "/ads", icon: Megaphone },
  { name: "Relatorios", href: "/reports", icon: BarChart3 },
];

const bottomNavigation: { name: string; href: string; icon: LucideIcon }[] = [
  { name: "Admin", href: "/admin", icon: Shield },
  { name: "Configuracoes", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col bg-sidebar-bg text-sidebar-text min-h-screen">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-white/10">
        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-bold text-xs">
          CDR
        </div>
        <span className="font-semibold">CDR Group</span>
      </div>

      {/* Main navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-sidebar-text hover:bg-sidebar-hover"
              }`}
            >
              <Icon className="w-5 h-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Bottom navigation */}
      <div className="px-3 py-4 border-t border-white/10 space-y-1">
        {bottomNavigation.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-sidebar-text hover:bg-sidebar-hover"
              }`}
            >
              <Icon className="w-5 h-5" />
              {item.name}
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
