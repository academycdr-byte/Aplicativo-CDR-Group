import Image from "next/image";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-background">
      {/* Subtle Gradient Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/10 blur-[160px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[160px]" />
      </div>

      <div className="w-full max-w-md relative z-10 px-6">
        <div className="text-center mb-8 flex flex-col items-center">
          <div className="relative w-16 h-16 mb-5">
            <Image
              src="/logo.png.png"
              alt="CDR Group"
              fill
              className="object-contain"
              priority
            />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">CDR Group</h2>
          <p className="text-muted-foreground text-sm mt-1">Performance Dashboard</p>
        </div>
        {children}
      </div>
    </div>
  );
}
