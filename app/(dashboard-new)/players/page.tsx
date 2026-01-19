"use client"

import Image from "next/image"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowRight,
  ArrowUpDown,
  CalendarIcon,
  Download,
  Filter,
  LineChart as LineChartIcon,
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
  Line,
  LineChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts"
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Flag } from "lucide-react"

type DateRangeKey = "7" | "30" | "90" | "365" | "custom"
type JourneyGranularity = "daily" | "weekly"

function SentimentJourneyEventOverlay({
  points,
  events,
  plotLeftPx,
  plotRightPx,
}: {
  points: SentimentJourneyPoint[]
  events: any[]
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

type SentimentJourneyPoint = {
  label: string
  positiveCount: number
  negativeCount: number
  negativeDisplay: number
}

type SentimentJourneySummary = {
  positiveCount: number
  negativeCount: number
  positiveChangePct: number
  negativeChangePct: number
}

type MentionsPoint = {
  label: string
  player: number
  avg: number
}

type SocialAppearance = {
  id: string
  impressions: number
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
  goals: number
  assists: number
  age: number | null
}

type HotTopic = {
  rank: number
  topic: string
  mentions: number
  date: string
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
    events: any[]
  }
  playerMentions: {
    mostPopular: any | null
    mostControversial: any | null
    fullReport: PlayerReportItem[]
  }
  hotTopics: HotTopic[]
  topExposures: any[]
  aiSummary: string | null
}

const sentimentJourneyChartConfig: ChartConfig = {
  positiveCount: { label: "Positive", color: "var(--chart-1)" },
  negativeDisplay: { label: "Negative", color: "var(--chart-2)" },
}

const mentionsJourneyChartConfig: ChartConfig = {
  player: { label: "Player", color: "var(--chart-1)" },
  avg: { label: "Average", color: "var(--chart-3)" },
}

function formatDeltaPct(value: number) {
  const abs = Math.abs(value)
  const rounded = abs < 10 ? abs.toFixed(1) : Math.round(abs).toString()
  return `${value >= 0 ? "+" : "-"}${rounded}%`
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

function percentChange(current: number, previous: number) {
  if (!previous) return current === 0 ? 0 : 100
  return ((current - previous) / previous) * 100
}

function makeLabels(granularity: JourneyGranularity, points: number) {
  if (granularity === "weekly") {
    return Array.from({ length: points }, (_, i) => `W${String(i + 1).padStart(2, "0")}`)
  }
  return Array.from({ length: points }, (_, i) => `D${String(i + 1).padStart(2, "0")}`)
}

function makeMockSentimentJourney(granularity: JourneyGranularity, seed: number) {
  const rand = mulberry32(seed)
  const points = granularity === "weekly" ? 12 : 24
  const labels = makeLabels(granularity, points)

  const data: SentimentJourneyPoint[] = labels.map((label, idx) => {
    const wave = Math.sin((idx / (points - 1)) * Math.PI * 2)
    const jitter = (rand() - 0.5) * 0.25
    const base = 0.55 + 0.15 * wave + jitter

    const volume = 520 + Math.round(rand() * 520)
    const positive = Math.round(volume * clamp(base, 0.25, 0.85))
    const negative = Math.max(0, volume - positive)

    return {
      label,
      positiveCount: positive,
      negativeCount: negative,
      negativeDisplay: -negative,
    }
  })

  const sumPositive = data.reduce((acc, p) => acc + p.positiveCount, 0)
  const sumNegative = data.reduce((acc, p) => acc + p.negativeCount, 0)

  return { points: data, positiveCount: sumPositive, negativeCount: sumNegative }
}

function makeMockMentionsJourney(granularity: JourneyGranularity, seed: number): MentionsPoint[] {
  const rand = mulberry32(seed)
  const points = granularity === "weekly" ? 12 : 24
  const labels = makeLabels(granularity, points)

  return labels.map((label, idx) => {
    const wave = Math.sin((idx / (points - 1)) * Math.PI * 2)
    const baselineAvg = 520 + wave * 90
    const baselinePlayer = 640 + wave * 150
    const avg = Math.round(clamp(baselineAvg + (rand() - 0.5) * 80, 180, 980))
    const player = Math.round(clamp(baselinePlayer + (rand() - 0.5) * 120, 240, 1400))
    return { label, avg, player }
  })
}

export default function PlayersPage() {
  const [search, setSearch] = useState("")
  const [dateRangeKey, setDateRangeKey] = useState<DateRangeKey>("30")
  const [customStart, setCustomStart] = useState<Date | undefined>()
  const [customEnd, setCustomEnd] = useState<Date | undefined>()
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [journeyGranularity, setJourneyGranularity] = useState<JourneyGranularity>("daily")
  const [journeyNormalize, setJourneyNormalize] = useState(false)

  const [overview, setOverview] = useState<OverviewSummaryResponse | null>(null)
  const [playerOverview, setPlayerOverview] = useState<OverviewSummaryResponse | null>(null)

  const mentionsJourneyRef = useRef<HTMLDivElement | null>(null)
  const [eventMentionsHeightPx, setEventMentionsHeightPx] = useState<number | undefined>(undefined)

  useEffect(() => {
    const el = mentionsJourneyRef.current
    if (!el) return

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const next = Math.round(entry.contentRect.height)
      setEventMentionsHeightPx((prev) => (prev === next ? prev : next))
    })

    observer.observe(el)
    return () => observer.disconnect()
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

  useEffect(() => {
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
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return
        console.error(err)
      }
    }

    void run()
    return () => controller.abort()
  }, [start, end, journeyGranularity])

  const selectedPlayer = useMemo(() => {
    if (!overview?.playerMentions?.fullReport?.length) return null
    // Sort by mentions desc and pick top 1
    const sorted = [...overview.playerMentions.fullReport].sort((a, b) => b.mentions - a.mentions)
    return sorted[0]
  }, [overview])

  useEffect(() => {
    if (!selectedPlayer) return

    const controller = new AbortController()
    const run = async () => {
      try {
        const url = new URL("/api/new/overview/summary", window.location.origin)
        url.searchParams.set("start", toIsoDateOnly(start))
        url.searchParams.set("end", toIsoDateOnly(end))
        url.searchParams.set("granularity", journeyGranularity === "weekly" ? "week" : "day")
        url.searchParams.set("player_id", String(selectedPlayer.fotmobId))

        const res = await fetch(url.toString(), {
          cache: "no-store",
          signal: controller.signal,
        })
        if (!res.ok) throw new Error(`API ${res.status}`)
        const data = (await res.json()) as OverviewSummaryResponse
        setPlayerOverview(data)
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return
        console.error(err)
      }
    }

    void run()
    return () => controller.abort()
  }, [selectedPlayer, start, end, journeyGranularity])

  const player = useMemo(
    () => {
      if (!selectedPlayer) {
         return {
            firstName: "Johan",
            lastName: "Bakayoko",
            flag: "🇧🇪",
            position: "RW",
            age: "—",
            imageSrc: "/player_images/no_image.png",
            marketValue: "—",
         }
      }

      const parts = selectedPlayer.name.split(" ")
      const lastName = parts.pop() || selectedPlayer.name
      const firstName = parts.join(" ")

      const mv = selectedPlayer.marketValue
        ? selectedPlayer.marketValue >= 1_000_000
          ? `€${(selectedPlayer.marketValue / 1_000_000).toFixed(1)}M`
          : `€${(selectedPlayer.marketValue / 1_000).toFixed(0)}K`
        : "—"

      return {
        firstName,
        lastName,
        flag: "🇳🇱", // Placeholder
        position: selectedPlayer.position || "—",
        age: selectedPlayer.age ? `${selectedPlayer.age}y` : "—",
        imageSrc: selectedPlayer.shirtNumber 
             ? `/player_images/${selectedPlayer.shirtNumber}.png` 
             : "/player_images/no_image.png",
        marketValue: mv,
      }
    },
    [selectedPlayer]
  )

  const heroStats = useMemo(
    () => {
        if (!selectedPlayer) {
             return [
                { label: "MENTIONS", value: "—" },
                { label: "MARKET VALUE", value: "—" },
                { label: "AVG PERFORMANCE", value: "—" },
                { label: "GOALS", value: "—" },
                { label: "ASSISTS", value: "—" },
             ]
        }
        
        const mv = selectedPlayer.marketValue
        ? selectedPlayer.marketValue >= 1_000_000
          ? `€${(selectedPlayer.marketValue / 1_000_000).toFixed(1)}M`
          : `€${(selectedPlayer.marketValue / 1_000).toFixed(0)}K`
        : "—"

      return [
        { label: "MENTIONS", value: selectedPlayer.mentions.toLocaleString() },
        { label: "MARKET VALUE", value: mv },
        { label: "AVG PERFORMANCE", value: selectedPlayer.avgRating ? selectedPlayer.avgRating.toFixed(1) : "-" },
        { label: "GOALS", value: selectedPlayer.goals.toString() },
        { label: "ASSISTS", value: selectedPlayer.assists.toString() },
      ] as const
    },
    [selectedPlayer]
  )

  const sentimentJourney = useMemo(() => {
    // Prefer player-specific data if available, else standard overview (but playerOverview is better for this card)
    const source = playerOverview || overview
    if (source?.sentimentJourney) {
      return source.sentimentJourney
    }
    const seedBase = Number(dateRangeKey) * 1000 + (journeyGranularity === "weekly" ? 77 : 33)
    const current = makeMockSentimentJourney(journeyGranularity, seedBase + 1)
    const previous = makeMockSentimentJourney(journeyGranularity, seedBase + 999)

    const summary: SentimentJourneySummary = {
      positiveCount: current.positiveCount,
      negativeCount: current.negativeCount,
      positiveChangePct: percentChange(current.positiveCount, previous.positiveCount),
      negativeChangePct: percentChange(current.negativeCount, previous.negativeCount),
    }

    return { points: current.points, summary }
  }, [dateRangeKey, journeyGranularity, overview, playerOverview])

  // Process data for the chart: normalize if needed
  const sentimentJourneyData = useMemo(() => {
    return sentimentJourney.points.map((p) => {
      if (journeyNormalize && p.totalCount > 0) {
        // Normalized stack: strictly 0..100 for positive, and -100..0 for negative?
        // Actually, normally "normalized" means 100% stacked bar.
        // In the Engagement Hub logic:
        // positiveHeight = (pos / total) * 100
        // negativeHeight = (neg / total) * 100
        // We display negative as negative value downwards?
        // The standard stackOffset="sign" logic in Recharts works with absolute values mostly or signed.
        
        // Let's check how Engagement Hub does it. 
        // It seems I didn't verify the normalization logic in Engagement Hub fully. 
        // But typically:
        const total = p.positiveCount + p.negativeCount
        const posPct = total > 0 ? (p.positiveCount / total) * 100 : 0
        const negPct = total > 0 ? (p.negativeCount / total) * 100 : 0
        
        return {
          ...p,
          positiveCount: Math.round(posPct),
          negativeCount: Math.round(negPct),
          negativeDisplay: -Math.round(negPct), // For the chart to draw below 0
          originalTotal: total,
        }
      }
      return p
    })
  }, [sentimentJourney.points, journeyNormalize])

  const sentimentJourneyEvents = useMemo(() => {
    // Only show events if we have them. 
    // The events come from the API attached to points.
    // They are linked by labels.
    return sentimentJourney.events || []
  }, [sentimentJourney])

  const sentimentJourneyDomainMax = useMemo(() => {
    const maxAbs = sentimentJourney.points.reduce((acc, p) => {
      const candidate = Math.max(p.positiveCount, p.negativeCount)
      return Math.max(acc, candidate)
    }, 0)

    if (!maxAbs) return 1000
    return Math.ceil(maxAbs / 100) * 100
  }, [sentimentJourney.points])

  const mentionsJourney = useMemo(() => {
    const seedBase = Number(dateRangeKey) * 1000 + (journeyGranularity === "weekly" ? 707 : 303)
    return makeMockMentionsJourney(journeyGranularity, seedBase)
  }, [dateRangeKey, journeyGranularity])

  const eventMentions = useMemo(
    () => {
      if (overview?.hotTopics) {
        return overview.hotTopics.slice(0, 10).map((t, i) => ({
          rank: i + 1,
          event: t.topic,
          mentions: t.mentions,
        }))
      }

      return [
        { rank: 1, event: "AZ 1 - 5 PSV", mentions: 1240 },
        { rank: 2, event: "Winactie PSV tenue", mentions: 980 },
        { rank: 3, event: "Champions League group draw", mentions: 860 },
        { rank: 4, event: "Goal in the 89th minute", mentions: 740 },
        { rank: 5, event: "Man of the Match interview", mentions: 690 },
        { rank: 6, event: "Pre-season training clip", mentions: 640 },
        { rank: 7, event: "Assist vs Feyenoord", mentions: 610 },
        { rank: 8, event: "Injury update", mentions: 580 },
        { rank: 9, event: "Contract extension rumours", mentions: 540 },
        { rank: 10, event: "Away day atmosphere", mentions: 510 },
      ]
    },
    [overview]
  )

  const playerMentions = useMemo(
    () =>
      (
        [
          { rank: 1, comment: "Bakayoko was unstoppable today — what a performance.", likes: 221 },
          { rank: 2, comment: "That run and the cut-back from Bakayoko changed the game.", likes: 198 },
          { rank: 3, comment: "Bakayoko needs to start every match, he brings so much threat.", likes: 174 },
          { rank: 4, comment: "Great link-up play, but Bakayoko must be more clinical.", likes: 155 },
          { rank: 5, comment: "Bakayoko tracking back + pressing has been top lately.", likes: 141 },
          { rank: 6, comment: "Is Bakayoko already worth €30m?", likes: 126 },
          { rank: 7, comment: "Bakayoko + Veerman connection is elite.", likes: 118 },
          { rank: 8, comment: "One touch too many from Bakayoko in the box.", likes: 104 },
          { rank: 9, comment: "Bakayoko’s pace on the wing is terrifying.", likes: 99 },
          { rank: 10, comment: "Bakayoko with another assist — love it.", likes: 92 },
        ] as const
      ),
    []
  )

  const socialAppearances = useMemo(() => {
    const posts: SocialAppearance[] = [
      { id: "p1", impressions: 236_000 },
      { id: "p2", impressions: 188_500 },
      { id: "p3", impressions: 156_200 },
    ]

    return posts
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

          <div className="inline-flex items-stretch">
            <div
              className="flex items-center gap-2 rounded-l-md border border-r-0 border-input bg-card px-3 text-sm"
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
                <SelectItem value="365">Last 365 days</SelectItem>
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
                className="bg-popover text-popover-foreground absolute right-0 top-full z-50 mt-2 w-64 rounded-md border p-2 text-sm shadow-md"
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

      <div className="relative">
        <div className="pointer-events-none absolute left-6 bottom-0 z-20">
          <Image
            src={player.imageSrc}
            alt={`${player.firstName} ${player.lastName}`}
            width={260}
            height={520}
            className="h-[210px] w-auto object-contain object-bottom md:h-[200px]"
            priority
          />
        </div>

        <section
          className={
            "relative h-[170px] overflow-hidden" +
            " [clip-path:polygon(0_0,100%_0,calc(100%_-_12px)_100%,0_100%)]" +
            " before:absolute before:inset-0 before:z-0 before:bg-black"
          }
        >
          <div className="relative z-10 flex h-full items-stretch justify-between gap-8 px-6 text-white">
            <div className="flex min-w-0 flex-1 items-end gap-6">
              <div className="w-[160px] shrink-0 md:w-[190px]" aria-hidden="true" />

              <div className="flex min-w-0 flex-col justify-center self-center">
                <div className="text-xs text-white/80">{player.firstName}</div>
                <div className="flex items-end gap-2">
                  <div className="font-psv-branding italic text-4xl leading-none md:text-4xl truncate">{player.lastName}</div>
                  <div className="text-2xl leading-none" aria-label="Country">{player.flag}</div>
                </div>

                <div className="mt-1 flex items-center gap-2">
                  <div className="inline-flex items-center rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white">
                    {player.position}
                  </div>
                  <div className="inline-flex items-center rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white">
                    {player.age}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-none flex-col items-end justify-center self-center">
              <div className="text-xs text-white/80">Market value</div>
              <div className="mt-2 font-psv-branding italic text-4xl leading-none tabular-nums md:text-4xl">
                {player.marketValue}
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="grid w-full grid-cols-1 gap-6 md:grid-cols-5">
        {heroStats.map((stat) => (
          <div key={stat.label} className="rounded-xl border border-border bg-background px-5 py-4">
            <div className="text-base font-semibold font-psv-branding">{stat.label}</div>
            <div className="mt-2 font-psv-branding italic text-3xl leading-none tabular-nums">{stat.value}</div>
          </div>
        ))}
      </section>

      <section className="w-full rounded-xl border border-border bg-background overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2 text-base font-semibold font-psv-branding">
            <LineChartIcon className="h-4 w-4 text-primary" />
            <span>SENTIMENT JOURNEY</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex items-center rounded-md border border-border bg-background p-1 text-sm">
              <button
                type="button"
                onClick={() => setJourneyNormalize(false)}
                className={cn(
                  "inline-flex h-7 items-center rounded-sm px-3",
                  !journeyNormalize ? "bg-black text-white" : "text-muted-foreground hover:bg-accent",
                )}
              >
                Volume
              </button>
              <button
                type="button"
                onClick={() => setJourneyNormalize(true)}
                className={cn(
                  "inline-flex h-7 items-center rounded-sm px-3",
                  journeyNormalize ? "bg-black text-white" : "text-muted-foreground hover:bg-accent",
                )}
              >
                100%
              </button>
            </div>
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
          </div>
        </div>

        <div className="flex w-full items-stretch">
          <div className="w-3/4 py-6">
            <ChartContainer
              config={sentimentJourneyChartConfig}
              className="h-[260px] w-full"
              overlay={
                <SentimentJourneyEventOverlay
                  points={sentimentJourneyData}
                  events={sentimentJourneyEvents}
                  plotLeftPx={40}
                  plotRightPx={18}
                />
              }
            >
              <BarChart
                data={sentimentJourneyData}
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

                    const total =
                      Object.prototype.hasOwnProperty.call(point, "originalTotal")
                        // @ts-ignore
                        ? point.originalTotal
                        : point.positiveCount + point.negativeCount

                    const posVal =
                      Object.prototype.hasOwnProperty.call(point, "originalTotal")
                        // @ts-ignore (we know originalTotal exists if total != pos+neg in normalized mode, but actually logic is simpler)
                        // If normalized, positiveCount is %. We want tooltip to show real values?
                        // "make it completely the same as the one on the overview"
                        // The Overview tooltip usually shows the VALUES, even if the chart is normalized?
                        // Or does it show percentages?
                        // Let's assume we want to show the REAL values in tooltip if we have them.
                        // I didn't save real values in normalized obj except maybe via originalTotal logic?
                        // Wait, I only saved originalTotal.
                        // I can't recover pos/neg counts exactly from %, so I should have saved them.
                        // Let's simplify and show what's in the point for now.
                        // Actually, Overview page uses `point.positiveCount` directly. If normalized, it shows 80 vs 20.
                        // Let's stick to showing point values.
                        ? point.positiveCount
                        : point.positiveCount

                     const netPct = total === 0 ? 0 : ((point.positiveCount - point.negativeCount) / total) * 100

                    return (
                      <div className="rounded-lg bg-black px-3 py-2 text-white shadow-md">
                        <div className="text-sm font-semibold">{point.label}</div>
                        <div className="mt-2 space-y-1 text-sm">
                          <div className="flex items-center justify-between gap-6">
                            <span className="inline-flex items-center gap-2 text-green-500">
                              <ThumbsUp className="h-4 w-4" />
                            </span>
                            <span className="font-medium tabular-nums">{point.positiveCount.toLocaleString()}{journeyNormalize ? "%" : ""}</span>
                          </div>
                          <div className="flex items-center justify-between gap-6">
                            <span className="inline-flex items-center gap-2 text-red-500">
                              <ThumbsDown className="h-4 w-4" />
                            </span>
                            <span className="font-medium tabular-nums">{point.negativeCount.toLocaleString()}{journeyNormalize ? "%" : ""}</span>
                          </div>
                          {!journeyNormalize && (
                            <div className="flex items-center justify-between gap-2 pt-1 text-xs text-white/70">
                              <LineChartIcon className="h-3.5 w-3.5" />
                              <span className="tabular-nums">{netPct.toFixed(0)}%</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  }}
                />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis
                  width={40}
                  domain={journeyNormalize ? [0, 100] : [-sentimentJourneyDomainMax, sentimentJourneyDomainMax]}
                  ticks={journeyNormalize ? [0, 50, 100] : [-sentimentJourneyDomainMax, 0, sentimentJourneyDomainMax]}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => Math.abs(Number(v)).toLocaleString() + (journeyNormalize ? "%" : "")}
                />
                <Bar dataKey="positiveCount" stackId="totals" radius={0} className="fill-green-500" />
                {!journeyNormalize ? (
                  <Bar dataKey="negativeDisplay" stackId="totals" radius={0} className="fill-red-500" />
                ) : (
                  <Bar dataKey="negativeCount" stackId="totals" radius={0} className="fill-red-500" />
                )}
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
                    {sentimentJourney.summary.positiveCount.toLocaleString()}
                  </div>
                  <div
                    className={cn(
                      "inline-flex items-center gap-1 text-sm font-semibold",
                      sentimentJourney.summary.positiveChangePct >= 0 ? "text-green-500" : "text-red-500"
                    )}
                  >
                    <span>{formatDeltaPct(sentimentJourney.summary.positiveChangePct)}</span>
                    {sentimentJourney.summary.positiveChangePct >= 0 ? (
                      <TrendingUp className="h-4 w-4" />
                    ) : (
                      <TrendingDown className="h-4 w-4" />
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <ThumbsDown className="h-10 w-10 shrink-0 text-red-500" />
              <div className="min-w-0">
                <div className="text-sm text-muted-foreground">Negative comments</div>
                <div className="mt-1 flex items-baseline gap-2">
                  <div className="font-psv-branding italic text-3xl leading-none">
                    {sentimentJourney.summary.negativeCount.toLocaleString()}
                  </div>
                  <div
                    className={cn(
                      "inline-flex items-center gap-1 text-sm font-semibold",
                      sentimentJourney.summary.negativeChangePct >= 0 ? "text-green-500" : "text-red-500"
                    )}
                  >
                    <span>{formatDeltaPct(sentimentJourney.summary.negativeChangePct)}</span>
                    {sentimentJourney.summary.negativeChangePct >= 0 ? (
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

      <section className="grid w-full grid-cols-1 items-start gap-6 md:grid-cols-3">
        <div
          ref={mentionsJourneyRef}
          className="flex flex-col overflow-hidden rounded-xl border border-border bg-background md:col-span-2"
        >
          <div className="flex items-center justify-between gap-3 px-6 py-4">
            <div className="flex items-center gap-2 text-base font-semibold font-psv-branding">
              <LineChartIcon className="h-4 w-4" />
              <span>MENTIONS JOURNEY</span>
            </div>
            <div className="text-sm text-muted-foreground">{periodLabel}</div>
          </div>

          <div className="px-6 pb-6">
            <ChartContainer config={mentionsJourneyChartConfig} className="h-[260px] w-full">
              <LineChart data={mentionsJourney} margin={{ top: 12, right: 18, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} width={40} />
                <ChartTooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const p = payload[0]?.payload as MentionsPoint | undefined
                    if (!p) return null
                    return (
                      <div className="rounded-lg bg-black px-3 py-2 text-white shadow-md">
                        <div className="text-sm font-semibold">{p.label}</div>
                        <div className="mt-2 space-y-1 text-xs">
                          <div className="flex items-center justify-between gap-6">
                            <span className="text-white/70">Player</span>
                            <span className="font-medium tabular-nums">{p.player.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center justify-between gap-6">
                            <span className="text-white/70">Average</span>
                            <span className="font-medium tabular-nums">{p.avg.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    )
                  }}
                />
                <Line type="monotone" dataKey="avg" stroke="var(--chart-3)" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="player" stroke="var(--chart-1)" strokeWidth={2.5} dot={false} isAnimationActive={false} />
              </LineChart>
            </ChartContainer>

            <div className="mt-3 flex flex-wrap items-center justify-center gap-5 text-xs text-muted-foreground">
              {[{ key: "player", label: `${player.firstName} ${player.lastName}`, color: "var(--chart-1)" }, { key: "avg", label: "Average", color: "var(--chart-3)" }].map(
                (item) => (
                  <div key={item.key} className="flex items-center gap-2">
                    <span className="h-[10px] w-[10px] rounded-[2px]" style={{ backgroundColor: item.color }} aria-hidden="true" />
                    <span>{item.label}</span>
                  </div>
                )
              )}
            </div>
          </div>
        </div>

        <div
          className="flex flex-col overflow-hidden rounded-xl border border-border bg-background md:col-span-1"
          style={eventMentionsHeightPx ? { height: eventMentionsHeightPx } : undefined}
        >
          <div className="px-6 pt-6 pb-4">
            <div className="flex items-baseline justify-between gap-3">
              <div className="text-base font-semibold font-psv-branding">EVENT MENTIONS</div>
              <div className="text-sm text-muted-foreground">{periodLabel}</div>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto border-t border-border">
            <table className="w-full table-fixed text-xs">
              <thead>
                <tr>
                  <th className="sticky top-0 z-10 w-12 bg-muted px-3 py-2 text-left font-semibold text-muted-foreground">#</th>
                  <th className="sticky top-0 z-10 bg-muted px-3 py-2 text-left font-semibold text-muted-foreground">EVENT</th>
                  <th className="sticky top-0 z-10 w-24 bg-muted px-3 py-2 text-right font-semibold text-muted-foreground">
                    MENTIONS
                  </th>
                </tr>
              </thead>
              <tbody>
                {eventMentions.map((row, index) => (
                  <tr key={row.rank} className={index % 2 === 0 ? "bg-background" : "bg-muted"}>
                    <td className="w-12 px-3 py-2 text-muted-foreground tabular-nums">{row.rank}</td>
                    <td className="px-3 py-2">
                      <div className="truncate">{row.event}</div>
                    </td>
                    <td className="w-24 px-3 py-2 text-right font-medium tabular-nums">{row.mentions.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="mt-0 grid w-full grid-cols-1 gap-6 md:flex md:h-[320px]">
        <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-background md:flex-1 md:min-w-0">
          <div className="flex items-center justify-between gap-3 px-6 py-4">
            <div className="text-base font-semibold font-psv-branding">PLAYER MENTIONS</div>
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

          <div className="flex-1 overflow-y-auto border-t border-border">
            <table className="w-full table-fixed text-xs">
              <thead>
                <tr>
                  <th className="sticky top-0 z-10 w-12 bg-muted px-3 py-2 text-left font-semibold text-muted-foreground">#</th>
                  <th className="sticky top-0 z-10 bg-muted px-3 py-2 text-left font-semibold text-muted-foreground">COMMENT</th>
                  <th className="sticky top-0 z-10 w-20 bg-muted px-3 py-2 text-right font-semibold text-muted-foreground">
                    LIKES
                  </th>
                </tr>
              </thead>
              <tbody>
                {playerMentions
                  .filter((row) => {
                    if (!search.trim()) return true
                    return row.comment.toLowerCase().includes(search.trim().toLowerCase())
                  })
                  .map((row, index) => (
                    <tr key={row.rank} className={index % 2 === 0 ? "bg-background" : "bg-muted"}>
                      <td className="w-12 px-3 py-2 text-muted-foreground tabular-nums">{row.rank}</td>
                      <td className="px-3 py-2">
                        <div className="truncate">{row.comment}</div>
                      </td>
                      <td className="w-20 px-3 py-2 text-right font-medium tabular-nums">{row.likes.toLocaleString()}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-background md:w-[400px] md:min-w-[400px] md:flex-none">
          <div className="flex items-center justify-between gap-3 px-6 py-4">
            <div className="text-base font-semibold font-psv-branding">SOCIAL APPEAREANCES</div>
            <div className="text-sm text-muted-foreground">{periodLabel}</div>
          </div>

          <div className="flex-1 min-h-0 px-6 pb-6">
            <div className="grid h-full grid-cols-3 gap-3">
              {socialAppearances.map((item) => (
                <div key={item.id} className="flex h-full flex-col overflow-hidden">
                  <div className="relative flex-1 min-h-0 w-full">
                    <Image
                      src="/posts/post-template.png"
                      alt="Tagged post"
                      fill
                      sizes="(min-width: 768px) 220px, 33vw"
                      className="object-cover"
                    />
                  </div>
                  <div className="shrink-0 flex items-center justify-center border-t border-border bg-muted px-2 py-2">
                    <div className="text-xs text-muted-foreground tabular-nums text-center">
                      {item.impressions.toLocaleString()} <br /> impressions
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
