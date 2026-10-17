import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Rental App", template: "%s · Rental App" },
  description: "Manage properties, tenancies, rent payments and property finances.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full bg-background font-sans antialiased">{children}</body>
    </html>
  );
}
