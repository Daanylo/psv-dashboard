import { NextResponse } from "next/server"
import { query } from "@/lib/db" // Still needed for Promise.all query inside component? No, helper functions handle it.
// Actually helper functions use `query` from db.
import OpenAI from "openai"
import {
  Granularity,
  SentimentJourneySummary,
  addDaysUtc,
  createdAtSecondsExpr,
  finalizeMentionedPlayer,
  loadHotTopics,
  loadMentionAggregates,
  loadPlayerDirectory,
  loadSentimentCountsByDay,
  loadTopExposures,
  parseIsoDateOnly,
  percentChange,
  pickMostControversial,
  pickMostPopular,
  toIsoDateOnly,
} from "@/lib/overview-data"

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const start = parseIsoDateOnly(url.searchParams.get("start"))
    const end = parseIsoDateOnly(url.searchParams.get("end"))

    if (!start || !end) {
      return NextResponse.json(
        { error: "Missing or invalid start/end" },
        { status: 400 },
      )
    }

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

    // Load data needed for AI context
    // 1. Sentiment Summary
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

    // 2. Players & Topics
    const { aliasToPlayer } = await loadPlayerDirectory()

    const [currentMentionAgg, previousMentionAgg, hotTopics, topExposures] = await Promise.all([
      loadMentionAggregates(startTs, endTs, aliasToPlayer),
      loadMentionAggregates(previousStartTs, previousEndTs, aliasToPlayer),
      loadHotTopics(startInclusive, endInclusive, currentCountsByDay),
      loadTopExposures(startTs, endTs),
    ])

    const popularAgg = pickMostPopular(currentMentionAgg)
    const popularPrevTotal =
      (popularAgg && previousMentionAgg.get(popularAgg.name)?.total) || 0
    const mostPopular = finalizeMentionedPlayer(popularAgg, popularPrevTotal)


    // 3. Generate AI Summary
    let aiSummary = null
    
    // Fallback template
    const topTopic = hotTopics[0]?.topic || "recent matches"
    const sentimentDirection = summary.positiveChangePct > 0 ? "improving" : "declining"
    const playerHighlight = mostPopular ? `, with ${mostPopular.name} leading player discussions` : ""
    const fallbackSummary = `Social sentiment is ${sentimentDirection} (${Number(summary.positiveChangePct).toFixed(1)}%) this period${playerHighlight}. The biggest driver of engagement was ${topTopic}, while ${topExposures[0]?.brand || "partners"} saw significant visibility.`
    
    if (openai) {
      try {
        const prompt = `
          You are a social media analyst for PSV Eindhoven. Write a single, punchy sentence (max 20 words) summarizing the most surprising or significant insight from this data.
          Period: ${toIsoDateOnly(start)} to ${toIsoDateOnly(end)}.
          
          Data:
          - Total Engagement (Weighted by Likes): ${summary.positiveCount + summary.negativeCount}
          - Sentiment: ${summary.positiveCount} positive vs ${summary.negativeCount} negative.
          - Positive Trend: ${summary.positiveChangePct.toFixed(1)}% vs previous period.
          - Top Player Mentioned: ${mostPopular?.name} (${mostPopular?.mentions} mentions).
          - Top Match/Event: ${hotTopics[0]?.topic} (${hotTopics[0]?.mentions} mentions).
          - Top Sponsor Exposure: ${topExposures[0]?.brand} (${topExposures[0]?.appearances} appearances).
          
          Focus only on the single biggest outlier or driver. No filler words. Start directly with the insight.
        `
        
        const completion = await openai.chat.completions.create({
          messages: [{ role: "user", content: prompt }],
          model: "gpt-4o", 
        })

        aiSummary = completion.choices[0]?.message?.content?.trim() || fallbackSummary
      } catch (e) {
        console.error("OpenAI summary generation failed", e)
        aiSummary = fallbackSummary
      }
    } else {
        aiSummary = fallbackSummary
    }

    return NextResponse.json({ aiSummary })

  } catch (error) {
    console.error("[overview/ai-summary] error", error)
    return NextResponse.json(
      { error: "Failed to generate AI summary" },
      { status: 500 },
    )
  }
}
