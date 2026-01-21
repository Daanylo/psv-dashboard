import Link from "next/link"
import { ReactNode } from "react"
import { cn } from "@/lib/utils"

export function getPlayerReportHref(playerId: number) {
  return `/players?player_id=${encodeURIComponent(String(playerId))}`
}

export function PlayerLink({
  playerId,
  children,
  className,
}: {
  playerId: number | null | undefined
  children: ReactNode
  className?: string
}) {
  if (!playerId) {
    return <span className={className}>{children}</span>
  }

  return (
    <Link
      href={getPlayerReportHref(playerId)}
      className={cn("hover:underline underline-offset-4", className)}
    >
      {children}
    </Link>
  )
}
