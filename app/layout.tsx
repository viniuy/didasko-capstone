import type React from "react";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/shared/components/theme-provider";
import { AuthProvider } from "@/shared/components/auth-provider";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Didasko",
  description: "Next.js application with Google authentication",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=0.8" />
      </head>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="didasko"
          enableSystem
          disableTransitionOnChange
        >
          <Toaster />
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
