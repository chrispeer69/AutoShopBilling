import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ShopDesk",
  description: "Invoicing + CRM for small auto repair shops",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
