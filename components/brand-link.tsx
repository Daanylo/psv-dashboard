import Link from "next/link"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "")
}

export function getSponsorsReportHref(brand: string | null | undefined) {
  const b = (brand ?? "").trim()
  const key = b ? slugify(b) : ""
  const sp = new URLSearchParams()
  if (key) sp.set("brand", key)
  return `/sponsors-report${sp.toString() ? `?${sp.toString()}` : ""}`
}

export function BrandLink({
  brand,
  className,
  children,
}: {
  brand: string | null | undefined
  className?: string
  children: ReactNode
}) {
  return (
    <Link href={getSponsorsReportHref(brand)} className={cn("inline-flex", className)}>
      {children}
    </Link>
  )
}
