import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PwaRegistrar } from "./PwaRegistrar";

export const metadata: Metadata = {
  title: "ROOMMIE — Hogar en sintonía",
  description:
    "Compras, actividades y lecturas de tu hogar compartido. Registrar y recordar, sin imponer.",
  applicationName: "ROOMMIE",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "ROOMMIE" },
  formatDetection: { telephone: false },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
};
export const viewport: Viewport = {
  themeColor: "#f8f8fb",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>
        <PwaRegistrar />
        {children}
      </body>
    </html>
  );
}
