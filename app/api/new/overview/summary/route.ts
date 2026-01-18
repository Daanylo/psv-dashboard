import { NextResponse } from "next/server"
import { query } from "@/lib/db"
import {
  Granularity,
  OverviewResponse,
  PlayerReportItem,
  SentimentJourneySummary,
  addDaysUtc,
  attachMatchesToPoints,
  buildDailyPoints,
  buildWeeklyPoints,
  createdAtSecondsExpr,
  finalizeMentionedPlayer,
  loadHotTopics,
  loadMatches,
  loadMentionAggregates,
  loadPlayerDirectory,
  loadPlayerRatings,
  loadSentimentCountsByDay,
  loadTopExposures,
  parseIsoDateOnly,
  percentChange,
  pickMostControversial,
  pickMostPopular,
  toIsoDateOnly,
} from "@/lib/overview-data"

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const start = parseIsoDateOnly(url.searchParams.get("start"))
    const end = parseIsoDateOnly(url.searchParams.get("end"))
    const debug = url.searchParams.get("debug") === "1"

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

    const [currentCountsByDay, currentTotals, prevTotals] =
      await Promise.all([
        loadSentimentCountsByDay(startTs, endTs),
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

    const points =
      granularity === "week"
        ? buildWeeklyPoints(start, end, currentCountsByDay)
        : buildDailyPoints(start, end, currentCountsByDay)

    const currentPos = Number(currentTotals[0]?.positiveCount ?? 0)
    const currentNeg = Number(currentTotals[0]?.negativeCount ?? 0)
    const prevPos = Number(prevTotals[0]?.positiveCount ?? 0)
    const prevNeg = Number(prevTotals[0]?.negativeCount ?? 0)

    const summary: SentimentJourneySummary = {
      positiveCount: currentPos,
      negativeCount: currentNeg,
      positiveChangePct: percentChange(currentPos, prevPos),
      negativeChangePct: percentChange(currentNeg, prevNeg),
    }

    const matches = await loadMatches(start, end)
    const events = attachMatchesToPoints(points, matches)

    const { aliasToPlayer, allPlayers } = await loadPlayerDirectory()

    const [currentMentionAgg, previousMentionAgg, hotTopics, playerRatings, topExposures] = await Promise.all([
      loadMentionAggregates(startTs, endTs, aliasToPlayer),
      loadMentionAggregates(previousStartTs, previousEndTs, aliasToPlayer),
      loadHotTopics(startInclusive, endInclusive, currentCountsByDay),
      loadPlayerRatings(startInclusive, endInclusive),
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
          shirtNumber: p.shirtNumber,
          position: p.position ?? "Unknown",
          mentions: 0,
          positivePct: 0,
          avgRating: playerRatings.get(p.fotmobId) ?? null,
          marketValue: p.transferValue,
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

    return NextResponse.json(body)
  } catch (error) {
    console.error("[overview/summary] error", error)
    return NextResponse.json(
      { error: "Failed to build overview summary" },
      { status: 500 },
    )
  }
}
