import { NextResponse } from "next/server"
import { query } from "@/lib/db"

type Granularity = "day" | "week"

type SentimentJourneyPoint = {
  label: string
  positiveCount: number
  negativeCount: number
  negativeDisplay: number
  totalCount: number
  isoStart: string
  isoEnd: string
}

type SentimentJourneySummary = {
  positiveCount: number
  negativeCount: number
  positiveChangePct: number
  negativeChangePct: number
}

type SentimentJourneyEvent = {
  id: string
  xLabel: string
  title: string
  subtitle: string
}

type MentionedPlayer = {
  name: string
  shirtNumber: number | null
  mentions: number
  mentionsChangePct: number
  positivePct: number
  neutralPct: number
  negativePct: number
}

type OverviewResponse = {
  meta: {
    start: string
    end: string
    previousStart: string
    previousEnd: string
    granularity: Granularity
    debug?: {
      matchedRows: number
      minCreatedAtSeconds: number | null
      maxCreatedAtSeconds: number | null
      sentimentCounts: Array<{ sentiment: string; count: number }>
    }
  }
  sentimentJourney: {
    points: SentimentJourneyPoint[]
    summary: SentimentJourneySummary
    events: SentimentJourneyEvent[]
  }
  playerMentions: {
    mostPopular: MentionedPlayer | null
    mostControversial: MentionedPlayer | null
  }
}

function parseIsoDateOnly(value: string | null) {
  if (!value) return null
  const d = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(d.getTime())) return null
  return d
}

function toIsoDateOnly(date: Date) {
  const d = new Date(date)
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString().slice(0, 10)
}

function addDaysUtc(date: Date, days: number) {
  const d = new Date(date)
  d.setUTCDate(d.getUTCDate() + days)
  return d
}

function startOfWeekUtc(date: Date) {
  const d = new Date(date)
  const day = d.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diff)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

function endOfWeekUtc(date: Date) {
  return addDaysUtc(startOfWeekUtc(date), 6)
}

function percentChange(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : 100
  return ((current - previous) / previous) * 100
}

function labelForDateUtc(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })
}

const createdAtSecondsExpr =
  "(CASE " +
  "WHEN ic.created_at > 100000000000000 THEN FLOOR(ic.created_at / 1000000) " +
  "WHEN ic.created_at > 1000000000000 THEN FLOOR(ic.created_at / 1000) " +
  "ELSE FLOOR(ic.created_at) " +
  "END)"

async function loadSentimentCountsByDay(startTs: number, endTs: number) {
  const rows = await query<
    Array<{
      day: string | Date
      totalCount: number
      positiveCount: number
      negativeCount: number
    }>
  >(
    `SELECT
      DATE_FORMAT(DATE(FROM_UNIXTIME(${createdAtSecondsExpr})), '%Y-%m-%d') as day,
      COUNT(*) as totalCount,
      SUM(CASE WHEN LOWER(TRIM(ic.sentiment)) = 'positive' THEN 1 ELSE 0 END) as positiveCount,
      SUM(CASE WHEN LOWER(TRIM(ic.sentiment)) = 'negative' THEN 1 ELSE 0 END) as negativeCount
    FROM instagram_comments ic
    WHERE ic.created_at IS NOT NULL
      AND ${createdAtSecondsExpr} >= ?
      AND ${createdAtSecondsExpr} <= ?
    GROUP BY day
    ORDER BY day ASC`,
    [startTs, endTs],
  )

  const map = new Map<string, { total: number; pos: number; neg: number }>()
  for (const row of rows) {
    const dayKey =
      typeof row.day === "string" ? row.day.slice(0, 10) : toIsoDateOnly(row.day)

    map.set(dayKey, {
      total: Number(row.totalCount ?? 0),
      pos: Number(row.positiveCount ?? 0),
      neg: Number(row.negativeCount ?? 0),
    })
  }
  return map
}

function buildDailyPoints(
  start: Date,
  end: Date,
  countsByDay: Map<string, { total: number; pos: number; neg: number }>,
) {
  const points: SentimentJourneyPoint[] = []

  let cursor = new Date(start)
  cursor.setUTCHours(0, 0, 0, 0)

  const endDay = new Date(end)
  endDay.setUTCHours(0, 0, 0, 0)

  while (cursor <= endDay) {
    const iso = toIsoDateOnly(cursor)
    const counts = countsByDay.get(iso) ?? { total: 0, pos: 0, neg: 0 }

    points.push({
      label: labelForDateUtc(cursor),
      positiveCount: counts.pos,
      negativeCount: counts.neg,
      negativeDisplay: -counts.neg,
      totalCount: counts.total,
      isoStart: iso,
      isoEnd: iso,
    })

    cursor = addDaysUtc(cursor, 1)
  }

  return points
}

function buildWeeklyPoints(
  start: Date,
  end: Date,
  dailyCounts: Map<string, { total: number; pos: number; neg: number }>,
) {
  const points: SentimentJourneyPoint[] = []

  const startDay = new Date(start)
  startDay.setUTCHours(0, 0, 0, 0)

  const endDay = new Date(end)
  endDay.setUTCHours(0, 0, 0, 0)

  let cursor = startOfWeekUtc(startDay)

  while (cursor <= endDay) {
    const rangeStart = cursor
    const rangeEnd = endOfWeekUtc(cursor)

    const visibleStart = rangeStart < startDay ? startDay : rangeStart
    const visibleEnd = rangeEnd > endDay ? endDay : rangeEnd

    let pos = 0
    let neg = 0
    let total = 0
    let d = new Date(visibleStart)
    while (d <= visibleEnd) {
      const iso = toIsoDateOnly(d)
      const counts = dailyCounts.get(iso)
      if (counts) {
        total += counts.total
        pos += counts.pos
        neg += counts.neg
      }
      d = addDaysUtc(d, 1)
    }

    points.push({
      label: labelForDateUtc(visibleStart),
      positiveCount: pos,
      negativeCount: neg,
      negativeDisplay: -neg,
      totalCount: total,
      isoStart: toIsoDateOnly(visibleStart),
      isoEnd: toIsoDateOnly(visibleEnd),
    })

    cursor = addDaysUtc(rangeEnd, 1)
  }

  return points
}

type PlayerRow = {
  name: string
  shirt_number: number | null
  aliases: string | null
}

function stripDiacritics(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
}

function normalizeName(value: string) {
  return stripDiacritics(value)
    .toLowerCase()
    .replace(/["'`]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function parseListText(value: string): string[] {
  const trimmed = value.trim()
  if (!trimmed) return []

  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) {
        return parsed
          .map((v) => (typeof v === "string" ? v.trim() : ""))
          .filter(Boolean)
      }
      if (typeof parsed === "string") return [parsed.trim()].filter(Boolean)
    } catch {
    }
  }

  return trimmed
    .split(/[,;|\n\r]+/)
    .map((p) => p.trim())
    .filter(Boolean)
}

async function loadPlayerDirectory() {
  const players = await query<PlayerRow[]>(
    `SELECT name, shirt_number, aliases
     FROM players
     WHERE COALESCE(exclude_from_ranking, 0) = 0`,
  )

  const aliasToPlayer = new Map<
    string,
    { name: string; shirtNumber: number | null }
  >()

  for (const player of players) {
    const canonical = {
      name: player.name,
      shirtNumber:
        player.shirt_number === null || player.shirt_number === undefined
          ? null
          : Number(player.shirt_number),
    }

    const addAlias = (alias: string) => {
      const key = normalizeName(alias)
      if (!key) return
      if (!aliasToPlayer.has(key)) {
        aliasToPlayer.set(key, canonical)
      }
    }

    addAlias(player.name)

    if (player.aliases) {
      for (const alias of parseListText(player.aliases)) {
        addAlias(alias)
      }
    }
  }

  return { aliasToPlayer }
}

type MentionRow = {
  player_mentioned: string | null
  sentiment: string | null
}

function addMentionAggregate(
  target: Map<
    string,
    {
      name: string
      shirtNumber: number | null
      total: number
      pos: number
      neg: number
      neu: number
    }
  >,
  player: { name: string; shirtNumber: number | null },
  sentiment: string | null,
) {
  const key = player.name
  const current =
    target.get(key) ??
    ({
      name: player.name,
      shirtNumber: player.shirtNumber,
      total: 0,
      pos: 0,
      neg: 0,
      neu: 0,
    } as const)

  const next = {
    name: current.name,
    shirtNumber: current.shirtNumber,
    total: current.total + 1,
    pos: current.pos,
    neg: current.neg,
    neu: current.neu,
  }

  const s = (sentiment ?? "").toLowerCase()
  const normalized = s.trim()
  if (normalized === "positive") next.pos += 1
  else if (normalized === "negative") next.neg += 1
  else next.neu += 1

  target.set(key, next)
}

function finalizeMentionedPlayer(
  agg:
    | {
        name: string
        shirtNumber: number | null
        total: number
        pos: number
        neg: number
        neu: number
      }
    | undefined,
  prevTotal: number,
): MentionedPlayer | null {
  if (!agg || agg.total <= 0) return null
  const total = agg.total
  return {
    name: agg.name,
    shirtNumber: agg.shirtNumber,
    mentions: total,
    mentionsChangePct: percentChange(total, prevTotal),
    positivePct: (agg.pos / total) * 100,
    neutralPct: (agg.neu / total) * 100,
    negativePct: (agg.neg / total) * 100,
  }
}

async function loadMentionAggregates(
  startTs: number,
  endTs: number,
  aliasToPlayer: Map<string, { name: string; shirtNumber: number | null }>,
) {
  const rows = await query<MentionRow[]>(
    `SELECT ic.player_mentioned, ic.sentiment
     FROM instagram_comments ic
     WHERE ic.player_mentioned IS NOT NULL
       AND ic.player_mentioned <> ''
       AND ic.created_at IS NOT NULL
       AND ${createdAtSecondsExpr} >= ?
       AND ${createdAtSecondsExpr} <= ?`,
    [startTs, endTs],
  )

  const agg = new Map<
    string,
    { name: string; shirtNumber: number | null; total: number; pos: number; neg: number; neu: number }
  >()

  for (const row of rows) {
    if (!row.player_mentioned) continue
    const players = parseListText(row.player_mentioned)
    if (!players.length) continue

    const unique = Array.from(new Set(players.map((p) => normalizeName(p)).filter(Boolean)))

    for (const mentionKey of unique) {
      const player = aliasToPlayer.get(mentionKey)
      if (!player) continue
      addMentionAggregate(agg, player, row.sentiment)
    }
  }

  return agg
}

function pickMostPopular(
  agg: Map<
    string,
    { name: string; shirtNumber: number | null; total: number; pos: number; neg: number; neu: number }
  >,
) {
  let best: { name: string; shirtNumber: number | null; total: number; pos: number; neg: number; neu: number } | undefined

  for (const val of agg.values()) {
    if (!best || val.total > best.total) {
      best = val
    }
  }

  return best
}

function pickMostControversial(
  agg: Map<
    string,
    { name: string; shirtNumber: number | null; total: number; pos: number; neg: number; neu: number }
  >,
  excludeName?: string,
) {
  let best:
    | {
        name: string
        shirtNumber: number | null
        total: number
        pos: number
        neg: number
        neu: number
      }
    | undefined

  for (const val of agg.values()) {
    if (excludeName && val.name === excludeName) continue
    if (val.total < 3) continue

    const negativePct = val.total === 0 ? 0 : val.neg / val.total

    if (!best) {
      best = val
      continue
    }

    const bestNegativePct = best.total === 0 ? 0 : best.neg / best.total

    if (negativePct > bestNegativePct) {
      best = val
    } else if (negativePct === bestNegativePct && val.total > best.total) {
      best = val
    }
  }

  return best
}

type MatchRow = {
  fotmob_match_id: number
  home_team_name: string
  away_team_name: string
  score_str: string | null
  tournament_name: string | null
  match_utc_time: string | Date | null
  finished: number | null
}

async function loadMatches(start: Date, end: Date) {
  const startStr = `${toIsoDateOnly(start)} 00:00:00`
  const endStr = `${toIsoDateOnly(end)} 23:59:59`

  const matches = await query<MatchRow[]>(
    `SELECT fotmob_match_id, home_team_name, away_team_name, score_str, tournament_name, match_utc_time, finished
     FROM matches
     WHERE match_utc_time IS NOT NULL
       AND match_utc_time >= ?
       AND match_utc_time <= ?
     ORDER BY match_utc_time DESC
     LIMIT 12`,
    [startStr, endStr],
  )

  return matches.reverse()
}

function attachMatchesToPoints(points: SentimentJourneyPoint[], matches: MatchRow[]) {
  const events: SentimentJourneyEvent[] = []

  for (const match of matches) {
    if (!match.match_utc_time) continue
    const matchDate = new Date(match.match_utc_time)
    if (Number.isNaN(matchDate.getTime())) continue

    const matchIso = toIsoDateOnly(matchDate)
    const point = points.find((p) => matchIso >= p.isoStart && matchIso <= p.isoEnd)
    if (!point) continue

    const home = match.home_team_name || "Home"
    const away = match.away_team_name || "Away"
    const title = `${home} vs ${away}`

    const subtitleParts: string[] = []
    if (match.tournament_name) subtitleParts.push(match.tournament_name)
    if (match.score_str) subtitleParts.push(match.score_str)
    const subtitle = subtitleParts.join(" · ") || "Match"

    events.push({
      id: String(match.fotmob_match_id),
      xLabel: point.label,
      title,
      subtitle,
    })
  }

  const uniqueById = new Map<string, SentimentJourneyEvent>()
  for (const e of events) uniqueById.set(e.id, e)

  return Array.from(uniqueById.values())
}

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
            SUM(CASE WHEN LOWER(TRIM(ic.sentiment)) = 'positive' THEN 1 ELSE 0 END) as positiveCount,
            SUM(CASE WHEN LOWER(TRIM(ic.sentiment)) = 'negative' THEN 1 ELSE 0 END) as negativeCount
           FROM instagram_comments ic
           WHERE ic.created_at IS NOT NULL
             AND ${createdAtSecondsExpr} >= ?
             AND ${createdAtSecondsExpr} <= ?`,
          [startTs, endTs],
        ),
        query<Array<{ positiveCount: number; negativeCount: number }>>(
          `SELECT
            SUM(CASE WHEN LOWER(TRIM(ic.sentiment)) = 'positive' THEN 1 ELSE 0 END) as positiveCount,
            SUM(CASE WHEN LOWER(TRIM(ic.sentiment)) = 'negative' THEN 1 ELSE 0 END) as negativeCount
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

    const { aliasToPlayer } = await loadPlayerDirectory()

    const [currentMentionAgg, previousMentionAgg] = await Promise.all([
      loadMentionAggregates(startTs, endTs, aliasToPlayer),
      loadMentionAggregates(previousStartTs, previousEndTs, aliasToPlayer),
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

    const body: OverviewResponse = {
      meta: {
        start: toIsoDateOnly(start),
        end: toIsoDateOnly(end),
        previousStart: toIsoDateOnly(previousStart),
        previousEnd: toIsoDateOnly(previousEnd),
        granularity,
      },
      sentimentJourney: {
        points,
        summary,
        events,
      },
      playerMentions: {
        mostPopular,
        mostControversial,
      },
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
