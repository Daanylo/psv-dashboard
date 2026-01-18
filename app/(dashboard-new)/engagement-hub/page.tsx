"use client"

import Image from "next/image"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowUpDown,
  ArrowRight,
  BadgeEuro,
  Bookmark,
  CalendarIcon,
  Download,
  Filter,
  Flag,
  Heart,
  LineChart as LineChartIcon,
  MessageCircle,
  MessageSquareText,
  PieChart as PieChartIcon,
  Repeat2,
  Share2,
  Smile,
  Star,
  ThumbsDown,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Separator } from "@/components/ui/separator"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts"
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type DateRangeKey = "7" | "30" | "90" | "365" | "custom"
type JourneyGranularity = "daily" | "weekly"

type SentimentJourneyPoint = {
  label: string
  positiveCount: number
  negativeCount: number
  negativeDisplay: number
  isoStart: string
  isoEnd: string
}

type SentimentJourneySummary = {
  positiveCount: number
  negativeCount: number
  positiveChangePct: number
  negativeChangePct: number
}

type SentimentJourneyEvent = {
  id: string
  xLabel: string
  title: string
  subtitle: string
}

const sentimentJourneyChartConfig: ChartConfig = {
  positiveCount: {
    label: "Positive",
    color: "hsl(var(--chart-1))",
  },
  negativeDisplay: {
    label: "Negative",
    color: "hsl(var(--chart-2))",
  },
}

function formatDeltaPct(value: number) {
  const abs = Math.abs(value)
  const rounded = abs < 10 ? abs.toFixed(1) : Math.round(abs).toString()
  return `${value >= 0 ? "+" : "-"}${rounded}%`
}

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

function legendLabel(name: string) {
  const trimmed = name.trim()
  if (!trimmed) return name
  const parts = trimmed.split(/\s+/)
  return parts[parts.length - 1] ?? name
}

function addDaysLocal(date: Date, days: number) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function mulberry32(seed: number) {
  return function random() {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function labelForDate(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function startOfWeekLocal(date: Date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function endOfWeekLocal(date: Date) {
  const start = startOfWeekLocal(date)
  return addDaysLocal(start, 6)
}

function percentChange(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : 100
  return ((current - previous) / previous) * 100
}

function makeMockJourney(start: Date, end: Date, granularity: JourneyGranularity, seedBase: number) {
  const points: SentimentJourneyPoint[] = []

  const startDay = new Date(start)
  startDay.setHours(0, 0, 0, 0)
  const endDay = new Date(end)
  endDay.setHours(0, 0, 0, 0)

  let cursor = new Date(startDay)
  let index = 0

  while (cursor <= endDay) {
    const rangeStart = granularity === "weekly" ? startOfWeekLocal(cursor) : new Date(cursor)
    const rangeEnd = granularity === "weekly" ? endOfWeekLocal(cursor) : new Date(cursor)

    if (rangeEnd < startDay) {
      cursor = addDaysLocal(cursor, 1)
      continue
    }

    if (rangeStart > endDay) break

    const visibleStart = rangeStart < startDay ? startDay : rangeStart
    const visibleEnd = rangeEnd > endDay ? endDay : rangeEnd

    const localSeed =
      seedBase +
      toIsoDateOnly(visibleStart)
        .split("")
        .reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
    const r = mulberry32(localSeed)

    const total = 420 + Math.floor(r() * 680)

    const t = index / (granularity === "weekly" ? 10 : 30)
    const wave = Math.sin(t * Math.PI * 2) * 22
    const noise = (r() - 0.5) * 18
    const sentimentScore = clamp(Math.round(wave + noise), -40, 40)
    const positivity = clamp((sentimentScore + 100) / 200, 0, 1)

    const pos = Math.round(total * (0.25 + 0.55 * positivity) * (0.92 + r() * 0.16))
    const neg = Math.round(total * (0.75 - 0.55 * positivity) * (0.92 + r() * 0.16))

    points.push({
      label: labelForDate(visibleStart),
      positiveCount: pos,
      negativeCount: neg,
      negativeDisplay: -neg,
      isoStart: toIsoDateOnly(visibleStart),
      isoEnd: toIsoDateOnly(visibleEnd),
    })

    index += 1

    cursor = granularity === "weekly" ? addDaysLocal(rangeEnd, 1) : addDaysLocal(cursor, 1)
  }

  const positiveCount = points.reduce((acc, p) => acc + p.positiveCount, 0)
  const negativeCount = points.reduce((acc, p) => acc + p.negativeCount, 0)

  return { points, positiveCount, negativeCount }
}

function makeMockJourneyEvents(points: SentimentJourneyPoint[], seedBase: number) {
  if (!points.length) return [] as SentimentJourneyEvent[]

  const titles = [
    { title: "Matchday", subtitle: "PSV fixture" },
    { title: "Transfer", subtitle: "Squad update" },
    { title: "Announcement", subtitle: "Club news" },
    { title: "Campaign", subtitle: "Sponsor activation" },
  ] as const

  const r = mulberry32(seedBase + 202)
  const targetCount = Math.min(3, Math.max(1, Math.floor(points.length / 8)))

  const chosen = new Set<number>()
  const minIndex = Math.min(3, points.length - 1)
  const maxIndex = Math.max(minIndex, points.length - 4)

  while (chosen.size < targetCount) {
    const idx = clamp(minIndex + Math.floor(r() * (maxIndex - minIndex + 1)), 0, points.length - 1)
    chosen.add(idx)
  }

  return Array.from(chosen)
    .sort((a, b) => a - b)
    .map((idx, i) => {
      const pick = titles[(i + Math.floor(r() * titles.length)) % titles.length]
      const p = points[idx]
      return {
        id: `${seedBase}-${idx}-${pick.title}`,
        xLabel: p.label,
        title: pick.title,
        subtitle: pick.subtitle,
      }
    })
}

function SentimentJourneyEventOverlay({
  points,
  events,
  plotLeftPx,
  plotRightPx,
}: {
  points: SentimentJourneyPoint[]
  events: SentimentJourneyEvent[]
  plotLeftPx: number
  plotRightPx: number
}) {
  if (!events.length || !points.length) return null

  const count = points.length

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <div className="absolute top-0" style={{ left: plotLeftPx, right: plotRightPx, height: "100%" }}>
        {events.map((event) => {
          const idx = points.findIndex((p) => p.label === event.xLabel)
          if (idx < 0) return null

          const leftPct = ((idx + 0.5) / count) * 100

          return (
            <div key={event.id} className="absolute" style={{ left: `${leftPct}%`, top: -10 }}>
              <div className="group pointer-events-auto relative z-10 hover:z-50" style={{ transform: "translateX(-14px)" }}>
                <div
                  className={
                    "flex h-7 items-center overflow-hidden rounded-md border border-border bg-background " +
                    "transition-[width,padding,justify-content] duration-150 ease-out " +
                    "w-7 justify-center px-0 " +
                    "group-hover:w-[180px] group-hover:justify-start group-hover:px-2"
                  }
                >
                  <Flag className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div
                    className={
                      "ml-0 group-hover:ml-2 overflow-hidden whitespace-nowrap " +
                      "max-w-0 opacity-0 transition-[max-width,opacity] duration-150 ease-out " +
                      "group-hover:max-w-[140px] group-hover:opacity-100"
                    }
                  >
                    <div className="truncate text-xs font-medium text-foreground">{event.title}</div>
                    <div className="truncate text-[11px] text-muted-foreground">{event.subtitle}</div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

type MentionsShareSlice = {
  key: string
  name: string
  value: number
  color: string
}

const engagementMarqueeRowA = [
  { key: "like", label: "Likes", Icon: Heart },
  { key: "comment", label: "Comments", Icon: MessageCircle },
  { key: "share", label: "Shares", Icon: Share2 },
  { key: "bookmark", label: "Bookmarks", Icon: Bookmark },
  { key: "repost", label: "Reposts", Icon: Repeat2 },
] as const

const engagementMarqueeRowB = [
  { key: "comment", label: "Comments", Icon: MessageCircle },
  { key: "bookmark", label: "Bookmarks", Icon: Bookmark },
  { key: "like", label: "Likes", Icon: Heart },
  { key: "share", label: "Shares", Icon: Share2 },
  { key: "thumb", label: "Upvotes", Icon: ThumbsUp },
] as const

const engagementMarqueeRowC = [
  { key: "thumb", label: "Upvotes", Icon: ThumbsUp },
  { key: "like", label: "Likes", Icon: Heart },
  { key: "repost", label: "Reposts", Icon: Repeat2 },
  { key: "comment", label: "Comments", Icon: MessageCircle },
  { key: "bookmark", label: "Bookmarks", Icon: Bookmark },
  { key: "share", label: "Shares", Icon: Share2 },
] as const

export default function EngagementHubPage() {
  const [search, setSearch] = useState("")
  const [dateRangeKey, setDateRangeKey] = useState<DateRangeKey>("30")
  const [customStart, setCustomStart] = useState<Date | undefined>()
  const [customEnd, setCustomEnd] = useState<Date | undefined>()
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [journeyGranularity, setJourneyGranularity] = useState<JourneyGranularity>("daily")

  const sentimentVsMarketValueRef = useRef<HTMLDivElement | null>(null)
  const mentionsShareRef = useRef<HTMLDivElement | null>(null)
  const [playerReportHeightPx, setPlayerReportHeightPx] = useState<number | null>(null)
  const [hotTopicsHeightPx, setHotTopicsHeightPx] = useState<number | null>(null)

  useEffect(() => {
    const mql = window.matchMedia("(min-width: 768px)")

    const update = () => {
      if (!mql.matches) {
        setPlayerReportHeightPx(null)
        setHotTopicsHeightPx(null)
        return
      }

      const sentimentHeight = sentimentVsMarketValueRef.current?.getBoundingClientRect().height
      const mentionsHeight = mentionsShareRef.current?.getBoundingClientRect().height

      setPlayerReportHeightPx(sentimentHeight ? Math.round(sentimentHeight) : null)
      setHotTopicsHeightPx(mentionsHeight ? Math.round(mentionsHeight) : null)
    }

    const ro = new ResizeObserver(update)
    if (sentimentVsMarketValueRef.current) ro.observe(sentimentVsMarketValueRef.current)
    if (mentionsShareRef.current) ro.observe(mentionsShareRef.current)
    update()

    const onChange = () => update()
    mql.addEventListener("change", onChange)
    window.addEventListener("resize", update)

    return () => {
      ro.disconnect()
      mql.removeEventListener("change", onChange)
      window.removeEventListener("resize", update)
    }
  }, [])

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

  const sentimentJourneyData = useMemo(() => {
    const days = Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1
    const prevEnd = addDaysLocal(start, -1)
    const prevStart = addDaysLocal(prevEnd, -(days - 1))

    const seedBase =
      start.getFullYear() * 10000 +
      (start.getMonth() + 1) * 100 +
      start.getDate() +
      (journeyGranularity === "weekly" ? 777 : 333)

    const current = makeMockJourney(start, end, journeyGranularity, seedBase)
    const previous = makeMockJourney(prevStart, prevEnd, journeyGranularity, seedBase + 999)

    const summary: SentimentJourneySummary = {
      positiveCount: current.positiveCount,
      negativeCount: current.negativeCount,
      positiveChangePct: percentChange(current.positiveCount, previous.positiveCount),
      negativeChangePct: percentChange(current.negativeCount, previous.negativeCount),
    }

    return { points: current.points, summary }
  }, [start, end, journeyGranularity])

  const sentimentJourneyEvents = useMemo(() => {
    const seedBase = start.getFullYear() * 10000 + (start.getMonth() + 1) * 100 + start.getDate() + 909
    return makeMockJourneyEvents(sentimentJourneyData.points, seedBase)
  }, [sentimentJourneyData.points, start])

  const sentimentJourneyDomainMax = useMemo(() => {
    const maxAbs = sentimentJourneyData.points.reduce((acc, p) => {
      const candidate = Math.max(p.positiveCount, p.negativeCount)
      return Math.max(acc, candidate)
    }, 0)

    if (!maxAbs) return 1000
    const rounded = Math.ceil(maxAbs / 100) * 100
    return rounded
  }, [sentimentJourneyData.points])

  const mentionsShare = useMemo(() => {
    const data: MentionsShareSlice[] = [
      { key: "p1", name: "Guus Til", value: 28, color: "var(--chart-1)" },
      { key: "p2", name: "Armando Obispo", value: 18, color: "var(--chart-2)" },
      { key: "p3", name: "Johan Bakayoko", value: 22, color: "var(--chart-3)" },
      { key: "p4", name: "Joey Veerman", value: 16, color: "var(--chart-4)" },
      { key: "p5", name: "Luuk de Jong", value: 16, color: "var(--chart-5)" },
    ]

    const config: ChartConfig = Object.fromEntries(
      data.map((item) => [
        item.key,
        {
          label: item.name,
          color: item.color,
        },
      ])
    )

    return { data, config }
  }, [])

  const platformShare = useMemo(() => {
    const data: MentionsShareSlice[] = [
      { key: "ig", name: "Instagram", value: 44, color: "var(--chart-1)" },
      { key: "tt", name: "TikTok", value: 26, color: "var(--chart-2)" },
      { key: "yt", name: "YouTube", value: 18, color: "var(--chart-3)" },
      { key: "fb", name: "Facebook", value: 12, color: "var(--chart-4)" },
    ]

    const config: ChartConfig = Object.fromEntries(
      data.map((item) => [
        item.key,
        {
          label: item.name,
          color: item.color,
        },
      ])
    )

    return { data, config }
  }, [])

  return (
    <main className="max-w-screen-xl mx-auto px-6 py-8 space-y-6">
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

          <div className="inline-flex items-stretch shadow-sm">
            <div
              className="flex items-center gap-2 rounded-l-md border border-r-0 border-input bg-card px-3 text-sm text-muted-foreground"
              aria-hidden="true"
            >
              <CalendarIcon className="h-4 w-4" />
              <span>{dateRangeLabel}</span>
            </div>
            <Select value={dateRangeKey} onValueChange={(v) => setDateRangeKey(v as DateRangeKey)}>
              <SelectTrigger className="h-9 min-w-[140px] rounded-l-none border-l-0 bg-background font-medium hover:bg-accent hover:text-accent-foreground focus:ring-0">
                <SelectValue>{periodLabel}</SelectValue>
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
                <SelectItem value="365">Last year</SelectItem>
                <SelectItem value="custom">Custom Range</SelectItem>
              </SelectContent>
            </Select>
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
          "relative h-[150px] overflow-hidden" +
          " [clip-path:polygon(0_0,100%_0,calc(100%_-_12px)_100%,0_100%)]" +
          " before:absolute before:inset-0 before:z-0 before:bg-black"
        }
      >
        <div className="relative z-10 flex h-full flex-wrap items-stretch justify-between gap-6 px-6 text-white md:flex-nowrap">
          <div className="flex flex-1 flex-col justify-center">
            <div className="text-3xl font-bold font-psv-branding italic leading-none md:text-3xl">ENGAGEMENT HUB</div>
            <div className="mt-2 max-w-[520px] text-sm text-white/80">Player sentiment, mentions and engagement signals.</div>
          </div>
          <div className="relative hidden h-full w-full flex-none items-center overflow-hidden md:flex md:w-[400px] md:-mr-6">
            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-black to-transparent" />
            <div className="relative z-0 flex w-full flex-col gap-2 py-3">
              <div className="w-full overflow-hidden">
                <div
                  className="psv-logo-marquee psv-logo-marquee--a flex w-max items-center gap-6 will-change-transform"
                  style={{ animationDuration: "12s" }}
                >
                  {[...engagementMarqueeRowA, ...engagementMarqueeRowA].map((item, index) => (
                    <div
                      key={`eng-a-${item.key}-${index}`}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-white/5"
                    >
                      <item.Icon className="h-4 w-4 text-white/80" />
                      <span className="sr-only">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="w-full overflow-hidden">
                <div
                  className="psv-logo-marquee psv-logo-marquee--b flex w-max items-center gap-6 will-change-transform"
                  style={{ animationDuration: "16s" }}
                >
                  {[...engagementMarqueeRowB, ...engagementMarqueeRowB].map((item, index) => (
                    <div
                      key={`eng-b-${item.key}-${index}`}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-white/5"
                    >
                      <item.Icon className="h-4 w-4 text-white/70" />
                      <span className="sr-only">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="w-full overflow-hidden">
                <div
                  className="psv-logo-marquee psv-logo-marquee--c flex w-max items-center gap-6 will-change-transform"
                  style={{ animationDuration: "20s" }}
                >
                  {[...engagementMarqueeRowC, ...engagementMarqueeRowC].map((item, index) => (
                    <div
                      key={`eng-c-${item.key}-${index}`}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-white/5"
                    >
                      <item.Icon className="h-4 w-4 text-white/60" />
                      <span className="sr-only">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6 w-full rounded-xl border border-border bg-background overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2 text-base font-semibold font-psv-branding">
            <LineChartIcon className="h-4 w-4 text-primary" />
            <span>SENTIMENT JOURNEY</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex items-center rounded-md border border-border bg-background p-1 text-sm">
              <button
                type="button"
                onClick={() => setJourneyGranularity("daily")}
                className={cn(
                  "inline-flex h-7 items-center rounded-sm px-3",
                  journeyGranularity === "daily" ? "bg-black text-white" : "text-muted-foreground hover:bg-accent"
                )}
              >
                Daily
              </button>
              <button
                type="button"
                onClick={() => setJourneyGranularity("weekly")}
                className={cn(
                  "inline-flex h-7 items-center rounded-sm px-3",
                  journeyGranularity === "weekly" ? "bg-black text-white" : "text-muted-foreground hover:bg-accent"
                )}
              >
                Weekly
              </button>
            </div>

            <button
              type="button"
              className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm text-foreground hover:bg-accent"
            >
              <ArrowRight className="h-4 w-4" />
              <span>More</span>
            </button>
          </div>
        </div>

        <div className="flex w-full items-stretch">
          <div className="w-3/4 py-6">
            <ChartContainer
              config={sentimentJourneyChartConfig}
              className="h-[260px] w-full"
              overlay={
                <SentimentJourneyEventOverlay
                  points={sentimentJourneyData.points}
                  events={sentimentJourneyEvents}
                  plotLeftPx={40}
                  plotRightPx={18}
                />
              }
            >
              <BarChart
                data={sentimentJourneyData.points}
                margin={{ top: 12, right: 18, left: 0, bottom: 0 }}
                stackOffset="sign"
              >
                <CartesianGrid strokeDasharray="3 3" />
                <ReferenceLine y={0} stroke="var(--background)" strokeWidth={10} />
                <ReferenceLine y={0} stroke="hsl(var(--border))" />
                <ChartTooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const point = payload[0]?.payload as SentimentJourneyPoint | undefined
                    if (!point) return null

                    const total = point.positiveCount + point.negativeCount
                    const netPct = total === 0 ? 0 : ((point.positiveCount - point.negativeCount) / total) * 100
                    return (
                      <div className="rounded-lg bg-black px-3 py-2 text-white shadow-md">
                        <div className="text-sm font-semibold">{point.label}</div>
                        <div className="mt-2 space-y-1 text-sm">
                          <div className="flex items-center justify-between gap-6">
                            <span className="inline-flex items-center gap-2 text-green-500">
                              <ThumbsUp className="h-4 w-4" />
                            </span>
                            <span className="font-medium tabular-nums">{point.positiveCount.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center justify-between gap-6">
                            <span className="inline-flex items-center gap-2 text-red-500">
                              <ThumbsDown className="h-4 w-4" />
                            </span>
                            <span className="font-medium tabular-nums">{point.negativeCount.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center justify-between gap-2 pt-1 text-xs text-white/70">
                            <LineChartIcon className="h-3.5 w-3.5" />
                            <span className="tabular-nums">{netPct.toFixed(0)}%</span>
                          </div>
                        </div>
                      </div>
                    )
                  }}
                />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis
                  width={40}
                  domain={[-sentimentJourneyDomainMax, sentimentJourneyDomainMax]}
                  ticks={[-sentimentJourneyDomainMax, 0, sentimentJourneyDomainMax]}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => Math.abs(Number(v)).toLocaleString()}
                />
                <Bar dataKey="positiveCount" stackId="totals" radius={0} className="fill-green-500" />
                <Bar dataKey="negativeDisplay" stackId="totals" radius={0} className="fill-red-500" />
              </BarChart>
            </ChartContainer>
          </div>

          <div className="py-6">
            <Separator orientation="vertical" />
          </div>

          <div className="flex w-1/4 flex-col px-6 py-6 justify-evenly">
            <div className="flex items-center gap-4">
              <ThumbsUp className="h-10 w-10 shrink-0 text-green-500" />
              <div className="min-w-0">
                <div className="text-sm text-muted-foreground">Positive comments</div>
                <div className="mt-1 flex items-baseline gap-2">
                  <div className="font-psv-branding italic text-3xl leading-none">
                    {sentimentJourneyData.summary.positiveCount.toLocaleString()}
                  </div>
                  <div
                    className={cn(
                      "inline-flex items-center gap-1 text-sm font-semibold",
                      sentimentJourneyData.summary.positiveChangePct >= 0 ? "text-green-500" : "text-red-500"
                    )}
                  >
                    <span>{formatDeltaPct(sentimentJourneyData.summary.positiveChangePct)}</span>
                    {sentimentJourneyData.summary.positiveChangePct >= 0 ? (
                      <TrendingUp className="h-4 w-4" />
                    ) : (
                      <TrendingDown className="h-4 w-4" />
                    )}
                  </div>
                </div>
              </div>
            </div>

            <Separator className="my-6" />

            <div className="flex items-center gap-4">
              <ThumbsDown className="h-10 w-10 shrink-0 text-red-500" />
              <div className="min-w-0">
                <div className="text-sm text-muted-foreground">Negative comments</div>
                <div className="mt-1 flex items-baseline gap-2">
                  <div className="font-psv-branding italic text-3xl leading-none">
                    {sentimentJourneyData.summary.negativeCount.toLocaleString()}
                  </div>
                  <div
                    className={cn(
                      "inline-flex items-center gap-1 text-sm font-semibold",
                      sentimentJourneyData.summary.negativeChangePct >= 0 ? "text-red-500" : "text-green-500"
                    )}
                  >
                    <span>{formatDeltaPct(sentimentJourneyData.summary.negativeChangePct)}</span>
                    {sentimentJourneyData.summary.negativeChangePct >= 0 ? (
                      <TrendingUp className="h-4 w-4" />
                    ) : (
                      <TrendingDown className="h-4 w-4" />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6 flex w-full flex-col gap-6 md:flex-row md:items-start">
        <div
          className="flex flex-col overflow-hidden rounded-xl border border-border bg-background md:flex-1 md:min-w-0"
          style={playerReportHeightPx ? { height: playerReportHeightPx } : undefined}
        >
          <div className="flex items-center justify-between gap-3 px-6 py-4">
            <div className="text-base font-semibold font-psv-branding">PLAYER REPORT</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm text-foreground hover:bg-accent"
              >
                <Filter className="h-4 w-4" />
                <span>Filter</span>
              </button>
              <button
                type="button"
                className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm text-foreground hover:bg-accent"
              >
                <ArrowUpDown className="h-4 w-4" />
                <span>Sort</span>
              </button>
              <div className="text-sm text-muted-foreground">{periodLabel}</div>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto border-t border-border">
            <table className="w-full table-fixed text-xs">
              <colgroup>
                <col className="w-10" />
                <col />
                <col className="w-20" />
                <col className="w-14" />
                <col className="w-14" />
                <col className="w-20" />
              </colgroup>
              <thead>
                <tr>
                  <th className="sticky top-0 z-10 bg-muted px-3 py-2 text-left font-semibold text-muted-foreground">#</th>
                  <th className="sticky top-0 z-10 bg-muted px-3 py-2 text-left font-semibold text-muted-foreground">PLAYER</th>
                  <th className="sticky top-0 z-10 bg-muted px-3 py-2 text-right font-semibold text-muted-foreground">
                    <span className="inline-flex items-center justify-end gap-1">
                      <MessageSquareText className="h-3.5 w-3.5" />
                      <span className="sr-only">Mentions</span>
                    </span>
                  </th>
                  <th className="sticky top-0 z-10 bg-muted px-3 py-2 text-right font-semibold text-muted-foreground">
                    <span className="inline-flex items-center justify-end gap-1">
                      <Smile className="h-3.5 w-3.5" />
                      <span className="sr-only">Avg sentiment</span>
                    </span>
                  </th>
                  <th className="sticky top-0 z-10 bg-muted px-3 py-2 text-right font-semibold text-muted-foreground">
                    <span className="inline-flex items-center justify-end gap-1">
                      <Star className="h-3.5 w-3.5" />
                      <span className="sr-only">Avg performance</span>
                    </span>
                  </th>
                  <th className="sticky top-0 z-10 bg-muted px-3 py-2 text-right font-semibold text-muted-foreground">
                    <span className="inline-flex items-center justify-end gap-1">
                      <BadgeEuro className="h-3.5 w-3.5" />
                      <span className="sr-only">Market value</span>
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    {
                      rank: 1,
                      player: "Guus Til",
                      playerImageSrc: "/player_images/20.png",
                      mentions: 1840,
                      avgSentiment: 62,
                      avgPerformance: 8.6,
                      marketValue: "€32.5M",
                    },
                    {
                      rank: 2,
                      player: "Armando Obispo",
                      playerImageSrc: "/player_images/4.png",
                      mentions: 1290,
                      avgSentiment: 41,
                      avgPerformance: 5.8,
                      marketValue: "€7.0M",
                    },
                    {
                      rank: 3,
                      player: "Johan Bakayoko",
                      playerImageSrc: "/player_images/20.png",
                      mentions: 980,
                      avgSentiment: 57,
                      avgPerformance: 7.7,
                      marketValue: "€45.0M",
                    },
                    {
                      rank: 4,
                      player: "Joey Veerman",
                      playerImageSrc: "/player_images/4.png",
                      mentions: 860,
                      avgSentiment: 49,
                      avgPerformance: 7.3,
                      marketValue: "€28.0M",
                    },
                    {
                      rank: 5,
                      player: "Luuk de Jong",
                      playerImageSrc: "/player_images/20.png",
                      mentions: 820,
                      avgSentiment: 55,
                      avgPerformance: 7.1,
                      marketValue: "€4.0M",
                    },
                    {
                      rank: 6,
                      player: "Noa Lang",
                      playerImageSrc: "/player_images/4.png",
                      mentions: 780,
                      avgSentiment: 46,
                      avgPerformance: 6.9,
                      marketValue: "€25.0M",
                    },
                    {
                      rank: 7,
                      player: "Walter Benítez",
                      playerImageSrc: "/player_images/20.png",
                      mentions: 720,
                      avgSentiment: 52,
                      avgPerformance: 7.0,
                      marketValue: "€9.0M",
                    },
                    {
                      rank: 8,
                      player: "Olivier Boscagli",
                      playerImageSrc: "/player_images/4.png",
                      mentions: 690,
                      avgSentiment: 50,
                      avgPerformance: 6.8,
                      marketValue: "€15.0M",
                    },
                    {
                      rank: 9,
                      player: "Ismael Saibari",
                      playerImageSrc: "/player_images/20.png",
                      mentions: 640,
                      avgSentiment: 53,
                      avgPerformance: 6.7,
                      marketValue: "€20.0M",
                    },
                    {
                      rank: 10,
                      player: "Sergiño Dest",
                      playerImageSrc: "/player_images/4.png",
                      mentions: 610,
                      avgSentiment: 47,
                      avgPerformance: 6.6,
                      marketValue: "€16.0M",
                    },
                  ] as const
                ).map((row, index) => (
                  <tr key={row.rank} className={cn(index % 2 === 0 ? "bg-background" : "bg-muted", "h-8")}>
                    <td className="px-3 py-2 text-muted-foreground tabular-nums">{row.rank}</td>
                    <td className="h-full px-3">
                      <div className="flex h-full items-center gap-2">
                        <div className="pt-1 self-end">
                          <Image
                            src={row.playerImageSrc}
                            alt={row.player}
                            width={96}
                            height={192}
                            className="h-6 w-auto object-contain object-bottom"
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate">{row.player}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">{row.mentions.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.avgSentiment}%</td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.avgPerformance.toFixed(1)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.marketValue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div
          ref={sentimentVsMarketValueRef}
          className="flex w-full flex-col overflow-hidden rounded-xl border border-border bg-background md:w-[400px] md:min-w-[380px] md:flex-none"
        >
          <div className="flex items-baseline justify-between gap-3 px-6 py-4">
            <div className="text-base font-semibold font-psv-branding">SENTIMENT VS MARKET VALUE</div>
            <div className="text-sm text-muted-foreground">{periodLabel}</div>
          </div>

          <div className="px-6 pb-5 space-y-3">
            {([
              {
                firstName: "Guus",
                lastName: "Til",
                imageSrc: "/player_images/20.png",
                marketValue: "€9m",
                sentimentLabel: "70% positive",
                sentimentVariant: "positive" as const,
              },
              {
                firstName: "Johan",
                lastName: "Bakayoko",
                imageSrc: "/player_images/4.png",
                marketValue: "€20m",
                sentimentLabel: "65% negative",
                sentimentVariant: "negative" as const,
              },
            ] as const).map((player) => {
              const isPositive = player.sentimentVariant === "positive"
              return (
                <div key={player.lastName} className="rounded-xl bg-muted p-3 pb-0">
                  <div className="flex items-center gap-3">
                    <div className="shrink-0">
                      <Image
                        src={player.imageSrc}
                        alt={player.lastName}
                        width={128}
                        height={256}
                        className="h-full w-auto object-contain object-bottom"
                      />
                    </div>

                    <div className="min-w-0">
                      <div
                        className={
                          "relative inline-flex overflow-hidden px-3 py-1 text-white" +
                          " before:absolute before:inset-0 before:bg-black" +
                          " before:[clip-path:polygon(0_0,100%_0,calc(100%_-_10px)_100%,0_100%)]"
                        }
                      >
                        <div className="relative z-10">
                          <div className="text-xs leading-none text-white/80">{player.firstName}</div>
                          <div className="font-psv-branding italic text-2xl leading-none">{player.lastName}</div>
                        </div>
                      </div>

                      <div className="mt-2 space-y-1 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Market value:</span>
                          <span className="font-semibold text-foreground">{player.marketValue}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Sentiment:</span>
                          <span
                            className={cn(
                              "inline-flex items-center rounded-md px-2 py-0.5 text-sm font-semibold",
                              isPositive ? "bg-green-500/20 text-green-700" : "bg-red-500/20 text-red-700"
                            )}
                          >
                            {player.sentimentLabel}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section className="mt-6 grid w-full grid-cols-1 gap-6 md:grid-cols-3 md:items-start">
        <div
          ref={mentionsShareRef}
          className="flex flex-col overflow-hidden rounded-xl border border-border bg-background md:col-span-1"
        >
          <div className="flex items-baseline justify-between gap-3 px-6 py-4">
            <div className="flex items-center gap-2 text-base font-semibold font-psv-branding">
              <PieChartIcon className="h-4 w-4" />
              <span>MENTIONS SHARE</span>
            </div>
            <div className="text-sm text-muted-foreground">{periodLabel}</div>
          </div>

          <div className="px-6 pb-6">
            <ChartContainer config={mentionsShare.config} className="h-[200px] w-full aspect-auto">
              <PieChart>
                <ChartTooltip
                  cursor={false}
                  content={({ active, payload }) => {
                    if (!active || !payload || payload.length === 0) return null
                    const item = payload[0] as unknown as { name?: unknown; value?: unknown; payload?: { name?: unknown } }
                    const name = String(item?.name ?? item?.payload?.name ?? "")
                    const value = typeof item?.value === "number" ? item.value : Number(item?.value)

                    return (
                      <div className="rounded-lg border border-black bg-black px-3 py-2 shadow-md text-white">
                        <div className="text-sm font-semibold text-white">{legendLabel(name)}</div>
                        <div className="mt-1 text-xs text-white/80 tabular-nums">
                          {Number.isFinite(value) ? `${value.toFixed(0)}%` : "-"}
                        </div>
                      </div>
                    )
                  }}
                />
                <Pie
                  data={mentionsShare.data as unknown as Array<{ name: string; value: number }>}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={92}
                  paddingAngle={0}
                  stroke="transparent"
                  strokeWidth={0}
                >
                  {mentionsShare.data.map((item) => (
                    <Cell key={item.key} fill={`var(--color-${item.key})`} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>

            <div className="mt-2 flex flex-wrap items-center justify-center gap-5 text-xs text-muted-foreground">
              {mentionsShare.data.map((item) => (
                <div key={item.key} className="flex items-center gap-2">
                  <span className="h-[10px] w-[10px] rounded-[2px]" style={{ backgroundColor: item.color }} aria-hidden="true" />
                  <span>{legendLabel(item.name)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div
          className="flex flex-col overflow-hidden rounded-xl border border-border bg-background md:col-span-2"
          style={hotTopicsHeightPx ? { height: hotTopicsHeightPx } : undefined}
        >
          <div className="px-6 pt-6 pb-4">
            <div className="flex items-baseline justify-between gap-3">
              <div className="text-base font-semibold font-psv-branding">HOT TOPICS</div>
              <div className="text-sm text-muted-foreground">{periodLabel}</div>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto border-t border-border">
            <table className="w-full table-fixed text-xs">
              <thead>
                <tr>
                  <th className="sticky top-0 z-10 w-12 bg-muted px-3 py-2 text-left font-semibold text-muted-foreground">#</th>
                  <th className="sticky top-0 z-10 bg-muted px-3 py-2 text-left font-semibold text-muted-foreground">TOPIC</th>
                  <th className="sticky top-0 z-10 w-24 bg-muted px-3 py-2 text-right font-semibold text-muted-foreground">
                    MENTIONS
                  </th>
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    { rank: 1, topic: "Referee decision in the second half", mentions: 1240 },
                    { rank: 2, topic: "Tactical change after halftime", mentions: 980 },
                    { rank: 3, topic: "Performance of the midfield trio", mentions: 860 },
                    { rank: 4, topic: "Injury update and squad depth", mentions: 740 },
                    { rank: 5, topic: "VAR check and offside call", mentions: 690 },
                    { rank: 6, topic: "Substitution impact late in the game", mentions: 640 },
                    { rank: 7, topic: "Goalkeeper distribution and build-up play", mentions: 610 },
                    { rank: 8, topic: "Set-piece defending and marking", mentions: 580 },
                    { rank: 9, topic: "Atmosphere in the stadium", mentions: 540 },
                    { rank: 10, topic: "Post-match interview highlights", mentions: 510 },
                  ] as const
                ).map((row, index) => (
                  <tr key={row.rank} className={index % 2 === 0 ? "bg-background" : "bg-muted"}>
                    <td className="w-12 px-3 py-2 text-muted-foreground tabular-nums">{row.rank}</td>
                    <td className="px-3 py-2">
                      <div className="truncate">{row.topic}</div>
                    </td>
                    <td className="w-24 px-3 py-2 text-right font-medium tabular-nums">{row.mentions.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="mt-6 grid w-full grid-cols-1 gap-6 md:grid-cols-3">
        <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-background md:col-span-1">
          <div className="flex items-baseline justify-between gap-3 px-6 py-4">
            <div className="flex items-center gap-2 text-base font-semibold font-psv-branding">
              <PieChartIcon className="h-4 w-4" />
              <span>PLATFORM SHARE</span>
            </div>
            <div className="text-sm text-muted-foreground">{periodLabel}</div>
          </div>

          <div className="px-6 pb-6">
            <ChartContainer config={platformShare.config} className="h-[200px] w-full aspect-auto">
              <PieChart>
                <ChartTooltip
                  cursor={false}
                  content={({ active, payload }) => {
                    if (!active || !payload || payload.length === 0) return null
                    const item = payload[0] as unknown as { name?: unknown; value?: unknown; payload?: { name?: unknown } }
                    const name = String(item?.name ?? item?.payload?.name ?? "")
                    const value = typeof item?.value === "number" ? item.value : Number(item?.value)

                    return (
                      <div className="rounded-lg border border-black bg-black px-3 py-2 shadow-md text-white">
                        <div className="text-sm font-semibold text-white">{legendLabel(name)}</div>
                        <div className="mt-1 text-xs text-white/80 tabular-nums">
                          {Number.isFinite(value) ? `${value.toFixed(0)}%` : "-"}
                        </div>
                      </div>
                    )
                  }}
                />
                <Pie
                  data={platformShare.data as unknown as Array<{ name: string; value: number }>}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={92}
                  paddingAngle={0}
                  stroke="transparent"
                  strokeWidth={0}
                >
                  {platformShare.data.map((item) => (
                    <Cell key={item.key} fill={`var(--color-${item.key})`} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-5 text-xs text-muted-foreground">
              {platformShare.data.map((item) => (
                <div key={item.key} className="flex items-center gap-2">
                  <span className="h-[10px] w-[10px] rounded-[2px]" style={{ backgroundColor: item.color }} aria-hidden="true" />
                  <span>{legendLabel(item.name)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-background md:col-span-1">
          <div className="flex items-baseline justify-between gap-3 px-6 py-4">
            <div className="text-base font-semibold font-psv-branding">TOP CONTENT TYPE</div>
            <div className="text-sm text-muted-foreground">{periodLabel}</div>
          </div>

          <div className="px-6 pb-6 space-y-5">
            {([
              { label: "Video", value: 40 },
              { label: "Stories", value: 27 },
              { label: "Photo", value: 18 },
              { label: "Text", value: 15 },
            ] as const).map((item) => (
              <div key={item.label}>
                <div className="flex items-center justify-between text-sm">
                  <div className="font-medium">{item.label}</div>
                  <div className="font-semibold tabular-nums">{item.value}%</div>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-black" style={{ width: `${item.value}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-background md:col-span-1">
          <div className="flex items-baseline justify-between gap-3 px-6 py-4">
            <div className="text-base font-semibold font-psv-branding">TOP HASHTAGS</div>
            <div className="text-sm text-muted-foreground">{periodLabel}</div>
          </div>

          <div className="px-6 pb-6 space-y-5">
            {([
              { tag: "#PSV", value: 32, deltaPct: 8.2 },
              { tag: "#UCL", value: 24, deltaPct: -3.4 },
              { tag: "#Eredivisie", value: 18, deltaPct: 2.1 },
              { tag: "#PSVFans", value: 12, deltaPct: -1.6 },
            ] as const).map((item) => {
              const up = item.deltaPct >= 0
              return (
                <div key={item.tag}>
                  <div className="flex items-center justify-between text-sm">
                    <div className="font-medium">{item.tag}</div>
                    <div className="flex items-center gap-2">
                      <div className="font-semibold tabular-nums">{item.value}%</div>
                      <div className={cn("text-xs font-semibold tabular-nums", up ? "text-green-600" : "text-red-600")}>
                        {up ? "+" : ""}
                        {item.deltaPct.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-black" style={{ width: `${item.value}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>
    </main>
  )
}
