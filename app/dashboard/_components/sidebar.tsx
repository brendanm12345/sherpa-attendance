import { EnvVarWarning } from "@/components/env-var-warning";
import HeaderAuth from "@/app/dashboard/_components/header-auth";
import { hasEnvVars } from "@/utils/supabase/check-env-vars";
import "@/app/globals.css";
import Tabs from "@/app/dashboard/_components/tabs";

export default function Sidebar() {
    return (
        <nav className="flex flex-col justify-between items-start border-r border-b-foreground/10 bg-accent h-full">
            {/* top */}
            <Tabs />
            {/* bottom */}
            <div className="flex flex-col p-6 text-sm">
                <div className="bg-white border border-b-foreground/10 rounded-md p-3">
                    {!hasEnvVars ? <EnvVarWarning /> : <HeaderAuth />}
                </div>
            </div>
        </nav>
    )
}
