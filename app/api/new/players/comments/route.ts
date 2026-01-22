import { NextResponse } from "next/server"
import {
  loadPlayerDirectory,
  loadPlayerComments,
  loadMatches,
  parseIsoDateOnly,
  toIsoDateOnly
} from "@/lib/overview-data"

type CacheEntry<T> = { at: number; value: T }

const CACHE_TTL_MS = 30_000
const cache = new Map<string, CacheEntry<unknown>>()

function getCached<T>(key: string): T | null {
  const hit = cache.get(key)
  if (!hit) return null
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key)
    return null
  }
  return hit.value as T
}

function setCached(key: string, value: unknown) {
  cache.set(key, { at: Date.now(), value })
  // keep cache bounded
  if (cache.size > 50) {
    const oldestKey = cache.keys().next().value as string | undefined
    if (oldestKey) cache.delete(oldestKey)
  }
}

export async function GET(req: Request) {
  try {
    const cacheKey = req.url
    const cached = getCached<{ comments: unknown[] }>(cacheKey)
    if (cached) {
      return NextResponse.json(cached)
    }

    const url = new URL(req.url)
    const start = parseIsoDateOnly(url.searchParams.get("start"))
    const end = parseIsoDateOnly(url.searchParams.get("end"))
    const playerIdParam = url.searchParams.get("player_id")
    const sort = url.searchParams.get("sort") || "likes"
    const sentiment = url.searchParams.get("sentiment") || "all"

    if (!start || !end) {
      return NextResponse.json(
        { error: "Missing or invalid start/end" },
        { status: 400 }
      )
    }

    if (!playerIdParam) {
      return NextResponse.json(
          { error: "Missing player_id" },
          { status: 400 }
      )
    }
    const playerId = Number(playerIdParam)

    const startInclusive = new Date(start)
    startInclusive.setUTCHours(0, 0, 0, 0)
    const endInclusive = new Date(end)
    endInclusive.setUTCHours(23, 59, 59, 999)

    const startTs = Math.floor(startInclusive.getTime() / 1000)
    const endTs = Math.floor(endInclusive.getTime() / 1000)

    const { aliasToPlayer, allPlayers } = await loadPlayerDirectory()
    
    // Find the target player to get search terms
    const targetPlayer = allPlayers.find(p => p.fotmobId === playerId)
    const searchTerms: string[] = []
    if (targetPlayer) {
        searchTerms.push(targetPlayer.name)
        if (targetPlayer.aliases) {
            searchTerms.push(...targetPlayer.aliases)
        }
    }

    const comments = await loadPlayerComments(
        startTs,
        endTs,
        playerId,
        aliasToPlayer,
        (sort === "time" ? "time" : "likes"),
        (sentiment === "positive" || sentiment === "neutral" || sentiment === "negative") ? sentiment : "all",
        searchTerms,
        50
    )

    const matches = await loadMatches(startInclusive, endInclusive)
    const matchByIsoDay = new Map<string, { matchId: number; title: string }>()

    for (const m of matches) {
      if (!m.match_utc_time) continue
      const d = new Date(m.match_utc_time)
      if (Number.isNaN(d.getTime())) continue
      const iso = toIsoDateOnly(d)
      if (!iso) continue

      const matchId = Number(m.fotmob_match_id)
      if (!Number.isFinite(matchId) || matchId <= 0) continue

      matchByIsoDay.set(iso, {
        matchId,
        title: `${m.home_team_name} vs ${m.away_team_name}`,
      })
    }

    const commentsWithEvents = comments.map((c: any) => {
      const d = new Date(String(c.date ?? ""))
      if (Number.isNaN(d.getTime())) return c
      const iso = toIsoDateOnly(d)
      const hit = iso ? matchByIsoDay.get(iso) : null
      if (!hit) return c
      return { ...c, matchId: hit.matchId, matchTitle: hit.title }
    })

    const payload = { comments: commentsWithEvents }
    setCached(cacheKey, payload)
    return NextResponse.json(payload)
  } catch (error) {
    console.error("Error loading player comments:", error)
    return NextResponse.json({ error: "Failed to load comments" }, { status: 500 })
  }
}
