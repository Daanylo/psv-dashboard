"use client"

import { useMemo, useState } from "react"
import Image from "next/image"
import { CartesianGrid, Cell, Line, LineChart, Pie, PieChart, XAxis, YAxis } from "recharts"
import {
  Activity,
  ArrowUpDown,
  Calendar as CalendarIcon,
  Download,
  Eye,
  EyeOff,
  Filter,
  FileText,
  Heart,
  MessageCircle,
  PieChart as PieChartIcon,
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
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { cn } from "@/lib/utils"

type DateRangeKey = "7" | "30" | "90" | "365"
type ExposureGranularity = "daily" | "weekly"

const sponsorLogos = [
  { src: "/sponsor-logos/puma-white.png", alt: "PUMA" },
  { src: "/sponsor-logos/brainport-white.png", alt: "Brainport" },
  { src: "/sponsor-logos/energiedirect.png", alt: "EnergieDirect" },
  { src: "/sponsor-logos/simac-logo-rgb-transp.gif", alt: "Simac" },
  { src: "/sponsor-logos/goodhabitz-logo-png.png", alt: "GoodHabitz" },
  { src: "/sponsor-logos/joe-logo.svg", alt: "JOE" },
  { src: "/sponsor-logos/50plus-logo.svg", alt: "50+" },
] as const

const sponsorLogosRowB = [...sponsorLogos.slice(2), ...sponsorLogos.slice(0, 2)] as const
const sponsorLogosRowC = [...sponsorLogos.slice(4), ...sponsorLogos.slice(0, 4)] as const

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

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function percentChange(current: number, previous: number) {
  if (!Number.isFinite(previous) || previous === 0) return 0
  return ((current - previous) / previous) * 100
}

function formatDeltaPct(value: number) {
  const rounded = Math.round(value)
  return `${rounded >= 0 ? "+" : ""}${rounded}%`
}

function legendLabel(name: string) {
  const trimmed = name.trim()
  if (!trimmed) return name
  const parts = trimmed.split(/\s+/)
  return parts[parts.length - 1] ?? name
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value)
}

function formatAxisLabel(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function addDaysLocal(date: Date, days: number) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
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

export default function CommercialHubPage() {
  const [search, setSearch] = useState("")
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [dateRangeKey, setDateRangeKey] = useState<DateRangeKey>("30")
  const [exposureGranularity, setExposureGranularity] = useState<ExposureGranularity>("daily")

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
    }
  }, [dateRangeKey])

  const { start, end } = useMemo(() => getDateRange(dateRangeDays, new Date()), [dateRangeDays])
  const dateRangeLabel = useMemo(
    () => `${formatShortDate(start)} - ${formatShortDate(end)}`,
    [start, end]
  )

  const { previousStart, previousPeriodLabel } = useMemo(() => {
    const prevEnd = new Date(start)
    prevEnd.setDate(prevEnd.getDate() - 1)
    const prev = getDateRange(dateRangeDays, prevEnd)
    return {
      previousStart: prev.start,
      previousPeriodLabel: `${formatShortDate(prev.start)} - ${formatShortDate(prev.end)}`,
    }
  }, [dateRangeDays, start])

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
    }
  }, [dateRangeKey])

  const postOverview = useMemo(() => {
    const seedCurrent = Math.floor(start.getTime() / 86400000)
    const seedPrevious = Math.floor(previousStart.getTime() / 86400000)
    const randCurrent = mulberry32(seedCurrent)
    const randPrevious = mulberry32(seedPrevious)

    const postImageCandidates = [
      "/posts/post-template.png",
      "/posts/post-template.png",
      "/posts/post-template.png",
      "/posts/post-template.png",
    ]

    const captions = [
      "Matchday vibes in Eindhoven. Ready for another big night.",
      "New kit details looking sharp. What’s your favorite part?",
      "Training done. Eyes on the weekend. Let’s go.",
      "Highlights are up. Relive the best moments.",
      "Behind the scenes from today’s session.",
    ]

    const dateSpanMs = Math.max(1, end.getTime() - start.getTime())

    const posts = Array.from({ length: 3 }).map((_, i) => {
      const t = (i + 1) / 4
      const jitter = (randCurrent() - 0.5) * 0.18
      const ts = start.getTime() + dateSpanMs * Math.min(1, Math.max(0, t + jitter))
      const date = new Date(ts)
      const likes = Math.round(1200 + randCurrent() * 9800)
      const comments = Math.round(60 + randCurrent() * 740)
      const caption = captions[Math.floor(randCurrent() * captions.length)]
      const imageSrc = postImageCandidates[(seedCurrent + i) % postImageCandidates.length]
      return {
        id: `post-${seedCurrent}-${i}`,
        imageSrc,
        date,
        likes,
        comments,
        caption,
      }
    })

    const currentPosts = Math.max(3, Math.round(dateRangeDays * (0.65 + randCurrent() * 0.55)))
    const previousPosts = Math.max(3, Math.round(dateRangeDays * (0.65 + randPrevious() * 0.55)))

    const currentImpressions = Math.round(
      currentPosts * (6500 + randCurrent() * 15500)
    )
    const previousImpressions = Math.round(
      previousPosts * (6500 + randPrevious() * 15500)
    )

    const visibleEngagement = posts.reduce((sum, p) => sum + p.likes + p.comments, 0)
    const engagementScale = Math.max(1, currentPosts / 3)
    const currentEngagement = Math.round(visibleEngagement * engagementScale)

    let prevVisibleEngagement = 0
    for (let i = 0; i < 3; i++) {
      const likes = Math.round(1100 + randPrevious() * 9200)
      const comments = Math.round(55 + randPrevious() * 700)
      prevVisibleEngagement += likes + comments
    }
    const prevEngagementScale = Math.max(1, previousPosts / 3)
    const previousEngagement = Math.round(prevVisibleEngagement * prevEngagementScale)

    return {
      posts,
      metrics: {
        posts: {
          label: "Posts",
          value: currentPosts,
          previousValue: previousPosts,
        },
        impressions: {
          label: "Impressions",
          value: currentImpressions,
          previousValue: previousImpressions,
        },
        engagement: {
          label: "Engagement",
          value: currentEngagement,
          previousValue: previousEngagement,
        },
      },
    }
  }, [dateRangeDays, end, previousStart, start])

  const brandOverview = useMemo(() => {
    const scale = Math.max(0.25, dateRangeDays / 30)
    const seedCurrent = Math.floor(start.getTime() / 86400000) + 4242
    const seedPrevious = Math.floor(previousStart.getTime() / 86400000) + 4242
    const randCurrent = mulberry32(seedCurrent)
    const randPrevious = mulberry32(seedPrevious)

    const exposures = Math.round((85000 + randCurrent() * 155000) * scale)
    const exposuresPrev = Math.round((85000 + randPrevious() * 155000) * scale)

    const impressions = Math.round(exposures * (1.9 + randCurrent() * 1.2))
    const impressionsPrev = Math.round(exposuresPrev * (1.9 + randPrevious() * 1.2))

    const visibility = 38 + randCurrent() * 34
    const visibilityPrev = 38 + randPrevious() * 34

    return {
      exposures: {
        value: exposures,
        previousValue: exposuresPrev,
      },
      impressions: {
        value: impressions,
        previousValue: impressionsPrev,
      },
      visibility: {
        value: visibility,
        previousValue: visibilityPrev,
      },
    }
  }, [dateRangeDays, previousStart, start])

  const exposureTrends = useMemo(() => {
    const startDay = new Date(start)
    startDay.setHours(0, 0, 0, 0)
    const endDay = new Date(end)
    endDay.setHours(0, 0, 0, 0)

    const scale = Math.max(0.35, dateRangeDays / 30)
    const seedBase = Math.floor(startDay.getTime() / 86400000) + 9001

    const baseRand = mulberry32(seedBase)
    let puma = 3200 * scale + baseRand() * 2200 * scale
    let brainport = 2600 * scale + baseRand() * 2100 * scale
    let energie = 2100 * scale + baseRand() * 1900 * scale

    const data: Array<{ label: string; puma: number; brainport: number; energie: number }> = []

    let cursor = new Date(startDay)
    let index = 0

    while (cursor <= endDay) {
      const rangeStart =
        exposureGranularity === "weekly" ? startOfWeekLocal(cursor) : new Date(cursor)
      const rangeEnd =
        exposureGranularity === "weekly" ? endOfWeekLocal(cursor) : new Date(cursor)

      if (rangeEnd < startDay) {
        cursor = addDaysLocal(cursor, 1)
        continue
      }

      if (rangeStart > endDay) break

      const visibleStart = rangeStart < startDay ? startDay : rangeStart
      const visibleEnd = rangeEnd > endDay ? endDay : rangeEnd

      const isoStart = visibleStart.toISOString().slice(0, 10)
      const localSeed =
        seedBase + isoStart.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
      const rp = mulberry32(localSeed + 1)
      const rb = mulberry32(localSeed + 2)
      const re = mulberry32(localSeed + 3)

      const t = index / (exposureGranularity === "weekly" ? 12 : 45)
      const seasonal = Math.sin(t * Math.PI * 2)

      puma = Math.max(0, puma + (rp() - 0.5) * 900 * scale + seasonal * 250 * scale)
      brainport = Math.max(0, brainport + (rb() - 0.5) * 820 * scale + seasonal * 220 * scale)
      energie = Math.max(0, energie + (re() - 0.5) * 760 * scale + seasonal * 200 * scale)

      data.push({
        label: formatAxisLabel(visibleStart),
        puma: Math.round(puma),
        brainport: Math.round(brainport),
        energie: Math.round(energie),
      })

      index += 1
      cursor = exposureGranularity === "weekly" ? addDaysLocal(visibleEnd, 1) : addDaysLocal(cursor, 1)
    }

    const latest = data[data.length - 1]
    return {
      data,
      latest,
      config: {
        puma: { label: "PUMA", color: "var(--chart-1)" },
        brainport: { label: "Brainport", color: "var(--chart-2)" },
        energie: { label: "EnergieDirect", color: "var(--chart-3)" },
      } satisfies ChartConfig,
    }
  }, [dateRangeDays, end, exposureGranularity, start])

  const visibilityShare = useMemo(() => {
    const seedBase =
      start.getFullYear() * 10000 + (start.getMonth() + 1) * 100 + start.getDate() + 1717
    const r = mulberry32(seedBase)

    const rawA = 0.25 + r() * 0.45
    const rawB = 0.15 + r() * 0.35
    const rawC = 0.1 + r() * 0.25
    const sum = rawA + rawB + rawC
    const a = (rawA / sum) * 100
    const b = (rawB / sum) * 100
    const c = (rawC / sum) * 100

    const data = [
      { key: "puma", name: "PUMA", value: a, color: "var(--chart-1)" },
      { key: "brainport", name: "Brainport", value: b, color: "var(--chart-2)" },
      { key: "energie", name: "EnergieDirect", value: c, color: "var(--chart-3)" },
    ] as const

    const config = {
      puma: { label: "PUMA", color: "var(--chart-1)" },
      brainport: { label: "Brainport", color: "var(--chart-2)" },
      energie: { label: "EnergieDirect", color: "var(--chart-3)" },
    } satisfies ChartConfig

    return { data, config }
  }, [start])

  const missedOpportunities = useMemo(() => {
    const seedBase =
      start.getFullYear() * 10000 + (start.getMonth() + 1) * 100 + start.getDate() + 2323
    const r = mulberry32(seedBase)

    return Array.from({ length: 3 }).map((_, i) => {
      const impressions = Math.round(140000 + r() * 860000)
      const visibilityPct = 8 + r() * 24
      return {
        id: `missed-${seedBase}-${i}`,
        impressions,
        visibilityPct,
      }
    })
  }, [start])

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
              <div className="border-input gap-2 bg-background text-foreground inline-flex h-9 items-center rounded-l-md border px-3 text-sm">
                <CalendarIcon className="h-4 w-4" />
                {dateRangeLabel}
              </div>
              <Select value={dateRangeKey} onValueChange={(v) => setDateRangeKey(v as DateRangeKey)}>
                <SelectTrigger className="h-9 rounded-l-none border-l-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                  <SelectItem value="365">Last 365 days</SelectItem>
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
          " before:absolute before:inset-0 before:z-0 before:bg-black" +
          ""
        }
      >

        <div className="relative z-10 flex h-full flex-wrap items-stretch justify-between gap-6 px-6 text-white md:flex-nowrap">
          <div className="flex flex-1 flex-col justify-center">
            <div className="text-3xl font-bold font-psv-branding italic leading-none md:text-3xl">
              COMMERCIAL HUB
            </div>
            <div className="mt-2 max-w-[520px] text-sm text-white/80">
              Sponsorship performance, exposure, and partner insights in one place.
            </div>
          </div>

          <div className="relative flex w-full flex-none items-center overflow-hidden md:w-[400px] md:-mr-6">
            <div className="relative z-0 flex w-full flex-col gap-3 py-4">
              <div className="w-full overflow-hidden">
                <div className="psv-logo-marquee psv-logo-marquee--a flex w-max items-center gap-10 will-change-transform">
                  {[...sponsorLogos, ...sponsorLogos].map((logo, index) => (
                    <Image
                      key={`row-a-${logo.src}-${index}`}
                      src={logo.src}
                      alt={logo.alt}
                      width={140}
                      height={40}
                      className="h-8 w-auto opacity-80 grayscale brightness-200"
                    />
                  ))}
                </div>
              </div>

              <div className="w-full overflow-hidden">
                <div className="psv-logo-marquee psv-logo-marquee--b flex w-max items-center gap-10 will-change-transform">
                  {[...sponsorLogosRowB, ...sponsorLogosRowB].map((logo, index) => (
                    <Image
                      key={`row-b-${logo.src}-${index}`}
                      src={logo.src}
                      alt={logo.alt}
                      width={140}
                      height={40}
                      className="h-8 w-auto opacity-70 grayscale brightness-200"
                    />
                  ))}
                </div>
              </div>

              <div className="hidden w-full overflow-hidden md:block">
                <div className="psv-logo-marquee psv-logo-marquee--c flex w-max items-center gap-10 will-change-transform">
                  {[...sponsorLogosRowC, ...sponsorLogosRowC].map((logo, index) => (
                    <Image
                      key={`row-c-${logo.src}-${index}`}
                      src={logo.src}
                      alt={logo.alt}
                      width={140}
                      height={40}
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

      <section className="w-full max-h-[500px] rounded-xl border border-border bg-background overflow-hidden flex flex-col">
        <div className="flex items-center justify-between gap-3 px-6 py-4">
          <div className="flex items-center gap-2 text-base font-semibold font-psv-branding">
            <FileText className="h-4 w-4" />
            <span>POST OVERVIEW</span>
          </div>
          <div className="flex items-center gap-3">
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

        <div className="px-6 pb-6 flex-1 min-h-0">
          <div className="grid h-full min-h-0 grid-cols-1 gap-6 md:grid-cols-[2fr_1px_1fr]">

              <div className="grid h-full min-h-0 auto-rows-fr grid-cols-1 gap-3 sm:grid-cols-3">
                {postOverview.posts.map((post) => (
                  <div
                    key={post.id}
                    className="flex h-full min-h-0 flex-col overflow-hidden bg-background"
                  >
                    <div className="relative w-full flex-1 min-h-0">
                      <Image
                        src={post.imageSrc}
                        alt="Post"
                        fill
                        sizes="(min-width: 1024px) 260px, (min-width: 640px) 33vw, 100vw"
                        className="object-cover"
                      />
                    </div>

                    <div className="shrink-0 h-20 border-t border-border bg-muted px-3 py-3 flex flex-col">
                      <div className="flex justify-between w-full items-start">
                        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                          <div className="truncate">{formatShortDate(post.date)}</div>
                        </div>

                        <div className="flex items-center gap-2 text-xs">
                          <div className="inline-flex items-center gap-1">
                            <Heart className="h-4 w-4" />
                            <span className="tabular-nums">{post.likes.toLocaleString()}</span>
                          </div>
                          <div className="inline-flex items-center gap-1">
                            <MessageCircle className="h-4 w-4" />
                            <span className="tabular-nums">{post.comments.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>

                      <div
                        className="mt-2 text-xs leading-relaxed text-foreground/90 overflow-hidden flex-1"
                        style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}
                      >
                        <span className="break-words">{post.caption}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>


            <div className="hidden md:block w-px bg-border" />

            <div>
              <div className="flex flex-col h-full overflow-hidden bg-background divide-y divide-border justify-evenly">
                {([
                  postOverview.metrics.posts,
                  postOverview.metrics.impressions,
                  postOverview.metrics.engagement,
                ] as const).map((metric) => {
                  const deltaPct = percentChange(metric.value, metric.previousValue)
                  const isUp = deltaPct >= 0
                  const valueDisplay =
                    metric.label === "Impressions"
                      ? formatCompactNumber(metric.value)
                      : metric.value.toLocaleString()
                  const previousValueDisplay =
                    metric.label === "Impressions"
                      ? formatCompactNumber(metric.previousValue)
                      : metric.previousValue.toLocaleString()
                  const MetricIcon =
                    metric.label === "Posts"
                      ? FileText
                      : metric.label === "Impressions"
                        ? Eye
                        : Activity
                  return (
                    <div key={metric.label} className="px-5 py-5">
                      <div className="text-sm text-primary">{metric.label}</div>
                      <div className="mt-1 flex items-baseline gap-2">
                        <MetricIcon className="h-6 w-6 shrink-0 text-primary" />
                        <div className="font-psv-branding italic text-3xl leading-none tabular-nums">
                          {valueDisplay}
                        </div>
                        <div
                          className={cn(
                            "inline-flex items-center gap-1 text-sm font-semibold",
                            isUp ? "text-green-500" : "text-red-500"
                          )}
                        >
                          <span>{formatDeltaPct(deltaPct)}</span>
                          {isUp ? (
                            <TrendingUp className="h-4 w-4" />
                          ) : (
                            <TrendingDown className="h-4 w-4" />
                          )}
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        vs. {previousValueDisplay} last period
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid w-full grid-cols-1 gap-6 md:grid-cols-3">
        {([
          {
            title: "BRAND EXPOSURES",
            value: brandOverview.exposures.value,
            previousValue: brandOverview.exposures.previousValue,
            valueDisplay: brandOverview.exposures.value.toLocaleString(),
            previousValueDisplay: brandOverview.exposures.previousValue.toLocaleString(),
          },
          {
            title: "BRAND IMPRESSIONS",
            value: brandOverview.impressions.value,
            previousValue: brandOverview.impressions.previousValue,
            valueDisplay: formatCompactNumber(brandOverview.impressions.value),
            previousValueDisplay: formatCompactNumber(brandOverview.impressions.previousValue),
          },
          {
            title: "AVERAGE VISIBILITY",
            value: brandOverview.visibility.value,
            previousValue: brandOverview.visibility.previousValue,
            valueDisplay: `${brandOverview.visibility.value.toFixed(1)}%`,
            previousValueDisplay: `${brandOverview.visibility.previousValue.toFixed(1)}%`,
          },
        ] as const).map((card) => {
          const deltaPct = percentChange(card.value, card.previousValue)
          const isUp = deltaPct >= 0
          const HeaderIcon =
            card.title === "BRAND EXPOSURES" ? Eye : card.title === "BRAND IMPRESSIONS" ? TrendingUp : Activity
          return (
            <div
              key={card.title}
              className="w-full rounded-xl border border-border bg-background overflow-hidden"
            >
              <div className="flex items-baseline justify-between gap-3 px-6 py-4">
                <div className="flex items-center gap-2 text-base font-semibold font-psv-branding">
                  <HeaderIcon className="h-4 w-4" />
                  <span>{card.title}</span>
                </div>
                <div className="text-sm text-muted-foreground">{periodLabel}</div>
              </div>

              <div className="px-6 pb-6">
                <div className="mt-1 flex items-baseline gap-2">
                  <div className="font-psv-branding italic text-3xl leading-none tabular-nums">
                    {card.valueDisplay}
                  </div>
                  <div
                    className={cn(
                      "inline-flex items-center gap-1 text-sm font-semibold",
                      isUp ? "text-green-500" : "text-red-500"
                    )}
                  >
                    <span>{formatDeltaPct(deltaPct)}</span>
                    {isUp ? (
                      <TrendingUp className="h-4 w-4" />
                    ) : (
                      <TrendingDown className="h-4 w-4" />
                    )}
                  </div>
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  vs. {card.previousValueDisplay} last period
                </div>
              </div>
            </div>
          )
        })}
      </section>

      <section className="w-full rounded-xl border border-border bg-background overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-6 py-4">
          <div className="flex items-center gap-2 text-base font-semibold font-psv-branding">
            <TrendingUp className="h-4 w-4" />
            <span>EXPOSURE TRENDS</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center rounded-md border border-border bg-background p-1 text-sm">
              <button
                type="button"
                onClick={() => setExposureGranularity("daily")}
                className={cn(
                  "inline-flex h-7 items-center rounded-sm px-3",
                  exposureGranularity === "daily"
                    ? "bg-black text-white"
                    : "text-muted-foreground hover:bg-accent"
                )}
              >
                Daily
              </button>
              <button
                type="button"
                onClick={() => setExposureGranularity("weekly")}
                className={cn(
                  "inline-flex h-7 items-center rounded-sm px-3",
                  exposureGranularity === "weekly"
                    ? "bg-black text-white"
                    : "text-muted-foreground hover:bg-accent"
                )}
              >
                Weekly
              </button>
            </div>

            <div className="text-sm text-muted-foreground">{periodLabel}</div>
          </div>
        </div>

        <div className="px-6 pb-6">
          <div className="min-w-0">
              <ChartContainer
                config={exposureTrends.config}
                className="h-72 w-full"
              >
                <LineChart data={exposureTrends.data} margin={{ top: 14, right: 18, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <ChartTooltip
                    cursor={{ stroke: "#c7c7c7", strokeDasharray: "4 4" }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload || payload.length === 0) return null

                      const visible = payload.filter((p) => p.type !== "none")
                      if (visible.length === 0) return null

                      return (
                        <div className="rounded-lg border border-black bg-black px-3 py-2 shadow-md space-y-2 text-white">
                          <div className="font-semibold text-sm text-white">{String(label ?? "")}</div>
                          <div className="space-y-1 text-xs text-zinc-100">
                            {visible.map((item) => {
                              const stroke =
                                (typeof item.stroke === "string" && item.stroke) ||
                                (typeof item.color === "string" && item.color) ||
                                "#ffffff"
                              const name = String(item.name ?? item.dataKey ?? "")
                              const value =
                                typeof item.value === "number" ? item.value : Number(item.value)

                              return (
                                <div
                                  key={String(item.dataKey ?? name)}
                                  className="flex items-center justify-between gap-4"
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span
                                      className="h-[10px] w-[10px] rounded-[2px] shrink-0"
                                      style={{ backgroundColor: stroke }}
                                      aria-hidden="true"
                                    />
                                    <span className="truncate text-zinc-200">{name}</span>
                                  </div>
                                  <span className="text-white font-mono font-medium tabular-nums">
                                    {Number.isFinite(value) ? value.toLocaleString() : "-"}
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    }}
                  />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={18} />
                  <YAxis
                    width={44}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => formatCompactNumber(Number(v))}
                  />
                  <Line
                    type="monotone"
                    dataKey="puma"
                    stroke="var(--color-puma)"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="brainport"
                    stroke="var(--color-brainport)"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="energie"
                    stroke="var(--color-energie)"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ChartContainer>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-5 text-xs text-muted-foreground">
            {([
              { key: "puma", label: "PUMA", color: "var(--chart-1)" },
              { key: "brainport", label: "Brainport", color: "var(--chart-2)" },
              { key: "energie", label: "EnergieDirect", color: "var(--chart-3)" },
            ] as const).map((item) => (
              <div key={item.key} className="flex items-center gap-2">
                <span
                  className="h-[10px] w-[10px] rounded-[2px]"
                  style={{ backgroundColor: item.color }}
                  aria-hidden="true"
                />
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid w-full grid-cols-1 gap-6 md:grid-cols-3">
        <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-background md:col-span-1">
          <div className="flex items-baseline justify-between gap-3 px-6 py-4">
            <div className="flex items-center gap-2 text-base font-semibold font-psv-branding">
              <PieChartIcon className="h-4 w-4" />
              <span>VISIBILITY SHARE</span>
            </div>
            <div className="text-sm text-muted-foreground">{periodLabel}</div>
          </div>

          <div className="px-6 pb-6">
            <ChartContainer config={visibilityShare.config} className="h-[260px] w-full aspect-auto">
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
                  data={visibilityShare.data as unknown as Array<{ name: string; value: number }>}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={92}
                  paddingAngle={0}
                  stroke="transparent"
                  strokeWidth={0}
                >
                  {visibilityShare.data.map((item) => (
                    <Cell key={item.key} fill={`var(--color-${item.key})`} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-5 text-xs text-muted-foreground">
              {visibilityShare.data.map((item) => (
                <div key={item.key} className="flex items-center gap-2">
                  <span
                    className="h-[10px] w-[10px] rounded-[2px]"
                    style={{ backgroundColor: item.color }}
                    aria-hidden="true"
                  />
                  <span>{legendLabel(item.name)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-background md:col-span-2">
          <div className="flex items-center justify-between gap-3 px-6 py-4">
            <div className="flex items-center gap-2 text-base font-semibold font-psv-branding">
              <EyeOff className="h-4 w-4" />
              <span>MISSED OPPORTUNITIES</span>
            </div>
            <div className="text-sm text-muted-foreground">{periodLabel}</div>
          </div>

          <div className="flex-1 min-h-0 px-6 pb-6">
            <div className="grid h-full grid-cols-3 gap-3">
              {missedOpportunities.map((item) => (
                <div key={item.id} className="flex h-full flex-col overflow-hidden">
                  <div className="relative flex-1 min-h-0 w-full">
                    <Image
                      src="/posts/post-template.png"
                      alt="Missed opportunity post"
                      fill
                      sizes="(min-width: 768px) 220px, 33vw"
                      className="object-cover"
                    />
                  </div>
                  <div className="shrink-0 flex flex-col items-center justify-center gap-1 border-t border-border bg-muted px-2 py-2">
                    <div className="text-xs text-muted-foreground tabular-nums text-center">
                      {item.impressions.toLocaleString()} impressions
                    </div>
                    <div className="text-xs font-semibold tabular-nums text-foreground text-center">
                      {item.visibilityPct.toFixed(1)}% visibility
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
