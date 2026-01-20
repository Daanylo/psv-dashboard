"use client"

import Image from "next/image"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { ArrowRight, Calendar as CalendarIcon, Download, Filter } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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

function getRatingBadgeClass(rating: number) {
  if (rating < 6) return "bg-red-500"
  if (rating < 8) return "bg-orange-400"
  return "bg-green-500"
}

function formatCompactNumber(value: number) {
  const abs = Math.abs(value)
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return `${Math.round(value)}`
}

function splitName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length <= 1) return { first: name, last: "" }
  return { first: parts.slice(0, -1).join(" "), last: parts[parts.length - 1] }
}

function getClubLogoSrc(teamName: string) {
  const key = teamName.toLowerCase()
  if (key.includes("ajax")) return "/club-logos/Logo_AFC_Ajax_(1928-1991,_2025-).png"
  if (key.includes("feyenoord")) return "/club-logos/Feyenoord_logo.svg.png"
  if (key.includes("utrecht")) return "/club-logos/Logo_FC_Utrecht.svg.png"
  if (key.includes("twente")) return "/club-logos/fc-twente-logo-png-transparent.png"
  if (key.includes("az")) return "/club-logos/AZ_Alkmaar.svg.png"
  return null
}

function ClubLogo({ teamName }: { teamName: string }) {
  const src = getClubLogoSrc(teamName)
  if (!src) {
    const initials = teamName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("")
    return (
      <div className="flex h-[35px] w-[35px] items-center justify-center rounded-full bg-white/15 text-xs font-semibold">
        {initials || "?"}
      </div>
    )
  }

  return <Image src={src} alt={teamName} width={35} height={35} />
}

function PlayerHeroImage({ shirtNumber, name }: { shirtNumber: number | null; name: string }) {
  const initialSrc = shirtNumber ? `/player_images/${shirtNumber}.png` : "/player_images/no_image.png"
  const [src, setSrc] = useState(initialSrc)

  useEffect(() => {
    setSrc(initialSrc)
  }, [initialSrc])

  return (
    <Image
      src={src}
      alt={name}
      width={240}
      height={480}
      className="h-full w-auto object-contain object-bottom"
      onError={() => setSrc("/player_images/no_image.png")}
    />
  )
}

function PlayerTinyImage({ shirtNumber, name }: { shirtNumber: number | null; name: string }) {
  const initialSrc = shirtNumber ? `/player_images/${shirtNumber}.png` : "/player_images/no_image.png"
  const [src, setSrc] = useState(initialSrc)

  useEffect(() => {
    setSrc(initialSrc)
  }, [initialSrc])

  return (
    <Image
      src={src}
      alt={name}
      width={64}
      height={128}
      className="h-6 w-auto object-contain object-bottom"
      onError={() => setSrc("/player_images/no_image.png")}
    />
  )
}

type MatchListItem = {
  id: number
  homeTeamName: string
  awayTeamName: string
  scoreStr: string | null
  tournamentName: string | null
  matchUtcTime: string | null
  finished: boolean
}

type EventReport = {
  match: MatchListItem
  hero: {
    best: null | {
      fotmobId: number
      name: string
      shirtNumber: number | null
      rating: number
      minutes: number
    }
    worst: null | {
      fotmobId: number
      name: string
      shirtNumber: number | null
      rating: number
      minutes: number
    }
  }
  metrics: {
    sentiment: {
      total: number
      pos: number
      neg: number
      neu: number
      net: number
      netDeltaVsPrevWeek: number
      commentCount: number
      likesSum: number
    }
    impressions: {
      total: number
      postCount: number
      topPosts: Array<{
        id: string
        shortcode: string | null
        url: string | null
        imageUrl: string
        impressions: number
      }>
    }
    topics: Array<{ topic: string; count: number }>
    playerSentimentVsRating: Array<{
      fotmobId: number
      name: string
      shirtNumber: number | null
      rating: number
      mentions: number
      positivePct: number
      negativePct: number
      diff: number
    }>
  }
}

export default function EventsPage() {
  const [search, setSearch] = useState("")
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [dateRangeKey, setDateRangeKey] = useState<DateRangeKey>("30")
  const [matches, setMatches] = useState<MatchListItem[]>([])
  const [matchesLoading, setMatchesLoading] = useState(false)
  const [matchesError, setMatchesError] = useState<string | null>(null)
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null)
  const [report, setReport] = useState<EventReport | null>(null)
  const [reportLoading, setReportLoading] = useState(false)
  const [reportError, setReportError] = useState<string | null>(null)
  
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
    let cancelled = false

    async function run() {
      setMatchesLoading(true)
      setMatchesError(null)

      try {
        const startStr = toIsoDateOnly(start)
        const endStr = toIsoDateOnly(end)
        const res = await fetch(`/api/new/events/matches?start=${startStr}&end=${endStr}`, {
          cache: "no-store",
        })

        if (!res.ok) {
          throw new Error(`Failed to load matches (${res.status})`)
        }

        const data = (await res.json()) as { matches: MatchListItem[] }
        if (cancelled) return

        setMatches(data.matches ?? [])
        const finished = (data.matches ?? []).filter((m) => m.finished && m.matchUtcTime)
        const pick = finished.length
          ? finished[finished.length - 1]
          : (data.matches ?? []).filter((m) => m.matchUtcTime).slice(-1)[0] ?? null

        setSelectedMatchId((prev) => {
          if (prev && (data.matches ?? []).some((m) => m.id === prev)) return prev
          return pick ? pick.id : null
        })
      } catch (e) {
        if (cancelled) return
        setMatches([])
        setSelectedMatchId(null)
        setMatchesError(e instanceof Error ? e.message : "Failed to load matches")
      } finally {
        if (!cancelled) setMatchesLoading(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [start, end])

  useEffect(() => {
    let cancelled = false
    if (!selectedMatchId) {
      setReport(null)
      return
    }

    async function run() {
      setReportLoading(true)
      setReportError(null)

      try {
        const res = await fetch(`/api/new/events/report?match_id=${selectedMatchId}`, { cache: "no-store" })
        if (!res.ok) {
          throw new Error(`Failed to load report (${res.status})`)
        }
        const data = (await res.json()) as EventReport
        if (cancelled) return
        setReport(data)
      } catch (e) {
        if (cancelled) return
        setReport(null)
        setReportError(e instanceof Error ? e.message : "Failed to load report")
      } finally {
        if (!cancelled) setReportLoading(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [selectedMatchId])

  const selectedMatch = useMemo(() => {
    if (report?.match) return report.match
    return matches.find((m) => m.id === selectedMatchId) ?? null
  }, [matches, report, selectedMatchId])

  const recentEventDateLabel = useMemo(() => {
    const t = selectedMatch?.matchUtcTime
    if (!t) return formatShortDate(end)
    const d = new Date(t)
    if (Number.isNaN(d.getTime())) return formatShortDate(end)
    return formatShortDate(d)
  }, [end, selectedMatch?.matchUtcTime])

  const matchTitle = useMemo(() => {
    if (!selectedMatch) return "Recent event"
    return `${selectedMatch.homeTeamName} vs ${selectedMatch.awayTeamName}`
  }, [selectedMatch])

  const matchScore = useMemo(() => {
    return selectedMatch?.scoreStr || "—"
  }, [selectedMatch])

  const filteredMatches = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return matches
    return matches.filter((m) => {
      const hay = `${m.homeTeamName} ${m.awayTeamName} ${m.tournamentName ?? ""} ${m.scoreStr ?? ""}`.toLowerCase()
      return hay.includes(q)
    })
  }, [matches, search])

  const best = report?.hero.best ?? null
  const worst = report?.hero.worst ?? null
  const bestName = best ? splitName(best.name) : { first: "—", last: "" }
  const worstName = worst ? splitName(worst.name) : { first: "—", last: "" }
  const bestRating = best?.rating ?? 0
  const worstRating = worst?.rating ?? 0
  const sentiment = report?.metrics.sentiment
  const impressions = report?.metrics.impressions
  const netPct = sentiment ? sentiment.net * 100 : 0

  return (
    <main className="max-w-screen-xl mx-auto px-6 py-8">
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
              <span>{selectedMatch ? "Match" : "Filter"}</span>
            </button>

            {isFilterOpen ? (
              <div
                role="menu"
                className="bg-popover text-popover-foreground absolute right-0 top-full z-50 mt-2 w-56 rounded-md border p-2 text-sm shadow-md"
              >
                <div className="px-2 py-1.5 text-muted-foreground">Matches</div>
                {matchesLoading ? (
                  <div className="px-2 py-1.5 text-muted-foreground">Loading...</div>
                ) : matchesError ? (
                  <div className="px-2 py-1.5 text-red-500">{matchesError}</div>
                ) : filteredMatches.length ? (
                  <div className="max-h-[280px] overflow-auto">
                    {filteredMatches
                      .slice()
                      .reverse()
                      .map((m) => {
                        const isSelected = m.id === selectedMatchId
                        const dateLabel = m.matchUtcTime ? formatShortDate(new Date(m.matchUtcTime)) : ""
                        const label = `${m.homeTeamName} - ${m.awayTeamName}`
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => {
                              setSelectedMatchId(m.id)
                              setIsFilterOpen(false)
                            }}
                            className={
                              "flex w-full flex-col gap-0.5 rounded-md px-2 py-2 text-left transition hover:bg-accent " +
                              (isSelected ? "bg-accent" : "")
                            }
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="truncate">{label}</div>
                              <div className="text-xs text-muted-foreground">{m.scoreStr ?? ""}</div>
                            </div>
                            <div className="text-xs text-muted-foreground truncate">{dateLabel}</div>
                          </button>
                        )
                      })}
                  </div>
                ) : (
                  <div className="px-2 py-1.5 text-muted-foreground">No matches found</div>
                )}
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
          "relative mt-6 h-[150px] overflow-hidden" +
          " before:absolute before:inset-0 before:z-0 before:bg-black" +
          " before:[clip-path:polygon(0_0,100%_0,calc(100%_-_12px)_100%,0_100%)]"
        }
      >
        <div className="relative z-10 flex h-full flex-nowrap items-stretch justify-between px-6 text-white">
          <div className="flex flex-none flex-col justify-center">
            <div className="flex items-baseline gap-2 justify-between">
              <div className="text-sm">{matchTitle}</div>
              <div className="text-sm text-white/80">{recentEventDateLabel}</div>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <ClubLogo teamName={selectedMatch?.homeTeamName ?? "Home"} />
              <div className="text-3xl font-psv-branding italic">{matchScore}</div>
              <ClubLogo teamName={selectedMatch?.awayTeamName ?? "Away"} />
            </div>
          </div>

          <div className="flex h-full flex-none items-center gap-4">
            <div className="self-end h-full pt-4">
              <PlayerHeroImage shirtNumber={best?.shirtNumber ?? null} name={best?.name ?? "Best performance"} />
            </div>

            <div className="flex flex-none items-start gap-3">
              <div>
                <div className="text-sm">Best performance</div>
                <div className="flex items-center gap-2">
                  <div>
                    <div className="mt-1 text-xs text-white">{bestName.first}</div>
                    <div className="font-psv-branding italic text-3xl leading-none">{bestName.last || ""}</div>
                  </div>
                  <div
                    className={
                      "inline-flex h-5 items-center rounded-md px-2 text-xs font-semibold text-black " +
                      getRatingBadgeClass(bestRating || 0)
                    }
                  >
                    {bestRating ? bestRating.toFixed(1) : "—"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex h-full flex-none items-center gap-4 ">
            <div className="self-end h-full pt-4">
              <PlayerHeroImage shirtNumber={worst?.shirtNumber ?? null} name={worst?.name ?? "Worst performance"} />
            </div>

            <div className="flex flex-none items-start gap-3">
              <div>
                <div className="text-sm">Worst performance</div>
                <div className="flex items-center gap-2">
                  <div>
                    <div className="mt-1 text-xs text-white">{worstName.first}</div>
                    <div className="font-psv-branding italic text-3xl leading-none">{worstName.last || ""}</div>
                  </div>
                  <div
                    className={
                      "inline-flex h-5 items-center rounded-md px-2 text-xs font-semibold text-black " +
                      getRatingBadgeClass(worstRating || 0)
                    }
                  >
                    {worstRating ? worstRating.toFixed(1) : "—"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-none items-center justify-end px-4">
            <Link
              href="/commercial-hub"
              className="inline-flex h-10 items-center gap-2 rounded-md bg-white px-4 text-sm text-black"
            >
              <ArrowRight className="h-4 w-4" />
              <span>View impact</span>
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-6 grid w-full grid-cols-1 gap-6 md:grid-cols-3">
        <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-background">
          <div className="px-6 pt-6 pb-4">
            <div className="flex items-baseline justify-between gap-3">
              <div className="text-base font-semibold font-psv-branding">SENTIMENT &amp; ENGAGEMENT</div>
              <div className="text-sm text-muted-foreground">Match window</div>
            </div>
          </div>

          <div className="border-t border-border px-6 py-4">
            {reportLoading ? (
              <div className="text-sm text-muted-foreground">Loading...</div>
            ) : reportError ? (
              <div className="text-sm text-red-500">{reportError}</div>
            ) : sentiment ? (
              <div className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <div className="text-2xl font-semibold tabular-nums">{netPct.toFixed(0)}%</div>
                  <div className="text-xs text-muted-foreground">Net sentiment</div>
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground">Positive</div>
                    <div className="tabular-nums">{sentiment.total ? ((sentiment.pos / sentiment.total) * 100).toFixed(0) : "0"}%</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Negative</div>
                    <div className="tabular-nums">{sentiment.total ? ((sentiment.neg / sentiment.total) * 100).toFixed(0) : "0"}%</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Neutral</div>
                    <div className="tabular-nums">{sentiment.total ? ((sentiment.neu / sentiment.total) * 100).toFixed(0) : "0"}%</div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground">Comments</div>
                    <div className="tabular-nums">{formatCompactNumber(sentiment.commentCount)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Likes</div>
                    <div className="tabular-nums">{formatCompactNumber(sentiment.likesSum)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Volume</div>
                    <div className="tabular-nums">{formatCompactNumber(sentiment.total)}</div>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  Δ vs prev week: {(sentiment.netDeltaVsPrevWeek * 100).toFixed(0)}%
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No data</div>
            )}
          </div>
        </div>

        <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-background">
          <div className="px-6 pt-6 pb-4">
            <div className="flex items-baseline justify-between gap-3">
              <div className="text-base font-semibold font-psv-branding">IMPRESSIONS</div>
              <div className="text-sm text-muted-foreground">Match window</div>
            </div>
          </div>

          <div className="border-t border-border px-6 py-4">
            {reportLoading ? (
              <div className="text-sm text-muted-foreground">Loading...</div>
            ) : reportError ? (
              <div className="text-sm text-red-500">{reportError}</div>
            ) : impressions ? (
              <div className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <div className="text-2xl font-semibold tabular-nums">{formatCompactNumber(impressions.total)}</div>
                  <div className="text-xs text-muted-foreground">Total impressions</div>
                </div>
                <div className="text-sm text-muted-foreground">Posts: {impressions.postCount}</div>
                {impressions.topPosts.length ? (
                  <div className="grid grid-cols-3 gap-2">
                    {impressions.topPosts.map((p) => (
                      <a
                        key={p.id}
                        href={p.url ?? (p.shortcode ? `https://www.instagram.com/p/${p.shortcode}/` : "#")}
                        target="_blank"
                        rel="noreferrer"
                        className="group relative overflow-hidden rounded-md border border-border"
                      >
                        <img src={p.imageUrl} alt="Top post" className="h-20 w-full object-cover" />
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1 text-[10px] text-white">
                          {formatCompactNumber(p.impressions)}
                        </div>
                      </a>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">No posts in window</div>
                )}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No data</div>
            )}
          </div>
        </div>

        <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-background">
          <div className="px-6 pt-6 pb-4">
            <div className="flex items-baseline justify-between gap-3">
              <div className="text-base font-semibold font-psv-branding">TOP TOPICS</div>
              <div className="text-sm text-muted-foreground">Match window</div>
            </div>
          </div>

          <div className="border-t border-border px-6 py-4">
            {reportLoading ? (
              <div className="text-sm text-muted-foreground">Loading...</div>
            ) : reportError ? (
              <div className="text-sm text-red-500">{reportError}</div>
            ) : report?.metrics.topics?.length ? (
              <div className="space-y-2">
                {report.metrics.topics.map((t) => (
                  <div key={t.topic} className="flex items-center justify-between gap-4 text-sm">
                    <div className="truncate">{t.topic}</div>
                    <div className="text-muted-foreground tabular-nums">{t.count}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No topics</div>
            )}
          </div>
        </div>
      </section>

      <section className="mt-6 flex flex-col overflow-hidden rounded-xl border border-border bg-background">
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <div className="text-base font-semibold font-psv-branding">RATING VS SENTIMENT ANOMALIES</div>
              <div className="text-sm text-muted-foreground">Mismatch between match rating and comment sentiment</div>
            </div>
            <div className="text-sm text-muted-foreground">{periodLabel}</div>
          </div>
        </div>

        {reportLoading ? (
          <div className="border-t border-border px-6 py-6 text-sm text-muted-foreground">Loading...</div>
        ) : reportError ? (
          <div className="border-t border-border px-6 py-6 text-sm text-red-500">{reportError}</div>
        ) : report?.metrics.playerSentimentVsRating?.length ? (
          <div className="border-t border-border overflow-x-auto">
            <table className="w-full table-fixed text-sm">
              <thead>
                <tr>
                  <th className="sticky top-0 z-10 bg-muted px-6 py-2 text-left font-semibold text-muted-foreground">PLAYER</th>
                  <th className="sticky top-0 z-10 w-24 bg-muted px-6 py-2 text-right font-semibold text-muted-foreground">RATING</th>
                  <th className="sticky top-0 z-10 w-24 bg-muted px-6 py-2 text-right font-semibold text-muted-foreground">MENTIONS</th>
                  <th className="sticky top-0 z-10 w-24 bg-muted px-6 py-2 text-right font-semibold text-muted-foreground">POS</th>
                  <th className="sticky top-0 z-10 w-24 bg-muted px-6 py-2 text-right font-semibold text-muted-foreground">NEG</th>
                  <th className="sticky top-0 z-10 w-28 bg-muted px-6 py-2 text-right font-semibold text-muted-foreground">MISMATCH</th>
                </tr>
              </thead>
              <tbody>
                {report.metrics.playerSentimentVsRating.map((row, index) => {
                  const mismatch = row.diff
                  const mismatchLabel = `${mismatch >= 0 ? "+" : ""}${(mismatch * 100).toFixed(0)}%`
                  return (
                    <tr key={row.fotmobId} className={index % 2 === 0 ? "bg-background" : "bg-muted"}>
                      <td className="px-6 py-2">
                        <div className="flex items-center gap-3">
                          <PlayerTinyImage shirtNumber={row.shirtNumber} name={row.name} />
                          <div className="truncate">{row.name}</div>
                        </div>
                      </td>
                      <td className="px-6 py-2 text-right">
                        <span className={"inline-flex h-5 items-center rounded-md px-2 text-xs font-semibold text-black " + getRatingBadgeClass(row.rating)}>
                          {row.rating.toFixed(1)}
                        </span>
                      </td>
                      <td className="px-6 py-2 text-right text-muted-foreground tabular-nums">{row.mentions}</td>
                      <td className="px-6 py-2 text-right text-muted-foreground tabular-nums">{row.positivePct.toFixed(0)}%</td>
                      <td className="px-6 py-2 text-right text-muted-foreground tabular-nums">{row.negativePct.toFixed(0)}%</td>
                      <td className="px-6 py-2 text-right">
                        <span className={mismatch >= 0 ? "text-green-600" : "text-red-500"}>{mismatchLabel}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="border-t border-border px-6 py-6 text-sm text-muted-foreground">Not enough mention volume for anomalies</div>
        )}
      </section>
    </main>
  )
}
