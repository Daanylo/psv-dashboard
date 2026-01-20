"use client"

import { useMemo, useState, useEffect, useRef } from "react"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Activity,
  Calendar as CalendarIcon,
  Download,
  Eye,
  FileText,
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
import { Separator } from "@/components/ui/separator"
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

type DateRangeKey = "7" | "30" | "90" | "365" | "custom"

type Brand = {
  id: number
  name: string
  slug: string
  color: string
  logo_light: string | null
  logo_dark: string | null
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
  end.setHours(23, 59, 59, 999)

  const start = new Date(end)
  start.setDate(start.getDate() - (days - 1))
  start.setHours(0,0,0,0)

  return { start, end }
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

type SortKey = "impressions" | "visibility" | "time" | "sentiment"

export default function SponsorsReportPage() {
  const [search, setSearch] = useState("")
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [dateRangeKey, setDateRangeKey] = useState<DateRangeKey>("30")
  const [brandKey, setBrandKey] = useState<string>(() => {
    if (typeof window === "undefined") return "puma"
    const sp = new URLSearchParams(window.location.search)
    return sp.get("brand") || "puma"
  })
  const [sortBy, setSortBy] = useState<SortKey>("impressions")
  const [availableBrands, setAvailableBrands] = useState<Brand[]>([])
  const [brandsLoading, setBrandsLoading] = useState(true)

  const router = useRouter()
  const searchParams = useSearchParams()
  const brandParam = searchParams.get("brand")

  useEffect(() => {
    if (brandParam && brandParam !== brandKey) {
      setBrandKey(brandParam)
    }
  }, [brandParam, brandKey])

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    if (brandKey) sp.set("brand", brandKey)
    else sp.delete("brand")

    const nextSearch = sp.toString() ? `?${sp.toString()}` : ""
    if (nextSearch !== window.location.search) {
      router.replace(`/sponsors-report${nextSearch}`, { scroll: false })
    }
  }, [brandKey, router])

  // Fetch available brands
  useEffect(() => {
    async function fetchBrands() {
        try {
            const res = await fetch("/api/new/settings/brands")
            if (res.ok) {
                const data = await res.json()
                setAvailableBrands(data)
                // If current brandKey is not in fetched brands, reset to first one
                if (data.length > 0 && !data.find((b: Brand) => b.slug === brandKey)) {
                   setBrandKey(data[0].slug)
                }
            }
        } catch (e) {
            console.error("Failed to fetch brands", e)
        } finally {
            setBrandsLoading(false)
        }
    }
    fetchBrands()
  }, [])
  
  // State for fetched data
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Custom date range state (defaults to last 30 days)
  const defaultEnd = useMemo(() => new Date(), [])
  const defaultStart = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d
  }, [])
  
  const [customStart, setCustomStart] = useState<string>(toIsoDateOnly(defaultStart))
  const [customEnd, setCustomEnd] = useState<string>(toIsoDateOnly(defaultEnd))

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
    
  // Calculate previous period for API call
  const { previousStart, previousEnd } = useMemo(() => {
    const prevEnd = new Date(start)
    prevEnd.setDate(prevEnd.getDate() - 1)
    
    // For custom ranges, we likely want the same duration
    if (dateRangeKey === "custom") {
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const durationDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; 
        
        const prevStart = new Date(prevEnd);
        prevStart.setDate(prevStart.getDate() - (durationDays - 1));
        return {
            previousStart: prevStart,
            previousEnd: prevEnd
        }
    }

    const prev = getDateRange(dateRangeDays, prevEnd)
    return {
      previousStart: prev.start,
      previousEnd: prev.end
    }
  }, [dateRangeDays, start, end, dateRangeKey])

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

  const selectedBrand = useMemo(() => {
    return availableBrands.find((b) => b.slug === brandKey) ?? availableBrands[0] ?? { name: brandKey, slug: brandKey, color: "#999" }
  }, [brandKey, availableBrands])

  // Fetch Data
  useEffect(() => {
    // Wait for brands to load? Not strictly necessary but safe.
    if (brandsLoading) return 

    async function fetchData() {
      setLoading(true)
      try {
        const query = new URLSearchParams({
          start: start.getTime().toString(),
          end: end.getTime().toString(),
          previousStart: previousStart.getTime().toString(),
          previousEnd: previousEnd.getTime().toString(),
          brand: brandKey,
          sortBy: sortBy
        })
        const res = await fetch(`/api/new/sponsors-report?${query.toString()}`)
        if (res.ok) {
            const json = await res.json()
            setData(json)
        }
      } catch (err) {
        console.error("Failed to fetch sponsor report", err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [start, end, previousStart, previousEnd, brandKey, sortBy, brandsLoading])

  const topExposures = useMemo(() => {
    if (!data) return { 
      items: [], 
      metrics: { 
        exposures: { label: "Exposures", value: 0, previousValue: 0, icon: Eye }, 
        impressions: { label: "Impressions", value: 0, previousValue: 0, icon: TrendingUp }, 
        visibility: { label: "Avg. visibility", value: 0, previousValue: 0, icon: Activity } 
      } 
    }

    return {
      items: (data.topExposures || []).slice(0, 3), // Ensure max 3 items
      metrics: {
        exposures: {
          label: "Exposures",
          value: data.metrics.exposures.value,
          previousValue: data.metrics.exposures.previousValue,
          icon: Eye,
        },
        impressions: {
          label: "Impressions",
          value: data.metrics.impressions.value,
          previousValue: data.metrics.impressions.previousValue,
          icon: TrendingUp,
        },
        visibility: {
          label: "Avg. visibility",
          value: data.metrics.visibility.value,
          previousValue: data.metrics.visibility.previousValue,
          icon: Activity,
        },
      },
    }
  }, [data])

  const exposureTrends = useMemo(() => {
    const config: ChartConfig = {
      brand: { label: selectedBrand.name, color: selectedBrand.color || "hsl(var(--chart-1))" },
      avg: { label: "Average", color: "var(--muted-foreground)" },
    }
    return { data: data?.trends || [], config }
  }, [data, selectedBrand.name])

  const sentimentMetric = useMemo(() => {
    if (!data) return { label: "FAN SENTIMENT", value: 0, previousValue: 0, valueDisplay: "0%", previousValueDisplay: "0%" }
    
    return {
      label: "FAN SENTIMENT",
      value: data.metrics.sentiment.value,
      previousValue: data.metrics.sentiment.previousValue,
      valueDisplay: `${data.metrics.sentiment.value.toFixed(1)}%`,
      previousValueDisplay: `${data.metrics.sentiment.previousValue.toFixed(1)}%`,
    }
  }, [data])

  const estimatedValueMetric = useMemo(() => {
    if (!data) return { label: "ESTIMATED VALUE", value: 0, previousValue: 0, valueDisplay: "€0", previousValueDisplay: "€0" }

    return {
      label: "ESTIMATED VALUE",
      value: data.metrics.value.value,
      previousValue: data.metrics.value.previousValue,
      valueDisplay: formatCurrencyEUR(data.metrics.value.value),
      previousValueDisplay: formatCurrencyEUR(data.metrics.value.previousValue),
    }
  }, [data])

  const visibilityShare = useMemo(() => {
    if (!data || !data.visibilityShare) return { data: [], config: {} }

    // data.visibilityShare is now [{ key: "brand", value: ... }, { key: "others", value: ... }]
    const rawData = data.visibilityShare as { key: string, value: number }[];
    
    // Determine color for the selected brand
    let brandColor = selectedBrand.color || "#000000";

    const chartData = rawData.map(item => {
        if (item.key === 'brand') {
            return {
                ...item,
                name: selectedBrand.name,
                color: brandColor
            }
        } else {
            return {
                ...item,
                name: "Other",
                color: "var(--muted)" // or a grey hex
            }
        }
    });

    const config: ChartConfig = {
      brand: { label: selectedBrand.name, color: brandColor },
      others: { label: "Other", color: "var(--muted)" },
    };

    return { data: chartData, config }
  }, [data, selectedBrand])

  const cumulativeImpact = useMemo(() => {
    const config: ChartConfig = {
      impressions: { label: selectedBrand.name, color: selectedBrand.color || "hsl(var(--chart-1))" },
      avg: { label: "Average", color: "var(--muted-foreground)" },
    }
    return { data: data?.cumulativeImpact || [], config }
  }, [data, selectedBrand.name])

  const mainRef = useRef<HTMLElement>(null)

  const handleExport = async () => {
    if (!mainRef.current) return
    try {
        const { toPng } = await import("html-to-image")
        const jsPDF = (await import("jspdf")).default
        
        // Helper to manually fetch and embed fonts to avoid html-to-image parsing errors
        const getFontEmbedCSS = async () => {
             try {
                const fonts = [
                    { name: "PSVBranding", url: "/fonts/PSVBranding-Regular.woff2", weight: 400, style: "normal" },
                    { name: "PSVBranding", url: "/fonts/PSVBranding-Bold.woff2", weight: 700, style: "normal" },
                    { name: "PSVBranding", url: "/fonts/PSVBranding-BoldItalic.woff2", weight: 700, style: "italic" },
                    // Open Sans (User manually provided)
                    { name: "Open Sans", url: "/fonts/OpenSans-Regular.woff2", weight: 400, style: "normal" },
                    { name: "Open Sans", url: "/fonts/OpenSans-Bold.woff2", weight: 700, style: "normal" },
                ]
                const parts = await Promise.all(fonts.map(async (f) => {
                    const res = await fetch(f.url)
                    if (!res.ok) throw new Error(`Failed to fetch font ${f.url}`)
                    const blob = await res.blob()
                    return new Promise<string>((resolve, reject) => {
                        const reader = new FileReader()
                        reader.onloadend = () => {
                            if (typeof reader.result === 'string') {
                                resolve(`@font-face { font-family: "${f.name}"; src: url(${reader.result}) format("woff2"); font-weight: ${f.weight}; font-style: ${f.style}; }`)
                            } else {
                                reject(new Error("Reader result not string"))
                            }
                        }
                        reader.onerror = reject
                        reader.readAsDataURL(blob)
                    })
                }))
                
                // Override Next.js generated font variables to point to our manually embedded "Open Sans"
                const overrideCSS = `
                    :root { 
                        --font-open-sans: "Open Sans", sans-serif !important; 
                        --font-sans: "Open Sans", sans-serif !important; 
                    }
                `
                return parts.join("\n") + overrideCSS
            } catch (e) {
                console.warn("Font embedding failed, continuing without custom fonts", e)
                return ""
            }
        }

        const fontCSS = await getFontEmbedCSS()
        
        // Capture the full scrollable content
        const node = mainRef.current
        const width = node.scrollWidth
        const height = node.scrollHeight

        // Pre-process images: force eager loading and inline as base64 to prevent duplication/missing issues
        const images = Array.from(node.querySelectorAll("img"))
        const imageRestoreFns: (() => void)[] = []

        await Promise.all(images.map(async (img) => {
            try {
                if (img.loading !== "eager") img.loading = "eager"
                
                // Ensure loaded
                if (!img.complete) {
                    await new Promise((resolve) => {
                        img.onload = resolve
                        img.onerror = resolve
                    })
                }

                // Inline as Data URL
                const currentSrc = img.currentSrc || img.src
                if (currentSrc && !currentSrc.startsWith("data:")) {
                    // Fetch the image data
                    const response = await fetch(currentSrc)
                    const blob = await response.blob()
                    
                    const base64 = await new Promise<string>((resolve, reject) => {
                        const reader = new FileReader()
                        reader.onloadend = () => {
                            if (typeof reader.result === "string") resolve(reader.result)
                            else reject(new Error("Failed to convert image to base64"))
                        }
                        reader.onerror = reject
                        reader.readAsDataURL(blob)
                    })

                    // Save original state
                    const prevSrc = img.getAttribute("src")
                    const prevSrcSet = img.getAttribute("srcset")

                    // Apply base64
                    img.src = base64
                    img.removeAttribute("srcset")

                    // Queue restoration
                    imageRestoreFns.push(() => {
                        if (prevSrc) img.setAttribute("src", prevSrc)
                        else img.removeAttribute("src")
                        
                        if (prevSrcSet) img.setAttribute("srcset", prevSrcSet)
                    })
                }
            } catch (e) {
                console.warn("Failed to inline image for export", e)
            }
        }))

        // Small buffer for DOM updates
        await new Promise(r => setTimeout(r, 100))

        const dataUrl = await toPng(node, { 
            cacheBust: true, // Re-enable cache busting to avoid potential Next.js image timeouts
            pixelRatio: 2,
            fontEmbedCSS: fontCSS,
            backgroundColor: "#ffffff",
            width: width,
            height: height,
            style: {
                height: 'auto',
                overflow: 'visible',
                maxHeight: 'none',
                margin: '0',
                maxWidth: 'none',
                width: `${width}px`
            }
        })

        // Restore images to original state
        imageRestoreFns.forEach(restore => restore())
        
        const pdf = new jsPDF({
            orientation: width > height ? "landscape" : "portrait",
            unit: "px",
            format: [width, height]
        })
        
        pdf.addImage(dataUrl, "PNG", 0, 0, width, height)
        pdf.save("sponsors-report.pdf")
    } catch (err: any) {
        console.error("Export failed details:", err)
    }
  }

  return (
    <main ref={mainRef} className="max-w-screen-xl mx-auto px-6 py-8 space-y-6">
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
              <span>Sponsor</span>
            </button>

            {isFilterOpen ? (
              <div
                role="menu"
                className="bg-popover text-popover-foreground absolute right-0 top-full z-50 mt-2 w-[320px] max-w-[calc(100vw-3rem)] overflow-x-hidden rounded-md border p-3 text-sm shadow-md"
              >
                <div className="px-1 pb-2 text-xs font-semibold text-muted-foreground">Brand</div>
                <div role="radiogroup" className="max-h-[300px] overflow-y-auto space-y-2">
                  {availableBrands.map((brand) => {
                    const selected = brand.slug === brandKey
                    const logo = brand.logo_light
                    return (
                      <label
                        key={brand.slug}
                        className={cn(
                          "relative flex cursor-pointer items-center gap-3 rounded-md border border-border px-3 py-2",
                          selected ? "bg-muted" : "bg-background hover:bg-accent"
                        )}
                      >
                        <input
                          type="radio"
                          name="brand"
                          value={brand.slug}
                          checked={selected}
                          onChange={() => setBrandKey(brand.slug)}
                          className="sr-only"
                        />
                        <div
                          className={cn(
                            "relative h-5 w-5 shrink-0 rounded-full border after:absolute after:inset-[3px] after:rounded-full after:bg-foreground after:transition-opacity",
                            selected ? "border-foreground after:opacity-100" : "border-muted-foreground after:opacity-0"
                          )}
                          aria-hidden="true"
                        />
                        {logo ? (
                          <Image
                            src={logo}
                            alt={brand.name}
                            width={140}
                            height={42}
                            className={cn("h-6 w-auto object-contain", selected ? "opacity-100" : "opacity-75 grayscale")}
                          />
                        ) : (
                          <span className="font-semibold text-sm">{brand.name}</span>
                        )}
                      </label>
                    )
                  })}
                </div>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={handleExport}
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
                    [0, 1].map((dup) => {
                      const logoSrc = selectedBrand.logo_dark || selectedBrand.logo_light || "https://placehold.co/140x40"
                      return (
                      <Image
                        key={`brand-a-${selectedBrand.slug}-${i}-${dup}`}
                        src={logoSrc}
                        alt={selectedBrand.name}
                        width={140}
                        height={40}
                        className="h-8 w-auto opacity-80 grayscale brightness-200"
                      />
                      )
                    })
                  )}
                </div>
              </div>

              <div className="w-full overflow-hidden">
                <div className="psv-logo-marquee psv-logo-marquee--b flex w-max items-center gap-10 will-change-transform">
                  {Array.from({ length: 12 }).flatMap((_, i) =>
                    [0, 1].map((dup) => {
                      const logoSrc = selectedBrand.logo_dark || selectedBrand.logo_light || "https://placehold.co/140x40"
                      return (
                      <Image
                        key={`brand-b-${selectedBrand.slug}-${i}-${dup}`}
                        src={logoSrc}
                        alt={selectedBrand.name}
                        width={140}
                        height={40}
                        className="h-8 w-auto opacity-70 grayscale brightness-200"
                      />
                      )
                    })
                  )}
                </div>
              </div>

              <div className="w-full overflow-hidden">
                <div className="psv-logo-marquee psv-logo-marquee--c flex w-max items-center gap-10 will-change-transform">
                  {Array.from({ length: 12 }).flatMap((_, i) =>
                    [0, 1].map((dup) => {
                      const logoSrc = selectedBrand.logo_dark || selectedBrand.logo_light || "https://placehold.co/140x40"
                      return (
                      <Image
                        key={`brand-c-${selectedBrand.slug}-${i}-${dup}`}
                        src={logoSrc}
                        alt={selectedBrand.name}
                        width={140}
                        height={40}
                        className="h-8 w-auto opacity-60 grayscale brightness-200"
                      />
                      )
                    })
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
          <div className="flex items-center gap-3">
             <div className="flex items-center gap-2">
                 <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
                    <SelectTrigger className="h-8 w-[130px] text-xs">
                        <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="time">Recent</SelectItem>
                        <SelectItem value="visibility">Visibility Score</SelectItem>
                        <SelectItem value="impressions">Impressions</SelectItem>
                        {/* <SelectItem value="sentiment">Sentiment</SelectItem> */}
                    </SelectContent>
                 </Select>
             </div>
             <div className="text-sm text-muted-foreground">{periodLabel}</div>
           </div>
        </div>

        <div className="px-6 pb-6 flex-1 min-h-0">
          <div className="grid h-full min-h-0 grid-cols-1 gap-6 md:grid-cols-[2fr_1px_1fr]">
            <div className="grid h-full min-h-0 auto-rows-fr grid-cols-1 gap-3 sm:grid-cols-3">
              {topExposures.items.length === 0 ? (
                <div className="col-span-3 flex h-full flex-col items-center justify-center text-center text-muted-foreground p-8 border border-dashed border-border rounded-lg bg-muted/20">
                  <FileText className="h-10 w-10 opacity-30 mb-2" />
                  <span className="text-sm font-medium">No posts found</span>
                  <span className="text-xs">Try adjusting your filters or date range</span>
                </div>
              ) : (
                topExposures.items.map((item: any) => (
                  <div key={item.id} className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
                    <div className="relative w-full flex-1 min-h-0">
                      <a
                        href={item.url || "#"}
                        target={item.url ? "_blank" : undefined}
                        rel={item.url ? "noopener noreferrer" : undefined}
                        className={item.url ? "block h-full w-full" : "block h-full w-full pointer-events-none"}
                      >
                        <Image
                          src={item.imageSrc}
                          alt="Top exposure"
                          fill
                          sizes="(min-width: 1024px) 260px, (min-width: 640px) 33vw, 100vw"
                          className="object-cover"
                        />
                      </a>
                    </div>

                    <div className="shrink-0 h-16 border-t border-border bg-muted px-3 py-3 flex flex-col">
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
                ))
              )}
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
                  {visibilityShare.data.map((item: any) => (
                    <Cell key={item.key} fill={item.color} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-5 text-xs text-muted-foreground">
              {visibilityShare.data.map((item: any) => (
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
