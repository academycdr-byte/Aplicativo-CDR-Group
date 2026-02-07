import Image from "next/image";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--muted)] px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8 flex flex-col items-center">
          <div className="relative w-20 h-20 mb-4">
            <Image
              src="/logo.png.png"
              alt="CDR Group"
              fill
              className="object-contain"
              priority
            />
          </div>
          <h2 className="text-xl font-semibold">CDR Group</h2>
        </div>
        {children}
      </div>
    </div>
  );
}
