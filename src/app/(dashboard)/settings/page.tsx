import Link from "next/link";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Configuracoes</h2>
        <p className="text-[var(--muted-foreground)] text-sm mt-1">
          Gerencie as configuracoes da sua conta e organizacao.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/settings/profile"
          className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 hover:border-[var(--primary)] transition-colors"
        >
          <h3 className="font-semibold mb-1">Perfil</h3>
          <p className="text-sm text-[var(--muted-foreground)]">
            Edite seu nome, email e senha.
          </p>
        </Link>

        <Link
          href="/settings/organization"
          className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 hover:border-[var(--primary)] transition-colors"
        >
          <h3 className="font-semibold mb-1">Organizacao</h3>
          <p className="text-sm text-[var(--muted-foreground)]">
            Gerencie sua organizacao e convide membros.
          </p>
        </Link>
      </div>
    </div>
  );
}
