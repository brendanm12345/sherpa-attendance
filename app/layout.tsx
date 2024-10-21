import { EnvVarWarning } from "@/components/env-var-warning";
import HeaderAuth from "@/components/header-auth";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { hasEnvVars } from "@/utils/supabase/check-env-vars";
import { ThemeProvider } from "next-themes";
import Link from "next/link";
import "./globals.css";
import localFont from 'next/font/local';
import { MountainIcon, ConversationIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/toaster";
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata = {
  metadataBase: new URL(defaultUrl),
  title: "24/7 AI Attendance Assistant",
  description: "Your own attendance assitant capable of automatically texting gaurdians about absences",
};

export const abcGinto = localFont({
  src: [
    {
      path: '../public/fonts/ABCGintoNormal-Regular-Trial-BF651b7b7389896.woff',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../public/fonts/ABCGintoNormal-Medium-Trial-BF651b7b7332bb4.woff',
      weight: '500',
      style: 'medium',
    },
    {
      path: '../public/fonts/ABCGintoNormal-Bold-Trial-BF651b7b7309f45.woff',
      weight: '700',
      style: 'bold',
    },

  ],
  variable: '--font-abc-ginto',
});

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createServerComponentClient({ cookies });
  const { data, error } = await supabase.auth.getSession()
  console.log("Session:", data)

  return (
    <html lang="en" className={abcGinto.className} suppressHydrationWarning>
      <body className="bg-background text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <main className="min-h-screen flex flex-row h-full">
            {data ? (
              <>
                {/* Sidebar */}
                <nav className="flex flex-col justify-between items-start border-r border-b-foreground/10 bg-accent">
                  {/* top */}
                  <div className="flex flex-col p-6 text-sm gap-6 w-full">
                    <div className="flex gap-1 items-center font-medium text-lg">
                      <MountainIcon />
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
                          <Link href={"/"} className="flex flex-row gap-2 w-full items-center font-normal">
                            <ConversationIcon />
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
              </>
            ) : (
              // Render only the children when user is not logged in
              <div className="flex-1">
                {children}
              </div>
            )}
          </main>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
