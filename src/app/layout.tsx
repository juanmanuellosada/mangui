import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, Calistoga } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const ibmPlexSans = IBM_Plex_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const calistoga = Calistoga({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://mangui.app"
  ),
  title: {
    default: "mangui — Finanzas personales en pesos y dólares",
    template: "%s | mangui",
  },
  description:
    "Controlá tus gastos, ingresos y ahorros en ARS y USD con mangui. Multimoneda, cuotas, presupuestos y más — hecho para Argentina.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "mangui",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "es_AR",
    url: "https://mangui.app",
    siteName: "mangui",
    title: "mangui — Finanzas personales en pesos y dólares",
    description:
      "Controlá tus gastos, ingresos y ahorros en ARS y USD con mangui. Multimoneda, cuotas, presupuestos y más — hecho para Argentina.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "mangui — Finanzas personales para Argentina",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "mangui — Finanzas personales en pesos y dólares",
    description:
      "Controlá tus gastos, ingresos y ahorros en ARS y USD con mangui. Hecho para Argentina.",
    images: ["/og-image.png"],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAFAF9" },
    { media: "(prefers-color-scheme: dark)", color: "#0B1410" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es-AR"
      className={`${ibmPlexSans.variable} ${calistoga.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
