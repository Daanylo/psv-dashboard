"use client"

import Image from "next/image"
import Link from "next/link"
import { useMemo, useState } from "react"
import { ArrowRight, Calendar as CalendarIcon, Download, Filter } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"

type DateRangeKey = "7" | "30" | "90" | "365" | "custom"

function formatShortDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function toIsoDateOnly(date: Date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function parseLocalIsoDate(value: string) {
  const [y, m, d] = value.split("-").map(Number)
  return new Date(y, m - 1, d)
}

function getDateRange(days: number, endDate: Date) {
  const end = new Date(endDate)
  end.setHours(0, 0, 0, 0)

  const start = new Date(end)
  start.setDate(start.getDate() - (days - 1))

  return { start, end }
}

function getRatingBadgeClass(rating: number) {
  if (rating < 6) return "bg-red-500"
  if (rating < 8) return "bg-orange-400"
  return "bg-green-500"
}

export default function EventsPage() {
  const [search, setSearch] = useState("")
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [dateRangeKey, setDateRangeKey] = useState<DateRangeKey>("30")
  const [customStart, setCustomStart] = useState<Date | undefined>()
  const [customEnd, setCustomEnd] = useState<Date | undefined>()

  const { start, end } = useMemo(() => {
    if (dateRangeKey === "custom") {
      const e = customEnd || new Date()
      const s = customStart || new Date(new Date().setDate(new Date().getDate() - 30))
      e.setHours(23, 59, 59, 999)
      s.setHours(0, 0, 0, 0)
      return { start: s, end: e }
    }
    const map: Record<string, number> = {
      "7": 7,
      "30": 30,
      "90": 90,
      "365": 365,
    }
    return getDateRange(map[dateRangeKey] || 30, new Date())
  }, [dateRangeKey, customStart, customEnd])

  const dateRangeLabel = useMemo(() => `${formatShortDate(start)} - ${formatShortDate(end)}`, [start, end])

  const periodLabel = useMemo(() => {
    if (dateRangeKey === "custom") return "Custom Range"
    const labels: Record<string, string> = {
      "7": "Last 7 days",
      "30": "Last 30 days",
      "90": "Last 90 days",
      "365": "Last 365 days",
    }
    return labels[dateRangeKey] || "Select period"
  }, [dateRangeKey])

  const recentEventDateLabel = useMemo(() => formatShortDate(end), [end])

  const bestRating = 8.6
  const worstRating = 5.8

  return (
    <main className="max-w-screen-xl mx-auto px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="max-w-[300px] flex-1">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="border-input placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 dark:hover:bg-input/50 h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-2 text-sm transition-[color] outline-none focus:border-primary"
          />
        </div>

        <div className="flex items-center gap-2">
          {dateRangeKey === "custom" && (
            <>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">From</span>
                <input
                  type="date"
                  value={customStart ? toIsoDateOnly(customStart) : ""}
                  onChange={(e) => {
                    if (!e.target.value) {
                      setCustomStart(undefined)
                      return
                    }
                    setCustomStart(parseLocalIsoDate(e.target.value))
                  }}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">To</span>
                <input
                  type="date"
                  value={customEnd ? toIsoDateOnly(customEnd) : ""}
                  onChange={(e) => {
                    if (!e.target.value) {
                      setCustomEnd(undefined)
                      return
                    }
                    setCustomEnd(parseLocalIsoDate(e.target.value))
                  }}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                />
              </div>
              <Separator orientation="vertical" className="h-6" />
            </>
          )}

          <div className="flex items-center gap-2">
            <div className="inline-flex items-stretch">
              <div className="border-input gap-2 bg-background text-foreground inline-flex h-9 items-center rounded-l-md border px-3 text-sm">
                <CalendarIcon className="h-4 w-4" />
                {dateRangeLabel}
              </div>
              <Select value={dateRangeKey} onValueChange={(v) => setDateRangeKey(v as DateRangeKey)}>
                <SelectTrigger className="h-9 rounded-l-none border-l-0">
                  <SelectValue>{periodLabel}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                  <SelectItem value="365">Last 365 days</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setIsFilterOpen((v) => !v)}
              className="inline-flex h-9 items-center gap-2 rounded-md border bg-background px-3 text-sm text-foreground hover:bg-accent"
              aria-haspopup="menu"
              aria-expanded={isFilterOpen}
            >
              <Filter className="h-4 w-4" />
              <span>Filter</span>
            </button>

            {isFilterOpen ? (
              <div
                role="menu"
                className="bg-popover text-popover-foreground absolute right-0 top-full z-50 mt-2 w-56 rounded-md border p-2 text-sm shadow-md"
              >
                <div className="px-2 py-1.5 text-muted-foreground">No filters yet</div>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            className="inline-flex h-9 items-center gap-2 rounded-md border bg-background px-3 text-sm text-foreground hover:bg-accent"
          >
            <Download className="h-4 w-4" />
            <span>Export</span>
          </button>
        </div>
      </div>

      <section
        className={
          "relative mt-6 h-[150px] overflow-hidden" +
          " before:absolute before:inset-0 before:z-0 before:bg-black" +
          " before:[clip-path:polygon(0_0,100%_0,calc(100%_-_12px)_100%,0_100%)]"
        }
      >
        <div className="relative z-10 flex h-full flex-nowrap items-stretch justify-between px-6 text-white">
          <div className="flex flex-none flex-col justify-center">
            <div className="flex items-baseline gap-2 justify-between">
              <div className="text-sm">Recent event</div>
              <div className="text-sm text-white/80">{recentEventDateLabel}</div>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <Image
                src="/club-logos/Logo_AFC_Ajax_(1928-1991,_2025-).png"
                alt="Home club"
                width={35}
                height={35}
              />
              <div className="text-3xl font-psv-branding italic">3 - 0</div>
              <Image src="/club-logos/Feyenoord_logo.svg.png" alt="Away club" width={35} height={35} />
            </div>
          </div>

          <div className="flex h-full flex-none items-center gap-4">
            <div className="self-end h-full pt-4">
              <Image
                src="/player_images/20.png"
                alt="Best performance player"
                width={240}
                height={480}
                className="h-full w-auto object-contain object-bottom"
              />
            </div>

            <div className="flex flex-none items-start gap-3">
              <div>
                <div className="text-sm">Best performance</div>
                <div className="flex items-center gap-2">
                  <div>
                    <div className="mt-1 text-xs text-white">Guus</div>
                    <div className="font-psv-branding italic text-3xl leading-none">Til</div>
                  </div>
                  <div
                    className={
                      "inline-flex h-5 items-center rounded-md px-2 text-xs font-semibold text-black " +
                      getRatingBadgeClass(bestRating)
                    }
                  >
                    {bestRating.toFixed(1)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex h-full flex-none items-center gap-4 ">
            <div className="self-end h-full pt-4">
              <Image
                src="/player_images/4.png"
                alt="Worst performance player"
                width={240}
                height={480}
                className="h-full w-auto object-contain object-bottom"
              />
            </div>

            <div className="flex flex-none items-start gap-3">
              <div>
                <div className="text-sm">Worst performance</div>
                <div className="flex items-center gap-2">
                  <div>
                    <div className="mt-1 text-xs text-white">Armando</div>
                    <div className="font-psv-branding italic text-3xl leading-none">Obispo</div>
                  </div>
                  <div
                    className={
                      "inline-flex h-5 items-center rounded-md px-2 text-xs font-semibold text-black " +
                      getRatingBadgeClass(worstRating)
                    }
                  >
                    {worstRating.toFixed(1)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-none items-center justify-end px-4">
            <Link
              href="/commercial-hub"
              className="inline-flex h-10 items-center gap-2 rounded-md bg-white px-4 text-sm text-black"
            >
              <ArrowRight className="h-4 w-4" />
              <span>View impact</span>
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
