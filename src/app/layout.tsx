import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { PostHogProvider } from "@/components/analytics/posthog-provider";

const iaWriterQuattro = localFont({
  src: [
    {
      path: "./fonts/iAWriterQuattroS-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/iAWriterQuattroS-Italic.woff2",
      weight: "400",
      style: "italic",
    },
    {
      path: "./fonts/iAWriterQuattroS-Bold.woff2",
      weight: "700",
      style: "normal",
    },
    {
      path: "./fonts/iAWriterQuattroS-BoldItalic.woff2",
      weight: "700",
      style: "italic",
    },
  ],
  variable: "--font-quattro",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://mangui.com.ar"
  ),
  title: {
    default: "Mangui 🥭 — Finanzas personales en pesos y dólares",
    template: "%s | Mangui 🥭",
  },
  description:
    "Controlá tus gastos, ingresos y ahorros en ARS y USD con mangui. Multimoneda, cuotas, presupuestos y más — hecho para Argentina.",
  manifest: "/manifest.json",
  icons: {
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Mangui 🥭",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "es_AR",
    url: "https://mangui.com.ar",
    siteName: "Mangui 🥭",
    title: "Mangui 🥭 — Finanzas personales en pesos y dólares",
    description:
      "Controlá tus gastos, ingresos y ahorros en ARS y USD con Mangui 🥭. Multimoneda, cuotas, presupuestos y más — hecho para Argentina.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Mangui 🥭 — Finanzas personales para Argentina",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Mangui 🥭 — Finanzas personales en pesos y dólares",
    description:
      "Controlá tus gastos, ingresos y ahorros en ARS y USD con Mangui 🥭. Hecho para Argentina.",
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
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es-AR"
      className={`${iaWriterQuattro.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <PostHogProvider>
          <Providers>{children}</Providers>
        </PostHogProvider>
        <Analytics />
      </body>
    </html>
  );
}
