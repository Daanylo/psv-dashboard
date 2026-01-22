import { NextResponse } from "next/server"
import { query } from "@/lib/db"
import {
  Granularity,
  OverviewResponse,
  PlayerReportItem,
  SentimentJourneySummary,
  SentimentJourneyTaggedPost,
  addDaysUtc,
  attachMatchesToPointsWithStats,
  buildDailyPoints,
  buildWeeklyPoints,
  createdAtSecondsExpr,
  finalizeMentionedPlayer,
  loadHotTopics,
  loadMatches,
  loadMentionAggregates,
  loadMentionsJourney,
  loadPlayerDirectory,
  loadPlayerMotmCounts,
  loadPlayerRatings,
  loadSentimentCountsByDay,
  loadPlayerSentimentCountsByDay,
  loadPostsCountsByDay,
  loadTopExposures,
  parseIsoDateOnly,
  percentChange,
  pickMostControversial,
  pickMostPopular,
  attachPostsCountsToPoints,
  parseListText,
  toIsoDateOnly,
} from "@/lib/overview-data"

function looksLikeInstagramHandle(value: string) {
  const v = value.trim().replace(/^@/, "")
  if (v.length < 3 || v.length > 40) return false
  if (v.includes(" ")) return false
  return /^[A-Za-z0-9._]+$/.test(v)
}

function handleFromInstagramUrl(raw: unknown) {
  if (!raw) return null
  const text = String(raw).trim()
  if (!text) return null

  try {
    const url = new URL(text)
    const parts = url.pathname.split("/").filter(Boolean)
    if (parts.length === 0) return null
    const candidate = parts[0]
    if (!candidate) return null
    if (candidate === "p" || candidate === "reel" || candidate === "tv") return null
    const cleaned = candidate.replace(/^@/, "")
    return looksLikeInstagramHandle(cleaned) ? cleaned : null
  } catch {
    const cleaned = text
      .replace(/^@/, "")
      .replace(/^https?:\/\/www\.instagram\.com\//i, "")
      .split("/")[0]
      ?.trim()
    if (!cleaned) return null
    if (cleaned === "p" || cleaned === "reel" || cleaned === "tv") return null
    return looksLikeInstagramHandle(cleaned) ? cleaned : null
  }
}

function uniq<T>(values: T[]) {
  return Array.from(new Set(values))
}

function parseAliases(raw: unknown) {
  if (raw == null) return []
  if (Array.isArray(raw)) return raw.map((v) => String(v)).filter(Boolean)
  return parseListText(String(raw))
}

async function loadPlayerInstagramHandles(playerId: number) {
  const playerRows = await query<Array<{ aliases: unknown; instagram_url: unknown }>>(
    `SELECT aliases, instagram_url FROM players WHERE fotmob_id = ? LIMIT 1`,
    [playerId],
  )

  const aliases = parseAliases(playerRows[0]?.aliases)
  const handles = uniq(
    [
      ...aliases.map((a) => a.trim().replace(/^@/, "")),
      handleFromInstagramUrl(playerRows[0]?.instagram_url) ?? "",
    ]
      .map((a) => a.trim().replace(/^@/, ""))
      .filter((a) => looksLikeInstagramHandle(a)),
  ).slice(0, 12)

  return handles
}

async function loadTopTaggedPostByDay(startTs: number, endTs: number, handles: string[]) {
  if (handles.length === 0) return []

  const clauses = handles.map(() => `JSON_CONTAINS(ip.tagged_users, CAST('1' AS JSON), ?)`)
  const whereTagged = `(${clauses.join(" OR ")})`
  const paths = handles.map((h) => `$."${h}"`)

  const rows = await query<
    Array<{
      day: string
      id: number
      shortcode: string | null
      url: string | null
      taken_at_timestamp: number | string | null
      impressions: number | string | null
    }>
  >(
    `SELECT
       DATE_FORMAT(DATE(FROM_UNIXTIME(ip.taken_at_timestamp)), '%Y-%m-%d') as day,
       ip.id,
       ip.shortcode,
       ip.url,
       ip.taken_at_timestamp,
       COALESCE(ip.estimated_reach, ip.video_view_count, 0) as impressions
     FROM instagram_posts ip
     INNER JOIN (
       SELECT
         DATE_FORMAT(DATE(FROM_UNIXTIME(ip.taken_at_timestamp)), '%Y-%m-%d') as day,
         MAX(COALESCE(ip.estimated_reach, ip.video_view_count, 0)) as max_impressions
       FROM instagram_posts ip
       WHERE ip.tagged_users IS NOT NULL
         AND ip.taken_at_timestamp IS NOT NULL
         AND CAST(ip.taken_at_timestamp AS UNSIGNED) >= ?
         AND CAST(ip.taken_at_timestamp AS UNSIGNED) <= ?
         AND ${whereTagged}
       GROUP BY day
     ) mx
       ON mx.day = DATE_FORMAT(DATE(FROM_UNIXTIME(ip.taken_at_timestamp)), '%Y-%m-%d')
      AND mx.max_impressions = COALESCE(ip.estimated_reach, ip.video_view_count, 0)
     WHERE ip.tagged_users IS NOT NULL
       AND ip.taken_at_timestamp IS NOT NULL
       AND CAST(ip.taken_at_timestamp AS UNSIGNED) >= ?
       AND CAST(ip.taken_at_timestamp AS UNSIGNED) <= ?
       AND ${whereTagged}`,
    [startTs, endTs, ...paths, startTs, endTs, ...paths],
  )

  return rows
}

function taggedPostsForPoints(
  points: Array<{ label: string; isoStart: string; isoEnd: string }>,
  dailyTop: Array<{ day: string; id: number; shortcode: string | null; url: string | null; impressions: number | string | null }>,
) {
  const byDay = new Map<string, { id: number; shortcode: string | null; url: string | null; impressions: number }>()
  for (const row of dailyTop) {
    const dayKey = String(row.day).slice(0, 10)
    const impressions = Number(row.impressions ?? 0)
    const existing = byDay.get(dayKey)
    if (!existing || impressions > existing.impressions) {
      byDay.set(dayKey, {
        id: Number(row.id),
        shortcode: row.shortcode ?? null,
        url: row.url ?? null,
        impressions,
      })
    }
  }

  const out: SentimentJourneyTaggedPost[] = []
  for (const p of points) {
    const start = parseIsoDateOnly(p.isoStart)
    const end = parseIsoDateOnly(p.isoEnd)
    if (!start || !end) continue

    let best: { id: number; shortcode: string | null; url: string | null; impressions: number } | null = null
    let cursor = new Date(start)
    cursor.setUTCHours(0, 0, 0, 0)

    const endDay = new Date(end)
    endDay.setUTCHours(0, 0, 0, 0)

    while (cursor <= endDay) {
      const iso = toIsoDateOnly(cursor)
      const hit = byDay.get(iso)
      if (hit && (!best || hit.impressions > best.impressions)) {
        best = hit
      }
      cursor = addDaysUtc(cursor, 1)
    }

    if (!best) continue

    const url = best.url || (best.shortcode ? `https://www.instagram.com/p/${best.shortcode}/` : "")
    if (!url) continue

    out.push({
      id: String(best.id),
      xLabel: p.label,
      url,
      shortcode: best.shortcode,
      impressions: best.impressions,
    })
  }

  return out
}

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
  if (cache.size > 50) {
    const oldestKey = cache.keys().next().value as string | undefined
    if (oldestKey) cache.delete(oldestKey)
  }
}

export async function GET(req: Request) {
  try {
    const cacheKey = req.url
    const cached = getCached<OverviewResponse>(cacheKey)
    if (cached) {
      return NextResponse.json(cached)
    }

    const url = new URL(req.url)
    const start = parseIsoDateOnly(url.searchParams.get("start"))
    const end = parseIsoDateOnly(url.searchParams.get("end"))
    const debug = url.searchParams.get("debug") === "1"
    const playerIdParam = url.searchParams.get("player_id")
    const playerId = playerIdParam ? Number(playerIdParam) : null

    if (!start || !end) {
      return NextResponse.json(
        { error: "Missing or invalid start/end (expected YYYY-MM-DD)" },
        { status: 400 },
      )
    }

    const granularityParam = url.searchParams.get("granularity")
    const granularity: Granularity =
      granularityParam === "week" || granularityParam === "day"
        ? (granularityParam as Granularity)
        : "day"

    const startInclusive = new Date(start)
    startInclusive.setUTCHours(0, 0, 0, 0)

    const endInclusive = new Date(end)
    endInclusive.setUTCHours(23, 59, 59, 999)

    const startTs = Math.floor(startInclusive.getTime() / 1000)
    const endTs = Math.floor(endInclusive.getTime() / 1000)

    const days =
      Math.floor((new Date(toIsoDateOnly(end)).getTime() - new Date(toIsoDateOnly(start)).getTime()) / (24 * 60 * 60 * 1000)) +
      1

    const previousEnd = addDaysUtc(new Date(toIsoDateOnly(start)), -1)
    const previousStart = addDaysUtc(previousEnd, -(days - 1))

    const previousStartTs = Math.floor(previousStart.getTime() / 1000)
    const previousEndTs = Math.floor(
      new Date(`${toIsoDateOnly(previousEnd)}T23:59:59.999Z`).getTime() / 1000,
    )

    const { aliasToPlayer, allPlayers } = await loadPlayerDirectory()

    let currentCountsByDay: Map<string, { total: number; pos: number; neg: number }>
    let currentPos = 0
    let currentNeg = 0
    let prevPos = 0
    let prevNeg = 0

    if (playerId) {
      currentCountsByDay = await loadPlayerSentimentCountsByDay(startTs, endTs, playerId, aliasToPlayer)
      
      for (const val of currentCountsByDay.values()) {
        currentPos += val.pos
        currentNeg += val.neg
      }

      const prevCountsByDay = await loadPlayerSentimentCountsByDay(previousStartTs, previousEndTs, playerId, aliasToPlayer)
      for (const val of prevCountsByDay.values()) {
        prevPos += val.pos
        prevNeg += val.neg
      }
    } else {
      currentCountsByDay = await loadSentimentCountsByDay(startTs, endTs)

      const [currentTotals, prevTotals] =
        await Promise.all([
          query<Array<{ positiveCount: number; negativeCount: number }>>(
            `SELECT
              SUM(CASE WHEN LOWER(TRIM(ic.sentiment)) = 'positive' THEN (1 + COALESCE(ic.likes, 0)) ELSE 0 END) as positiveCount,
              SUM(CASE WHEN LOWER(TRIM(ic.sentiment)) = 'negative' THEN (1 + COALESCE(ic.likes, 0)) ELSE 0 END) as negativeCount
             FROM instagram_comments ic
             WHERE ic.created_at IS NOT NULL
               AND ${createdAtSecondsExpr} >= ?
               AND ${createdAtSecondsExpr} <= ?`,
            [startTs, endTs],
          ),
          query<Array<{ positiveCount: number; negativeCount: number }>>(
            `SELECT
              SUM(CASE WHEN LOWER(TRIM(ic.sentiment)) = 'positive' THEN (1 + COALESCE(ic.likes, 0)) ELSE 0 END) as positiveCount,
              SUM(CASE WHEN LOWER(TRIM(ic.sentiment)) = 'negative' THEN (1 + COALESCE(ic.likes, 0)) ELSE 0 END) as negativeCount
             FROM instagram_comments ic
             WHERE ic.created_at IS NOT NULL
               AND ${createdAtSecondsExpr} >= ?
               AND ${createdAtSecondsExpr} <= ?`,
            [previousStartTs, previousEndTs],
          ),
        ])
        
      currentPos = Number(currentTotals[0]?.positiveCount ?? 0)
      currentNeg = Number(currentTotals[0]?.negativeCount ?? 0)
      prevPos = Number(prevTotals[0]?.positiveCount ?? 0)
      prevNeg = Number(prevTotals[0]?.negativeCount ?? 0)
    }

    const points =
      granularity === "week"
        ? buildWeeklyPoints(start, end, currentCountsByDay)
        : buildDailyPoints(start, end, currentCountsByDay)

    const postsByDay = await loadPostsCountsByDay(startTs, endTs)
    const pointsWithPosts = attachPostsCountsToPoints(points, postsByDay)

    let taggedPosts: SentimentJourneyTaggedPost[] = []
    if (playerId) {
      const handles = await loadPlayerInstagramHandles(playerId)
      if (handles.length > 0) {
        const dailyTopTagged = await loadTopTaggedPostByDay(startTs, endTs, handles)
        taggedPosts = taggedPostsForPoints(pointsWithPosts, dailyTopTagged)
      }
    }

    const summary: SentimentJourneySummary = {
      positiveCount: currentPos,
      negativeCount: currentNeg,
      positiveChangePct: percentChange(currentPos, prevPos),
      negativeChangePct: percentChange(currentNeg, prevNeg),
    }

    const matches = await loadMatches(start, end)
    let statsByMatchId:
      | Map<number, { playerRating: number | null; playerGoals: number; playerAssists: number }>
      | undefined

    if (playerId && matches.length > 0) {
      const matchIds = matches
        .map((m) => Number(m.fotmob_match_id))
        .filter((id) => Number.isFinite(id) && id > 0)

      if (matchIds.length > 0) {
        const placeholders = matchIds.map(() => "?").join(",")
        const rows = await query<
          Array<{
            match_id: number
            fotmob_rating: number | string | null
            goals: number | string | null
            assists: number | string | null
          }>
        >(
          `SELECT match_id, fotmob_rating, goals, assists
           FROM player_match_performance
           WHERE player_id = ?
             AND match_id IN (${placeholders})`,
          [playerId, ...matchIds],
        )

        statsByMatchId = new Map()
        for (const row of rows) {
          const matchId = Number(row.match_id)
          if (!Number.isFinite(matchId) || matchId <= 0) continue
          statsByMatchId.set(matchId, {
            playerRating:
              row.fotmob_rating === null || row.fotmob_rating === undefined
                ? null
                : Number(row.fotmob_rating),
            playerGoals: Number(row.goals ?? 0),
            playerAssists: Number(row.assists ?? 0),
          })
        }
      }
    }

    const events = attachMatchesToPointsWithStats(pointsWithPosts, matches, statsByMatchId)

    const [currentMentionAgg, previousMentionAgg, hotTopics, playerRatings, motmCounts, topExposures] = await Promise.all([
      loadMentionAggregates(startTs, endTs, aliasToPlayer),
      loadMentionAggregates(previousStartTs, previousEndTs, aliasToPlayer),
      loadHotTopics(startInclusive, endInclusive, currentCountsByDay),
      loadPlayerRatings(startInclusive, endInclusive),
      loadPlayerMotmCounts(startInclusive, endInclusive, playerId),
      loadTopExposures(startTs, endTs),
    ])

    const popularAgg = pickMostPopular(currentMentionAgg)
    const controversialAgg = pickMostControversial(
      currentMentionAgg,
      popularAgg?.name,
    )

    const popularPrevTotal =
      (popularAgg && previousMentionAgg.get(popularAgg.name)?.total) || 0
    const controversialPrevTotal =
      (controversialAgg &&
        previousMentionAgg.get(controversialAgg.name)?.total) ||
      0

    const mostPopular = finalizeMentionedPlayer(popularAgg, popularPrevTotal)
    const mostControversial = finalizeMentionedPlayer(
      controversialAgg,
      controversialPrevTotal,
    )

    const fullReport: PlayerReportItem[] = allPlayers
      .map((p) => {
        const result: PlayerReportItem = {
          name: p.name,
          fotmobId: p.fotmobId,
          shirtNumber: p.shirtNumber,
          position: p.position ?? "Unknown",
          mentions: 0,
          motm: motmCounts.get(p.fotmobId) ?? 0,
          positivePct: 0,
          avgRating: playerRatings.get(p.fotmobId) ?? null,
          marketValue: p.transferValue,
          goals: p.goals,
          assists: p.assists,
          countryCode: p.countryCode,
          age: p.age,
        }

        const agg = currentMentionAgg.get(p.name)
        if (agg && agg.total > 0) {
          result.mentions = agg.total
          result.positivePct = (agg.pos / agg.total) * 100
        }

        return result
      })
      .sort((a, b) => b.mentions - a.mentions)

    // No AI summary here - it is loaded separately
    const aiSummary = null

    const mentionsJourney = await loadMentionsJourney(startTs, endTs, granularity, playerId)

    const body: OverviewResponse = {
      meta: {
        start: toIsoDateOnly(start),
        end: toIsoDateOnly(end),
        previousStart: toIsoDateOnly(previousStart),
        previousEnd: toIsoDateOnly(previousEnd),
        granularity,
      },
      aiSummary,
      sentimentJourney: {
        points: pointsWithPosts,
        summary,
        events,
        taggedPosts,
      },
      mentionsJourney,
      playerMentions: {
        mostPopular,
        mostControversial,
        fullReport,
      },
      hotTopics,
      topExposures,
    }

    if (debug) {
      const [debugTotals, sentimentCounts] = await Promise.all([
        query<
          Array<{
            matchedRows: number
            minCreatedAtSeconds: number | null
            maxCreatedAtSeconds: number | null
          }>
        >(
          `SELECT
            COUNT(*) as matchedRows,
            MIN(${createdAtSecondsExpr}) as minCreatedAtSeconds,
            MAX(${createdAtSecondsExpr}) as maxCreatedAtSeconds
           FROM instagram_comments ic
           WHERE ic.created_at IS NOT NULL
             AND ${createdAtSecondsExpr} >= ?
             AND ${createdAtSecondsExpr} <= ?`,
          [startTs, endTs],
        ),
        query<Array<{ sentiment: string; count: number }>>(
          `SELECT
            LOWER(TRIM(COALESCE(ic.sentiment, ''))) as sentiment,
            COUNT(*) as count
           FROM instagram_comments ic
           WHERE ic.created_at IS NOT NULL
             AND ${createdAtSecondsExpr} >= ?
             AND ${createdAtSecondsExpr} <= ?
           GROUP BY sentiment
           ORDER BY count DESC`,
          [startTs, endTs],
        ),
      ])

      body.meta.debug = {
        matchedRows: Number(debugTotals[0]?.matchedRows ?? 0),
        minCreatedAtSeconds:
          debugTotals[0]?.minCreatedAtSeconds === null ||
          debugTotals[0]?.minCreatedAtSeconds === undefined
            ? null
            : Number(debugTotals[0]?.minCreatedAtSeconds),
        maxCreatedAtSeconds:
          debugTotals[0]?.maxCreatedAtSeconds === null ||
          debugTotals[0]?.maxCreatedAtSeconds === undefined
            ? null
            : Number(debugTotals[0]?.maxCreatedAtSeconds),
        sentimentCounts: sentimentCounts.map((row) => ({
          sentiment: row.sentiment,
          count: Number(row.count ?? 0),
        })),
      }
    }

    setCached(cacheKey, body)
    return NextResponse.json(body)
  } catch (error) {
    console.error("[overview/summary] error", error)
    return NextResponse.json(
      { error: "Failed to build overview summary" },
      { status: 500 },
    )
  }
}
