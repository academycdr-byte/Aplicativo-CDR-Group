import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "CDR Group - Painel de Gestao",
    template: "%s | CDR Group",
  },
  description:
    "Centralize seus dados de e-commerce e anuncios em um unico lugar. Conecte Shopify, Nuvemshop, Cartpanda, Yampi, Facebook Ads, Google Ads e Reportana.",
  keywords: [
    "e-commerce",
    "dashboard",
    "shopify",
    "nuvemshop",
    "cartpanda",
    "yampi",
    "facebook ads",
    "google ads",
    "reportana",
    "vendas",
    "anuncios",
  ],
  authors: [{ name: "CDR Group" }],
  openGraph: {
    title: "CDR Group - Painel de Gestao",
    description:
      "Centralize seus dados de e-commerce e anuncios em um unico lugar.",
    type: "website",
    locale: "pt_BR",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </head>
      <body>
        <SessionProvider>
          <ThemeProvider>
            {children}
            <Toaster richColors position="top-right" />
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
