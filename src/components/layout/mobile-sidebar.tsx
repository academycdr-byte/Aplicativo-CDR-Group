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
  Shield,
  FileText,
  Wallet,
  type LucideIcon,
} from "lucide-react";
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
  adminOnly?: boolean;
  internalOnly?: boolean;
};

export function MobileSidebar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { data: session } = useSession();

  const userRole = session?.user?.role;
  const isInternal = userRole === "OWNER" || userRole === "ADMIN" || userRole === "MEMBER";
  const isAdmin = userRole === "OWNER" || userRole === "ADMIN";

  // Same structure as Sidebar
  const aiNavItems = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  ];

  const platformNavItems: NavItem[] = [
    { name: "Mais Vendidos", href: "/best-sellers", icon: ShoppingBag },
    { name: "Anuncios", href: "/ads", icon: Megaphone },
    { name: "Financeiro", href: "/financeiro", icon: Wallet },
    { name: "Analytics", href: "/analytics", icon: BarChart3 },
    ...(isAdmin ? [{ name: "Relatórios", href: "/reports", icon: FileText }] : []),
  ];

  const managementNavItems = [
    { name: "Integrações", href: "/integrations", icon: Link2, internalOnly: true },
    { name: "Configurações", href: "/settings", icon: Settings },
  ];

  const filterNav = (items: NavItem[]) => {
    return items.filter(item => {
      if (item.adminOnly) return isAdmin;
      if (item.internalOnly) return isInternal;
      return true;
    });
  };

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
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[14px] font-medium transition-all relative ${isActive
            ? "bg-primary/10 text-primary font-semibold"
            : "text-sidebar-text/70 hover:text-sidebar-text hover:bg-sidebar-hover"
          }`}
      >
        {isActive && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-primary rounded-r-full" />
        )}
        <Icon className="w-5 h-5 shrink-0" strokeWidth={1.8} />
        {item.name}
      </Link>
    );
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="w-5 h-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0 bg-sidebar-bg text-sidebar-text overflow-y-auto">
        <SheetHeader className="px-5 py-5 border-b border-white/5">
          <SheetTitle className="flex items-center gap-3 text-sidebar-text">
            <Image
              src="/logo-cdr.png"
              alt="CDR Group"
              width={36}
              height={36}
              className="rounded-lg"
            />
            <div>
              <p className="font-semibold text-sm leading-tight">CDR Group</p>
              <p className="text-[11px] text-sidebar-text/50 leading-tight">Performance</p>
            </div>
          </SheetTitle>
        </SheetHeader>
        <nav className="px-3 pt-4 pb-4 space-y-6">
          <div className="space-y-1">
            <p className="px-3 mb-3 text-[11px] font-semibold uppercase tracking-widest text-sidebar-text/40">
              CDR AI
            </p>
            {filteredAiNav.map((item) => (
              <NavLink key={item.href} item={item} />
            ))}
          </div>

          <div className="space-y-1">
            <p className="px-3 mb-3 text-[11px] font-semibold uppercase tracking-widest text-sidebar-text/40">
              Plataforma
            </p>
            {filteredPlatformNav.map((item) => (
              <NavLink key={item.href} item={item} />
            ))}
          </div>

          <div className="space-y-1">
            <p className="px-3 mb-3 text-[11px] font-semibold uppercase tracking-widest text-sidebar-text/40">
              Gestão
            </p>
            {filteredManagementNav.map((item) => (
              <NavLink key={item.href} item={item} />
            ))}
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
