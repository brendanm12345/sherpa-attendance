"use client"
import React from 'react'
import { Button } from '../../../components/ui/button'
import { ConversationIcon, SentIcon } from '../../../components/icons'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function tabs() {
    const pathname = usePathname();

    return (
        <div className="flex flex-col p-3 text-sm gap-6 w-full">
            <div className="flex flex-col gap-2 w-full">
                {/* Section Header */}
                <p className="opacity-50 px-3">
                    Attendance
                </p>
                {/* Section Links */}
                <div>
                    <Button
                        variant={pathname === "/dashboard" ? "secondary" : "ghost"}
                        className="w-full"
                    >
                        <Link href={"/dashboard"} className="flex flex-row gap-2 w-full items-center font-normal">
                            <ConversationIcon />
                            Conversations
                        </Link>
                    </Button>
                </div>
                <div>
                    <Button
                        variant={pathname === "/dashboard/campaigns" ? "secondary" : "ghost"}
                        className="w-full"
                    >
                        <Link href={"/dashboard/campaigns"} className="flex flex-row gap-2 w-full items-center font-normal">
                            <SentIcon />
                            Campaigns
                        </Link>
                    </Button>
                </div>
            </div>
        </div>
    )
}
