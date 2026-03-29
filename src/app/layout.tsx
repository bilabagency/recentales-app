import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Recentales",
  description: "Organizá tus juntadas familiares en el campo",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
