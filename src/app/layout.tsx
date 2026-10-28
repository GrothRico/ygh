import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "YGH · Sammlung",
  description: "Private Verwaltung einer Yu-Gi-Oh!-Sammlung.",
  applicationName: "YGH Sammlung",
  appleWebApp: { capable: true, title: "YGH Sammlung", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
