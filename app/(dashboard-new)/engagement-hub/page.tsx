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
  totalCount: number
  isoStart: string
  isoEnd: string
  positivePct?: number
  negativePct?: number
  negativePctDisplay?: number
  neutralPct?: number
  neutralPctHalf?: number
  neutralPctHalfDisplay?: number
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
  shirtNumber: number | null
  mentions: number
  mentionsChangePct: number
  positivePct: number
  neutralPct: number
  negativePct: number
}

type HotTopic = {
  rank: number
  topic: string
  mentions: number
}

type TopExposure = {
  brand: string
  appearances: number
  postUrl: string
  visibilityScore: number
  avgVisibility: number
}

type PlayerReportItem = {
  name: string
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
      totalCount: pos + neg,
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
  }, [initialSrc, shirtNumber])

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
  const indexCounts: Record<number, number> = {}

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <div className="absolute top-0" style={{ left: plotLeftPx, right: plotRightPx, height: "100%" }}>
        {events.map((event) => {
          const idx = points.findIndex((p) => p.label === event.xLabel)
          if (idx < 0) return null

          const stackIndex = indexCounts[idx] || 0
          indexCounts[idx] = stackIndex + 1

          const leftPct = ((idx + 0.5) / count) * 100
          const topOffset = -10 + (stackIndex * 32)

          return (
            <div key={event.id} className="absolute" style={{ left: `${leftPct}%`, top: topOffset }}>
              <div className="group pointer-events-auto relative z-10 hover:z-50" style={{ transform: "translateX(-14px)" }}>
                <div
                  className={
                    "flex items-center overflow-hidden rounded-md border border-border bg-background " +
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
  
  // Custom date range state (defaults to last 30 days)
  const defaultEnd = useMemo(() => new Date(), [])
  const defaultStart = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d
  }, [])
  
  const [customStart, setCustomStart] = useState<string>(toIsoDateOnly(defaultStart))
  const [customEnd, setCustomEnd] = useState<string>(toIsoDateOnly(defaultEnd))

  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [journeyGranularity, setJourneyGranularity] = useState<JourneyGranularity>("daily")
  const [journeyNormalize, setJourneyNormalize] = useState(false)
  const [playerPositionFilter, setPlayerPositionFilter] = useState("all")
  const [playerSortCol, setPlayerSortCol] = useState<"mentions" | "positivePct" | "avgRating" | "marketValue">("mentions")
  const [playerSortDir, setPlayerSortDir] = useState<"asc" | "desc">("desc")

  const [overview, setOverview] = useState<OverviewSummaryResponse | null>(null)
  const [overviewLoading, setOverviewLoading] = useState(true)
  const [overviewError, setOverviewError] = useState<string | null>(null)

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

  const dateRangeLabel = useMemo(() => `${formatShortDate(start)} - ${formatShortDate(end)}`, [start, end])

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

  const sentimentJourneyEvents = useMemo(() => {
    return overview?.sentimentJourney?.events ?? ([] as SentimentJourneyEvent[])
  }, [overview])

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
    if (!overview?.playerMentions?.fullReport) {
      return { data: [], config: {} }
    }

    const players = overview.playerMentions.fullReport
    const totalMentions = players.reduce((acc, p) => acc + Math.max(0, Number(p.mentions ?? 0)), 0)
    if (!totalMentions) return { data: [], config: {} }

    const topN = 5
    const sorted = [...players].sort((a, b) => b.mentions - a.mentions)
    const top = sorted.slice(0, topN)

    const topMentions = top.reduce((acc, p) => acc + Math.max(0, Number(p.mentions ?? 0)), 0)
    const data: MentionsShareSlice[] = top.map((p, i) => ({
      key: `p${i}`,
      name: p.name,
      value: (Math.max(0, Number(p.mentions ?? 0)) / totalMentions) * 100,
      color: `var(--chart-${(i % 5) + 1})`,
    }))

    const otherMentions = Math.max(0, totalMentions - topMentions)
    if (sorted.length > topN && otherMentions > 0) {
      const topShareSum = data.reduce((acc, item) => acc + item.value, 0)
      data.push({
        key: "other",
        name: "Other",
        value: Math.max(0, 100 - topShareSum),
        color: "var(--muted-foreground)",
      })
    }

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
  }, [overview])

  const sentimentVsValuePlayers = useMemo(() => {
    if (!overview?.playerMentions?.fullReport) return []
    
    // Players with known MV
    const valid = overview.playerMentions.fullReport.filter(p => p.marketValue !== null && p.marketValue > 0)
    if (valid.length < 2) return []

    // Calculate percentiles for market value to properly segment low/high
    const marketValues = valid.map(p => p.marketValue || 0).sort((a, b) => a - b)
    const medianMV = marketValues[Math.floor(marketValues.length / 2)]
    
    // Weighted score for impact: sentiment * log(mentions) 
    // This helps bubble up players with actual volume and good/bad sentiment rather than just 100% on 1 mention
    const scorePlayer = (p: typeof valid[0], type: 'positive' | 'negative') => {
        const sentiment = type === 'positive' ? p.positivePct : (100 - p.positivePct)
        // Log base 10 of mentions (capped at at least 1) to damp effect of very high mentions 
        // but penalize very low mentions heavily
        const weight = Math.log10(Math.max(p.mentions, 1))
        return sentiment * weight
    }

    // 1. Low MV (< median) AND High Positive Impact (Sentiment x Volume)
    const lowMvPlayers = valid.filter(p => (p.marketValue || 0) < medianMV)
    const bestLowMv = lowMvPlayers.sort((a, b) => scorePlayer(b, 'positive') - scorePlayer(a, 'positive'))[0]
    
    // 2. High MV (>= median) AND High Negative Impact (Low Sentiment x Volume)
    const highMvPlayers = valid.filter(p => (p.marketValue || 0) >= medianMV)
    const worstHighMv = highMvPlayers.sort((a, b) => scorePlayer(b, 'negative') - scorePlayer(a, 'negative'))[0]
    
    const results = []
    
    if (bestLowMv) {
        const parts = bestLowMv.name.split(" ")
        const lastName = parts.pop() || bestLowMv.name
        const firstName = parts.join(" ")
        
        results.push({
            firstName,
            lastName,
            imageSrc: bestLowMv.shirtNumber ? `/player_images/${bestLowMv.shirtNumber}.png` : "/player_images/no_image.png",
            marketValue: formatMarketValue(bestLowMv.marketValue),
            sentimentLabel: `${Math.round(bestLowMv.positivePct)}% positive`,
            sentimentVariant: "positive" as const
        })
    }
    
    if (worstHighMv) {
        const parts = worstHighMv.name.split(" ")
        const lastName = parts.pop() || worstHighMv.name
        const firstName = parts.join(" ")
        
        // Invert positive for negative label proxy
        const negProxy = 100 - worstHighMv.positivePct
        
        results.push({
            firstName,
            lastName,
            imageSrc: worstHighMv.shirtNumber ? `/player_images/${worstHighMv.shirtNumber}.png` : "/player_images/no_image.png",
            marketValue: formatMarketValue(worstHighMv.marketValue),
            sentimentLabel: `${Math.round(negProxy)}% negative`,
            sentimentVariant: "negative" as const
        })
    }
    
    return results
  }, [overview])

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

            <label className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm text-foreground hover:bg-accent cursor-pointer">
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
                <SentimentJourneyEventOverlay
                  points={sentimentJourneyData.points}
                  events={sentimentJourneyEvents}
                  plotLeftPx={40}
                  plotRightPx={18}
                />
              }
            >
              <BarChart
                data={sentimentJourneyChartData}
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
                    dataKey="neutralPctHalfDisplay"
                    stackId="totals"
                    radius={0}
                    className="fill-gray-300 dark:fill-gray-700"
                  />
                ) : null}
                {journeyNormalize ? (
                  <Bar
                    key="norm-neg"
                    dataKey="negativePctDisplay"
                    stackId="totals"
                    radius={0}
                    className="fill-red-500"
                  />
                ) : null}
                {journeyNormalize ? (
                  <Bar
                    key="norm-pos-neutral"
                    dataKey="neutralPctHalf"
                    stackId="totals"
                    radius={0}
                    className="fill-gray-300 dark:fill-gray-700"
                  />
                ) : null}
                {journeyNormalize ? (
                  <Bar
                    key="norm-pos"
                    dataKey="positivePct"
                    stackId="totals"
                    radius={0}
                    className="fill-green-500"
                  />
                ) : null}

                {!journeyNormalize ? (
                  <Bar
                    key="raw-pos"
                    dataKey="positiveCount"
                    stackId="totals"
                    radius={0}
                    className="fill-green-500"
                  />
                ) : null}
                {!journeyNormalize ? (
                  <Bar
                    key="raw-neg"
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
                {sortedAndFilteredPlayers.map((row, index) => (
                  <tr key={row.name} className={cn(index % 2 === 0 ? "bg-background" : "bg-muted", "h-8")}>
                    <td className="px-3 py-2 text-muted-foreground tabular-nums">{row.rank}</td>
                    <td className="h-full px-3">
                      <div className="flex h-full items-center gap-2">
                        <div className="pt-1 self-end">
                            <PlayerImage shirtNumber={row.shirtNumber} name={row.name} />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate">{row.name}</div>
                          <div className="text-xs text-muted-foreground">{row.position}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">{Math.floor(row.mentions).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.mentions > 0 ? `${row.positivePct.toFixed(0)}%` : "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                       <span className={cn("inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium text-white", getRatingBadgeClass(row.avgRating || 0))}>
                           {row.avgRating ? row.avgRating.toFixed(1) : "-"}
                       </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatMarketValue(row.marketValue)}</td>
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
            {sentimentVsValuePlayers.map((player) => {
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
                              "inline-flex text-nowrap items-center rounded-md px-2 py-0.5 text-sm font-semibold",
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
          <div className="px-6 py-4">
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
                {(overview?.hotTopics || []).map((row, index) => (
                  <tr key={index} className={index % 2 === 0 ? "bg-background" : "bg-muted"}>
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
    </main>
  )
}
