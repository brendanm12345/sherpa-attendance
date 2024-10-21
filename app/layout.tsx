import { ThemeProvider } from "next-themes";
import "./globals.css";
import localFont from 'next/font/local';
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
          <div className="min-h-screen flex flex-col">
            {children}
          </div>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
