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
      {/* Floating App Shell — CDR Design System v2.1 §2 */}
      <div className="min-h-screen bg-background p-3">
        <div className="app-shell">
          <Header />
          <div className="flex flex-1 min-h-0">
            <Sidebar />
            <main className="app-content flex-1 overflow-y-auto px-4 py-6 sm:px-6 sm:py-8 md:px-8 md:py-8">
              <div className="max-w-[1400px] mx-auto">
                {children}
              </div>
            </main>
          </div>
        </div>
        <BackgroundSync />
        <BottomNav />
      </div>
    </AvatarProvider>
  );
}
