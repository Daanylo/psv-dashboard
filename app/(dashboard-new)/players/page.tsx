"use client"

import Image from "next/image"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  Award,
  ArrowRight,
  ArrowUpDown,
  CalendarIcon,
  CalendarDays,
  Camera,
  Download,
  Filter,
  Flag,
  Footprints,
  Gauge,
  LineChart as LineChartIcon,
  MessageSquareText,
  Target,
  ThumbsDown,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { exportNodeToPdf } from "@/lib/export-pdf"
import { Separator } from "@/components/ui/separator"
import { GlobalSearch } from "@/components/global-search"
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

type DateRangeKey = "7" | "30" | "90" | "365" | "custom"
type JourneyGranularity = "daily" | "weekly"

function SentimentJourneyEventOverlay({
  points,
  events,
  plotLeftPx,
  plotRightPx,
  onMatchClick,
}: {
  points: SentimentJourneyPoint[]
  events: any[]
  plotLeftPx: number
  plotRightPx: number
  onMatchClick?: (matchId: number) => void
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

          const matchId = Number(event.id)
          const canNavigate = !!onMatchClick && Number.isFinite(matchId) && matchId > 0

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
                    "h-[30px] max-h-[30px] " +
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
                  </div>
                </div>

                <div
                  className={
                    "pointer-events-none absolute left-0 top-full mt-1 w-[180px] " +
                    "rounded-md border border-border bg-background px-2 py-1 shadow-md " +
                    "opacity-0 translate-y-1 transition-all duration-150 ease-out " +
                    "group-hover:opacity-100 group-hover:translate-y-0"
                  }
                >
                  <div className="truncate text-xs font-medium text-foreground">{event.title}</div>
                  <div className="truncate text-[11px] leading-tight text-muted-foreground">{event.subtitle}</div>
                  <div className="truncate text-[9px] leading-tight text-muted-foreground tabular-nums">
                    {[
                      `Rating ${
                        event.playerRating === null || event.playerRating === undefined
                          ? "—"
                          : Number(event.playerRating).toFixed(1)
                      }`,
                      `G ${Number(event.playerGoals ?? 0)}`,
                      `A ${Number(event.playerAssists ?? 0)}`,
                    ].join(" · ")}
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
  if (!points.length) return null

  const maxPosts = points.reduce((acc, p) => Math.max(acc, Number(p.postsCount ?? 0)), 0)
  if (!maxPosts) return null

  const count = points.length

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <div className="absolute top-0" style={{ left: plotLeftPx, right: plotRightPx, height: "100%" }}>
        {points.map((p, idx) => {
          const posts = Number(p.postsCount ?? 0)
          const t = maxPosts ? posts / maxPosts : 0
          const opacity = 0.08 + t * 0.42
          const leftPct = ((idx + 0.5) / count) * 100

          return (
            <div
              key={idx}
              className="pointer-events-auto absolute rounded-[2px] bg-primary"
              title={`${posts.toLocaleString()} posts`}
              style={{
                left: `calc(${leftPct}% - 2px)`,
                bottom: 6,
                width: "4px",
                height: "10px",
                opacity,
              }}
            />
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

function formatSafeDateOnly(value: string) {
  const raw = (value ?? "").trim()
  if (!raw) return "—"

  if (/^\d+$/.test(raw)) {
    const num = Number(raw)
    if (Number.isFinite(num)) {
      if (raw.length === 10) {
        const d = new Date(num * 1000)
        return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString()
      }
      if (raw.length === 13) {
        const d = new Date(num)
        return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString()
      }
    }
  }

  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString()
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
  totalCount: number
  postsCount: number
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
  imageUrl?: string
  url?: string
}

type PlayerReportItem = {
  name: string
  fotmobId: number
  shirtNumber: number | null
  position: string | null
  mentions: number
  motm: number
  positivePct: number
  avgRating: number | null
  marketValue: number | null
  goals: number
  assists: number
  age: number | null
}

type BasicPlayer = {
  name: string
  shirtNumber: number | null
  fotmobId: number
  transferValue: number | null
  position: string | null
  goals: number
  assists: number
  countryCode: string | null
  age: number | null
  rating: number | null
  matchesPlayed: number
  motm: number
  aliases?: string[]
}

type HotTopic = {
  rank: number
  matchId: number
  topic: string
  mentions: number
  date: string
}

type PlayerComment = {
  id: string
  text: string
  likes: number
  sentiment: string
  date: string
  playerMentioned: string
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
  mentionsJourney?: MentionsPoint[]
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

function percentChange(current: number, previous: number) {
  if (!previous) return current === 0 ? 0 : 100
  return ((current - previous) / previous) * 100
}

function getFlagEmoji(countryCode: string | null) {
  if (!countryCode) return "—"
  
  // Custom mapping for common 3-letter codes if necessary
  const map: Record<string, string> = {
    "NED": "NL", "BEL": "BE", "USA": "US", "MEX": "MX", "FRA": "FR", 
    "GER": "DE", "DEU": "DE", "ESP": "ES", "BRA": "BR", "ARG": "AR",
    "ITA": "IT", "POR": "PT", "ENG": "GB", "GBR": "GB", "MAR": "MA",
    "ISR": "IL", "CRO": "HR", "BIH": "BA", "ROU": "RO", "CUW": "CW", "BFA": "BF", "CZE": "CZ"
  }
  
  let code = countryCode.toUpperCase()
  if (map[code]) code = map[code]
  
  if (code.length === 2) {
      const offset = 127397
      const f = code.split("").map(c => c.charCodeAt(0) + offset)
      return String.fromCodePoint(...f)
  }
  return code
}

export default function PlayersPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const mainRef = useRef<HTMLElement>(null)

  const [search, setSearch] = useState("")
  const [commentsSort, setCommentsSort] = useState<"likes" | "time">("likes")
  const [commentsSentiment, setCommentsSentiment] = useState<"all" | "positive" | "neutral" | "negative">("all")
  const [commentsData, setCommentsData] = useState<PlayerComment[]>([])

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

  const [overview, setOverview] = useState<OverviewSummaryResponse | null>(null)
  const [playerOverview, setPlayerOverview] = useState<OverviewSummaryResponse | null>(null)
  
  const [allPlayers, setAllPlayers] = useState<BasicPlayer[]>([])
  const selectedPlayerId = useMemo(() => {
    const raw = searchParams.get("player_id")
    if (!raw) return null
    const parsed = Number(raw)
    if (!Number.isFinite(parsed) || parsed <= 0) return null
    return parsed
  }, [searchParams])

  const [socialAppearances, setSocialAppearances] = useState<SocialAppearance[]>([])

  const lastSuccessfulPlayerOverviewUrlRef = useRef<string | null>(null)
  const lastSuccessfulCommentsUrlRef = useRef<string | null>(null)

  const mentionsJourneyRef = useRef<HTMLDivElement | null>(null)
  const [eventMentionsHeightPx, setEventMentionsHeightPx] = useState<number | undefined>(undefined)

  const filteredPlayers = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return allPlayers
    return allPlayers.filter((p) => p.name.toLowerCase().includes(q))
  }, [allPlayers, search])

  const groupedPlayers = useMemo(() => {
    const groupKeyForPosition = (pos: string | null) => {
      const p = (pos ?? "").toUpperCase()
      if (!p) return "ATT"
      if (p === "GK" || p.includes("GOALKEEP")) return "GK"
      if (
        p.includes("CB") ||
        p.includes("LB") ||
        p.includes("RB") ||
        p.includes("LWB") ||
        p.includes("RWB") ||
        p.includes("DEF")
      ) {
        return "DEF"
      }
      if (p.includes("CDM") || p.includes("CM") || p.includes("CAM") || p.includes("MID")) return "MID"
      return "ATT"
    }

    const labelForKey = (key: string) => {
      switch (key) {
        case "GK":
          return "Goalkeepers"
        case "DEF":
          return "Defenders"
        case "MID":
          return "Midfielders"
        default:
          return "Attackers"
      }
    }

    const groups = new Map<string, BasicPlayer[]>()
    for (const player of filteredPlayers) {
      const key = groupKeyForPosition(player.position)
      const list = groups.get(key) ?? []
      list.push(player)
      groups.set(key, list)
    }

    for (const [key, list] of groups.entries()) {
      list.sort((a, b) => a.name.localeCompare(b.name))
      groups.set(key, list)
    }

    const orderedKeys = ["GK", "DEF", "MID", "ATT"]
    return orderedKeys
      .filter((k) => (groups.get(k)?.length ?? 0) > 0)
      .map((k) => ({ key: k, label: labelForKey(k), players: groups.get(k) ?? [] }))
  }, [filteredPlayers])

  useEffect(() => {
    fetch('/api/new/players')
      .then(res => res.json())
      .then(data => {
        if (data.players) setAllPlayers(data.players)
      })
      .catch(console.error)
  }, [])

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

  const selectedPlayer = useMemo<PlayerReportItem | null>(() => {
    if (!selectedPlayerId) return null

    const fromPlayerOverview = playerOverview?.playerMentions?.fullReport?.find(
      (p) => p.fotmobId === selectedPlayerId,
    )
    if (fromPlayerOverview) return fromPlayerOverview

    const fromOverview = overview?.playerMentions?.fullReport?.find(
      (p) => p.fotmobId === selectedPlayerId,
    )
    if (fromOverview) return fromOverview

    const basic = allPlayers.find((p) => p.fotmobId === selectedPlayerId)
    if (!basic) return null

    return {
      name: basic.name,
      fotmobId: basic.fotmobId,
      shirtNumber: basic.shirtNumber,
      position: basic.position,
      mentions: 0,
      motm: 0,
      positivePct: 0,
      avgRating: null,
      marketValue: basic.transferValue,
      goals: basic.goals,
      assists: basic.assists,
      age: basic.age,
    }
  }, [selectedPlayerId, allPlayers, overview, playerOverview])

  useEffect(() => {
    if (!selectedPlayerId) {
      setPlayerOverview(null)
      lastSuccessfulPlayerOverviewUrlRef.current = null
      return
    }

    const controller = new AbortController()
    const run = async () => {
      try {
        const url = new URL("/api/new/overview/summary", window.location.origin)
        url.searchParams.set("start", toIsoDateOnly(start))
        url.searchParams.set("end", toIsoDateOnly(end))
        url.searchParams.set("granularity", journeyGranularity === "weekly" ? "week" : "day")
        url.searchParams.set("player_id", String(selectedPlayerId))

        const requestUrl = url.toString()
        if (lastSuccessfulPlayerOverviewUrlRef.current === requestUrl) return

        const res = await fetch(requestUrl, {
          cache: "no-store",
          signal: controller.signal,
        })
        if (!res.ok) throw new Error(`API ${res.status}`)
        const data = (await res.json()) as OverviewSummaryResponse
        lastSuccessfulPlayerOverviewUrlRef.current = requestUrl
        setPlayerOverview(data)
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return
        console.error(err)
      }
    }

    void run()
    return () => controller.abort()
  }, [selectedPlayerId, start, end, journeyGranularity])

  useEffect(() => {
     if (!selectedPlayerId) {
         setCommentsData([])
       lastSuccessfulCommentsUrlRef.current = null
         return
     }

     const controller = new AbortController()
     const run = async () => {
         try {
             const url = new URL("/api/new/players/comments", window.location.origin)
             url.searchParams.set("start", toIsoDateOnly(start))
             url.searchParams.set("end", toIsoDateOnly(end))
             url.searchParams.set("player_id", String(selectedPlayerId))
             url.searchParams.set("sort", commentsSort)
             url.searchParams.set("sentiment", commentsSentiment)

           const requestUrl = url.toString()
           if (lastSuccessfulCommentsUrlRef.current === requestUrl) return

           const res = await fetch(requestUrl, {
                 signal: controller.signal
             })
             if (res.ok) {
                 const data = await res.json()
               lastSuccessfulCommentsUrlRef.current = requestUrl
                 setCommentsData(data.comments || [])
             }
         } catch(e: unknown) {
             if (e instanceof DOMException && e.name === "AbortError") return
             console.error(e)
         }
     }
     void run()
     return () => controller.abort()
    }, [selectedPlayerId, start, end, commentsSort, commentsSentiment])

  useEffect(() => {
    if (!selectedPlayerId) {
      setSocialAppearances([])
      return
    }

    const controller = new AbortController()
    const run = async () => {
      try {
        const url = new URL("/api/new/players/social-appearances", window.location.origin)
        url.searchParams.set("start", toIsoDateOnly(start))
        url.searchParams.set("end", toIsoDateOnly(end))
        url.searchParams.set("player_id", String(selectedPlayerId))

        const res = await fetch(url.toString(), {
          cache: "no-store",
          signal: controller.signal,
        })
        if (!res.ok) throw new Error(`API ${res.status}`)
        const data = (await res.json()) as { items?: SocialAppearance[] }

        setSocialAppearances(
          (data.items ?? []).map((item) => ({
            id: item.id,
            impressions: Number(item.impressions ?? 0),
            imageUrl: item.imageUrl,
            url: item.url,
          })),
        )
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return
        console.error(err)
        setSocialAppearances([])
      }
    }

    void run()
    return () => controller.abort()
  }, [selectedPlayerId, start, end])

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
        
      const basicInfo = allPlayers.find(p => p.fotmobId === selectedPlayer.fotmobId)
      const flag = getFlagEmoji(basicInfo?.countryCode || null)

      return {
        firstName,
        lastName,
        flag, 
        position: selectedPlayer.position || "—",
        age: selectedPlayer.age ? `${selectedPlayer.age}y` : "—",
        imageSrc: selectedPlayer.shirtNumber 
             ? `/player_images/${selectedPlayer.shirtNumber}.png` 
             : "/player_images/no_image.png",
        marketValue: mv,
      }
    },
    [selectedPlayer, allPlayers]
  )

  const heroStats = useMemo(
    () => {
        const overall = selectedPlayerId
          ? allPlayers.find((p) => p.fotmobId === selectedPlayerId) ?? null
          : null

        const iconByLabel: Record<string, LucideIcon> = {
          "MATCHES PLAYED": CalendarDays,
          "AVG PERFORMANCE": Gauge,
          GOALS: Target,
          ASSISTS: Footprints,
          MOTM: Award,
        }

        if (!overall) {
          return [
            { label: "MATCHES PLAYED", value: "—", icon: iconByLabel["MATCHES PLAYED"] },
            { label: "AVG PERFORMANCE", value: "—", icon: iconByLabel["AVG PERFORMANCE"] },
            { label: "GOALS", value: "—", icon: iconByLabel.GOALS },
            { label: "ASSISTS", value: "—", icon: iconByLabel.ASSISTS },
            { label: "MOTM", value: "—", icon: iconByLabel.MOTM },
          ]
        }

      return [
        { label: "MATCHES PLAYED", value: overall.matchesPlayed.toLocaleString(), icon: iconByLabel["MATCHES PLAYED"] },
        { label: "AVG PERFORMANCE", value: overall.rating !== null ? overall.rating.toFixed(1) : "-", icon: iconByLabel["AVG PERFORMANCE"] },
        { label: "GOALS", value: overall.goals.toString(), icon: iconByLabel.GOALS },
        { label: "ASSISTS", value: overall.assists.toString(), icon: iconByLabel.ASSISTS },
        { label: "MOTM", value: overall.motm.toLocaleString(), icon: iconByLabel.MOTM },
      ] as const
    },
    [allPlayers, selectedPlayerId]
  )

  const sentimentJourney = useMemo(() => {
    // Prefer player-specific data if available, else standard overview
    const source = playerOverview || overview
    if (source?.sentimentJourney) {
      return source.sentimentJourney
    }
    
    // Return empty state if data not loaded
    return { 
        points: [], 
        summary: { positiveCount: 0, negativeCount: 0, positiveChangePct: 0, negativeChangePct: 0 },
        events: [],
    }
  }, [overview, playerOverview])

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
    if (playerOverview?.mentionsJourney) return playerOverview.mentionsJourney
    return overview?.mentionsJourney || []
  }, [overview, playerOverview])

  const eventMentions = useMemo(
    () => {
      const sourceTopics = playerOverview?.hotTopics || overview?.hotTopics
      if (sourceTopics) {
        return sourceTopics.slice(0, 10).map((t, i) => ({
          rank: i + 1,
          matchId: t.matchId,
          event: t.topic,
          mentions: t.mentions,
        }))
      }

      return []
    },
    [overview, playerOverview]
  )
  return (
    <main ref={mainRef} className="max-w-screen-xl mx-auto px-6 py-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="max-w-[300px] flex-1">
          <GlobalSearch value={search} onValueChange={setSearch} />
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
              <span>Player</span>
            </button>

            {isFilterOpen ? (
              <div
                role="menu"
                className="bg-popover text-popover-foreground absolute right-0 top-full z-50 mt-2 w-64 rounded-md border p-2 text-sm shadow-md"
              >
                <div className="max-h-60 overflow-y-auto space-y-3">
                  {groupedPlayers.length === 0 ? (
                    <div className="px-2 py-1 text-xs text-muted-foreground">No players found</div>
                  ) : (
                    groupedPlayers.map((group) => (
                      <div key={group.key}>
                        <div className="px-2 pb-1 text-[11px] font-semibold text-muted-foreground">{group.label}</div>
                        <div className="space-y-1">
                          {group.players.map((p) => (
                            <button
                              key={p.fotmobId}
                              onClick={() => {
                                const params = new URLSearchParams(searchParams.toString())
                                params.set("player_id", String(p.fotmobId))
                                const qs = params.toString()
                                router.replace(qs ? `/players?${qs}` : "/players")
                                setIsFilterOpen(false)
                              }}
                              className={cn(
                                "w-full text-left px-2 py-1.5 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground flex items-center justify-between",
                                selectedPlayerId === p.fotmobId && "bg-accent text-accent-foreground",
                              )}
                            >
                              <span className="truncate">{p.name}</span>
                              <span className="text-xs text-muted-foreground">{getFlagEmoji(p.countryCode)}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={async () => {
              if (!mainRef.current) return
              await exportNodeToPdf(mainRef.current, "players.pdf")
            }}
            className="inline-flex h-9 items-center gap-2 rounded-md border bg-background px-3 text-sm text-foreground hover:bg-accent"
          >
            <Download className="h-4 w-4" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {!selectedPlayer ? (
         <div className="flex h-[400px] w-full items-center justify-center rounded-xl border border-dashed border-border bg-background/50">
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
               <Filter className="h-8 w-8 opacity-50" />
               <p className="font-medium">Please select a player to view detailed statistics</p>
            </div>
         </div>
      ) : (
      <>
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
            <div className="flex items-center gap-2 text-base font-semibold font-psv-branding">
              <stat.icon className="h-4 w-4 text-primary" />
              <span>{stat.label}</span>
            </div>
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

            <div className="ml-1 inline-flex items-center gap-2 text-xs text-muted-foreground">
              <span className="h-3 w-1.5 rounded-[2px] bg-primary/30" aria-hidden="true" />
              <span>Posts</span>
            </div>
          </div>
        </div>

        <div className="flex w-full items-stretch">
          <div className="w-3/4 py-6">
            <ChartContainer
              config={sentimentJourneyChartConfig}
              className="h-[260px] w-full"
              overlay={
                <>
                  <SentimentJourneyPostsOverlay points={sentimentJourneyData} plotLeftPx={40} plotRightPx={18} />
                  <SentimentJourneyEventOverlay
                    points={sentimentJourneyData}
                    events={sentimentJourneyEvents}
                    plotLeftPx={40}
                    plotRightPx={18}
                    onMatchClick={(matchId) => router.push(`/events?match_id=${matchId}`)}
                  />
                </>
              }
            >
              <BarChart
                data={sentimentJourneyData}
                margin={{ top: 12, right: 18, left: 0, bottom: 18 }}
                stackOffset="sign"
                onClick={(state) => {
                  const s = state as any
                  const label = (s?.activeLabel as string | undefined) ?? (s?.activePayload?.[0]?.payload?.label as string | undefined)
                  if (!label) return
                  const event = sentimentJourneyEvents.find((e: any) => e.xLabel === label)
                  const matchId = Number(event?.id)
                  if (!Number.isFinite(matchId) || matchId <= 0) return
                  router.push(`/events?match_id=${matchId}`)
                }}
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

                    const posts = Number(point.postsCount ?? 0)

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
                          <div className="flex items-center justify-between gap-2 pt-1 text-xs text-white/60">
                            <span>Posts</span>
                            <span className="tabular-nums">{posts.toLocaleString()}</span>
                          </div>
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
                      sentimentJourney.summary.negativeChangePct >= 0 ? "text-red-500" : "text-green-500"
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
          <div className="px-6 py-4">
            <div className="flex items-baseline justify-between gap-3">
              <div className="flex items-center gap-2 text-base font-semibold font-psv-branding">
                <Flag className="h-4 w-4 text-primary" />
                <span>EVENT MENTIONS</span>
              </div>
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
                      <Link href={`/events?match_id=${row.matchId}`} className="block truncate hover:underline">
                        {row.event}
                      </Link>
                    </td>
                    <td className="w-24 px-3 py-2 text-right font-medium tabular-nums">{row.mentions.toLocaleString()}</td>
                  </tr>
                ))}
                {eventMentions.length === 0 && (
                   <tr>
                     <td colSpan={3} className="px-3 py-8 text-center text-muted-foreground">
                        No significant events found
                     </td>
                   </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="mt-0 grid w-full grid-cols-1 gap-6 md:flex md:h-[320px]">
        <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-background md:flex-1 md:min-w-0">
          <div className="flex items-center justify-between gap-3 px-6 py-4">
            <div className="flex items-center gap-2 text-base font-semibold font-psv-branding">
              <MessageSquareText className="h-4 w-4 text-primary" />
              <span>PLAYER MENTIONS</span>
            </div>
            <div className="flex items-center gap-2">
              <Select value={commentsSentiment} onValueChange={(v: any) => setCommentsSentiment(v)}>
                <SelectTrigger className="h-9 min-w-[100px]">
                   <div className="flex items-center gap-2">
                     <Filter className="h-4 w-4" />
                     <SelectValue placeholder="Sentiment" />
                   </div>
                </SelectTrigger>
                <SelectContent>
                   <SelectItem value="all">All Sentiments</SelectItem>
                   <SelectItem value="positive">Positive</SelectItem>
                   <SelectItem value="neutral">Neutral</SelectItem>
                   <SelectItem value="negative">Negative</SelectItem>
                </SelectContent>
              </Select>

              <Select value={commentsSort} onValueChange={(v: any) => setCommentsSort(v)}>
                <SelectTrigger className="h-9 min-w-[120px]">
                   <div className="flex items-center gap-2">
                     <ArrowUpDown className="h-4 w-4" />
                     <SelectValue placeholder="Sort" />
                   </div>
                </SelectTrigger>
                <SelectContent>
                   <SelectItem value="likes">Most Liked</SelectItem>
                   <SelectItem value="time">Newest</SelectItem>
                </SelectContent>
              </Select>
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
                {commentsData
                  .map((row, index) => (
                    <tr key={row.id} className={index % 2 === 0 ? "bg-background" : "bg-muted"}>
                      <td className="w-12 px-3 py-2 text-muted-foreground tabular-nums">{index + 1}</td>
                      <td className="px-3 py-2">
                         <div className="truncate" title={row.text}>{row.text}</div>
                         <div className="mt-0.5 text-[10px] text-muted-foreground">
                             {[
                             formatSafeDateOnly(row.date),
                                 row.sentiment
                             ].filter(Boolean).join(" • ")}
                         </div>
                      </td>
                      <td className="w-20 px-3 py-2 text-right font-medium tabular-nums">{row.likes.toLocaleString()}</td>
                    </tr>
                  ))}
                  {commentsData.length === 0 && (
                      <tr>
                          <td colSpan={3} className="px-3 py-8 text-center text-muted-foreground">
                             {selectedPlayer ? "No comments found matching filters" : "Select a player to view comments"}
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
              <Camera className="h-4 w-4 text-primary" />
              <span>SOCIAL APPEAREANCES</span>
            </div>
            <div className="text-sm text-muted-foreground">{periodLabel}</div>
          </div>

          <div className="flex-1 min-h-0 px-6 pb-6">
            <div className="grid h-full grid-cols-3 gap-3">
              {socialAppearances.map((item) => (
                <div key={item.id} className="flex h-full flex-col overflow-hidden">
                  <div className="relative flex-1 min-h-0 w-full">
                    <a
                      href={item.url || "#"}
                      target={item.url ? "_blank" : undefined}
                      rel={item.url ? "noopener noreferrer" : undefined}
                      className={item.url ? "block h-full w-full" : "block h-full w-full pointer-events-none"}
                    >
                      <Image
                        src={item.imageUrl || "/posts/post-template.png"}
                        alt="Tagged post"
                        fill
                        sizes="(min-width: 768px) 220px, 33vw"
                        className="object-cover"
                      />
                    </a>
                  </div>
                  <div className="shrink-0 flex items-center justify-center border-t border-border bg-muted px-2 py-2">
                    <div className="text-xs text-muted-foreground tabular-nums text-center">
                      {item.impressions.toLocaleString()} <br /> impressions
                    </div>
                  </div>
                </div>
              ))}
              {socialAppearances.length === 0 && (
                <div className="col-span-3 flex h-full items-center justify-center text-sm text-muted-foreground">
                  No tagged posts found for this period
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
      </>
      )}
    </main>
  )
}
