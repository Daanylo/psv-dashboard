"use client"

import { useEffect, useMemo, useState, useRef } from "react"
import Image from "next/image"
import { CartesianGrid, Cell, Line, LineChart, Pie, PieChart, XAxis, YAxis } from "recharts"
import { BrandLink } from "@/components/brand-link"
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
import { Separator } from "@/components/ui/separator"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { cn } from "@/lib/utils"

type DateRangeKey = "7" | "30" | "90" | "365" | "custom"
type ExposureGranularity = "daily" | "weekly"

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
  const [selectedBrands, setSelectedBrands] = useState<string[]>([])
  const [availableBrands, setAvailableBrands] = useState<Brand[]>([])

  useEffect(() => {
    fetch("/api/new/settings/brands").then(r => r.json()).then(data => {
        setAvailableBrands(data)
         // Select all by default
        setSelectedBrands(data.map((b: Brand) => b.slug))
    })
  }, [])

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
      case "custom":
        return "Custom period"
    }
  }, [dateRangeKey])

  const [postOverview, setPostOverview] = useState<{
    posts: {
      id: string
      imageSrc: string
      url?: string
      date: Date
      likes: number
      comments: number
      caption: string
      impressions: number
      visibilityScore: number | null
      visibilityBrand: string | null
      sentimentScore: number | null
    }[]
    metrics: {
      posts: { label: string; value: number; previousValue: number }
      impressions: { label: string; value: number; previousValue: number }
      engagement: { label: string; value: number; previousValue: number }
      brandExposures: { label: string; value: number; previousValue: number }
      brandImpressions: { label: string; value: number; previousValue: number }
      avgVisibility: { label: string; value: number; previousValue: number }
    }
    trends: { date: string; [key: string]: any }[]
    visibilityShare: { brand: string; value: number }[]
    missedOpportunities: { id: string; impressions: number; visibilityPct: number; imageSrc: string; url?: string }[]
  }>({
    posts: [],
    metrics: {
      posts: { label: "Posts", value: 0, previousValue: 0 },
      impressions: { label: "Impressions", value: 0, previousValue: 0 },
      engagement: { label: "Engagement", value: 0, previousValue: 0 },
      brandExposures: { label: "Brand Exposures", value: 0, previousValue: 0 },
      brandImpressions: { label: "Brand Impressions", value: 0, previousValue: 0 },
      avgVisibility: { label: "Avg Visibility", value: 0, previousValue: 0 },
    },
    trends: [],
    visibilityShare: [],
    missedOpportunities: [],
  })

  // Chart config for the trends
  const trendsConfig = useMemo(() => {
     const config: ChartConfig = {
        value: { label: "Exposures", color: "hsl(var(--chart-1))" }
     }
     availableBrands.forEach(b => {
         config[b.slug] = { label: b.name, color: b.color }
     })
     return config
  }, [availableBrands])

  const [sortConfig, setSortConfig] = useState<{
    by: "time" | "visibility" | "impressions" | "sentiment"
    order: "asc" | "desc"
  }>({ by: "time", order: "desc" })

  const activeBrandKeys = useMemo(() => {
    const keys = new Set<string>();
    postOverview.trends.forEach(d => {
        Object.keys(d).forEach(k => {
             // Only show if it has non-zero data at some point
             if (k !== 'date' && typeof d[k] === 'number' && d[k] > 0) {
                 keys.add(k)
             }
        })
    })
    return Array.from(keys);
  }, [postOverview.trends]);

  useEffect(() => {
    async function fetchData() {
      try {
        const prevEnd = new Date(start)
        prevEnd.setDate(prevEnd.getDate() - 1)

        const params = new URLSearchParams({
          start: start.getTime().toString(),
          end: end.getTime().toString(),
          previousStart: previousStart.getTime().toString(),
          previousEnd: prevEnd.getTime().toString(),
          sortBy: sortConfig.by,
          order: sortConfig.order,
          brands: selectedBrands.join(","),
        })

        const res = await fetch(`/api/new/commercial-hub/posts?${params}`)
        if (!res.ok) throw new Error("Failed to fetch")
        const data = await res.json()

        setPostOverview({
          posts: data.posts.map((p: any) => ({ ...p, date: new Date(p.date) })),
          metrics: {
            posts: {
              label: "Posts",
              value: data.metrics.posts,
              previousValue: data.previousMetrics.posts,
            },
            impressions: {
              label: "Impressions",
              value: data.metrics.impressions,
              previousValue: data.previousMetrics.impressions,
            },
            engagement: {
              label: "Engagement",
              value: data.metrics.engagement,
              previousValue: data.previousMetrics.engagement,
            },
            brandExposures: {
              label: "Brand Exposures",
              value: data.metrics.brandExposures,
              previousValue: data.previousMetrics.brandExposures,
            },
            brandImpressions: {
              label: "Brand Impressions",
              value: data.metrics.brandImpressions,
              previousValue: data.previousMetrics.brandImpressions,
            },
            avgVisibility: {
              label: "Avg Visibility",
              value: data.metrics.avgVisibility,
              previousValue: data.previousMetrics.avgVisibility,
            },
          },
          trends: data.trends || [],
          visibilityShare: data.visibilityShare || [],
          missedOpportunities: data.missedOpportunities || [],
        })
      } catch (e) {
        console.error("Failed to load post overview:", e)
      }
    }

    fetchData()
  }, [start, end, previousStart, sortConfig, selectedBrands])





  const visibilityShare = useMemo(() => {
    const total = postOverview.visibilityShare.reduce((sum, item) => sum + item.value, 0)
    
    // Extended color palette for brands
    const palette = [
      "#FF0000", "#6e0078", "#1fa12d", "#005baa", "#ffc107", 
      "#ec008c", "#f39200", "#000000", "#555555", "#8B4513", 
      "#20B2AA", "#778899", "#DA70D6", "#FF6347", "#4682B4"
    ];

    // Take all brands
    const data = postOverview.visibilityShare.map((item, index) => {
        const key = item.brand.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        // Find matching config or generate color
        let color = palette[index % palette.length];
        let label = item.brand;
        
        // Prefer config color and label if available
        const configKey = Object.keys(trendsConfig).find(k => k === key);
        if (configKey) {
            const configItem = trendsConfig[configKey];
            if (configItem) {
                 // Use nullish coalescing to fallback to existing color if config color is undefined
                 color = configItem.color ?? color;
                 
                 // Ensure label is a string before assigning
                 const potentialLabel = configItem.label;
                 if (typeof potentialLabel === "string") {
                     label = potentialLabel;
                 }
            }
        }

        return {
            key,
            name: label,
            value: total > 0 ? (item.value / total) * 100 : 0,
            color
        }
    });

    const config: ChartConfig = {};
    data.forEach(d => {
        config[d.key] = { label: d.name, color: d.color };
    });

    return { data, config }
  }, [postOverview.visibilityShare])

  const missedOpportunities = postOverview.missedOpportunities

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
                console.warn("Font embedding failed (continuing without custom fonts):", e)
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
            format: [width, height] // Use exact pixel dimensions
        })
        
        pdf.addImage(dataUrl, "PNG", 0, 0, width, height)
        pdf.save("commercial-hub.pdf")
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
              <span>Sponsors</span>
            </button>

            {isFilterOpen ? (
              <div
                role="menu"
                className="bg-popover text-popover-foreground absolute right-0 top-full z-50 mt-2 w-56 rounded-md border p-2 text-sm shadow-md"
              >
                <div className="flex flex-col gap-1">
                  <div 
                    className="flex items-center gap-2 px-2 py-1.5 border-b hover:bg-accent rounded-sm cursor-pointer" 
                    onClick={() => {
                        if (selectedBrands.length === availableBrands.length) {
                             setSelectedBrands([]) 
                        } else {
                             setSelectedBrands(availableBrands.map(b => b.slug))
                        }
                    }}
                  >
                    <input 
                      type="checkbox" 
                      checked={availableBrands.length > 0 && selectedBrands.length === availableBrands.length}
                      readOnly
                      className="cursor-pointer"
                    />
                    <span className="font-medium">Select All</span>
                  </div>
                  {availableBrands.map((brand) => (
                    <div 
                        key={brand.slug} 
                        className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent rounded-sm cursor-pointer"
                        onClick={() => {
                            if (selectedBrands.includes(brand.slug)) {
                                setSelectedBrands(selectedBrands.filter(k => k !== brand.slug))
                            } else {
                                setSelectedBrands([...selectedBrands, brand.slug])
                            }
                        }}
                    >
                      <input 
                        type="checkbox" 
                        checked={selectedBrands.includes(brand.slug)}
                        readOnly
                        className="cursor-pointer"
                      />
                      <span>{brand.name}</span>
                    </div>
                  ))}

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
                  {[...availableBrands, ...availableBrands].map((brand, index) => {
                    const logoSrc = brand.logo_dark || brand.logo_light || ""
                    if (!logoSrc) return null
                    return (
                      <BrandLink key={`row-a-${brand.slug}-${index}`} brand={brand.slug} className="shrink-0">
                        <Image
                          src={logoSrc}
                          alt={brand.name}
                          width={140}
                          height={40}
                          className="h-8 w-auto opacity-80 grayscale brightness-200"
                        />
                      </BrandLink>
                  )})}
                </div>
              </div>

              <div className="w-full overflow-hidden">
                <div className="psv-logo-marquee psv-logo-marquee--b flex w-max items-center gap-10 will-change-transform">
                  {[...availableBrands, ...availableBrands].map((brand, index) => {
                    const logoSrc = brand.logo_dark || brand.logo_light || ""
                    if (!logoSrc) return null
                    return (
                      <BrandLink key={`row-b-${brand.slug}-${index}`} brand={brand.slug} className="shrink-0">
                        <Image
                          src={logoSrc}
                          alt={brand.name}
                          width={140}
                          height={40}
                          className="h-8 w-auto opacity-70 grayscale brightness-200"
                        />
                      </BrandLink>
                  )})}
                </div>
              </div>

              <div className="hidden w-full overflow-hidden md:block">
                <div className="psv-logo-marquee psv-logo-marquee--c flex w-max items-center gap-10 will-change-transform">
                  {[...availableBrands, ...availableBrands].map((brand, index) => {
                    const logoSrc = brand.logo_dark || brand.logo_light || ""
                    if (!logoSrc) return null
                    return (
                      <BrandLink key={`row-c-${brand.slug}-${index}`} brand={brand.slug} className="shrink-0">
                        <Image
                          src={logoSrc}
                          alt={brand.name}
                          width={140}
                          height={40}
                          className="h-8 w-auto opacity-60 grayscale brightness-200"
                        />
                      </BrandLink>
                  )})}
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
            <div className="flex items-center gap-2">
              <Select
                value={sortConfig.by}
                onValueChange={(val: any) =>
                  setSortConfig((prev) => ({ ...prev, by: val }))
                }
              >
                <SelectTrigger className="h-8 w-[130px] text-xs">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="time">Recent</SelectItem>
                  <SelectItem value="visibility">Visibility Score</SelectItem>
                  <SelectItem value="impressions">Impressions</SelectItem>
                  <SelectItem value="sentiment">Sentiment</SelectItem>
                </SelectContent>
              </Select>
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background text-foreground hover:bg-accent"
                onClick={() =>
                  setSortConfig((prev) => ({
                    ...prev,
                    order: prev.order === "asc" ? "desc" : "asc",
                  }))
                }
                title={sortConfig.order === "asc" ? "Ascending" : "Descending"}
              >
                <ArrowUpDown className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="text-sm text-muted-foreground">{periodLabel}</div>
          </div>
        </div>

        <div className="px-6 pb-6 flex-1 min-h-0">
          <div className="grid h-full min-h-0 grid-cols-1 gap-6 md:grid-cols-[2fr_1px_1fr]">

              <div className="grid h-full min-h-0 auto-rows-fr grid-cols-1 gap-3 sm:grid-cols-3">
                {postOverview.posts.length === 0 ? (
                    <div className="col-span-3 flex h-full flex-col items-center justify-center text-center text-muted-foreground p-8 border border-dashed border-border rounded-lg bg-muted/20">
                        <FileText className="h-10 w-10 opacity-30 mb-2" />
                        <span className="text-sm font-medium">No posts found</span>
                        <span className="text-xs">Try adjusting your filters or date range</span>
                    </div>
                ) : (
                  postOverview.posts.map((post) => (
                  <div
                    key={post.id}
                    className="flex h-full min-h-0 flex-col overflow-hidden bg-background"
                  >
                    <div className="relative w-full flex-1 min-h-0">
                      <a
                        href={post.url || "#"}
                        target={post.url ? "_blank" : undefined}
                        rel={post.url ? "noopener noreferrer" : undefined}
                        className={post.url ? "block h-full w-full" : "block h-full w-full pointer-events-none"}
                      >
                        <Image
                          src={post.imageSrc}
                          alt="Post"
                          fill
                          sizes="(min-width: 1024px) 260px, (min-width: 640px) 33vw, 100vw"
                          className="object-cover"
                        />
                      </a>
                      {sortConfig.by !== "time" && (
                        <div className="absolute top-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm tracking-tight tabular-nums">
                          {sortConfig.by === "visibility" &&
                            `Vis: ${post.visibilityScore !== null ? post.visibilityScore.toFixed(2) : "N/A"}${post.visibilityBrand ? ` (${post.visibilityBrand})` : ""}`}
                          {sortConfig.by === "impressions" &&
                            `Imp: ${formatCompactNumber(post.impressions)}`}
                          {sortConfig.by === "sentiment" &&
                            `Sent: ${post.sentimentScore !== null ? post.sentimentScore.toFixed(1) + "%" : "0%"}`}
                        </div>
                      )}
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
                        className="mt-2 text-xs leading-relaxed text-foreground/90 overflow-auto flex-1"
                        style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}
                      >
                        <span className="break-words">{post.caption}</span>
                      </div>
                    </div>
                  </div>
                )))}
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
            value: postOverview.metrics.brandExposures.value,
            previousValue: postOverview.metrics.brandExposures.previousValue,
            valueDisplay: postOverview.metrics.brandExposures.value.toLocaleString(),
            previousValueDisplay: postOverview.metrics.brandExposures.previousValue.toLocaleString(),
          },
          {
            title: "BRAND IMPRESSIONS",
            value: postOverview.metrics.brandImpressions.value,
            previousValue: postOverview.metrics.brandImpressions.previousValue,
            valueDisplay: formatCompactNumber(postOverview.metrics.brandImpressions.value),
            previousValueDisplay: formatCompactNumber(postOverview.metrics.brandImpressions.previousValue),
          },
          {
            title: "AVERAGE VISIBILITY",
            value: postOverview.metrics.avgVisibility.value,
            previousValue: postOverview.metrics.avgVisibility.previousValue,
            valueDisplay: `${postOverview.metrics.avgVisibility.value.toFixed(1)}%`,
            previousValueDisplay: `${postOverview.metrics.avgVisibility.previousValue.toFixed(1)}%`,
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
            <div className="text-sm text-muted-foreground">{periodLabel}</div>
          </div>
        </div>

        <div className="px-6 pb-6">
          <div className="min-w-0">
              <ChartContainer
                config={trendsConfig}
                className="h-72 w-full"
              >
                <LineChart data={postOverview.trends} margin={{ top: 14, right: 18, left: 10, bottom: 0 }}>
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
                               // Map internal keys to known labels if possible
                               const key = String(item.dataKey) as keyof typeof trendsConfig;
                               const config = trendsConfig[key] || { label: String(item.name || item.dataKey), color: item.stroke };
                               
                               return (
                                 <div key={key} className="flex items-center justify-between gap-4">
                                   <div className="flex items-center gap-2 min-w-0">
                                     <span
                                       className="h-[10px] w-[10px] rounded-[2px] shrink-0"
                                       style={{ backgroundColor: config.color }}
                                       aria-hidden="true"
                                     />
                                     <span className="truncate text-zinc-200">{config.label}</span>
                                   </div>
                                   <span className="text-white font-mono font-medium tabular-nums">
                                     {Number(item.value).toLocaleString()}
                                   </span>
                                 </div>
                               )
                             })}
                          </div>
                        </div>
                      )
                    }}
                  />
                  <XAxis 
                    dataKey="date" 
                    tickLine={false} 
                    axisLine={false} 
                    minTickGap={18}
                    tickFormatter={(value) => {
                       const d = new Date(value);
                       return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                    }}
                  />
                  <YAxis
                    width={44}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => formatCompactNumber(Number(v))}
                  />
                  {activeBrandKeys.map(key => {
                      const config = trendsConfig[key];
                      if (!config) return null;
                      return (
                          <Line 
                            key={key}
                            type="monotone" 
                            dataKey={key} 
                            stroke={config.color} 
                            strokeWidth={2} 
                            dot={false} 
                            isAnimationActive={false} 
                          />
                      )
                  })}
                </LineChart>
              </ChartContainer>
          </div>
          
          {/* Legend */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-5 text-xs text-muted-foreground">
            {activeBrandKeys.map((key) => {
               const config = trendsConfig[key]
               if (!config) return null
               return (
               <div key={key} className="flex items-center gap-2">
                 <div className="h-3 w-3 rounded-full" style={{ backgroundColor: config.color }}></div>
                 <span>{config.label}</span>
               </div>
               )
            })}
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
                    <a
                      href={item.url || "#"}
                      target={item.url ? "_blank" : undefined}
                      rel={item.url ? "noopener noreferrer" : undefined}
                      className={item.url ? "block h-full w-full" : "block h-full w-full pointer-events-none"}
                    >
                      <Image
                        src={item.imageSrc || "/posts/post-template.png"}
                        alt="Missed opportunity post"
                        fill
                        sizes="(min-width: 768px) 220px, 33vw"
                        className="object-cover"
                      />
                    </a>
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
