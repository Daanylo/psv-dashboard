"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useMemo, useState } from "react"
import type { ComponentType } from "react"
import {
  BarChart3,
  Briefcase,
  Calendar,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Code,
  Handshake,
  Home,
  Settings,
  Users,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Separator } from "@/components/ui/separator"

type NavItem = {
  label: string
  href: string
  icon: ComponentType<{ className?: string }>
}

type NavSection = {
  title: string
  items: NavItem[]
}

function SidebarLink({
  href,
  label,
  icon: Icon,
  isCollapsed,
}: {
  href: string
  label: string
  icon: ComponentType<{ className?: string }>
  isCollapsed: boolean
}) {
  const pathname = usePathname()

  const isActive = useMemo(() => {
    if (href === "/") return pathname === "/"
    return pathname?.startsWith(href)
  }, [href, pathname])

  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(
        "group relative flex items-center overflow-hidden py-2 text-sm",
        isCollapsed ? "justify-center px-2" : "px-3",
        "transition-colors duration-300",
        "before:absolute before:inset-0 before:z-0",
        "before:bg-black before:origin-left before:transition-transform before:duration-300 before:ease-out",
        isCollapsed
          ? "before:[clip-path:polygon(0_0,100%_0,calc(100%_-_2px)_100%,0_100%)]"
          : "before:[clip-path:polygon(0_0,100%_0,calc(100%_-_12px)_100%,0_100%)]",
        isActive ? "text-white before:scale-x-100" : "text-sidebar-foreground before:scale-x-0",
        "hover:text-white hover:before:scale-x-100"
      )}
    >
      <span className={cn("relative z-10 flex items-center", isCollapsed ? "" : "gap-2")}>
        <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-white" : "")} />
        <span className={cn("truncate", isCollapsed ? "sr-only" : "")}>{label}</span>
      </span>
    </Link>
  )
}

export default function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [developerMode, setDeveloperMode] = useState(false)

  const sections: NavSection[] = useMemo(
    () => [
      {
        title: "GENERAL",
        items: [
          { label: "Overview", href: "/", icon: Home },
          { label: "Commercial Hub", href: "/commercial-hub", icon: Briefcase },
          { label: "Engagement Hub", href: "/engagement-hub", icon: BarChart3 },
        ],
      },
      {
        title: "REPORTS",
        items: [
          { label: "Events", href: "/events", icon: Calendar },
          { label: "Sponsors", href: "/sponsors-report", icon: Handshake },
          { label: "Players", href: "/players", icon: Users },
        ],
      },
    ],
    []
  )

  return (
    <aside
      className={cn(
        "sticky top-0 h-screen shrink-0 border-r bg-sidebar text-sidebar-foreground",
        "transition-[width] duration-300 ease-in-out",
        isCollapsed ? "w-16" : "w-72"
      )}
    >
      <div className={cn("flex items-center justify-between", isCollapsed ? "px-2 py-3" : "px-4 py-4")}>
        <div
          className={cn(
            "overflow-hidden transition-[width,opacity] duration-300 ease-in-out",
            isCollapsed ? "w-0 opacity-0" : "w-[120px] opacity-100"
          )}
        >
          <Image
            src="/social-logos/psv-pulse2.png"
            alt="PSV Pulse"
            width={120}
            height={48}
            priority
          />
        </div>

        <div className={cn("flex justify-center", isCollapsed ? "flex-1 " : "")}>
          <button
            type="button"
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={() => setIsCollapsed((v) => !v)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border bg-background text-foreground hover:bg-accent"
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>


      </div>

      <div className={cn("flex h-[calc(100vh-64px)] flex-col", isCollapsed ? "px-2" : "")}>
        <nav className="flex-1 overflow-y-auto px-2 pb-2">
          {sections.map((section) => (
            <div key={section.title} className="mb-3">
              <div
                className={cn(
                  "px-3 py-2 text-xs font-semibold text-muted-foreground",
                  isCollapsed ? "sr-only" : ""
                )}
              >
                {section.title}
              </div>
              <div className="space-y-1">
                {section.items.map((item) => (
                  <SidebarLink
                    key={item.href + item.label}
                    href={item.href}
                    icon={item.icon}
                    label={item.label}
                    isCollapsed={isCollapsed}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="px-2 pb-3">
          <Separator className="mb-3" />

          <div className="space-y-1">
            <SidebarLink href="/settings" label="Settings" icon={Settings} isCollapsed={isCollapsed} />
            <SidebarLink href="/help" label="Help" icon={CircleHelp} isCollapsed={isCollapsed} />

            <button
              type="button"
              aria-pressed={developerMode}
              onClick={() => setDeveloperMode((v) => !v)}
              className={cn(
                "flex w-full items-center rounded-md py-2 text-sm transition-colors",
                isCollapsed ? "justify-center px-2" : "justify-between px-3"
              )}
            >
              <span className={cn("flex items-center", isCollapsed ? "" : "gap-2")}>
                <Code className="h-4 w-4 shrink-0" />
                <span className={cn(isCollapsed ? "sr-only" : "")}>Developer Mode</span>
              </span>
              <span
                className={cn(
                  "inline-flex h-5 w-9 items-center rounded-full border p-0.5 transition-colors",
                  isCollapsed ? "hidden" : "",
                  developerMode ? "bg-sidebar-primary border-none" : "bg-background"
                )}
              >
                <span
                  className={cn(
                    "h-4 w-4 rounded-full bg-gray-200 transition-transform",
                    developerMode ? "translate-x-4 bg-white" : "translate-x-0"
                  )}
                />
              </span>
            </button>
          </div>

          <div className={cn("mt-3 bg-black p-3 text-white", isCollapsed ? "hidden" : "")}>
            <div className="text-xs font-semibold">User</div>
            <div className="mt-1 text-sm">Not signed in</div>
          </div>
        </div>

        <div
          className={cn(
            "mt-auto px-3 py-2 text-xs text-muted-foreground",
            isCollapsed ? "text-center" : ""
          )}
        >
          © 2025 Citric Labs
        </div>
      </div>
    </aside>
  )
}
