import Link from "next/link";
import { User, Building2, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const settingsItems = [
  {
    href: "/settings/profile",
    icon: User,
    title: "Perfil",
    description: "Edite seu nome, email e senha.",
  },
  {
    href: "/settings/organization",
    icon: Building2,
    title: "Organizacao",
    description: "Gerencie sua organizacao e membros da equipe.",
  },
];

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Configuracoes</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Gerencie as configuracoes da sua conta e organizacao.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {settingsItems.map((item) => (
          <Link key={item.href} href={item.href}>
            <Card className="hover:border-primary transition-colors h-full">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <item.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">{item.title}</h3>
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
