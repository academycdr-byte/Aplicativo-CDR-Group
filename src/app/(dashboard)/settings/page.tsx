import Link from "next/link";
import { User } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const settingsItems = [
  {
    href: "/settings/profile",
    icon: User,
    title: "Perfil",
    description: "Edite seu nome, email e senha.",
  },
];

export default function SettingsPage() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Configurações</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Gerencie as configurações da sua conta e organização.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {settingsItems.map((item) => (
          <Link key={item.href} href={item.href}>
            <Card className="h-full border-border/40 hover:border-border/60 transition-colors duration-300">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="p-2.5 bg-secondary rounded-xl">
                    <item.icon className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1 text-base">{item.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
