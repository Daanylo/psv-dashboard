"use client"

import { useMemo, useState } from "react"
import { Calendar as CalendarIcon, ChevronDown, ChevronRight, Download, Filter } from "lucide-react"
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
  const [search, setSearch] = useState("")
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [dateRangeKey, setDateRangeKey] = useState<DateRangeKey>("30")
  const [customStart, setCustomStart] = useState<Date | undefined>()
  const [customEnd, setCustomEnd] = useState<Date | undefined>()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [brandDropdownOpen, setBrandDropdownOpen] = useState(false)

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

  const dateRangeLabel = useMemo(
    () => `${formatShortDate(start)} - ${formatShortDate(end)}`,
    [start, end]
  )

  const periodLabel = useMemo(() => {
    if (dateRangeKey === "custom") return "Custom Range"
    const labels: Record<string, string> = {
      "7": "Last 7 days",
      "30": "Last 30 days",
      "90": "Last 3 months",
      "365": "Last year",
    }
    return labels[dateRangeKey] || "Select period"
  }, [dateRangeKey])

  return (
    <main className="max-w-screen-2xl mx-auto px-6 py-8 space-y-6">
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
                  <SelectItem value="90">Last 3 months</SelectItem>
                  <SelectItem value="365">Last year</SelectItem>
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
