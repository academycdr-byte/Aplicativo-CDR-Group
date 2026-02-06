export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--muted)] px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-[var(--primary)] rounded-xl flex items-center justify-center text-white font-bold text-lg mx-auto mb-4">
            CDR
          </div>
          <h2 className="text-xl font-semibold">CDR Group</h2>
        </div>
        {children}
      </div>
    </div>
  );
}
