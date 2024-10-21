import { MountainIcon } from "@/components/icons";
import Sidebar from "@/app/dashboard/_components/sidebar";
import { ThemeSwitcher } from "@/components/theme-switcher";
import Link from "next/link";

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <>
            {/* Header spanning full width */}
            <header className="w-full p-4 border-b border-b-foreground/10 flex flex-row justify-between items-center">
                <div className="flex flex-row gap-2">
                <div className="flex gap-1 items-center font-medium text-md">
                    <MountainIcon />
                    <Link href={"/"}>Sherpa</Link>
                <div className="opacity-10 pl-1">|</div>
                </div>
                    <h2 className="">
                        Crystal Springs Middle School
                    </h2>
                </div>
                <ThemeSwitcher />
            </header>
            
            {/* Content area with sidebar and main content using responsive grid */}
            <div className="flex-1 flex">
                {/* Sidebar */}
                <aside className="w-64 flex-shrink-0">
                    <Sidebar />
                </aside>
                
                {/* Main content */}
                <main className="flex-grow overflow-hidden">
                    {children}
                </main>
            </div>
        </>
    );
}
