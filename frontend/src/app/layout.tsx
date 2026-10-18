import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";

import { Providers } from "@/components/providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Expense Tracker",
  description: "Track spending, plan monthly budgets, and get AI budget suggestions.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <ClerkProvider>
      {/* next-themes sets the `class` attribute on <html> before hydration. */}
      <html
        lang="en"
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      >
        <body className="flex min-h-full flex-col bg-background text-foreground">
          <Providers>{children}</Providers>
        </body>
      </html>
    </ClerkProvider>
  );
}
