"use client"

import { useMemo, useState } from "react"
import { Calendar as CalendarIcon, ChevronDown, ChevronRight, Download, Filter } from "lucide-react"
import { GlobalSearch } from "@/components/global-search"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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

export default function BrandingPage() {
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [dateRangeKey, setDateRangeKey] = useState<DateRangeKey>("30")
  
  const defaultEnd = useMemo(() => new Date(), [])
  const defaultStart = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d
  }, [])
  
  const [customStart, setCustomStart] = useState<string>(toIsoDateOnly(defaultStart))
  const [customEnd, setCustomEnd] = useState<string>(toIsoDateOnly(defaultEnd))
  
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [brandDropdownOpen, setBrandDropdownOpen] = useState(false)

  const dateRangeDays = useMemo(() => {
    switch (dateRangeKey) {
      case "7": return 7
      case "30": return 30
      case "90": return 90
      case "365": return 365
      default: return 30
    }
  }, [dateRangeKey])

  const { start, end } = useMemo(() => {
    if (dateRangeKey === "custom") {
      return { start: parseLocalIsoDate(customStart), end: parseLocalIsoDate(customEnd) }
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

  return (
    <main className="max-w-screen-2xl mx-auto px-6 py-8 space-y-6">
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
            className="inline-flex h-9 items-center gap-2 rounded-md border bg-background px-3 text-sm text-foreground hover:bg-accent"
          >
            <Download className="h-4 w-4" />
            <span>Export</span>
          </button>
        </div>
      </div>

      <section>
        <h1 className="text-2xl font-bold font-psv-branding">OVERVIEW</h1>
        <div className="mt-4 space-y-4">
          <Card className="rounded-none shadow-none">
            <CardContent>
              {/* Content will go here */}
            </CardContent>
          </Card>

          <Card className="rounded-none shadow-none">
            <CardHeader className="px-4 pb-2 pt-0">
              <CardTitle className="text-base font-semibold font-psv-branding">SOCIAL MEDIA POSTS</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Social media posts content will go here */}
            </CardContent>
          </Card>

          <div className="grid grid-cols-5 gap-4">
            <Card className="rounded-none shadow-none">
              <CardHeader className="px-4 pb-2 pt-0">
                <CardTitle className="text-base font-semibold font-psv-branding">BRAND IMPRESSIONS</CardTitle>
              </CardHeader>
              <CardContent>
                {/* Content will go here */}
              </CardContent>
            </Card>

            <Card className="rounded-none shadow-none">
              <CardHeader className="px-4 pb-2 pt-0">
                <CardTitle className="text-base font-semibold font-psv-branding">AVERAGE FAN SENTIMENT</CardTitle>
              </CardHeader>
              <CardContent>
                {/* Content will go here */}
              </CardContent>
            </Card>

            <Card className="rounded-none shadow-none">
              <CardHeader className="px-4 pb-2 pt-0">
                <CardTitle className="text-base font-semibold font-psv-branding">AVERAGE VISIBILITY SCORE</CardTitle>
              </CardHeader>
              <CardContent>
                {/* Content will go here */}
              </CardContent>
            </Card>

            <Card className="rounded-none shadow-none">
              <CardHeader className="px-4 pb-2 pt-0">
                <CardTitle className="text-base font-semibold font-psv-branding">BRAND EXPOSURES</CardTitle>
              </CardHeader>
              <CardContent>
                {/* Content will go here */}
              </CardContent>
            </Card>

            <Card className="rounded-none shadow-none">
              <CardHeader className="px-4 pb-2 pt-0">
                <CardTitle className="text-base font-semibold font-psv-branding">EXPOSURES PER POST</CardTitle>
              </CardHeader>
              <CardContent>
                {/* Content will go here */}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-4">
            <Card className="rounded-none shadow-none">
              <CardHeader className="px-4 pb-2 pt-0">
                <CardTitle className="text-base font-semibold font-psv-branding">Efficiency vs. Volume</CardTitle>
              </CardHeader>
              <CardContent>
                {/* Content will go here */}
              </CardContent>
            </Card>

            <Card className="rounded-none shadow-none">
              <CardHeader className="px-4 pb-2 pt-0">
                <CardTitle className="text-base font-semibold font-psv-branding">MISSED OPPORTUNITIES</CardTitle>
              </CardHeader>
              <CardContent>
                {/* Content will go here */}
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section>
            <button
              type="button"
              onClick={() => setDropdownOpen((prev: boolean) => !prev)}
              className="flex items-center gap-2 group"
              aria-expanded={dropdownOpen}
              aria-controls="dropdown-panel"
            >
              <h2 className="text-xl font-bold font-psv-branding">COMPARE</h2>
              {dropdownOpen ? (
                <ChevronDown className="h-5 w-5 text-[#2D9E3F] transition-colors duration-200" />
              ) : (
                <ChevronRight className="h-5 w-5 text-muted-foreground transition-colors duration-200" />
              )}
            </button>
            {dropdownOpen && (
              <div id="dropdown-panel" className="space-y-4 mt-4">
                <Card className="rounded-none shadow-none">
                  <CardContent>
                    {/* Content will go here */}
                  </CardContent>
                </Card>

                <div className="grid grid-cols-3 gap-4">
                  <Card className="rounded-none shadow-none">
                    <CardHeader className="px-4 pb-2 pt-0">
                      <CardTitle className="text-base font-semibold font-psv-branding">VISIBILITY SHARE</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {/* Brand growth content will go here */}
                    </CardContent>
                  </Card>

                  <Card className="rounded-none shadow-none">
                    <CardHeader className="px-4 pb-2 pt-0">
                      <CardTitle className="text-base font-semibold font-psv-branding">TREND GAP</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {/* Engagement rate content will go here */}
                    </CardContent>
                  </Card>

                  <Card className="rounded-none shadow-none">
                    <CardHeader className="px-4 pb-2 pt-0">
                      <CardTitle className="text-base font-semibold font-psv-branding">EXPOSURE QUALITY RADAR</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {/* Reach analysis content will go here */}
                    </CardContent>
                  </Card>
                </div>

                <Card className="rounded-none shadow-none">
                  <CardHeader className="px-4 pb-2 pt-0">
                    <CardTitle className="text-base font-semibold font-psv-branding">TREND GAP</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {/* Trend gap content will go here */}
                  </CardContent>
                </Card>
              </div>
            )}
          </section>

          <section>
            <button
              type="button"
              onClick={() => setBrandDropdownOpen((prev: boolean) => !prev)}
              className="flex items-center gap-2 group"
              aria-expanded={brandDropdownOpen}
              aria-controls="brand-dropdown-panel"
            >
              <h2 className="text-xl font-bold font-psv-branding">BRAND</h2>
              {brandDropdownOpen ? (
                <ChevronDown className="h-5 w-5 text-[#2D9E3F] transition-colors duration-200" />
              ) : (
                <ChevronRight className="h-5 w-5 text-muted-foreground transition-colors duration-200" />
              )}
            </button>
            {brandDropdownOpen && (
              <div id="brand-dropdown-panel" className="space-y-4 mt-4">
                <Card className="rounded-none shadow-none">
                  <CardContent>
                    {/* Content will go here */}
                  </CardContent>
                </Card>

                <Card className="rounded-none shadow-none">
                  <CardHeader className="px-4 pb-2 pt-0">
                    <CardTitle className="text-base font-semibold font-psv-branding">BEST EXPOSURES</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {/* Best exposures content will go here */}
                  </CardContent>
                </Card>

                <div className="grid grid-cols-3 gap-4">
                  <Card className="rounded-none shadow-none">
                    <CardHeader className="px-4 pb-2 pt-0">
                      <CardTitle className="text-base font-semibold font-psv-branding">ESTIMATED AMOUNT OF IMPRESSIONS</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {/* Estimated amount of impressions content will go here */}
                    </CardContent>
                  </Card>

                  <Card className="rounded-none shadow-none">
                    <CardHeader className="px-4 pb-2 pt-0">
                      <CardTitle className="text-base font-semibold font-psv-branding">AVERAGE FAN SENTIMENT</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {/* Average fan sentiment content will go here */}
                    </CardContent>
                  </Card>

                  <Card className="rounded-none shadow-none">
                    <CardHeader className="px-4 pb-2 pt-0">
                      <CardTitle className="text-base font-semibold font-psv-branding">ESTIMATED MEDIA VALUE</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {/* Estimated media value content will go here */}
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <Card className="rounded-none shadow-none">
                    <CardHeader className="px-4 pb-2 pt-0">
                      <CardTitle className="text-base font-semibold font-psv-branding">visibility share</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {/* Content will go here */}
                    </CardContent>
                  </Card>

                  <Card className="rounded-none shadow-none">
                    <CardHeader className="px-4 pb-2 pt-0">
                      <CardTitle className="text-base font-semibold font-psv-branding">EXPOSURE QUALITY RADAR</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {/* Content will go here */}
                    </CardContent>
                  </Card>

                  <Card className="rounded-none shadow-none">
                    <CardHeader className="px-4 pb-2 pt-0">
                      <CardTitle className="text-base font-semibold font-psv-branding">APPEARANCE HEATMAP</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {/* Content will go here */}
                    </CardContent>
                  </Card>

                  <Card className="rounded-none shadow-none">
                    <CardHeader className="px-4 pb-2 pt-0">
                      <CardTitle className="text-base font-semibold font-psv-branding">CUMULATIVE IMPACT</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {/* Content will go here */}
                    </CardContent>
                  </Card>

                  <Card className="rounded-none shadow-none">
                    <CardHeader className="px-4 pb-2 pt-0">
                      <CardTitle className="text-base font-semibold font-psv-branding">VISIBILITY OVER TIME</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {/* Content will go here */}
                    </CardContent>
                  </Card>
                </div>

                <Card className="rounded-none shadow-none">
                  <CardHeader className="px-4 pb-2 pt-0">
                    <CardTitle className="text-base font-semibold font-psv-branding">EFFICIENCY VS. VOLUME</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {/* Content will go here */}
                  </CardContent>
                </Card>
              </div>
            )}
          </section>
    </main>
  )
}
