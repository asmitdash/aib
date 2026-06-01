import type { Metadata } from "next";
import Link from "next/link";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";

import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AiB — Architecture-in-a-Box",
  description:
    "Paste a spec. Get an architecture: diagram, stack, data model, failure modes, estimate. 60 seconds. No login.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${jetBrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[var(--background)] text-[var(--foreground)]">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <header className="sticky top-0 z-40 h-14 border-b border-[var(--border)] bg-[var(--background)]/95 backdrop-blur">
            <div className="mx-auto flex h-full max-w-[1200px] items-center justify-between px-6">
              <Link href="/" className="flex items-center gap-3">
                <span className="font-mono text-base font-semibold tracking-tight">
                  AiB
                </span>
                <span className="hidden text-sm text-[var(--muted-foreground)] sm:inline">
                  Architecture-in-a-Box
                </span>
              </Link>
              <nav className="flex items-center gap-4 text-sm text-[var(--muted-foreground)]">
                <a
                  href="https://github.com"
                  className="hover:text-[var(--foreground)]"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  GitHub
                </a>
              </nav>
            </div>
          </header>
          <main className="flex flex-1 flex-col">{children}</main>
          <footer className="h-10 border-t border-[var(--border)]">
            <div className="mx-auto flex h-full max-w-[1200px] items-center justify-between px-6 text-xs text-[var(--muted-foreground)]">
              <span>v0.1 — paste-only — 60s bundles — $0–$5/run</span>
            </div>
          </footer>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
