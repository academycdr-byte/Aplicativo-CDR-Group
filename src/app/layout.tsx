import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CDR Group - Painel de Gestão",
  description: "Centralize seus dados de e-commerce e anúncios em um único lugar",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
