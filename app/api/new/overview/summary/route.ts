import { NextResponse } from "next/server"
import { query } from "@/lib/db"
import {
  Granularity,
  OverviewResponse,
  PlayerReportItem,
  SentimentJourneySummary,
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
  loadTopExposures,
  parseIsoDateOnly,
  percentChange,
  pickMostControversial,
  pickMostPopular,
  toIsoDateOnly,
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

    const events = attachMatchesToPointsWithStats(points, matches, statsByMatchId)

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
        points,
        summary,
        events,
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
