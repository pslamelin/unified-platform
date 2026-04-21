import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// 1. Import the Toaster component
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Lamelin Business Portal",
  description: "Enterprise management system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        
        {children}
        
        {/* 2. Add the Toaster right here so it renders on top of every page */}
        <Toaster />
        
      </body>
    </html>
  );
}