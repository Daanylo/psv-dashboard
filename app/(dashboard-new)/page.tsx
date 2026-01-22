"use client"

import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowRight,
  ArrowUpDown,
  BadgeEuro,
  Calendar as CalendarIcon,
  Download,
  Eye,
  Filter,
  Flag,
  LineChart as LineChartIcon,
  MessageSquareText,
  Smile,
  Sparkles,
  Star,
  ThumbsDown,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
} from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PlayerLink } from "@/components/player-link"
import { BrandLink } from "@/components/brand-link"
import { GlobalSearch } from "@/components/global-search"
import { Separator } from "@/components/ui/separator"
import { exportNodeToPdf } from "@/lib/export-pdf"
import { cn } from "@/lib/utils"
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts"
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart"

type DateRangeKey = "7" | "30" | "90" | "365" | "custom"
type JourneyGranularity = "daily" | "weekly"

type SentimentJourneyPoint = {
  label: string
  positiveCount: number
  negativeCount: number
  negativeDisplay: number
  totalCount: number
  postsCount: number
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


type PlayerMentionsStats = {
  name: string
  fotmobId: number
  shirtNumber: number | null
  mentions: number
  mentionsChangePct: number
  positivePct: number
  neutralPct: number
  negativePct: number
}

type HotTopic = {
  rank: number
  matchId: number
  topic: string
  mentions: number
}

type TopExposure = {
  brand: string
  brandSlug: string | null
  logoLight: string | null
  logoDark: string | null
  appearances: number
  postUrl: string
  postLink: string
  visibilityScore: number
  avgVisibility: number
}

type PlayerReportItem = {
  name: string
  fotmobId: number
  shirtNumber: number | null
  position: string | null
  mentions: number
  positivePct: number
  avgRating: number | null
  marketValue: number | null
}

type OverviewSummaryResponse = {
  meta: {
    start: string
    end: string
    previousStart: string
    previousEnd: string
    granularity: "day" | "week"
  }
  sentimentJourney: {
    points: SentimentJourneyPoint[]
    summary: SentimentJourneySummary
    events: SentimentJourneyEvent[]
  }
  playerMentions: {
    mostPopular: PlayerMentionsStats | null
    mostControversial: PlayerMentionsStats | null
    fullReport: PlayerReportItem[]
  }
  hotTopics: HotTopic[]
  topExposures: TopExposure[]
  aiSummary: string | null
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

function getSponsorLogo(brand: string) {
  const b = brand.toLowerCase().trim()
  if (b.includes("puma")) return "/sponsor-logos/puma-logo.svg"
  if (b.includes("brainport")) return "/sponsor-logos/brainport.png"
  if (b.includes("energie")) return "/sponsor-logos/energiedirect.png"
  if (b.includes("goodhabitz")) return "/sponsor-logos/goodhabitz-logo-png.png"
  if (b.includes("50plus") || b.includes("thumb")) return "/sponsor-logos/50plus-logo.svg"
  if (b.includes("psv")) return "/sponsor-logos/psv-logo.svg"
  if (b.includes("simac")) return "/sponsor-logos/simac-logo-rgb-transp.gif"
  return null
}

function labelForDate(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function startOfWeekLocal(date: Date) {
  const d = new Date(date)
  const day = d.getDay() // 0=Sun
  const diff = day === 0 ? -6 : 1 - day // Mon start
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

function makeMockJourney(
  start: Date,
  end: Date,
  granularity: JourneyGranularity,
  seedBase: number
) {
  const points: SentimentJourneyPoint[] = []

  const startDay = new Date(start)
  startDay.setHours(0, 0, 0, 0)
  const endDay = new Date(end)
  endDay.setHours(0, 0, 0, 0)

  const random = mulberry32(seedBase)

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
      totalCount: total,
      postsCount: 0,
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

function makeMockPlayerMentionsStats(seedBase: number): PlayerMentionsStats {
  const r = mulberry32(seedBase)

  const mentions = 620 + Math.floor(r() * 1680)
  const prevMentions = 620 + Math.floor(mulberry32(seedBase + 999)() * 1680)

  const positivePct = clamp(0.25 + r() * 0.35, 0.05, 0.85)
  const neutralPct = clamp(0.12 + r() * 0.26, 0.05, 0.7)
  const negativePct = clamp(1 - positivePct - neutralPct, 0.05, 0.85)
  const totalPct = positivePct + neutralPct + negativePct

  return {
    name: "Mock Player",
    fotmobId: seedBase,
    shirtNumber: null,
    mentions,
    mentionsChangePct: percentChange(mentions, prevMentions),
    positivePct: (positivePct / totalPct) * 100,
    neutralPct: (neutralPct / totalPct) * 100,
    negativePct: (negativePct / totalPct) * 100,
  }
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
  onMatchClick,
}: {
  points: SentimentJourneyPoint[]
  events: SentimentJourneyEvent[]
  plotLeftPx: number
  plotRightPx: number
  onMatchClick?: (matchId: number) => void
}) {
  if (!events.length || !points.length) return null

  const count = points.length
  const indexCounts: Record<number, number> = {}

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <div
        className="absolute top-0"
        style={{ left: plotLeftPx, right: plotRightPx, height: "100%" }}
      >
        {events.map((event) => {
          const idx = points.findIndex((p) => p.label === event.xLabel)
          if (idx < 0) return null

          const matchId = Number(event.id)
          const canNavigate = !!onMatchClick && Number.isFinite(matchId) && matchId > 0

          const stackIndex = indexCounts[idx] || 0
          indexCounts[idx] = stackIndex + 1

          const leftPct = ((idx + 0.5) / count) * 100
          const topOffset = -10 + (stackIndex * 32)

          return (
            <div
              key={event.id}
              className="absolute"
              style={{ left: `${leftPct}%`, top: topOffset }}
            >
              <div
                className="group pointer-events-auto relative z-10 hover:z-50"
                style={{ transform: "translateX(-14px)" }}
              >
                <div
                  className={
                    "flex items-center overflow-hidden rounded-md border border-border bg-background " +
                    "transition-[width,padding,justify-content] duration-150 ease-out " +
                    "w-7 justify-center px-0 " +
                    "group-hover:w-[180px] group-hover:justify-start group-hover:px-2 " +
                    (canNavigate ? "cursor-pointer" : "")
                  }
                  onClick={(e) => {
                    if (!canNavigate) return
                    e.stopPropagation()
                    onMatchClick(matchId)
                  }}
                  role={canNavigate ? "button" : undefined}
                >
                  <Flag className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div
                    className={
                      "ml-0 group-hover:ml-2 overflow-hidden whitespace-nowrap " +
                      "max-w-0 opacity-0 transition-[max-width,opacity] duration-150 ease-out " +
                      "group-hover:max-w-[140px] group-hover:opacity-100"
                    }
                  >
                    <div className={canNavigate ? "truncate text-xs font-medium text-foreground group-hover:underline" : "truncate text-xs font-medium text-foreground"}>
                      {event.title}
                    </div>
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

function SentimentJourneyPostsOverlay({
  points,
  plotLeftPx,
  plotRightPx,
}: {
  points: Array<Pick<SentimentJourneyPoint, "postsCount">>
  plotLeftPx: number
  plotRightPx: number
}) {
  return null
}

function formatShortDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
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

function formatMarketValue(value: number | null) {
  if (value === null) return "—"
  if (value >= 1_000_000) {
    return `€${(value / 1_000_000).toFixed(1)}M`
  }
  if (value >= 1_000) {
    return `€${(value / 1_000).toFixed(1)}K`
  }
  return `€${value}`
}

function PlayerImage({ shirtNumber, name }: { shirtNumber: number | null; name: string }) {
  const initialSrc = shirtNumber ? `/player_images/${shirtNumber}.png` : "/player_images/no_image.png"
  const [src, setSrc] = useState(initialSrc)

  useEffect(() => {
    setSrc(initialSrc)
  }, [initialSrc])

  return (
    <Image
      src={src}
      alt={name}
      width={96}
      height={192}
      className="h-6 w-auto object-contain object-bottom"
      onError={() => setSrc("/player_images/no_image.png")}
    />
  )
}

export default function HomePage() {
  const router = useRouter()
  const mainRef = useRef<HTMLElement>(null)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [dateRangeKey, setDateRangeKey] = useState<DateRangeKey>("30")
  
  // Custom date range state (defaults to last 30 days)
  const defaultEnd = useMemo(() => new Date(), [])
  const defaultStart = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d
  }, [])
  
  const [customStart, setCustomStart] = useState<string>(toIsoDateOnly(defaultStart))
  const [customEnd, setCustomEnd] = useState<string>(toIsoDateOnly(defaultEnd))

  const [journeyGranularity, setJourneyGranularity] = useState<JourneyGranularity>("daily")
  const [journeyNormalize, setJourneyNormalize] = useState(false)

  const [overview, setOverview] = useState<OverviewSummaryResponse | null>(null)
  const [overviewLoading, setOverviewLoading] = useState<boolean>(true)
  const [overviewError, setOverviewError] = useState<string | null>(null)

  const dateRangeDays = useMemo(() => {
    switch (dateRangeKey) {
      case "7":
        return 7
      case "30":
        return 30
      case "90":
        return 90
      case "365":
        return 365
      default:
        return 30
    }
  }, [dateRangeKey])

  const { start, end } = useMemo(() => {
    if (dateRangeKey === "custom") {
      return {
        start: parseLocalIsoDate(customStart),
        end: parseLocalIsoDate(customEnd)
      }
    }
    return getDateRange(dateRangeDays, new Date())
  }, [dateRangeDays, dateRangeKey, customStart, customEnd])

  const dateRangeLabel = useMemo(
    () => `${formatShortDate(start)} - ${formatShortDate(end)}`,
    [start, end]
  )

  const periodLabel = useMemo(() => {
    switch (dateRangeKey) {
      case "7":
        return "Last 7 days"
      case "30":
        return "Last 30 days"
      case "90":
        return "Last 90 days"
      case "365":
        return "Last 365 days"
      case "custom":
        return "Custom period"
    }
  }, [dateRangeKey])

  const recentEventDateLabel = useMemo(() => formatShortDate(end), [end])
  const bestRating = 8.6
  const worstRating = 5.8
  
  const [playerSortCol, setPlayerSortCol] = useState<"mentions" | "positivePct" | "avgRating" | "marketValue">("mentions")
  const [playerSortDir, setPlayerSortDir] = useState<"asc" | "desc">("desc")
  const [playerPositionFilter, setPlayerPositionFilter] = useState<string>("all")

  const psvMarqueeRowA = useMemo(() => Array.from({ length: 10 }, () => ({ src: "/sponsor-logos/psv-logo.svg", alt: "PSV" })), [])
  const psvMarqueeRowB = useMemo(() => Array.from({ length: 9 }, () => ({ src: "/sponsor-logos/psv-logo.svg", alt: "PSV" })), [])
  const psvMarqueeRowC = useMemo(() => Array.from({ length: 8 }, () => ({ src: "/sponsor-logos/psv-logo.svg", alt: "PSV" })), [])

  useEffect(() => {
    setOverviewLoading(true)
    setOverviewError(null)

    const controller = new AbortController()
    const run = async () => {
      try {
        const url = new URL("/api/new/overview/summary", window.location.origin)
        url.searchParams.set("start", toIsoDateOnly(start))
        url.searchParams.set("end", toIsoDateOnly(end))
        url.searchParams.set(
          "granularity",
          journeyGranularity === "weekly" ? "week" : "day",
        )

        const res = await fetch(url.toString(), {
          cache: "no-store",
          signal: controller.signal,
        })
        if (!res.ok) throw new Error(`API ${res.status}`)
        const data = (await res.json()) as OverviewSummaryResponse
        setOverview(data)
        setOverviewLoading(false)

        // Now fetch AI summary separately
        try {
          const aiUrl = new URL("/api/new/overview/ai-summary", window.location.origin)
          aiUrl.searchParams.set("start", toIsoDateOnly(start))
          aiUrl.searchParams.set("end", toIsoDateOnly(end))
          
          const aiRes = await fetch(aiUrl.toString(), {
             cache: "no-store",
             signal: controller.signal
          })
          if(aiRes.ok) {
             const aiData = await aiRes.json()
             setOverview(prev => prev ? ({ ...prev, aiSummary: aiData.aiSummary }) : prev)
          }
        } catch (aiErr) {
           console.error("AI summary fetch failed", aiErr)
        }

      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return

        const message =
          err instanceof Error ? err.message : "Failed to load overview"
        setOverviewError(message)
        setOverviewLoading(false)
      }
    }

    void run()
    return () => controller.abort()
  }, [start, end, journeyGranularity])

  const playerMentions = useMemo(() => {
    const fallback: { mostPopular: PlayerMentionsStats; mostControversial: PlayerMentionsStats } = {
      mostPopular: {
        name: "—",
        fotmobId: 0,
        shirtNumber: null,
        mentions: 0,
        mentionsChangePct: 0,
        positivePct: 0,
        neutralPct: 0,
        negativePct: 0,
      },
      mostControversial: {
        name: "—",
        fotmobId: 0,
        shirtNumber: null,
        mentions: 0,
        mentionsChangePct: 0,
        positivePct: 0,
        neutralPct: 0,
        negativePct: 0,
      },
    }

    if (!overview?.playerMentions) return fallback
    return {
      mostPopular: overview.playerMentions.mostPopular ?? fallback.mostPopular,
      mostControversial:
        overview.playerMentions.mostControversial ?? fallback.mostControversial,
    }
  }, [overview])

  const sentimentJourneyData = useMemo(() => {
    const empty: { points: SentimentJourneyPoint[]; summary: SentimentJourneySummary } = {
      points: [],
      summary: {
        positiveCount: 0,
        negativeCount: 0,
        positiveChangePct: 0,
        negativeChangePct: 0,
      },
    }

    return overview?.sentimentJourney
      ? { points: overview.sentimentJourney.points, summary: overview.sentimentJourney.summary }
      : empty
  }, [overview])

  const sentimentJourneyEvents = useMemo(() => {
    return overview?.sentimentJourney?.events ?? ([] as SentimentJourneyEvent[])
  }, [overview])

  const sentimentJourneyDomainMax = useMemo(() => {
    const maxPositive = sentimentJourneyData.points.reduce(
      (acc, p) => Math.max(acc, p.positiveCount),
      0,
    )
    const maxNegative = sentimentJourneyData.points.reduce(
      (acc, p) => Math.max(acc, p.negativeCount),
      0,
    )

    const maxAbs = Math.max(maxPositive, maxNegative)
    if (!maxAbs) return 1000
    return Math.ceil(maxAbs / 100) * 100
  }, [sentimentJourneyData.points])

  const sentimentJourneyChartData = useMemo(() => {
    return sentimentJourneyData.points.map((point) => {
      const total = Number(point.totalCount ?? 0)
      const pos = Number(point.positiveCount ?? 0)
      const neg = Number(point.negativeCount ?? 0)

      const positivePct = total > 0 ? (pos / total) * 100 : 0
      const negativePct = total > 0 ? (neg / total) * 100 : 0
      const neutralPctRaw = total > 0 ? 100 - positivePct - negativePct : 0
      const neutralPct = clamp(neutralPctRaw, 0, 100)
      const neutralPctHalf = neutralPct / 2

      return {
        ...point,
        positivePct,
        negativePct,
        negativePctDisplay: -negativePct,
        neutralPct,
        neutralPctHalf,
        neutralPctHalfDisplay: -neutralPctHalf,
      }
    })
  }, [sentimentJourneyData.points])

  const sortedAndFilteredPlayers = useMemo(() => {
    let list = overview?.playerMentions?.fullReport ?? []

    // Filter by position
    if (playerPositionFilter !== "all") {
      list = list.filter((p) => {
        if (!p.position) return false
        const pos = p.position.toLowerCase()
        if (playerPositionFilter === "gk") return pos.includes("goalkeeper") || pos.includes("keeper")
        if (playerPositionFilter === "def") return pos.includes("defender")
        if (playerPositionFilter === "mid") return pos.includes("midfielder")
        if (playerPositionFilter === "att") return pos.includes("attacker") || pos.includes("forward")
        return true
      })
    }

    // Sort
    list = [...list].sort((a, b) => {
      let valA: number = 0
      let valB: number = 0

      switch (playerSortCol) {
        case "mentions":
          valA = a.mentions
          valB = b.mentions
          break
        case "positivePct":
          valA = a.positivePct
          valB = b.positivePct
          break
        case "avgRating":
          valA = a.avgRating ?? 0
          valB = b.avgRating ?? 0
          break
        case "marketValue":
          valA = a.marketValue ?? 0
          valB = b.marketValue ?? 0
          break
      }

      return playerSortDir === "asc" ? valA - valB : valB - valA
    })

    return list.map((p, i) => ({ ...p, rank: i + 1 }))
  }, [overview, playerPositionFilter, playerSortCol, playerSortDir])

  return (
    <main ref={mainRef} className="max-w-screen-xl mx-auto px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="max-w-[300px] flex-1">
          <GlobalSearch />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <div className="inline-flex items-stretch">
              {dateRangeKey === "custom" ? (
                <div className="border-input bg-background flex h-9 items-center gap-2 rounded-l-md border border-r-0 px-2">
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    max={customEnd}
                    className="h-full bg-transparent text-sm outline-none w-[110px]"
                  />
                  <span className="text-muted-foreground">-</span>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    min={customStart}
                    max={toIsoDateOnly(defaultEnd)}
                    className="h-full bg-transparent text-sm outline-none w-[110px]"
                  />
                </div>
              ) : (
                <div className="border-input gap-2 bg-background text-foreground inline-flex h-9 items-center rounded-l-md border px-3 text-sm">
                  <CalendarIcon className="h-4 w-4" />
                  {dateRangeLabel}
                </div>
              )}
              <Select value={dateRangeKey} onValueChange={(v) => setDateRangeKey(v as DateRangeKey)}>
                <SelectTrigger className="h-9 rounded-l-none border-l-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                  <SelectItem value="365">Last 365 days</SelectItem>
                  <Separator className="my-1" />
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
            onClick={async () => {
              if (!mainRef.current) return
              await exportNodeToPdf(mainRef.current, "overview.pdf")
            }}
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
          " [clip-path:polygon(0_0,100%_0,calc(100%_-_12px)_100%,0_100%)]" +
          " before:absolute before:inset-0 before:z-0 before:bg-black"
        }
      >
        <div className="relative z-10 flex h-full flex-wrap items-stretch justify-between gap-6 px-6 text-white md:flex-nowrap">
          <div className="flex flex-1 flex-col justify-center">
            <div className="text-3xl font-bold font-psv-branding italic leading-none md:text-3xl">OVERVIEW</div>
            <div className="mt-2 max-w-[600px] text-sm text-white/80 leading-relaxed">
              {overviewLoading ? (
                <div className="animate-pulse flex flex-col gap-1.5 opacity-50">
                   <div className="h-3 w-64 bg-white/40 rounded" />
                   <div className="h-3 w-48 bg-white/40 rounded" />
                </div>
              ) : (
                <div className="group flex items-center gap-3">
                  {overview?.aiSummary && (
                    <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/50 transition-colors group-hover:text-white/90" />
                  )}
                  <span>
                    {overview?.aiSummary || "Snapshot of sentiment, mentions, and performance signals."}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="relative flex w-full flex-none items-center overflow-hidden md:w-[400px] md:-mr-6">
            <div className="relative z-0 flex w-full flex-col gap-3 py-4">
              <div className="w-full overflow-hidden">
                <div className="psv-logo-marquee psv-logo-marquee--a flex w-max items-center gap-10 will-change-transform">
                  {[...psvMarqueeRowA, ...psvMarqueeRowA].map((logo, index) => (
                    <Image
                      key={`psv-a-${index}`}
                      src={logo.src}
                      alt={logo.alt}
                      width={80}
                      height={80}
                      className="h-8 w-auto opacity-80 grayscale brightness-200"
                    />
                  ))}
                </div>
              </div>

              <div className="w-full overflow-hidden">
                <div className="psv-logo-marquee psv-logo-marquee--b flex w-max items-center gap-10 will-change-transform">
                  {[...psvMarqueeRowB, ...psvMarqueeRowB].map((logo, index) => (
                    <Image
                      key={`psv-b-${index}`}
                      src={logo.src}
                      alt={logo.alt}
                      width={80}
                      height={80}
                      className="h-8 w-auto opacity-70 grayscale brightness-200"
                    />
                  ))}
                </div>
              </div>

              <div className="hidden w-full overflow-hidden md:block">
                <div className="psv-logo-marquee psv-logo-marquee--c flex w-max items-center gap-10 will-change-transform">
                  {[...psvMarqueeRowC, ...psvMarqueeRowC].map((logo, index) => (
                    <Image
                      key={`psv-c-${index}`}
                      src={logo.src}
                      alt={logo.alt}
                      width={80}
                      height={80}
                      className="h-8 w-auto opacity-60 grayscale brightness-200"
                    />
                  ))}
                </div>
              </div>
            </div>

            <div
              className="pointer-events-none absolute inset-0 z-10"
              style={{
                background:
                  "linear-gradient(to right, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 20%, rgba(0,0,0,0.92) 24%, rgba(0,0,0,0) 66%)",
              }}
              aria-hidden
            />
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
                  journeyGranularity === "daily"
                    ? "bg-black text-white"
                    : "text-muted-foreground hover:bg-accent"
                )}
              >
                Daily
              </button>
              <button
                type="button"
                onClick={() => setJourneyGranularity("weekly")}
                className={cn(
                  "inline-flex h-7 items-center rounded-sm px-3",
                  journeyGranularity === "weekly"
                    ? "bg-black text-white"
                    : "text-muted-foreground hover:bg-accent"
                )}
              >
                Weekly
              </button>
            </div>

            <label className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm text-muted-foreground hover:bg-accent">
              <input
                type="checkbox"
                className="h-4 w-4 accent-black"
                checked={journeyNormalize}
                onChange={(e) => setJourneyNormalize(e.target.checked)}
              />
              <span>Normalize</span>
            </label>
          </div>
        </div>

        <div className="flex w-full items-stretch">
          <div className="w-3/4 py-6">
            <ChartContainer
              config={sentimentJourneyChartConfig}
              className="h-[260px] w-full"
              overlay={
                <>
                  <SentimentJourneyEventOverlay
                    points={sentimentJourneyData.points}
                    events={sentimentJourneyEvents}
                    plotLeftPx={40}
                    plotRightPx={18}
                    onMatchClick={(matchId) => router.push(`/events?match_id=${matchId}`)}
                  />
                </>
              }
            >
              <BarChart
                data={sentimentJourneyChartData}
                margin={{ top: 12, right: 18, left: 0, bottom: 18 }}
                stackOffset="sign"
                onClick={(state) => {
                  const s = state as any
                  const label = (s?.activeLabel as string | undefined) ?? (s?.activePayload?.[0]?.payload?.label as string | undefined)
                  if (!label) return
                  const event = sentimentJourneyEvents.find((e) => e.xLabel === label)
                  const matchId = Number(event?.id)
                  if (!Number.isFinite(matchId) || matchId <= 0) return
                  router.push(`/events?match_id=${matchId}`)
                }}

              >
                <CartesianGrid strokeDasharray="3 3" />
                <ReferenceLine yAxisId="count" y={0} stroke="var(--background)" strokeWidth={10} />
                <ReferenceLine yAxisId="count" y={0} stroke="hsl(var(--border))" />
                <ChartTooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const point = payload[0]?.payload as
                      | (SentimentJourneyPoint & {
                          positivePct?: number
                          negativePct?: number
                          neutralPct?: number
                        })
                      | undefined
                    if (!point) return null

                    const total = Number(point.totalCount ?? 0)
                    const posts = Number(point.postsCount ?? 0)
                    const netPct =
                      total === 0
                        ? 0
                        : ((point.positiveCount - point.negativeCount) / total) * 100
                    return (
                      <div className="rounded-lg bg-black px-3 py-2 text-white shadow-md">
                        <div className="text-sm font-semibold">{point.label}</div>
                        <div className="mt-2 space-y-1 text-sm">
                          <div className="flex items-center justify-between gap-6">
                            <span className="inline-flex items-center gap-2 text-green-500">
                              <ThumbsUp className="h-4 w-4" />
                            </span>
                            <span className="font-medium tabular-nums">
                              {journeyNormalize
                                ? `${(point.positivePct ?? 0).toFixed(0)}%`
                                : point.positiveCount.toLocaleString()}
                            </span>
                          </div>
                          {journeyNormalize ? (
                            <div className="flex items-center justify-between gap-6">
                              <span className="inline-flex items-center gap-2 text-white/70">
                                <Smile className="h-4 w-4" />
                              </span>
                              <span className="font-medium tabular-nums">
                                {(point.neutralPct ?? 0).toFixed(0)}%
                              </span>
                            </div>
                          ) : null}
                          <div className="flex items-center justify-between gap-6">
                            <span className="inline-flex items-center gap-2 text-red-500">
                              <ThumbsDown className="h-4 w-4" />
                            </span>
                            <span className="font-medium tabular-nums">
                              {journeyNormalize
                                ? `${(point.negativePct ?? 0).toFixed(0)}%`
                                : point.negativeCount.toLocaleString()}
                            </span>
                          </div>
                          {journeyNormalize ? (
                            <div className="pt-1 text-[11px] text-white/70 tabular-nums">
                              Total: {total.toLocaleString()}
                            </div>
                          ) : null}
                          <div className="flex items-center justify-between gap-2 pt-1 text-xs text-white/60">
                            <span>Posts</span>
                            <span className="tabular-nums">{posts.toLocaleString()}</span>
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
                  yAxisId="count"
                  width={40}
                  domain={
                    journeyNormalize
                      ? ([-100, 100] as const)
                      : ([-sentimentJourneyDomainMax, sentimentJourneyDomainMax] as const)
                  }
                  ticks={
                    journeyNormalize
                      ? ([-100, 0, 100] as const)
                      : ([-sentimentJourneyDomainMax, 0, sentimentJourneyDomainMax] as const)
                  }
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) =>
                    journeyNormalize
                      ? `${Math.abs(Number(v)).toFixed(0)}%`
                      : Math.abs(Number(v)).toLocaleString()
                  }
                />

                {journeyNormalize ? (
                  <Bar
                    key="norm-neg-neutral"
                    yAxisId="count"
                    dataKey="neutralPctHalfDisplay"
                    stackId="totals"
                    radius={0}
                    className="fill-gray-300 dark:fill-gray-700"
                  />
                ) : null}
                {journeyNormalize ? (
                  <Bar
                    key="norm-neg"
                    yAxisId="count"
                    dataKey="negativePctDisplay"
                    stackId="totals"
                    radius={0}
                    className="fill-red-500"
                  />
                ) : null}
                {journeyNormalize ? (
                  <Bar
                    key="norm-pos-neutral"
                    yAxisId="count"
                    dataKey="neutralPctHalf"
                    stackId="totals"
                    radius={0}
                    className="fill-gray-300 dark:fill-gray-700"
                  />
                ) : null}
                {journeyNormalize ? (
                  <Bar
                    key="norm-pos"
                    yAxisId="count"
                    dataKey="positivePct"
                    stackId="totals"
                    radius={0}
                    className="fill-green-500"
                  />
                ) : null}

                {!journeyNormalize ? (
                  <Bar
                    key="raw-pos"
                    yAxisId="count"
                    dataKey="positiveCount"
                    stackId="totals"
                    radius={0}
                    className="fill-green-500"
                  />
                ) : null}
                {!journeyNormalize ? (
                  <Bar
                    key="raw-neg"
                    yAxisId="count"
                    dataKey="negativeDisplay"
                    stackId="totals"
                    radius={0}
                    className="fill-red-500"
                  />
                ) : null}
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
                      sentimentJourneyData.summary.positiveChangePct >= 0
                        ? "text-green-500"
                        : "text-red-500"
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
                      sentimentJourneyData.summary.negativeChangePct >= 0
                        ? "text-red-500"
                        : "text-green-500"
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

      <section className="mt-6 grid w-full grid-cols-1 gap-6 md:grid-cols-3">
        <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-background px-6 pt-6 pb-0">
          <div className="flex items-baseline justify-between gap-3">
            <div className="flex items-center gap-2 text-base font-semibold font-psv-branding">
              <ThumbsUp className="h-4 w-4 text-primary" />
              <span>MOST POPULAR</span>
            </div>
            <div className="text-sm text-muted-foreground">{periodLabel}</div>
          </div>

          <div className="mt-5 flex items-end gap-4">
            <div className="shrink-0 self-end">
              <Image
                src={
                  playerMentions.mostPopular.shirtNumber
                    ? `/player_images/${playerMentions.mostPopular.shirtNumber}.png`
                    : "/no_image.png"
                }
                alt="Most popular player"
                width={256}
                height={256}
                className="h-36 w-auto object-contain object-bottom"
              />
            </div>

            <div className="min-w-0 self-start w-full">
              <div
                className={
                  "relative inline-flex overflow-hidden px-3 py-1 text-white" +
                  " before:absolute before:inset-0 before:bg-black" +
                  " before:[clip-path:polygon(0_0,100%_0,calc(100%_-_10px)_100%,0_100%)]"
                }
              >
                <PlayerLink playerId={playerMentions.mostPopular.fotmobId} className="relative z-10 block">
                  <div className="text-xs leading-none text-white/80">
                    {playerMentions.mostPopular.name.split(" ").slice(0, -1).join(" ") ||
                      playerMentions.mostPopular.name}
                  </div>
                  <div className="font-psv-branding italic text-3xl leading-none">
                    {playerMentions.mostPopular.name.split(" ").slice(-1)[0]}
                  </div>
                </PlayerLink>
              </div>

              <div className="mt-3 flex items-baseline gap-2">
                <div className="font-psv-branding italic text-3xl leading-none">
                  {playerMentions.mostPopular.mentions.toLocaleString()}
                </div>
                <div
                  className={cn(
                    "inline-flex items-center gap-1 text-sm font-semibold",
                    playerMentions.mostPopular.mentionsChangePct >= 0
                      ? "text-green-500"
                      : "text-red-500"
                  )}
                >
                  <span>{formatDeltaPct(playerMentions.mostPopular.mentionsChangePct)}</span>
                  {playerMentions.mostPopular.mentionsChangePct >= 0 ? (
                    <TrendingUp className="h-4 w-4" />
                  ) : (
                    <TrendingDown className="h-4 w-4" />
                  )}
                </div>
              </div>

              <div className="mt-2 h-3 w-[min(220px,100%)] overflow-hidden rounded-full bg-muted">
                <div className="flex h-full w-full">
                  <div
                    className="h-full bg-green-500"
                    style={{ width: `${playerMentions.mostPopular.positivePct}%` }}
                  />
                  <div
                    className="h-full bg-gray-300 dark:bg-gray-700"
                    style={{ width: `${playerMentions.mostPopular.neutralPct}%` }}
                  />
                  <div
                    className="h-full bg-red-500"
                    style={{ width: `${playerMentions.mostPopular.negativePct}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-background px-6 pt-6 pb-0">
          <div className="flex items-baseline justify-between gap-3">
            <div className="flex items-center gap-2 text-base font-semibold font-psv-branding">
              <ArrowUpDown className="h-4 w-4 text-primary" />
              <span>MOST CONTROVERSIAL</span>
            </div>
            <div className="text-sm text-muted-foreground">{periodLabel}</div>
          </div>

          <div className="mt-5 flex items-end gap-4">
            <div className="shrink-0 self-end">
              <Image
                src={
                  playerMentions.mostControversial.shirtNumber
                    ? `/player_images/${playerMentions.mostControversial.shirtNumber}.png`
                    : "/no_image.png"
                }
                alt="Most controversial player"
                width={256}
                height={256}
                className="h-36 w-auto object-contain object-bottom"
              />
            </div>

            <div className="min-w-0 self-start w-full">
              <div
                className={
                  "relative inline-flex overflow-hidden px-3 py-1 text-white" +
                  " before:absolute before:inset-0 before:bg-black" +
                  " before:[clip-path:polygon(0_0,100%_0,calc(100%_-_10px)_100%,0_100%)]"
                }
              >
                <PlayerLink playerId={playerMentions.mostControversial.fotmobId} className="relative z-10 block">
                  <div className="text-xs leading-none text-white/80">
                    {playerMentions.mostControversial.name
                      .split(" ")
                      .slice(0, -1)
                      .join(" ") || playerMentions.mostControversial.name}
                  </div>
                  <div className="font-psv-branding italic text-3xl leading-none">
                    {playerMentions.mostControversial.name.split(" ").slice(-1)[0]}
                  </div>
                </PlayerLink>
              </div>

              <div className="mt-3 flex items-baseline gap-2">
                <div className="font-psv-branding italic text-3xl leading-none">
                  {playerMentions.mostControversial.mentions.toLocaleString()}
                </div>
                <div
                  className={cn(
                    "inline-flex items-center gap-1 text-sm font-semibold",
                    playerMentions.mostControversial.mentionsChangePct >= 0
                      ? "text-green-500"
                      : "text-red-500"
                  )}
                >
                  <span>{formatDeltaPct(playerMentions.mostControversial.mentionsChangePct)}</span>
                  {playerMentions.mostControversial.mentionsChangePct >= 0 ? (
                    <TrendingUp className="h-4 w-4" />
                  ) : (
                    <TrendingDown className="h-4 w-4" />
                  )}
                </div>
              </div>

              <div className="mt-2 h-3 w-[min(220px,100%)] overflow-hidden rounded-full bg-muted">
                <div className="flex h-full w-full">
                  <div
                    className="h-full bg-green-500"
                    style={{ width: `${playerMentions.mostControversial.positivePct}%` }}
                  />
                  <div
                    className="h-full bg-gray-300 dark:bg-gray-700"
                    style={{ width: `${playerMentions.mostControversial.neutralPct}%` }}
                  />
                  <div
                    className="h-full bg-red-500"
                    style={{ width: `${playerMentions.mostControversial.negativePct}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex h-[215px] flex-col overflow-hidden rounded-xl border border-border bg-background">
          <div className="px-6 py-4">
            <div className="flex items-baseline justify-between gap-3">
              <div className="flex items-center gap-2 text-base font-semibold font-psv-branding">
                <Flag className="h-4 w-4 text-primary" />
                <span>EVENTS</span>
              </div>
              <div className="text-sm text-muted-foreground">{periodLabel}</div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto border-t border-border">
            <table className="w-full table-fixed text-xs">
              <thead>
                <tr>
                  <th className="sticky top-0 z-10 w-12 bg-muted px-3 py-2 text-left font-semibold text-muted-foreground">
                    #
                  </th>
                  <th className="sticky top-0 z-10 bg-muted px-3 py-2 text-left font-semibold text-muted-foreground">
                    EVENT
                  </th>
                  <th className="sticky top-0 z-10 w-24 bg-muted px-3 py-2 text-right font-semibold text-muted-foreground">
                    MENTIONS
                  </th>
                </tr>
              </thead>
              <tbody>
                {(overview?.hotTopics ?? []).map((row, index) => (
                  <tr key={row.rank} className={index % 2 === 0 ? "bg-background" : "bg-muted"}>
                    <td className="w-12 px-3 py-2 text-muted-foreground tabular-nums">{row.rank}</td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/events?match_id=${row.matchId}`}
                        className="block truncate hover:underline"
                      >
                        {row.topic}
                      </Link>
                    </td>
                    <td className="w-24 px-3 py-2 text-right font-medium tabular-nums">
                      {row.mentions.toLocaleString()}
                    </td>
                  </tr>
                ))}
                {(!overview?.hotTopics || overview.hotTopics.length === 0) && (
                  <tr>
                    <td colSpan={3} className="px-3 py-8 text-center text-muted-foreground">
                      {overviewLoading ? "Loading..." : "No events found"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="mt-6 grid w-full grid-cols-1 gap-6 md:flex md:h-[300px]">
        <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-background md:flex-1 md:min-w-0">
          <div className="flex items-center justify-between gap-3 px-6 py-4">
            <div className="flex items-center gap-2 text-base font-semibold font-psv-branding">
              <MessageSquareText className="h-4 w-4 text-primary" />
              <span>PLAYER REPORT</span>
            </div>
            <div className="flex items-center gap-2">
              <Select value={playerPositionFilter} onValueChange={setPlayerPositionFilter}>
                <SelectTrigger className="h-9 w-auto gap-2 border-border bg-background px-3 text-sm text-foreground hover:bg-accent focus:ring-0 shadow-none">
                  <Filter className="h-4 w-4" />
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Positions</SelectItem>
                  <SelectItem value="gk">Goalkeepers</SelectItem>
                  <SelectItem value="def">Defenders</SelectItem>
                  <SelectItem value="mid">Midfielders</SelectItem>
                  <SelectItem value="att">Attackers</SelectItem>
                </SelectContent>
              </Select>

              <Select value={playerSortCol} onValueChange={(v) => setPlayerSortCol(v as any)}>
                <SelectTrigger className="h-9 w-auto gap-2 border-border bg-background px-3 text-sm text-foreground hover:bg-accent focus:ring-0 shadow-none">
                  <ArrowUpDown className="h-4 w-4" />
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mentions">Mentions</SelectItem>
                  <SelectItem value="positivePct">Sentiment %</SelectItem>
                  <SelectItem value="avgRating">Avg Rating</SelectItem>
                  <SelectItem value="marketValue">Market Value</SelectItem>
                </SelectContent>
              </Select>
              <div className="text-sm text-muted-foreground">{periodLabel}</div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto border-t border-border">
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
                  <th className="sticky top-0 z-10 bg-muted px-3 py-2 text-left font-semibold text-muted-foreground">
                    #
                  </th>
                  <th className="sticky top-0 z-10 bg-muted px-3 py-2 text-left font-semibold text-muted-foreground">
                    PLAYER
                  </th>
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
                {sortedAndFilteredPlayers.map((row, index) => (
                  <tr
                    key={row.name}
                    className={cn(index % 2 === 0 ? "bg-background" : "bg-muted", "h-8")}
                  >
                    <td className="px-3 py-2 text-muted-foreground tabular-nums">{row.rank}</td>
                    <td className="h-full px-3">
                      <div className="flex h-full items-center gap-2">
                        <div className="pt-1 self-end">
                          <PlayerImage shirtNumber={row.shirtNumber} name={row.name} />
                        </div>
                        <div className="min-w-0">
                          <PlayerLink playerId={row.fotmobId} className="block truncate">
                            {row.name}
                          </PlayerLink>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">
                      {Math.floor(row.mentions).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">
                      {row.mentions > 0 ? `${row.positivePct.toFixed(0)}%` : "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                        <span className={cn("inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium text-white", getRatingBadgeClass(row.avgRating || 0))}>
                           {row.avgRating ? row.avgRating.toFixed(1) : "-"}
                       </span>
                    </td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">
                      {formatMarketValue(row.marketValue)}
                    </td>
                  </tr>
                ))}
                {sortedAndFilteredPlayers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                      {overviewLoading ? "Loading..." : "No players found"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-background md:w-[400px] md:min-w-[400px] md:flex-none">
          <div className="flex items-center justify-between gap-3 px-6 py-4">
            <div className="flex items-center gap-2 text-base font-semibold font-psv-branding">
              <Eye className="h-4 w-4 text-primary" />
              <span>TOP EXPOSURES</span>
            </div>
            <div className="text-sm text-muted-foreground">{periodLabel}</div>
          </div>

          <div className="flex-1 min-h-0 px-6 pb-6">
            <div className="grid h-full grid-cols-3 gap-3">
              {(overview?.topExposures ?? []).slice(0, 3).map((item) => {
                const logoLight = item.logoLight && item.logoLight.trim() ? item.logoLight : null
                const logoDark = item.logoDark && item.logoDark.trim() ? item.logoDark : null
                const fallbackLogo = getSponsorLogo(item.brand)
                const linkBrand = item.brandSlug ?? item.brand
                return (
                  <div
                    key={item.brand}
                    className="flex h-full flex-col overflow-hidden"
                  >
                    <div className="relative flex-1 min-h-0 w-full">
                      <a
                        href={item.postLink || "#"}
                        target={item.postLink ? "_blank" : undefined}
                        rel={item.postLink ? "noopener noreferrer" : undefined}
                        className={item.postLink ? "block h-full w-full" : "block h-full w-full pointer-events-none"}
                      >
                        <Image
                          src={item.postUrl || "/posts/post-template.png"}
                          alt={item.brand}
                          fill
                          sizes="(min-width: 768px) 220px, 33vw"
                          className="object-cover"
                        />
                      </a>
                    </div>
                    <div className="shrink-0 flex flex-col items-center justify-center gap-1 border-t border-border bg-muted px-2 py-2">
                      <BrandLink brand={linkBrand} className="h-5 w-full justify-center">
                        {logoLight || logoDark ? (
                          <div className="h-5 w-full flex items-center justify-center">
                            {logoLight && logoDark ? (
                              <>
                                <img
                                  src={logoLight}
                                  alt={item.brand}
                                  className="h-5 w-auto object-contain dark:hidden"
                                />
                                <img
                                  src={logoDark}
                                  alt={item.brand}
                                  className="hidden h-5 w-auto object-contain dark:block"
                                />
                              </>
                            ) : (
                              <img
                                src={logoLight ?? logoDark ?? ""}
                                alt={item.brand}
                                className="h-5 w-auto object-contain"
                              />
                            )}
                          </div>
                        ) : fallbackLogo ? (
                          <Image
                            src={fallbackLogo}
                            alt={item.brand}
                            width={120}
                            height={40}
                            className="h-5 w-auto object-contain"
                          />
                        ) : (
                          <div className="flex h-5 items-center justify-center font-bold text-xs uppercase tracking-tight">
                            {item.brand}
                          </div>
                        )}
                      </BrandLink>
                    </div>
                    <div className="shrink-0 flex flex-col gap-0.5 w-full text-[10px] text-muted-foreground px-3 py-2 bg-muted/40 border-t border-border/50">
                      <div className="flex justify-between w-full">
                        <span>App:</span>
                        <span className="font-medium tabular-nums">{item.appearances.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between w-full">
                        <span>Avg. vis:</span>
                        <span className="font-medium tabular-nums">
                          {item.avgVisibility > 1
                            ? Math.round(item.avgVisibility)
                            : Math.round(item.avgVisibility * 100)}%
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
