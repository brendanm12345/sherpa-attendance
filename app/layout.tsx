import DeployButton from "@/components/deploy-button";
import { EnvVarWarning } from "@/components/env-var-warning";
import HeaderAuth from "@/components/header-auth";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { hasEnvVars } from "@/utils/supabase/check-env-vars";
import { GeistSans } from "geist/font/sans";
import { ThemeProvider } from "next-themes";
import Link from "next/link";
import "./globals.css";
import { MountainSnow, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/toaster";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata = {
  metadataBase: new URL(defaultUrl),
  title: "Next.js and Supabase Starter Kit",
  description: "The fastest way to build apps with Next.js and Supabase",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={GeistSans.className} suppressHydrationWarning>
      <body className="bg-background text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <main className="min-h-screen flex flex-row h-full">
            {/* sidbar */}
            <nav className="flex flex-col justify-between items-start border-r border-b-foreground/10 bg-accent">
              {/* top */}
              <div className="flex flex-col p-6 text-sm gap-6 w-full">
                <div className="flex gap-2 items-center font-semibold">
                  <MountainSnow size={20} />
                  <Link href={"/"}>Sherpa</Link>
                </div>
                <div className="flex flex-col gap-2 w-full">
                  {/* Section Header */}
                  <p className="opacity-50">
                    Attendance
                  </p>
                  {/* Section Links */}
                  <div>
                    <Button variant="secondary" className="w-full">
                      <Link href={"/"} className="flex flex-row gap-2 w-full items-start">
                        <Send size={20} />
                        Conversations
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
              {/* bottom */}
              <div className="flex flex-col p-6 text-sm">
                <div className="bg-white border border-b-foreground/10 rounded-md p-3">
                  {!hasEnvVars ? <EnvVarWarning /> : <HeaderAuth />}
                </div>
              </div>
            </nav>
            {/* Main Section */}
            <div className="flex-1 flex flex-col">
              {/* Header */}
              <div className="p-6 border-b border-b-foreground/10 flex flex-row justify-between items-center" >
                <div className="flex flex-row gap-2">
                  <h2>Palo Alto Unified School District | </h2>
                  <h2 className="opacity-50">
                    Crystal Springs Middle School
                  </h2>
                </div>
                <ThemeSwitcher />
              </div>
              {/* Page Body */}
              <div className="flex flex-col w-full">
                {children}
              </div>
            </div>
          </main>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
