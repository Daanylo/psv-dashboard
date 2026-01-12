"use client"

import { useMemo, useState } from "react"
import Image from "next/image"
import {
  Activity,
  Calendar as CalendarIcon,
  Download,
  Eye,
  Filter,
  HeartHandshake,
  LineChart as LineChartIcon,
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
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart"
import { cn } from "@/lib/utils"
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts"

type DateRangeKey = "7" | "30" | "90" | "365"

type BrandKey = "puma" | "brainport" | "energiedirect" | "simac" | "goodhabitz" | "joe" | "fiftyplus"

const brands: Array<{ key: BrandKey; name: string; logoSrcOnDark: string; logoSrcOnLight: string; logoAlt: string }> = [
  {
    key: "puma",
    name: "PUMA",
    logoSrcOnDark: "/sponsor-logos/puma-white.png",
    logoSrcOnLight: "/sponsor-logos/puma-logo.svg",
    logoAlt: "PUMA",
  },
  {
    key: "brainport",
    name: "Brainport",
    logoSrcOnDark: "/sponsor-logos/brainport-white.png",
    logoSrcOnLight: "/sponsor-logos/brainport.png",
    logoAlt: "Brainport",
  },
  {
    key: "energiedirect",
    name: "EnergieDirect",
    logoSrcOnDark: "/sponsor-logos/energiedirect.png",
    logoSrcOnLight: "/sponsor-logos/energiedirect.png",
    logoAlt: "EnergieDirect",
  },
  {
    key: "simac",
    name: "Simac",
    logoSrcOnDark: "/sponsor-logos/simac-logo-rgb-transp.gif",
    logoSrcOnLight: "/sponsor-logos/simac-logo-rgb-transp.gif",
    logoAlt: "Simac",
  },
  {
    key: "goodhabitz",
    name: "GoodHabitz",
    logoSrcOnDark: "/sponsor-logos/goodhabitz-logo-png.png",
    logoSrcOnLight: "/sponsor-logos/goodhabitz-logo-png.png",
    logoAlt: "GoodHabitz",
  },
  {
    key: "joe",
    name: "JOE",
    logoSrcOnDark: "/sponsor-logos/joe-logo.svg",
    logoSrcOnLight: "/sponsor-logos/joe-logo.svg",
    logoAlt: "JOE",
  },
  {
    key: "fiftyplus",
    name: "50+",
    logoSrcOnDark: "/sponsor-logos/50plus-logo.svg",
    logoSrcOnLight: "/sponsor-logos/50plus-logo.svg",
    logoAlt: "50+",
  },
]

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

function formatCurrencyEUR(value: number) {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
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

export default function SponsorsReportPage() {
  const [search, setSearch] = useState("")
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [dateRangeKey, setDateRangeKey] = useState<DateRangeKey>("30")
  const [brandKey, setBrandKey] = useState<BrandKey>("puma")

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

  const { previousStart } = useMemo(() => {
    const prevEnd = new Date(start)
    prevEnd.setDate(prevEnd.getDate() - 1)
    const prev = getDateRange(dateRangeDays, prevEnd)
    return {
      previousStart: prev.start,
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

  const selectedBrand = useMemo(() => brands.find((b) => b.key === brandKey) ?? brands[0], [brandKey])

  const topExposures = useMemo(() => {
    const seedCurrent = Math.floor(start.getTime() / 86400000) + brandKey.length * 97
    const seedPrevious = Math.floor(previousStart.getTime() / 86400000) + brandKey.length * 97
    const r = mulberry32(seedCurrent)
    const rp = mulberry32(seedPrevious)

    const exposures = Math.round(65000 + r() * 215000)
    const exposuresPrev = Math.round(65000 + rp() * 215000)

    const impressions = Math.round(exposures * (1.8 + r() * 1.0))
    const impressionsPrev = Math.round(exposuresPrev * (1.8 + rp() * 1.0))

    const visibility = 22 + r() * 52
    const visibilityPrev = 22 + rp() * 52

    const items = Array.from({ length: 3 }).map((_, i) => {
      const local = mulberry32(seedCurrent + i * 19)
      const itemExposures = Math.round(exposures * (0.09 + local() * 0.07))
      const itemImpressions = Math.round(itemExposures * (1.6 + local() * 1.4))
      const itemVisibilityPct = 18 + local() * 62
      return {
        id: `${brandKey}-top-${seedCurrent}-${i}`,
        imageSrc: "/posts/post-template.png",
        impressions: itemImpressions,
        visibilityPct: itemVisibilityPct,
      }
    })

    return {
      items,
      metrics: {
        exposures: {
          label: "Exposures",
          value: exposures,
          previousValue: exposuresPrev,
          icon: Eye,
        },
        impressions: {
          label: "Impressions",
          value: impressions,
          previousValue: impressionsPrev,
          icon: TrendingUp,
        },
        visibility: {
          label: "Avg. visibility",
          value: visibility,
          previousValue: visibilityPrev,
          icon: Activity,
        },
      },
    }
  }, [brandKey, previousStart, start])

  const exposureTrends = useMemo(() => {
    const startDay = new Date(start)
    startDay.setHours(0, 0, 0, 0)
    const endDay = new Date(end)
    endDay.setHours(0, 0, 0, 0)

    const seedBase = Math.floor(startDay.getTime() / 86400000) + brandKey.length * 1337
    const r = mulberry32(seedBase)

    const scale = Math.max(0.45, dateRangeDays / 30)
    let brand = 2600 * scale + r() * 1600 * scale
    let avg = 2400 * scale + r() * 1400 * scale

    const data: Array<{ label: string; brand: number; avg: number }> = []
    let cursor = new Date(startDay)
    let index = 0

    while (cursor <= endDay) {
      const localSeed = seedBase + index * 17
      const rb = mulberry32(localSeed + 1)
      const ra = mulberry32(localSeed + 2)

      const t = index / Math.max(10, Math.min(60, dateRangeDays))
      const seasonal = Math.sin(t * Math.PI * 2)

      brand = Math.max(0, brand + (rb() - 0.5) * 900 * scale + seasonal * 240 * scale)
      avg = Math.max(0, avg + (ra() - 0.5) * 760 * scale + seasonal * 210 * scale)

      data.push({
        label: formatAxisLabel(cursor),
        brand: Math.round(brand),
        avg: Math.round(avg),
      })

      index += 1
      cursor = addDaysLocal(cursor, dateRangeDays > 90 ? 7 : 1)
    }

    const config: ChartConfig = {
      brand: { label: selectedBrand.name, color: "var(--chart-1)" },
      avg: { label: "Average", color: "var(--muted-foreground)" },
    }

    return { data, config }
  }, [brandKey, dateRangeDays, end, selectedBrand.name, start])

  const sentimentMetric = useMemo(() => {
    const seedCurrent = Math.floor(start.getTime() / 86400000) + brandKey.length * 404
    const seedPrevious = Math.floor(previousStart.getTime() / 86400000) + brandKey.length * 404
    const r = mulberry32(seedCurrent)
    const rp = mulberry32(seedPrevious)

    const current = 52 + r() * 36
    const prev = 52 + rp() * 36

    return {
      label: "FAN SENTIMENT",
      value: current,
      previousValue: prev,
      valueDisplay: `${current.toFixed(1)}%`,
      previousValueDisplay: `${prev.toFixed(1)}%`,
    }
  }, [brandKey, previousStart, start])

  const estimatedValueMetric = useMemo(() => {
    const seedCurrent = Math.floor(start.getTime() / 86400000) + brandKey.length * 707
    const seedPrevious = Math.floor(previousStart.getTime() / 86400000) + brandKey.length * 707
    const r = mulberry32(seedCurrent)
    const rp = mulberry32(seedPrevious)

    const current = Math.round(180000 + r() * 1320000)
    const prev = Math.round(180000 + rp() * 1320000)

    return {
      label: "ESTIMATED VALUE",
      value: current,
      previousValue: prev,
      valueDisplay: formatCurrencyEUR(current),
      previousValueDisplay: formatCurrencyEUR(prev),
    }
  }, [brandKey, previousStart, start])

  const visibilityShare = useMemo(() => {
    const seed = Math.floor(start.getTime() / 86400000) + brandKey.length * 919
    const r = mulberry32(seed)

    const brandShare = 18 + r() * 42
    const otherShare = Math.max(0, 100 - brandShare)

    const data = [
      { key: "brand", name: selectedBrand.name, value: brandShare, color: "var(--chart-1)" },
      { key: "others", name: "Other brands", value: otherShare, color: "var(--muted)" },
    ] as const

    const config: ChartConfig = {
      brand: { label: selectedBrand.name, color: "var(--chart-1)" },
      others: { label: "Other brands", color: "var(--muted)" },
    }

    return { data, config }
  }, [brandKey, selectedBrand.name, start])

  const cumulativeImpact = useMemo(() => {
    const startDay = new Date(start)
    startDay.setHours(0, 0, 0, 0)
    const endDay = new Date(end)
    endDay.setHours(0, 0, 0, 0)

    const seedBase = Math.floor(startDay.getTime() / 86400000) + brandKey.length * 5151
    const r = mulberry32(seedBase)

    const scale = Math.max(0.45, dateRangeDays / 30)
    let daily = 4200 * scale + r() * 3100 * scale
    let avgDaily = 3900 * scale + r() * 2700 * scale
    let cum = 0
    let avgCum = 0

    const data: Array<{ label: string; impressions: number; avg: number }> = []
    let cursor = new Date(startDay)
    let index = 0

    while (cursor <= endDay) {
      const localSeed = seedBase + index * 29
      const ri = mulberry32(localSeed + 1)
      const ra = mulberry32(localSeed + 2)
      const t = index / Math.max(10, Math.min(60, dateRangeDays))
      const seasonal = Math.cos(t * Math.PI * 2)

      daily = Math.max(0, daily + (ri() - 0.5) * 1300 * scale + seasonal * 320 * scale)
      avgDaily = Math.max(0, avgDaily + (ra() - 0.5) * 1100 * scale + seasonal * 280 * scale)

      cum += daily
      avgCum += avgDaily

      data.push({
        label: formatAxisLabel(cursor),
        impressions: Math.round(cum),
        avg: Math.round(avgCum),
      })

      index += 1
      cursor = addDaysLocal(cursor, dateRangeDays > 90 ? 7 : 1)
    }

    const config: ChartConfig = {
      impressions: { label: selectedBrand.name, color: "var(--chart-1)" },
      avg: { label: "Average", color: "var(--muted-foreground)" },
    }

    return { data, config }
  }, [brandKey, dateRangeDays, end, selectedBrand.name, start])

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
                className="bg-popover text-popover-foreground absolute right-0 top-full z-50 mt-2 w-[320px] max-w-[calc(100vw-3rem)] overflow-x-hidden rounded-md border p-3 text-sm shadow-md"
              >
                <div className="px-1 pb-2 text-xs font-semibold text-muted-foreground">Brand</div>
                <div role="radiogroup" className="space-y-2">
                  {brands.map((brand) => {
                    const selected = brand.key === brandKey
                    return (
                      <label
                        key={brand.key}
                        className={cn(
                          "flex cursor-pointer items-center gap-3 rounded-md border border-border px-3 py-2",
                          selected ? "bg-muted" : "bg-background hover:bg-accent"
                        )}
                      >
                        <input
                          type="radio"
                          name="brand"
                          value={brand.key}
                          checked={selected}
                          onChange={() => setBrandKey(brand.key)}
                          className="sr-only"
                        />
                        <div
                          className={cn(
                            "relative h-5 w-5 shrink-0 rounded-full border after:absolute after:inset-[3px] after:rounded-full after:bg-foreground after:transition-opacity",
                            selected ? "border-foreground after:opacity-100" : "border-muted-foreground after:opacity-0"
                          )}
                          aria-hidden="true"
                        />
                        <Image
                          src={brand.logoSrcOnLight}
                          alt={brand.logoAlt}
                          width={140}
                          height={42}
                          className={cn("h-6 w-auto object-contain", selected ? "opacity-100" : "opacity-75 grayscale")}
                        />
                        <span className="sr-only">{brand.name}</span>
                      </label>
                    )
                  })}
                </div>
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
            <div className="text-3xl font-bold font-psv-branding italic leading-none md:text-3xl">SPONSORS REPORT</div>
            <div className="mt-2 max-w-[520px] text-sm text-white/80">
              Brand exposure, visibility and impact metrics for your partners.
            </div>
          </div>

          <div className="relative flex w-full flex-none items-center overflow-hidden md:w-[400px] md:-mr-6">
            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-black to-transparent" />
            <div className="relative z-0 flex w-full flex-col gap-3 py-4">
              <div className="w-full overflow-hidden">
                <div className="psv-logo-marquee psv-logo-marquee--a flex w-max items-center gap-10 will-change-transform">
                  {Array.from({ length: 12 }).flatMap((_, i) =>
                    [0, 1].map((dup) => (
                      <Image
                        key={`brand-a-${selectedBrand.key}-${i}-${dup}`}
                        src={selectedBrand.logoSrcOnDark}
                        alt={selectedBrand.logoAlt}
                        width={140}
                        height={40}
                        className="h-8 w-auto opacity-80 grayscale brightness-200"
                      />
                    ))
                  )}
                </div>
              </div>

              <div className="w-full overflow-hidden">
                <div className="psv-logo-marquee psv-logo-marquee--b flex w-max items-center gap-10 will-change-transform">
                  {Array.from({ length: 12 }).flatMap((_, i) =>
                    [0, 1].map((dup) => (
                      <Image
                        key={`brand-b-${selectedBrand.key}-${i}-${dup}`}
                        src={selectedBrand.logoSrcOnDark}
                        alt={selectedBrand.logoAlt}
                        width={140}
                        height={40}
                        className="h-8 w-auto opacity-70 grayscale brightness-200"
                      />
                    ))
                  )}
                </div>
              </div>

              <div className="w-full overflow-hidden">
                <div className="psv-logo-marquee psv-logo-marquee--c flex w-max items-center gap-10 will-change-transform">
                  {Array.from({ length: 12 }).flatMap((_, i) =>
                    [0, 1].map((dup) => (
                      <Image
                        key={`brand-c-${selectedBrand.key}-${i}-${dup}`}
                        src={selectedBrand.logoSrcOnDark}
                        alt={selectedBrand.logoAlt}
                        width={140}
                        height={40}
                        className="h-8 w-auto opacity-60 grayscale brightness-200"
                      />
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="w-full rounded-xl border border-border bg-background overflow-hidden flex flex-col">
        <div className="flex items-center justify-between gap-3 px-6 py-4">
          <div className="flex items-center gap-2 text-base font-semibold font-psv-branding">
            <Eye className="h-4 w-4" />
            <span>TOP EXPOSURES</span>
          </div>
          <div className="text-sm text-muted-foreground">{periodLabel}</div>
        </div>

        <div className="px-6 pb-6 flex-1 min-h-0">
          <div className="grid h-full min-h-0 grid-cols-1 gap-6 md:grid-cols-[2fr_1px_1fr]">
            <div className="grid h-full min-h-0 auto-rows-fr grid-cols-1 gap-3 sm:grid-cols-3">
              {topExposures.items.map((item) => (
                <div key={item.id} className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
                  <div className="relative w-full flex-1 min-h-0">
                    <Image
                      src={item.imageSrc}
                      alt="Top exposure"
                      fill
                      sizes="(min-width: 1024px) 260px, (min-width: 640px) 33vw, 100vw"
                      className="object-cover"
                    />
                  </div>

                  <div className="shrink-0 h-20 border-t border-border bg-muted px-3 py-3 flex flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-xs text-muted-foreground truncate">Impressions</div>
                      <div className="text-xs font-semibold tabular-nums">{formatCompactNumber(item.impressions)}</div>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div className="text-xs text-muted-foreground">Visibility</div>
                      <div className="text-xs font-semibold tabular-nums">{item.visibilityPct.toFixed(1)}%</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden md:block w-px bg-border" />

            <div>
              <div className="flex flex-col h-full overflow-hidden bg-background divide-y divide-border justify-evenly">
                {([
                  topExposures.metrics.exposures,
                  topExposures.metrics.impressions,
                  topExposures.metrics.visibility,
                ] as const).map((metric) => {
                  const deltaPct = percentChange(metric.value, metric.previousValue)
                  const isUp = deltaPct >= 0
                  const MetricIcon = metric.icon
                  const valueDisplay =
                    metric.label === "Avg. visibility"
                      ? `${metric.value.toFixed(1)}%`
                      : metric.label === "Impressions"
                        ? formatCompactNumber(metric.value)
                        : metric.value.toLocaleString()
                  const previousValueDisplay =
                    metric.label === "Avg. visibility"
                      ? `${metric.previousValue.toFixed(1)}%`
                      : metric.label === "Impressions"
                        ? formatCompactNumber(metric.previousValue)
                        : metric.previousValue.toLocaleString()
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
                          {isUp ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">vs. {previousValueDisplay} last period</div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid w-full grid-cols-1 gap-6 md:grid-cols-[2fr_1fr]">
        <div className="w-full rounded-xl border border-border bg-background overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-6 py-4">
            <div className="flex items-center gap-2 text-base font-semibold font-psv-branding">
              <LineChartIcon className="h-4 w-4" />
              <span>EXPOSURE TRENDS</span>
            </div>
            <div className="text-sm text-muted-foreground">{periodLabel}</div>
          </div>

          <div className="px-6 pb-6">
            <ChartContainer config={exposureTrends.config} className="h-50 w-full">
              <LineChart data={exposureTrends.data} margin={{ top: 14, right: 18, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <ChartTooltip
                  cursor={{ stroke: "#c7c7c7", strokeDasharray: "4 4" }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload || payload.length === 0) return null
                    return (
                      <div className="rounded-lg border border-black bg-black px-3 py-2 shadow-md space-y-2 text-white">
                        <div className="font-semibold text-sm text-white">{String(label ?? "")}</div>
                        <div className="space-y-1 text-xs text-zinc-100">
                          {payload
                            .filter((p) => p.type !== "none")
                            .map((item) => {
                              const stroke =
                                (typeof item.stroke === "string" && item.stroke) ||
                                (typeof item.color === "string" && item.color) ||
                                "#ffffff"
                              const name = String(item.name ?? item.dataKey ?? "")
                              const value = typeof item.value === "number" ? item.value : Number(item.value)
                              return (
                                <div key={String(item.dataKey ?? name)} className="flex items-center justify-between gap-4">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="h-[10px] w-[10px] rounded-[2px] shrink-0" style={{ backgroundColor: stroke }} aria-hidden />
                                    <span className="truncate text-zinc-200">{name}</span>
                                  </div>
                                  <span className="text-white font-mono font-medium tabular-nums">
                                    {Number.isFinite(value) ? Number(value).toLocaleString() : "-"}
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
                <YAxis width={44} tickLine={false} axisLine={false} tickFormatter={(v) => formatCompactNumber(Number(v))} />
                <Line type="monotone" dataKey="brand" name={selectedBrand.name} stroke="var(--chart-1)" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="avg" name="Average" stroke="var(--muted-foreground)" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ChartContainer>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-5 text-xs text-muted-foreground">
              {([
                { key: "brand", label: selectedBrand.name, color: "var(--chart-1)" },
                { key: "avg", label: "Average", color: "var(--muted-foreground)" },
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
        </div>

        <div className="grid grid-cols-1 gap-6">
          {([
            { ...sentimentMetric, icon: HeartHandshake },
            { ...estimatedValueMetric, icon: TrendingUp },
          ] as const).map((metric) => {
            const deltaPct = percentChange(metric.value, metric.previousValue)
            const isUp = deltaPct >= 0
            const Icon = metric.icon
            return (
              <div key={metric.label} className="w-full rounded-xl border border-border bg-background overflow-hidden">
                <div className="flex items-center justify-between gap-3 px-6 py-4">
                  <div className="flex items-center gap-2 text-base font-semibold font-psv-branding">
                    <Icon className="h-4 w-4" />
                    <span>{metric.label}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">{periodLabel}</div>
                </div>

                <div className="px-6 pb-6">
                  <div className="mt-1 flex items-baseline gap-2">
                    <div className="font-psv-branding italic text-3xl leading-none tabular-nums">{metric.valueDisplay}</div>
                    <div
                      className={cn(
                        "inline-flex items-center gap-1 text-sm font-semibold",
                        isUp ? "text-green-500" : "text-red-500"
                      )}
                    >
                      <span>{formatDeltaPct(deltaPct)}</span>
                      {isUp ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">vs. {metric.previousValueDisplay} last period</div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section className="grid w-full grid-cols-1 gap-6 md:grid-cols-[1fr_2fr]">
        <div className="w-full rounded-xl border border-border bg-background overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-6 py-4">
            <div className="flex items-center gap-2 text-base font-semibold font-psv-branding">
              <Activity className="h-4 w-4" />
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
                    <Cell key={item.key} fill={item.color} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-5 text-xs text-muted-foreground">
              {visibilityShare.data.map((item) => (
                <div key={item.key} className="flex items-center gap-2">
                  <span className="h-[10px] w-[10px] rounded-[2px]" style={{ backgroundColor: item.color }} aria-hidden />
                  <span>{legendLabel(item.name)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="w-full rounded-xl border border-border bg-background overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-6 py-4">
            <div className="flex items-center gap-2 text-base font-semibold font-psv-branding">
              <TrendingUp className="h-4 w-4" />
              <span>CUMULATIVE IMPACT</span>
            </div>
            <div className="text-sm text-muted-foreground">{periodLabel}</div>
          </div>

          <div className="px-6 pb-6">
            <ChartContainer config={cumulativeImpact.config} className="h-72 w-full">
              <AreaChart data={cumulativeImpact.data} margin={{ top: 14, right: 18, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <ChartTooltip
                  cursor={{ stroke: "#c7c7c7", strokeDasharray: "4 4" }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload || payload.length === 0) return null
                    return (
                      <div className="rounded-lg border border-black bg-black px-3 py-2 shadow-md space-y-2 text-white">
                        <div className="font-semibold text-sm text-white">{String(label ?? "")}</div>
                        <div className="space-y-1 text-xs text-zinc-100">
                          {payload
                            .filter((p) => p.type !== "none")
                            .map((item) => {
                              const stroke =
                                (typeof item.stroke === "string" && item.stroke) ||
                                (typeof item.color === "string" && item.color) ||
                                "#ffffff"
                              const name = String(item.name ?? item.dataKey ?? "")
                              const value = typeof item.value === "number" ? item.value : Number(item.value)
                              return (
                                <div key={String(item.dataKey ?? name)} className="flex items-center justify-between gap-4">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="h-[10px] w-[10px] rounded-[2px] shrink-0" style={{ backgroundColor: stroke }} aria-hidden />
                                    <span className="truncate text-zinc-200">{name}</span>
                                  </div>
                                  <span className="text-white font-mono font-medium tabular-nums">
                                    {Number.isFinite(value) ? formatCompactNumber(Number(value)) : "-"}
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
                <YAxis width={44} tickLine={false} axisLine={false} tickFormatter={(v) => formatCompactNumber(Number(v))} />
                <Area
                  type="monotone"
                  dataKey="impressions"
                  name={selectedBrand.name}
                  stroke="var(--chart-1)"
                  fill="var(--chart-1)"
                  fillOpacity={0.22}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
                <Line type="monotone" dataKey="avg" name="Average" stroke="var(--muted-foreground)" strokeWidth={2} dot={false} isAnimationActive={false} />
              </AreaChart>
            </ChartContainer>
          </div>
        </div>
      </section>
    </main>
  )
}
