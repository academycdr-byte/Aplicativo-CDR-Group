"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Megaphone,
  Wallet,
  ShoppingBag,
  BarChart3,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  name: string;
  href: string;
  icon: LucideIcon;
};

const items: NavItem[] = [
  { name: "Home", href: "/dashboard", icon: LayoutDashboard },
  { name: "Ads", href: "/ads", icon: Megaphone },
  { name: "Financeiro", href: "/financeiro", icon: Wallet },
  { name: "Vendidos", href: "/best-sellers", icon: ShoppingBag },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t border-border/40 bg-background/80 backdrop-blur-xl safe-area-bottom"
      aria-label="Navegação rápida"
    >
      <div className="flex items-center justify-around h-14 px-1">
        {items.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 flex-1 py-1 transition-colors duration-200",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="w-5 h-5" strokeWidth={isActive ? 2.2 : 1.6} />
              <span className={cn(
                "text-[10px] leading-none",
                isActive ? "font-semibold" : "font-medium"
              )}>
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
