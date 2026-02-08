import Image from "next/image";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-background">
      {/* Mesh Gradient Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/20 blur-[120px] animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-500/20 blur-[120px] animate-pulse" style={{ animationDuration: '6s', animationDelay: '1s' }} />
      </div>

      <div className="w-full max-w-md relative z-10 px-6">
        <div className="text-center mb-8 flex flex-col items-center">
          <div className="relative w-24 h-24 mb-6 transition-transform hover:scale-105 duration-500">
            <Image
              src="/logo.png.png"
              alt="CDR Group"
              fill
              className="object-contain drop-shadow-2xl"
              priority
            />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">CDR Group</h2>
          <p className="text-muted-foreground text-sm mt-1">Performance Dashboard</p>
        </div>
        {children}
      </div>
    </div>
  );
}
