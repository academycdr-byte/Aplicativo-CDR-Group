import Image from "next/image";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        {/* Logo — CDR Design System v2.1 */}
        <div className="text-center mb-8 flex flex-col items-center">
          <Image
            src="/logo-cdr.png"
            alt="CDR Group"
            width={48}
            height={48}
            className="rounded-xl mb-4"
            priority
          />
          <h2 className="text-xl font-bold tracking-tight text-foreground">CDR Group</h2>
          <p className="text-muted-foreground text-sm mt-1">Performance Dashboard</p>
        </div>
        {children}
      </div>
    </div>
  );
}
