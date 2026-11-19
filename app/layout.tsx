import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// SF Pro is used on Apple devices (system font); Inter is the close match elsewhere.
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Armouring Dashboard",
  description: "Kharagpur armouring morning-meeting dashboard",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f2f7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
