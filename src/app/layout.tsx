import type { Metadata, Viewport } from "next";
import { Nunito_Sans } from "next/font/google";
import "./globals.css";

const fonte = Nunito_Sans({
  variable: "--font-sans-app",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Nina — Assistente de Curadores",
  description:
    "Conversas assistidas com residentes e relatórios de acompanhamento para a equipe de curadoria.",
  manifest: "/manifest.json",
  applicationName: "Nina",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Nina" },
  icons: {
    icon: [
      { url: "/icone-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icone-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  // Sistema privado: fora de buscador, e sem preview em link compartilhado.
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = {
  themeColor: "#0f5b5a",
  width: "device-width",
  initialScale: 1,
  // Zoom desabilitado por causa do quiosque; o tamanho base já é 18px.
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${fonte.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-fundo text-tinta">{children}</body>
    </html>
  );
}
