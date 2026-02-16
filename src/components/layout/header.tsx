"use client";

import Link from "next/link";
import { User, LogOut, Bell, Search } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { useAvatar } from "@/contexts/avatar-context";

export function Header() {
  const { data: session } = useSession();
  const { avatarUrl } = useAvatar();

  const userName = session?.user?.name || "Usuário";
  const userInitial = userName.charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-20 h-14 md:h-16 w-full flex items-center gap-2 md:gap-4 border-b border-border/40 bg-background/80 backdrop-blur-xl px-3 sm:px-6" role="banner">
      <div className="flex items-center gap-3 md:hidden">
        <MobileSidebar />
        <span className="text-sm font-semibold tracking-tight">CDR Group</span>
      </div>

      <div className="hidden md:flex flex-1 max-w-md">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            aria-label="Buscar no sistema"
            className="pl-9 h-10 w-full bg-muted/50 dark:bg-surface-glass border-transparent rounded-xl focus:bg-background focus:border-primary/20 transition-all duration-300"
          />
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground rounded-full transition-all duration-300" aria-label="Notificações">
          <Bell className="w-[18px] h-[18px]" />
        </Button>
        <ThemeToggle />

        <div className="h-5 w-px bg-border/30 mx-1" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 w-9 rounded-full focus-visible:ring-offset-0" aria-label="Menu do usuário">
              <Avatar className="h-9 w-9 border border-border/50">
                <AvatarImage src={avatarUrl || ""} />
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                  {userInitial}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-xl shadow-[var(--shadow-floating)] border-border/50 bg-card/95 backdrop-blur-xl">
            <div className="px-3 py-2">
              <p className="text-sm font-medium">{userName}</p>
              <p className="text-xs text-muted-foreground truncate">{session?.user?.email}</p>
            </div>
            <DropdownMenuSeparator className="bg-border/50" />
            <DropdownMenuItem asChild className="rounded-lg cursor-pointer focus:bg-primary/10 focus:text-primary transition-colors duration-200">
              <Link href="/settings/profile" className="flex items-center gap-2">
                <User className="w-4 h-4" />
                Meu perfil
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="rounded-lg cursor-pointer focus:bg-primary/10 focus:text-primary transition-colors duration-200">
              <Link href="/settings" className="flex items-center gap-2">
                Configurações
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-border/50" />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive focus:bg-destructive/10 rounded-lg cursor-pointer transition-colors duration-200"
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
