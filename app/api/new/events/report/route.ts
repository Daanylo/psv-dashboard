import { NextResponse } from "next/server"
import { query } from "@/lib/db"
import {
  createdAtSecondsExpr,
  loadMentionAggregates,
  loadPlayerDirectory,
} from "@/lib/overview-data"

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function ratingToUnit(rating: number) {
  const v = clamp(rating, 4, 9.5)
  return (v - 4) / (9.5 - 4)
}

function sentimentToUnit(pos: number, neg: number, total: number) {
  if (!total) return 0.5
  const net = (pos - neg) / total
  return (net + 1) / 2
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const matchIdParam = url.searchParams.get("match_id")
    const matchId = matchIdParam ? Number(matchIdParam) : null

    if (!matchId || !Number.isFinite(matchId)) {
      return NextResponse.json({ error: "Missing or invalid match_id" }, { status: 400 })
    }

    const matchRows = await query<
      Array<{
        fotmob_match_id: number
        home_team_name: string
        away_team_name: string
        score_str: string | null
        tournament_name: string | null
        match_utc_time: string | Date | null
        finished: number | null
      }>
    >(
      `SELECT fotmob_match_id, home_team_name, away_team_name, score_str, tournament_name, match_utc_time, finished
       FROM matches
       WHERE fotmob_match_id = ?
       LIMIT 1`,
      [matchId],
    )

    const match = matchRows[0]
    if (!match || !match.match_utc_time) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 })
    }

    const matchTime = new Date(match.match_utc_time)
    const startTs = Math.floor((matchTime.getTime() - 6 * 60 * 60 * 1000) / 1000)
    const endTs = Math.floor((matchTime.getTime() + 18 * 60 * 60 * 1000) / 1000)

    const prevStartTs = startTs - 7 * 24 * 60 * 60
    const prevEndTs = endTs - 7 * 24 * 60 * 60

    const perfRows = await query<
      Array<{
        player_id: number
        player_name: string | null
        shirt_number: number | null
        fotmob_rating: number | string | null
        minutes_played: number | null
      }>
    >(
      `SELECT pmp.player_id, p.name as player_name, p.shirt_number, pmp.fotmob_rating, pmp.minutes_played
       FROM player_match_performance pmp
       JOIN players p ON p.fotmob_id = pmp.player_id
       WHERE pmp.match_id = ?
         AND pmp.minutes_played > 0
         AND pmp.fotmob_rating IS NOT NULL`,
      [matchId],
    )

    const performances = perfRows
      .map((r) => ({
        fotmobId: Number(r.player_id),
        name: String(r.player_name ?? ""),
        shirtNumber: r.shirt_number === null ? null : Number(r.shirt_number),
        rating: Number(r.fotmob_rating),
        minutes: Number(r.minutes_played ?? 0),
      }))
      .filter((p) => p.name && Number.isFinite(p.rating))
      .sort((a, b) => b.rating - a.rating)

    const best = performances[0] ?? null
    const worst = performances.length ? performances[performances.length - 1] : null

    const [sentimentRows, prevSentimentRows] = await Promise.all([
      query<
        Array<{
          total: number | string | null
          pos: number | string | null
          neg: number | string | null
          neu: number | string | null
          commentCount: number | string | null
          likesSum: number | string | null
        }>
      >(
        `SELECT
          SUM(1 + COALESCE(ic.likes, 0)) as total,
          SUM(CASE WHEN LOWER(TRIM(ic.sentiment)) = 'positive' THEN (1 + COALESCE(ic.likes, 0)) ELSE 0 END) as pos,
          SUM(CASE WHEN LOWER(TRIM(ic.sentiment)) = 'negative' THEN (1 + COALESCE(ic.likes, 0)) ELSE 0 END) as neg,
          SUM(CASE WHEN LOWER(TRIM(ic.sentiment)) NOT IN ('positive','negative') OR ic.sentiment IS NULL THEN (1 + COALESCE(ic.likes, 0)) ELSE 0 END) as neu,
          COUNT(*) as commentCount,
          SUM(COALESCE(ic.likes, 0)) as likesSum
        FROM instagram_comments ic
        WHERE ic.created_at IS NOT NULL
          AND ${createdAtSecondsExpr} >= ?
          AND ${createdAtSecondsExpr} <= ?`,
        [startTs, endTs],
      ),
      query<
        Array<{
          total: number | string | null
          pos: number | string | null
          neg: number | string | null
          neu: number | string | null
        }>
      >(
        `SELECT
          SUM(1 + COALESCE(ic.likes, 0)) as total,
          SUM(CASE WHEN LOWER(TRIM(ic.sentiment)) = 'positive' THEN (1 + COALESCE(ic.likes, 0)) ELSE 0 END) as pos,
          SUM(CASE WHEN LOWER(TRIM(ic.sentiment)) = 'negative' THEN (1 + COALESCE(ic.likes, 0)) ELSE 0 END) as neg,
          SUM(CASE WHEN LOWER(TRIM(ic.sentiment)) NOT IN ('positive','negative') OR ic.sentiment IS NULL THEN (1 + COALESCE(ic.likes, 0)) ELSE 0 END) as neu
        FROM instagram_comments ic
        WHERE ic.created_at IS NOT NULL
          AND ${createdAtSecondsExpr} >= ?
          AND ${createdAtSecondsExpr} <= ?`,
        [prevStartTs, prevEndTs],
      ),
    ])

    const s = sentimentRows[0] ?? {
      total: 0,
      pos: 0,
      neg: 0,
      neu: 0,
      commentCount: 0,
      likesSum: 0,
    }
    const sp = prevSentimentRows[0] ?? { total: 0, pos: 0, neg: 0, neu: 0 }

    const total = Number(s.total ?? 0)
    const pos = Number(s.pos ?? 0)
    const neg = Number(s.neg ?? 0)
    const neu = Number(s.neu ?? 0)

    const prevTotal = Number(sp.total ?? 0)
    const prevPos = Number(sp.pos ?? 0)
    const prevNeg = Number(sp.neg ?? 0)

    const net = total ? (pos - neg) / total : 0
    const prevNet = prevTotal ? (prevPos - prevNeg) / prevTotal : 0

    const postsRows = await query<
      Array<{
        impressions: number | string | null
        postCount: number | string | null
      }>
    >(
      `SELECT
         SUM(COALESCE(ip.estimated_reach, ip.video_view_count, 0)) as impressions,
         COUNT(*) as postCount
       FROM instagram_posts ip
       WHERE ip.taken_at_timestamp IS NOT NULL
         AND ip.taken_at_timestamp >= ?
         AND ip.taken_at_timestamp <= ?`,
      [startTs, endTs],
    )

    const topPosts = await query<
      Array<{
        id: number
        shortcode: string | null
        url: string | null
        impressions: number | string | null
      }>
    >(
      `SELECT
         ip.id,
         ip.shortcode,
         ip.url,
         COALESCE(ip.estimated_reach, ip.video_view_count, 0) as impressions
       FROM instagram_posts ip
       WHERE ip.taken_at_timestamp IS NOT NULL
         AND ip.taken_at_timestamp >= ?
         AND ip.taken_at_timestamp <= ?
       ORDER BY impressions DESC
       LIMIT 3`,
      [startTs, endTs],
    )

    const topics = await query<Array<{ topic: string; count: number }>>(
      `SELECT ic.topic_label as topic, COUNT(*) as count
       FROM instagram_comments ic
       WHERE ic.topic_label IS NOT NULL
         AND ic.topic_label <> ''
         AND ic.created_at IS NOT NULL
         AND ${createdAtSecondsExpr} >= ?
         AND ${createdAtSecondsExpr} <= ?
       GROUP BY ic.topic_label
       ORDER BY count DESC
       LIMIT 6`,
      [startTs, endTs],
    )

    const impressions = Number(postsRows[0]?.impressions ?? 0)
    const postCount = Number(postsRows[0]?.postCount ?? 0)

    const { aliasToPlayer } = await loadPlayerDirectory()
    const mentionAgg = await loadMentionAggregates(startTs, endTs, aliasToPlayer)

    const mentionsById = new Map<number, { total: number; pos: number; neg: number; neu: number }>()
    for (const v of mentionAgg.values()) {
      mentionsById.set(v.fotmobId, { total: v.total, pos: v.pos, neg: v.neg, neu: v.neu })
    }

    const playerSentimentVsRating = performances
      .map((p) => {
        const m = mentionsById.get(p.fotmobId) ?? { total: 0, pos: 0, neg: 0, neu: 0 }
        const sentimentUnit = sentimentToUnit(m.pos, m.neg, m.total)
        const ratingUnit = ratingToUnit(p.rating)
        return {
          fotmobId: p.fotmobId,
          name: p.name,
          shirtNumber: p.shirtNumber,
          rating: p.rating,
          mentions: m.total,
          positivePct: m.total ? (m.pos / m.total) * 100 : 0,
          negativePct: m.total ? (m.neg / m.total) * 100 : 0,
          diff: ratingUnit - sentimentUnit,
        }
      })
      .filter((r) => r.mentions >= 3)
      .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
      .slice(0, 6)

    return NextResponse.json({
      match: {
        id: Number(match.fotmob_match_id),
        homeTeamName: match.home_team_name,
        awayTeamName: match.away_team_name,
        scoreStr: match.score_str,
        tournamentName: match.tournament_name,
        matchUtcTime: match.match_utc_time,
        finished: Number(match.finished ?? 0) === 1,
      },
      window: {
        startTs,
        endTs,
      },
      hero: {
        best,
        worst,
      },
      metrics: {
        sentiment: {
          total,
          pos,
          neg,
          neu,
          net,
          netDeltaVsPrevWeek: net - prevNet,
          commentCount: Number(s.commentCount ?? 0),
          likesSum: Number(s.likesSum ?? 0),
        },
        impressions: {
          total: impressions,
          postCount,
          topPosts: topPosts.map((p) => ({
            id: String(p.id),
            shortcode: p.shortcode,
            url: p.url,
            imageUrl: p.shortcode ? `https://www.instagram.com/p/${p.shortcode}/media/?size=l` : p.url || "",
            impressions: Number(p.impressions ?? 0),
          })),
        },
        topics: topics.map((t) => ({ topic: t.topic, count: Number(t.count ?? 0) })),
        playerSentimentVsRating,
      },
    })
  } catch (error) {
    console.error("Error building event report:", error)
    return NextResponse.json({ error: "Failed to build event report" }, { status: 500 })
  }
}
