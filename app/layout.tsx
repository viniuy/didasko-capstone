import type React from "react";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/shared/components/theme-provider";
import { AuthProvider } from "@/shared/components/auth-provider";
import { QueryProvider } from "@/providers/query-provider";
import { Toaster } from "react-hot-toast";
import { Loading } from "@/shared/components/layout/Loading";
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
          <Toaster
            position="top-center"
            containerClassName="my-toaster-container"
            toastOptions={{
              className: "",
              style: {
                background: "#fff",
                color: "#124A69",
                border: "1px solid #e5e7eb",
                boxShadow:
                  "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
                borderRadius: "0.5rem",
                padding: "1rem",
              },
              success: {
                style: {
                  background: "#fff",
                  color: "#124A69",
                  border: "1px solid #e5e7eb",
                },
                iconTheme: {
                  primary: "#124A69",
                  secondary: "#fff",
                },
              },
              error: {
                style: {
                  background: "#fff",
                  color: "#dc2626",
                  border: "1px solid #e5e7eb",
                },
                iconTheme: {
                  primary: "#dc2626",
                  secondary: "#fff",
                },
              },
              loading: {
                style: {
                  background: "#fff",
                  color: "#124A69",
                  border: "1px solid #e5e7eb",
                },
              },
            }}
          />

          <QueryProvider>
            <AuthProvider>
              <Loading />
              {children}
            </AuthProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
