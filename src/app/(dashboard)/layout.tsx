import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { BackgroundSync } from "@/components/background-sync";
import { AvatarProvider } from "@/contexts/avatar-context";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AvatarProvider>
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Header />
          <BackgroundSync />
          <main className="flex-1 px-3 py-4 sm:px-6 sm:py-6 md:px-8 md:py-8 pb-20 md:pb-8 overflow-y-auto"><div className="max-w-[1600px] mx-auto">{children}</div></main>
        </div>
        <BottomNav />
      </div>
    </AvatarProvider>
  );
}
