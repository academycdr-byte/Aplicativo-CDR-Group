"use client";

import Link from "next/link";
import { User, LogOut, Bell, Search, MessageSquare } from "lucide-react";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { MobileSidebar } from "@/components/layout/mobile-sidebar";
import { useAvatar } from "@/contexts/avatar-context";

export function Header() {
  const { data: session } = useSession();
  const { avatarUrl } = useAvatar();

  const userName = session?.user?.name || "Usuário";
  const userInitial = userName.charAt(0).toUpperCase();

  return (
    <header
      className="sticky top-0 z-20 h-[72px] w-full flex items-center gap-4 border-b border-border bg-bg-card px-4 sm:px-8"
      style={{ borderRadius: "20px 20px 0 0" }}
      role="banner"
    >
      {/* Mobile: hamburger + brand */}
      <div className="flex items-center gap-3 md:hidden">
        <MobileSidebar />
        <span className="text-sm font-semibold">CDR Group</span>
      </div>

      {/* Desktop: spacer left */}
      <div className="hidden md:block w-[240px] shrink-0" />

      {/* Center: Search — Design System v2.1 §3 */}
      <div className="hidden md:flex flex-1 justify-center">
        <div className="relative w-full max-w-[480px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
          <input
            type="text"
            placeholder="Buscar..."
            aria-label="Buscar no sistema"
            className="w-full h-10 pl-10 pr-16 bg-transparent border border-border rounded-xl text-sm text-foreground placeholder:text-text-tertiary focus:outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/15 transition-all"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-text-tertiary bg-secondary px-1.5 py-0.5 rounded">
            Ctrl+K
          </kbd>
        </div>
      </div>

      {/* Right: icons + avatar — Design System v2.1 §3 */}
      <div className="ml-auto flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-text-tertiary hover:text-foreground rounded-lg"
          aria-label="Mensagens"
        >
          <MessageSquare className="w-5 h-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-text-tertiary hover:text-foreground rounded-lg"
          aria-label="Notificações"
        >
          <Bell className="w-5 h-5" />
        </Button>
        <ThemeToggle />

        <div className="h-5 w-px bg-border mx-1" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-bg-hover transition-colors" aria-label="Menu do usuário">
              <Avatar className="h-9 w-9">
                <AvatarImage src={avatarUrl || ""} />
                <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
                  {userInitial}
                </AvatarFallback>
              </Avatar>
              <div className="hidden lg:block text-left">
                <p className="text-sm font-medium text-foreground leading-tight">{userName}</p>
                <p className="text-[11px] text-text-tertiary leading-tight">Admin</p>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-xl border-border">
            <div className="px-3 py-2">
              <p className="text-sm font-medium">{userName}</p>
              <p className="text-xs text-muted-foreground truncate">{session?.user?.email}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="rounded-lg cursor-pointer">
              <Link href="/settings/profile" className="flex items-center gap-2">
                <User className="w-4 h-4" />
                Meu perfil
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive rounded-lg cursor-pointer"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
