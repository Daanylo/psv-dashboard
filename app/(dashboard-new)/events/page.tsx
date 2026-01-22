"use client"

import Image from "next/image"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  Activity,
  ArrowRight,
  ArrowUpDown,
  Camera,
  Download,
  FileText,
  Filter,
  Heart,
  MessageCircle,
  MessageSquareText,
  Minus,
  Smile,
  Star,
  ThumbsDown,
  ThumbsUp,
  Users,
} from "lucide-react"
import { Separator } from "@/components/ui/separator"
import { PlayerLink } from "@/components/player-link"
import { GlobalSearch } from "@/components/global-search"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { exportNodeToPdf } from "@/lib/export-pdf"

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

function getFotmobTeamLogoUrl(teamId: number) {
  return `/api/fotmob/teamlogo/${teamId}`
}

function toIsoDateOnly(date: Date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
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

function ClubLogo({ teamId, teamName }: { teamId: number | null | undefined; teamName: string }) {
  const [broken, setBroken] = useState(false)

  useEffect(() => {
    setBroken(false)
  }, [teamId])

  const initials = useMemo(() => {
    return teamName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("")
  }, [teamName])

  if (!teamId || broken) {
    return (
      <div className="flex h-[35px] w-[35px] items-center justify-center rounded-full bg-white/15 text-xs font-semibold">
        {initials || "?"}
      </div>
    )
  }

  return (
    <Image
      src={getFotmobTeamLogoUrl(teamId)}
      alt={teamName}
      width={35}
      height={35}
      onError={() => setBroken(true)}
    />
  )
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
  homeTeamId: number
  homeTeamName: string
  awayTeamId: number
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
      engagement: number
      sentimentScorePct: number
      topPosts: Array<{
        id: string
        shortcode: string | null
        url: string | null
        imageUrl: string
        impressions: number
        takenAtTimestamp: number | null
        caption: string
        likes: number
        comments: number
      }>
    }
    topics: Array<{ topic: string; count: number }>
    playerSentimentVsRating: Array<{
      fotmobId: number
      name: string
      shirtNumber: number | null
      position: string | null
      rating: number
      mentions: number
      positivePct: number
      neutralPct: number
      negativePct: number
      diff: number
    }>
    playerMentionComments: Array<{
      id: string
      text: string
      likes: number
      sentiment: string
      date: string
      playerMentioned?: string | null
      postUrl?: string
      matchId?: number
      matchTitle?: string
    }>
  }
}

export default function EventsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const mainRef = useRef<HTMLElement>(null)

  const [matchSearch, setMatchSearch] = useState("")
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [matches, setMatches] = useState<MatchListItem[]>([])
  const [matchesLoading, setMatchesLoading] = useState(false)
  const [matchesError, setMatchesError] = useState<string | null>(null)
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null)
  const [report, setReport] = useState<EventReport | null>(null)
  const [reportLoading, setReportLoading] = useState(false)
  const [reportError, setReportError] = useState<string | null>(null)

  const [playerSortCol, setPlayerSortCol] = useState<"mentions" | "positivePct" | "rating" | "mismatch">("mentions")
  const [playerSortDir] = useState<"asc" | "desc">("desc")
  const [playerPositionFilter, setPlayerPositionFilter] = useState<string>("all")

  const [commentsSort, setCommentsSort] = useState<"likes" | "time">("likes")
  const [commentsSentiment, setCommentsSentiment] = useState<"all" | "positive" | "neutral" | "negative">("all")

  const urlMatchId = useMemo(() => {
    const raw = searchParams.get("match_id")
    if (!raw) return null
    const parsed = Number(raw)
    if (!Number.isFinite(parsed)) return null
    return parsed
  }, [searchParams])

  const end = useMemo(() => new Date(), [])
  const start = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - 365)
    return d
  }, [])

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
    if (!urlMatchId) return
    setSelectedMatchId((prev) => (prev === urlMatchId ? prev : urlMatchId))
  }, [urlMatchId])

  useEffect(() => {
    if (!selectedMatchId) return
    const current = searchParams.get("match_id")
    if (current === String(selectedMatchId)) return

    const params = new URLSearchParams(searchParams.toString())
    params.set("match_id", String(selectedMatchId))
    router.replace(`/events?${params.toString()}`)
  }, [router, searchParams, selectedMatchId])

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
        const url = new URL("/api/new/events/report", window.location.origin)
        url.searchParams.set("match_id", String(selectedMatchId))
        url.searchParams.set("sort", commentsSort)
        url.searchParams.set("sentiment", commentsSentiment)

        const res = await fetch(url.toString(), { cache: "no-store" })
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
  }, [selectedMatchId, commentsSort, commentsSentiment])

  useEffect(() => {
    if (!report?.match) return
    setMatches((prev) => {
      if (prev.some((m) => m.id === report.match.id)) return prev
      return [...prev, report.match]
    })
  }, [report?.match])

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
    const q = matchSearch.trim().toLowerCase()
    if (!q) return matches
    return matches.filter((m) => {
      const hay = `${m.homeTeamName} ${m.awayTeamName} ${m.tournamentName ?? ""} ${m.scoreStr ?? ""}`.toLowerCase()
      return hay.includes(q)
    })
  }, [matches, matchSearch])

  const best = report?.hero.best ?? null
  const worst = report?.hero.worst ?? null
  const bestName = best ? splitName(best.name) : { first: "—", last: "" }
  const worstName = worst ? splitName(worst.name) : { first: "—", last: "" }
  const bestRating = best?.rating ?? 0
  const worstRating = worst?.rating ?? 0
  const sentiment = report?.metrics.sentiment
  const impressions = report?.metrics.impressions
  const commentsData = report?.metrics.playerMentionComments ?? []

  const sortedAndFilteredPlayers = useMemo(() => {
    let list = report?.metrics.playerSentimentVsRating ?? []

    if (playerPositionFilter !== "all") {
      list = list.filter((p) => {
        if (!p.position) return false
        const pos = p.position.toLowerCase()
        if (playerPositionFilter === "gk") return pos.includes("goalkeeper") || pos.includes("keeper") || pos.includes("gk")
        if (playerPositionFilter === "def") return pos.includes("defender") || pos.includes("def")
        if (playerPositionFilter === "mid") return pos.includes("midfielder") || pos.includes("mid")
        if (playerPositionFilter === "att") return pos.includes("attacker") || pos.includes("forward") || pos.includes("striker") || pos.includes("wing")
        return true
      })
    }

    list = [...list].sort((a, b) => {
      let valA = 0
      let valB = 0

      switch (playerSortCol) {
        case "mentions":
          valA = a.mentions
          valB = b.mentions
          break
        case "positivePct":
          valA = a.positivePct
          valB = b.positivePct
          break
        case "rating":
          valA = a.rating
          valB = b.rating
          break
        case "mismatch":
          valA = Math.abs(a.diff)
          valB = Math.abs(b.diff)
          break
      }

      return playerSortDir === "asc" ? valA - valB : valB - valA
    })

    return list.map((p, i) => ({ ...p, rank: i + 1 }))
  }, [report, playerPositionFilter, playerSortCol, playerSortDir])

  return (
    <main ref={mainRef} className="max-w-screen-xl mx-auto px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="max-w-[300px] flex-1">
          <GlobalSearch />
        </div>

        <div className="flex items-center gap-2">
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
                <div className="px-2 pb-1.5">
                  <input
                    value={matchSearch}
                    onChange={(e) => setMatchSearch(e.target.value)}
                    placeholder="Search matches…"
                    className="border-input placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 dark:hover:bg-input/50 h-8 w-full rounded-md border bg-transparent px-2 text-xs outline-none focus:border-primary"
                  />
                </div>
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
                              <div className="flex items-center gap-2">
                                <div className="h-[24px] w-[24px]">
                                  <ClubLogo teamId={m.homeTeamId ?? null} teamName={m.homeTeamName} />
                                </div>
                                <div className="text-xs text-muted-foreground tabular-nums">{m.scoreStr ?? ""}</div>
                                <div className="h-[24px] w-[24px]">
                                  <ClubLogo teamId={m.awayTeamId ?? null} teamName={m.awayTeamName} />
                                </div>
                              </div>
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
            onClick={async () => {
              if (!mainRef.current) return
              await exportNodeToPdf(mainRef.current, "events.pdf")
            }}
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
        <div className="relative z-10 flex h-full flex-nowrap items-stretch justify-start gap-20 px-6 pr-12 text-white">
          <div className="flex flex-none flex-col justify-center">
            <div className="flex items-baseline gap-2 justify-between">
              <div className="text-sm">Match</div>
              <div className="text-sm text-white/80">{recentEventDateLabel}</div>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <ClubLogo teamId={selectedMatch?.homeTeamId ?? null} teamName={selectedMatch?.homeTeamName ?? "Home"} />
              <div className="text-3xl font-psv-branding italic">{matchScore}</div>
              <ClubLogo teamId={selectedMatch?.awayTeamId ?? null} teamName={selectedMatch?.awayTeamName ?? "Away"} />
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
                    <PlayerLink playerId={best?.fotmobId} className="block">
                      <div className="mt-1 text-xs text-white">{bestName.first}</div>
                      <div className="font-psv-branding italic text-3xl leading-none">{bestName.last || ""}</div>
                    </PlayerLink>
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
                    <PlayerLink playerId={worst?.fotmobId} className="block">
                      <div className="mt-1 text-xs text-white">{worstName.first}</div>
                      <div className="font-psv-branding italic text-3xl leading-none">{worstName.last || ""}</div>
                    </PlayerLink>
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
        </div>
      </section>

      <section className="mt-6">
        {reportLoading ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : reportError ? (
          <div className="text-sm text-red-500">{reportError}</div>
        ) : (
          <>
            {impressions ? (
              <div className="w-full max-h-[500px] rounded-xl border border-border bg-background overflow-hidden flex flex-col">
                <div className="flex items-center justify-between gap-3 px-6 py-4">
                  <div className="flex items-center gap-2 text-base font-semibold font-psv-branding">
                    <FileText className="h-4 w-4" />
                    <span>POST OVERVIEW</span>
                  </div>
                  <div className="text-sm text-muted-foreground">{recentEventDateLabel}</div>
                </div>

                <div className="px-6 pb-6 flex-1 min-h-0">
                  <div className="grid h-full min-h-0 grid-cols-1 gap-6 md:grid-cols-[2fr_1px_1fr]">
                    <div className="grid h-full min-h-0 auto-rows-fr grid-cols-1 gap-3 sm:grid-cols-3">
                      {impressions.topPosts.length ? (
                        impressions.topPosts.map((p) => {
                          const href = p.url ?? (p.shortcode ? `https://www.instagram.com/p/${p.shortcode}/` : "#")
                          const clickable = Boolean(p.url || p.shortcode)
                          const dateLabel = p.takenAtTimestamp ? formatShortDate(new Date(p.takenAtTimestamp * 1000)) : ""

                          return (
                            <div
                              key={p.id}
                              className={
                                "flex h-full min-h-0 flex-col overflow-hidden bg-background " +
                                (clickable ? "" : "opacity-80")
                              }
                            >
                              <div className="relative w-full flex-1 min-h-0">
                                <a
                                  href={href}
                                  target={clickable ? "_blank" : undefined}
                                  rel={clickable ? "noopener noreferrer" : undefined}
                                  className={clickable ? "block h-full w-full" : "block h-full w-full pointer-events-none"}
                                >
                                  <Image
                                    src={p.imageUrl || "/posts/post-template.png"}
                                    alt="Post"
                                    fill
                                    sizes="(min-width: 1024px) 260px, (min-width: 640px) 33vw, 100vw"
                                    className="object-cover"
                                  />
                                </a>
                                <div className="absolute top-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm tracking-tight tabular-nums">
                                  {`Imp: ${formatCompactNumber(p.impressions)}`}
                                </div>
                              </div>

                              <div className="shrink-0 h-20 border-t border-border bg-muted px-3 py-3 flex flex-col">
                                <div className="flex justify-between w-full items-start">
                                  <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                                    <div className="truncate">{dateLabel}</div>
                                  </div>

                                  <div className="flex items-center gap-2 text-xs">
                                    <div className="inline-flex items-center gap-1">
                                      <Heart className="h-4 w-4" />
                                      <span className="tabular-nums">{Number(p.likes ?? 0).toLocaleString()}</span>
                                    </div>
                                    <div className="inline-flex items-center gap-1">
                                      <MessageCircle className="h-4 w-4" />
                                      <span className="tabular-nums">{Number(p.comments ?? 0).toLocaleString()}</span>
                                    </div>
                                  </div>
                                </div>

                                <div
                                  className="mt-2 text-xs leading-relaxed text-foreground/90 overflow-auto flex-1"
                                  style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}
                                >
                                  <span className="break-words">{p.caption || ""}</span>
                                </div>
                              </div>
                            </div>
                          )
                        })
                      ) : (
                        <div className="col-span-3 flex h-full items-center justify-center text-sm text-muted-foreground">
                          No posts in window
                        </div>
                      )}
                    </div>

                    <div className="hidden md:block w-px bg-border" />

                    <div className="flex flex-col h-full overflow-hidden bg-background divide-y divide-border justify-evenly">
                      {([
                        { label: "Posts", value: impressions.postCount, icon: FileText, format: "count" as const },
                        { label: "Engagement", value: impressions.engagement, icon: Activity, format: "compact" as const },
                        { label: "Sentiment", value: impressions.sentimentScorePct, icon: Smile, format: "pctSigned" as const },
                      ] as const).map((metric) => {
                        const MetricIcon = metric.icon
                        const valueDisplay =
                          metric.format === "compact"
                            ? formatCompactNumber(Number(metric.value ?? 0))
                            : metric.format === "pctSigned"
                              ? `${Number(metric.value ?? 0) >= 0 ? "+" : ""}${Number(metric.value ?? 0).toFixed(0)}%`
                              : Number(metric.value ?? 0).toLocaleString()

                        return (
                          <div key={metric.label} className="px-5 py-5">
                            <div className="text-sm text-primary">{metric.label}</div>
                            <div className="mt-1 flex items-baseline gap-2">
                              <MetricIcon className="h-6 w-6 shrink-0 text-primary" />
                              <div className="font-psv-branding italic text-3xl leading-none tabular-nums">{valueDisplay}</div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No data</div>
            )}
          </>
        )}
      </section>

      <section className="mt-6 flex h-[320px] flex-col overflow-hidden rounded-xl border border-border bg-background">
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
            <div className="text-sm text-muted-foreground">{recentEventDateLabel}</div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto border-t border-border">
          <table className="w-full table-fixed text-xs">
            <thead>
              <tr>
                <th className="sticky top-0 z-10 w-12 bg-muted px-3 py-2 text-left font-semibold text-muted-foreground">#</th>
                <th className="sticky top-0 z-10 bg-muted px-3 py-2 text-left font-semibold text-muted-foreground">COMMENT</th>
                <th className="sticky top-0 z-10 w-20 bg-muted px-3 py-2 text-right font-semibold text-muted-foreground">LIKES</th>
              </tr>
            </thead>
            <tbody>
              {commentsData.map((row, index) => (
                <tr key={row.id} className={index % 2 === 0 ? "bg-background" : "bg-muted"}>
                  <td className="w-12 px-3 py-2 text-muted-foreground tabular-nums">{index + 1}</td>
                  <td className="px-3 py-2">
                    {row.postUrl ? (
                      <a
                        href={row.postUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block truncate hover:underline"
                        title={row.text}
                      >
                        {row.text}
                      </a>
                    ) : (
                      <div className="truncate" title={row.text}>
                        {row.text}
                      </div>
                    )}
                    <div className="mt-0.5 text-[10px] text-muted-foreground">
                      <span>{formatSafeDateOnly(row.date)}</span>
                      {row.playerMentioned ? <span>{" • "}{row.playerMentioned}</span> : null}
                      {row.sentiment ? <span>{" • "}{row.sentiment}</span> : null}
                      {row.matchId ? (
                        <>
                          <span>{" • "}</span>
                          <Link href={`/events?match_id=${row.matchId}`} className="hover:underline">
                            {row.matchTitle || "Event"}
                          </Link>
                        </>
                      ) : null}
                    </div>
                  </td>
                  <td className="w-20 px-3 py-2 text-right font-medium tabular-nums">{row.likes.toLocaleString()}</td>
                </tr>
              ))}
              {commentsData.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-8 text-center text-muted-foreground">
                    No comments found matching filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6 flex flex-col overflow-hidden rounded-xl border border-border bg-background">
        <div className="flex items-center justify-between gap-3 px-6 py-4">
          <div className="flex items-center gap-2 text-base font-semibold font-psv-branding">
            <Users className="h-4 w-4 text-primary" />
            <span>PLAYER REPORT</span>
          </div>
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
                <SelectItem value="positivePct">Positive %</SelectItem>
                <SelectItem value="rating">Performance</SelectItem>
                <SelectItem value="mismatch">Mismatch %</SelectItem>
              </SelectContent>
            </Select>

            <div className="text-sm text-muted-foreground">{recentEventDateLabel}</div>
          </div>
        </div>

        {reportLoading ? (
          <div className="border-t border-border px-6 py-6 text-sm text-muted-foreground">Loading...</div>
        ) : reportError ? (
          <div className="border-t border-border px-6 py-6 text-sm text-red-500">{reportError}</div>
        ) : sortedAndFilteredPlayers.length ? (
          <div className="flex-1 overflow-y-auto border-t border-border">
            <table className="w-full table-fixed text-xs">
              <colgroup>
                <col className="w-10" />
                <col />
                <col className="w-20" />
                <col className="w-14" />
                <col className="w-14" />
                <col className="w-14" />
                <col className="w-20" />
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
                      <ThumbsUp className="h-3.5 w-3.5" />
                      <span className="sr-only">Positive</span>
                    </span>
                  </th>
                  <th className="sticky top-0 z-10 bg-muted px-3 py-2 text-right font-semibold text-muted-foreground">
                    <span className="inline-flex items-center justify-end gap-1">
                      <Minus className="h-3.5 w-3.5" />
                      <span className="sr-only">Neutral</span>
                    </span>
                  </th>
                  <th className="sticky top-0 z-10 bg-muted px-3 py-2 text-right font-semibold text-muted-foreground">
                    <span className="inline-flex items-center justify-end gap-1">
                      <ThumbsDown className="h-3.5 w-3.5" />
                      <span className="sr-only">Negative</span>
                    </span>
                  </th>
                  <th className="sticky top-0 z-10 bg-muted px-3 py-2 text-right font-semibold text-muted-foreground">
                    <span className="inline-flex items-center justify-end gap-1">
                      <Star className="h-3.5 w-3.5" />
                      <span className="sr-only">Performance</span>
                    </span>
                  </th>
                  <th className="sticky top-0 z-10 bg-muted px-3 py-2 text-right font-semibold text-muted-foreground">
                    <span className="inline-flex items-center justify-end gap-1">
                      <ArrowUpDown className="h-3.5 w-3.5" />
                      <span className="sr-only">Mismatch</span>
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedAndFilteredPlayers.map((row, index) => {
                  const mismatchLabel = `${row.diff >= 0 ? "+" : ""}${(row.diff * 100).toFixed(0)}%`

                  return (
                    <tr key={row.fotmobId} className={(index % 2 === 0 ? "bg-background" : "bg-muted") + " h-8"}>
                      <td className="px-3 py-2 text-muted-foreground tabular-nums">{row.rank}</td>
                      <td className="h-full px-3">
                        <div className="flex h-full items-center gap-2">
                          <div className="pt-1 self-end">
                            <PlayerTinyImage shirtNumber={row.shirtNumber} name={row.name} />
                          </div>
                          <div className="min-w-0">
                            <PlayerLink playerId={row.fotmobId} className="block truncate">
                              {row.name}
                            </PlayerLink>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums">{row.mentions.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums">{row.positivePct.toFixed(0)}%</td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums">{row.neutralPct.toFixed(0)}%</td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums">{row.negativePct.toFixed(0)}%</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        <span className={"inline-flex h-5 items-center rounded-md px-2 text-xs font-semibold text-black " + getRatingBadgeClass(row.rating)}>
                          {row.rating.toFixed(1)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums">
                        <span className={row.diff < 0 ? "text-green-600" : "text-red-500"}>{mismatchLabel}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="border-t border-border px-6 py-6 text-sm text-muted-foreground">No players found</div>
        )}
      </section>
    </main>
  )
}
