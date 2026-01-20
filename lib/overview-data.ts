import { query } from "@/lib/db"

export type Granularity = "day" | "week"

export type SentimentJourneyPoint = {
  label: string
  positiveCount: number
  negativeCount: number
  negativeDisplay: number
  totalCount: number
  isoStart: string
  isoEnd: string
}

export type SentimentJourneySummary = {
  positiveCount: number
  negativeCount: number
  positiveChangePct: number
  negativeChangePct: number
}

export type SentimentJourneyEvent = {
  id: string
  xLabel: string
  title: string
  subtitle: string
}

export type MentionsPoint = {
  label: string
  player: number
  avg: number
}

export type PlayerComment = {
  id: string
  text: string
  likes: number
  sentiment: string
  date: string
  playerMentioned: string
}

export type MentionedPlayer = {
  name: string
  shirtNumber: number | null
  mentions: number
  mentionsChangePct: number
  positivePct: number
  neutralPct: number
  negativePct: number
}

export type HotTopic = {
  rank: number
  topic: string
  mentions: number
}

export type PlayerReportItem = {
  name: string
  fotmobId: number
  shirtNumber: number | null
  position: string | null
  mentions: number
  motm: number
  positivePct: number
  avgRating: number | null
  marketValue: number | null
  goals: number
  assists: number
  countryCode: string | null
  age: number | null
}

export type TopExposure = {
  brand: string
  appearances: number
  postUrl: string
  visibilityScore: number
  avgVisibility: number
}

export type OverviewResponse = {
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
  aiSummary: string | null
  sentimentJourney: {
    points: SentimentJourneyPoint[]
    summary: SentimentJourneySummary
    events: SentimentJourneyEvent[]
  }
  mentionsJourney: MentionsPoint[]
  playerMentions: {
    mostPopular: MentionedPlayer | null
    mostControversial: MentionedPlayer | null
    fullReport: PlayerReportItem[]
  }
  hotTopics: HotTopic[]
  topExposures: TopExposure[]
}

export function parseIsoDateOnly(value: string | null) {
  if (!value) return null
  const d = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(d.getTime())) return null
  return d
}

export function toIsoDateOnly(date: Date) {
  const d = new Date(date)
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString().slice(0, 10)
}

export function addDaysUtc(date: Date, days: number) {
  const d = new Date(date)
  d.setUTCDate(d.getUTCDate() + days)
  return d
}

export function startOfWeekUtc(date: Date) {
  const d = new Date(date)
  const day = d.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diff)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

export function endOfWeekUtc(date: Date) {
  return addDaysUtc(startOfWeekUtc(date), 6)
}

export function percentChange(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : 100
  return ((current - previous) / previous) * 100
}

export function labelForDateUtc(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })
}

export const createdAtSecondsExpr = "ic.created_at_ts"

export async function loadSentimentCountsByDay(startTs: number, endTs: number) {
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
      SUM(1 + COALESCE(ic.likes, 0)) as totalCount,
      SUM(CASE WHEN LOWER(TRIM(ic.sentiment)) = 'positive' THEN (1 + COALESCE(ic.likes, 0)) ELSE 0 END) as positiveCount,
      SUM(CASE WHEN LOWER(TRIM(ic.sentiment)) = 'negative' THEN (1 + COALESCE(ic.likes, 0)) ELSE 0 END) as negativeCount
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

export function buildDailyPoints(
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

export function buildWeeklyPoints(
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

export type PlayerRow = {
  fotmob_id: number
  name: string
  shirt_number: number | null
  aliases: string | null
  transfer_value: number | string | null
  position_group: string | null
  goals: number | null
  assists: number | null
  position_ids_desc: string | null
  country_code: string | null
  age: number | null
  rating: number | string | null
}

export function stripDiacritics(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
}

export function normalizeName(value: string) {
  return stripDiacritics(value)
    .toLowerCase()
    .replace(/["'`]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function parseListText(value: string): string[] {
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

export async function loadPlayerDirectory() {
  const players = await query<PlayerRow[]>(
    `SELECT fotmob_id, name, shirt_number, aliases, transfer_value, position_group, goals, assists, position_ids_desc, country_code, age, rating
     FROM players`,
  )

  const matchesPlayedRows = await query<Array<{ player_id: number; matchesPlayed: number }>>(
    `SELECT player_id, COUNT(*) as matchesPlayed
     FROM player_match_performance
     WHERE minutes_played > 0
     GROUP BY player_id`,
  )

  const motmRows = await query<Array<{ player_id: number; motmCount: number }>>(
    `SELECT
       player_id,
       COUNT(*) as motmCount
     FROM player_match_performance pmp
     WHERE minutes_played > 0
       AND fun_facts IS NOT NULL
       AND JSON_SEARCH(pmp.fun_facts, 'one', 'fun_fact_motm', NULL, '$[*].key') IS NOT NULL
     GROUP BY player_id`,
  )

  const matchesPlayedByPlayer = new Map<number, number>()
  for (const row of matchesPlayedRows) {
    matchesPlayedByPlayer.set(Number(row.player_id), Number(row.matchesPlayed ?? 0))
  }

  const motmByPlayer = new Map<number, number>()
  for (const row of motmRows) {
    motmByPlayer.set(Number(row.player_id), Number(row.motmCount ?? 0))
  }

  type PlayerCanonical = {
    name: string
    shirtNumber: number | null
    fotmobId: number
    transferValue: number | null
    position: string | null
    goals: number
    assists: number
    countryCode: string | null
    age: number | null
    aliases: string[]
    rating: number | null
    matchesPlayed: number
    motm: number
  }

  const aliasToPlayer = new Map<string, PlayerCanonical>()
  const allPlayers: PlayerCanonical[] = []

  for (const player of players) {
    let pos = player.position_group
    if (player.position_ids_desc) {
      const parts = player.position_ids_desc.split(",")
      if (parts.length > 0 && parts[0].trim()) {
        pos = parts[0].trim()
      }
    }

    const playerAliases: string[] = []
    if (player.aliases) {
        playerAliases.push(...parseListText(player.aliases))
    }

    const canonical: PlayerCanonical = {
      name: player.name,
      shirtNumber:
        player.shirt_number === null || player.shirt_number === undefined
          ? null
          : Number(player.shirt_number),
      fotmobId: Number(player.fotmob_id),
      transferValue: player.transfer_value ? Number(player.transfer_value) : null,
      position: pos,
      goals: Number(player.goals ?? 0),
      assists: Number(player.assists ?? 0),
      countryCode: player.country_code,
      age: player.age !== null ? Number(player.age) : null,
      aliases: playerAliases,
      rating: player.rating !== null && player.rating !== undefined ? Number(player.rating) : null,
      matchesPlayed: matchesPlayedByPlayer.get(Number(player.fotmob_id)) ?? 0,
      motm: motmByPlayer.get(Number(player.fotmob_id)) ?? 0,
    }

    allPlayers.push(canonical)

    const addAlias = (alias: string) => {
      const key = normalizeName(alias)
      if (!key) return
      if (!aliasToPlayer.has(key)) {
        aliasToPlayer.set(key, canonical)
      }
    }

    addAlias(player.name)
    playerAliases.forEach(addAlias)
  }

  return { aliasToPlayer, allPlayers }
}

export async function loadPlayerRatings(start: Date, end: Date) {
  const startStr = `${toIsoDateOnly(start)} 00:00:00`
  const endStr = `${toIsoDateOnly(end)} 23:59:59`

  const rows = await query<{ player_id: number; rating: number }[]>(
    `SELECT player_id, AVG(fotmob_rating) as rating
     FROM player_match_performance pmp
     WHERE match_date >= ?
       AND match_date <= ?
       AND fotmob_rating IS NOT NULL
     GROUP BY player_id`,
    [startStr, endStr],
  )

  const map = new Map<number, number>()
  for (const row of rows) {
    map.set(row.player_id, Number(row.rating))
  }
  return map
}

export async function loadPlayerMotmCounts(start: Date, end: Date, playerId?: number | null) {
  const startStr = `${toIsoDateOnly(start)} 00:00:00`
  const endStr = `${toIsoDateOnly(end)} 23:59:59`

  const params: Array<string | number> = [startStr, endStr]
  const playerClause = playerId ? "AND pmp.player_id = ?" : ""
  if (playerId) params.push(playerId)

  const rows = await query<Array<{ player_id: number; motmCount: number }>>(
    `SELECT
        pmp.player_id,
        COUNT(*) as motmCount
     FROM player_match_performance pmp
     WHERE pmp.match_date IS NOT NULL
       AND pmp.match_date >= ?
       AND pmp.match_date <= ?
       ${playerClause}
       AND pmp.fun_facts IS NOT NULL
       AND JSON_SEARCH(pmp.fun_facts, 'one', 'fun_fact_motm', NULL, '$[*].key') IS NOT NULL
     GROUP BY pmp.player_id`,
    params,
  )

  const map = new Map<number, number>()
  for (const row of rows) {
    map.set(Number(row.player_id), Number(row.motmCount ?? 0))
  }
  return map
}

export type MentionRow = {
  player_mentioned: string | null
  sentiment: string | null
  likes: number | null
}

export type AggregatedPlayer = {
  name: string
  shirtNumber: number | null
  fotmobId: number
  transferValue: number | null
  position: string | null
  total: number
  pos: number
  neg: number
  neu: number
}

export function addMentionAggregate(
  target: Map<string, AggregatedPlayer>,
  player: {
    name: string
    shirtNumber: number | null
    fotmobId: number
    transferValue: number | null
    position: string | null
  },
  sentiment: string | null,
  likes: number | null,
) {
  const key = player.name
  const current =
    target.get(key) ??
    ({
      name: player.name,
      shirtNumber: player.shirtNumber,
      fotmobId: player.fotmobId,
      transferValue: player.transferValue,
      position: player.position,
      total: 0,
      pos: 0,
      neg: 0,
      neu: 0,
    } as const)

  const weight = 1 + (likes || 0)

  const next = {
    ...current,
    total: current.total + weight,
  }

  const s = (sentiment ?? "").toLowerCase()
  const normalized = s.trim()
  if (normalized === "positive") next.pos += weight
  else if (normalized === "negative") next.neg += weight
  else next.neu += weight

  target.set(key, next)
}

export function finalizeMentionedPlayer(
  agg: AggregatedPlayer | undefined,
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

export async function loadMentionAggregates(
  startTs: number,
  endTs: number,
  aliasToPlayer: Map<
    string,
    {
      name: string
      shirtNumber: number | null
      fotmobId: number
      transferValue: number | null
      position: string | null
    }
  >,
) {
  const rows = await query<MentionRow[]>(
    `SELECT ic.player_mentioned, ic.sentiment, ic.likes
     FROM instagram_comments ic
     WHERE ic.player_mentioned IS NOT NULL
       AND ic.player_mentioned <> ''
       AND ic.created_at IS NOT NULL
       AND ${createdAtSecondsExpr} >= ?
       AND ${createdAtSecondsExpr} <= ?`,
    [startTs, endTs],
  )

  const agg = new Map<string, AggregatedPlayer>()

  for (const row of rows) {
    if (!row.player_mentioned) continue
    const players = parseListText(row.player_mentioned)
    if (!players.length) continue

    const unique = Array.from(
      new Set(players.map((p) => normalizeName(p)).filter(Boolean)),
    )

    for (const mentionKey of unique) {
      const player = aliasToPlayer.get(mentionKey)
      if (!player) continue
      addMentionAggregate(agg, player, row.sentiment, row.likes)
    }
  }

  return agg
}

export function pickMostPopular(agg: Map<string, AggregatedPlayer>) {
  let best: AggregatedPlayer | undefined
  for (const val of agg.values()) {
    if (!best || val.total > best.total) {
      best = val
    }
  }
  return best
}

export function pickMostControversial(
  agg: Map<string, AggregatedPlayer>,
  excludeName?: string,
) {
  let best: AggregatedPlayer | undefined

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

export type MatchRow = {
  fotmob_match_id: number
  home_team_id: number
  home_team_name: string
  away_team_id: number
  away_team_name: string
  score_str: string | null
  tournament_name: string | null
  match_utc_time: string | Date | null
  finished: number | null
}

export async function loadMatches(start: Date, end: Date) {
  const startStr = `${toIsoDateOnly(start)} 00:00:00`
  const endStr = `${toIsoDateOnly(end)} 23:59:59`

  const matches = await query<MatchRow[]>(
    `SELECT fotmob_match_id, home_team_id, home_team_name, away_team_id, away_team_name, score_str, tournament_name, match_utc_time, finished
     FROM matches
     WHERE match_utc_time IS NOT NULL
       AND match_utc_time >= ?
       AND match_utc_time <= ?
     ORDER BY match_utc_time DESC
     LIMIT 100`,
    [startStr, endStr],
  )

  return matches.reverse()
}

export function attachMatchesToPoints(points: SentimentJourneyPoint[], matches: MatchRow[]) {
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

export async function loadHotTopics(
  start: Date,
  end: Date,
  dailyCounts: Map<string, { total: number }>,
) {
  const startStr = `${toIsoDateOnly(start)} 00:00:00`
  const endStr = `${toIsoDateOnly(end)} 23:59:59`

  const matches = await query<MatchRow[]>(
    `SELECT fotmob_match_id, home_team_id, home_team_name, away_team_id, away_team_name, score_str, tournament_name, match_utc_time, finished
     FROM matches
     WHERE match_utc_time IS NOT NULL
       AND match_utc_time >= ?
       AND match_utc_time <= ?`,
    [startStr, endStr],
  )

  const results: HotTopic[] = []

  for (const m of matches) {
    if (!m.match_utc_time) continue
    const matchDate = new Date(m.match_utc_time)
    if (Number.isNaN(matchDate.getTime())) continue

    const isoDate = toIsoDateOnly(matchDate)
    const counts = dailyCounts.get(isoDate)
    const mentions = counts?.total ?? 0

    const topic = `${m.home_team_name} vs ${m.away_team_name}`
    results.push({
      rank: 0,
      topic,
      mentions,
    })
  }

  results.sort((a, b) => b.mentions - a.mentions)

  return results.slice(0, 10).map((r, i) => ({ ...r, rank: i + 1 }))
}

export async function loadTopExposures(startTs: number, endTs: number) {
  // 1. Get top 3 brands by frequency
  const brandRows = await query<{ brand: string; count: number; avg_viz: number }[]>(
    `SELECT ld.logo_label as brand, COUNT(*) as count, AVG(ld.visibility_score) as avg_viz
     FROM logo_detections ld
     JOIN instagram_posts ip ON ld.post_id = ip.id
     WHERE ip.taken_at_timestamp >= ? AND ip.taken_at_timestamp <= ?
       AND ld.logo_label IS NOT NULL AND ld.logo_label <> ''
     GROUP BY ld.logo_label
     ORDER BY count DESC
     LIMIT 3`,
    [startTs, endTs],
  )

  const results: TopExposure[] = []

  for (const b of brandRows) {
    // 2. Get best post for each brand (by visibility score)
    const posts = await query<{ url: string; shortcode: string; viz: number }[]>(
      `SELECT ip.url, ip.shortcode, ld.visibility_score as viz
       FROM logo_detections ld
       JOIN instagram_posts ip ON ld.post_id = ip.id
       WHERE ld.logo_label = ?
         AND ip.taken_at_timestamp >= ? AND ip.taken_at_timestamp <= ?
       ORDER BY ld.visibility_score DESC
       LIMIT 1`,
      [b.brand, startTs, endTs],
    )

    if (posts.length > 0) {
      results.push({
        brand: b.brand,
        appearances: Number(b.count),
        postUrl: posts[0].shortcode ? `https://www.instagram.com/p/${posts[0].shortcode}/media/?size=l` : posts[0].url || "",
        visibilityScore: Number(posts[0].viz),
        avgVisibility: Number(b.avg_viz || 0),
      })
    }
  }

  return results
}

export async function loadPlayerSentimentCountsByDay(
  startTs: number,
  endTs: number,
  targetFotmobId: number,
  aliasToPlayer: Map<string, { fotmobId: number }>,
) {
  const rows = await query<{
    created_at_ts: number
    sentiment: string
    likes: number
    player_mentioned: string | null
  }[]>(
    `SELECT
       ${createdAtSecondsExpr} as created_at_ts,
       ic.sentiment,
       ic.likes,
       ic.player_mentioned
     FROM instagram_comments ic
     WHERE ic.created_at IS NOT NULL
       AND ${createdAtSecondsExpr} >= ?
       AND ${createdAtSecondsExpr} <= ?
       AND ic.player_mentioned IS NOT NULL`,
    [startTs, endTs],
  )

  const map = new Map<string, { total: number; pos: number; neg: number }>()

  for (const row of rows) {
    if (!row.player_mentioned) continue
    const players = parseListText(row.player_mentioned)
    if (!players.length) continue

    const uniqueKeys = new Set(players.map((p) => normalizeName(p)).filter(Boolean))
    let relevant = false
    
    for (const key of uniqueKeys) {
      const p = aliasToPlayer.get(key)
      if (p && p.fotmobId === targetFotmobId) {
        relevant = true
        break
      }
    }

    if (!relevant) continue

    const date = new Date(row.created_at_ts * 1000)
    const dayKey = toIsoDateOnly(date)

    if (!map.has(dayKey)) {
      map.set(dayKey, { total: 0, pos: 0, neg: 0 })
    }

    const entry = map.get(dayKey)!
    const weight = 1 + (row.likes || 0)
    const s = (row.sentiment || "").trim().toLowerCase()

    entry.total += weight
    if (s === "positive") entry.pos += weight
    if (s === "negative") entry.neg += weight
  }

  return map
}

export async function loadPlayerComments(
  startTs: number,
  endTs: number,
  targetFotmobId: number,
  aliasToPlayer: Map<string, { fotmobId: number }>,
  sort: "likes" | "time",
  sentimentFilter: "all" | "positive" | "neutral" | "negative",
  searchTerms: string[] = [],
  limit = 50,
) {
  let sentimentClause = ""
  const params: (number | string)[] = [startTs, endTs]
    
    if (sentimentFilter !== "all") {
      sentimentClause = "AND LOWER(TRIM(ic.sentiment)) = ?"
      params.push(sentimentFilter)
    }

    // Build LIKE clauses for player mentions
    // We only fetch rows where player_mentioned contains one of the alias names
    // player_mentioned is a string representation of a list: "['Name 1', 'Name 2']" or similar
    // We use %Name% to be safe.
    let likeClause = ""
    if (searchTerms.length > 0) {
        // Filter out very short aliases to avoid false positives (e.g. "Jo")
        // But if the name IS "Jo", we might have to use it.
        // Let's rely on the calling code to provide good terms.
        const validTerms = searchTerms.filter(t => t.length > 2);
        
        if (validTerms.length > 0) {
            const orParts = validTerms.map(() => "ic.player_mentioned LIKE ?")
            likeClause = `AND (${orParts.join(" OR ")})`
            validTerms.forEach(t => params.push(`%${t}%`))
        }
    }

    // We have to filter by player in JS to get exact matches,
    // so we may need to fetch more rows than 'limit' initially if we relied on DB limit,
    // but since we can't reliably filter by player in SQL (messy json/string),
    // we'll fetch broader set (maybe with a sane hard limit 1000?) and then filter & sort & slice in JS.
    // BUT if we sort by likes in SQL, we might get top liked comments that ARENT about the player.
    // So we must fetch ALL potential candidates, distinct by player mention being present.

    const rows = await query<{
      created_at_ts: number
      sentiment: string
      likes: number
      player_mentioned: string | null
      text: string
      id: number
    }[]>(
      `SELECT
         ${createdAtSecondsExpr} as created_at_ts,
         ic.sentiment,
         ic.likes,
         ic.player_mentioned,
         ic.text,
         ic.id
       FROM instagram_comments ic
       WHERE ic.created_at IS NOT NULL
         AND ${createdAtSecondsExpr} >= ?
         AND ${createdAtSecondsExpr} <= ?
         AND ic.player_mentioned IS NOT NULL
         ${sentimentClause}
         ${likeClause}`,
      params,
    )

  const relevantComments: PlayerComment[] = []

  // Filter results in JS
  for (const row of rows) {
    if (!row.player_mentioned) continue

    const players = parseListText(row.player_mentioned)
    const uniqueKeys = new Set(players.map((p) => normalizeName(p)).filter(Boolean))

    let relevant = false
    for (const key of uniqueKeys) {
      const p = aliasToPlayer.get(key)
      if (p && p.fotmobId === targetFotmobId) {
        relevant = true
        break
      }
    }

    if (relevant) {
      relevantComments.push({
        id: row.id.toString(),
        text: row.text,
        likes: row.likes || 0,
        sentiment: (row.sentiment || "").trim().toLowerCase(),
        date: new Date(row.created_at_ts * 1000).toISOString(),
        playerMentioned: row.player_mentioned,
      })
    }
  }

  // Sort
  relevantComments.sort((a, b) => {
    if (sort === "likes") {
       if (b.likes !== a.likes) return b.likes - a.likes
       return new Date(b.date).getTime() - new Date(a.date).getTime()
    } else {
       return new Date(b.date).getTime() - new Date(a.date).getTime()
    }
  })

  return relevantComments.slice(0, limit)
}

export async function loadMentionsJourney(
  startTs: number,
  endTs: number,
  granularity: Granularity,
  playerId?: number | null,
) {
  // Query daily totals for ALL players (to calculate avg)
  const allRows = await query<{
    created_at_ts: number
    likes: number
  }[]>(
    `SELECT
       ${createdAtSecondsExpr} as created_at_ts,
       ic.likes
     FROM instagram_comments ic
     WHERE ic.created_at IS NOT NULL
       AND ${createdAtSecondsExpr} >= ?
       AND ${createdAtSecondsExpr} <= ?
       AND ic.player_mentioned IS NOT NULL`,
    [startTs, endTs],
  )
    
  // If specific player requested, query just their mentions
  let playerRows: typeof allRows = []
  if (playerId) {
    const { aliasToPlayer } = await loadPlayerDirectory()
    const pRowsRaw = await query<{
        created_at_ts: number
        likes: number
        player_mentioned: string
    }[]>(
        `SELECT
        ${createdAtSecondsExpr} as created_at_ts,
        ic.likes,
        ic.player_mentioned
        FROM instagram_comments ic
        WHERE ic.created_at IS NOT NULL
        AND ${createdAtSecondsExpr} >= ?
        AND ${createdAtSecondsExpr} <= ?
        AND ic.player_mentioned IS NOT NULL`,
        [startTs, endTs],
    )

    // Filter in JS because player_mentioned is a messy list string
    for (const row of pRowsRaw) {
        if (!row.player_mentioned) continue
        const players = parseListText(row.player_mentioned)
        const uniqueKeys = new Set(players.map((p) => normalizeName(p)).filter(Boolean))
        let relevant = false
        for (const key of uniqueKeys) {
            const p = aliasToPlayer.get(key)
            if (p && p.fotmobId === playerId) {
            relevant = true
            break
            }
        }
        if (relevant) {
            playerRows.push({ created_at_ts: row.created_at_ts, likes: row.likes })
        }
    }
  }

  // Aggregate by day
  const dailyMap = new Map<string, { total: number; player: number }>()
  
  // Total bucket (all players)
  for (const row of allRows) {
    const d = new Date(row.created_at_ts * 1000)
    const key = toIsoDateOnly(d)
    if (!dailyMap.has(key)) dailyMap.set(key, { total: 0, player: 0 })
    dailyMap.get(key)!.total += (1 + (row.likes || 0))
  }

  // Player bucket
  if (playerId) {
     for (const row of playerRows) {
        const d = new Date(row.created_at_ts * 1000)
        const key = toIsoDateOnly(d)
        if (!dailyMap.has(key)) dailyMap.set(key, { total: 0, player: 0 })
        dailyMap.get(key)!.player += (1 + (row.likes || 0))
     }
  }

  // Now build points based on granularity
  const startDate = new Date(startTs * 1000)
  const endDate = new Date(endTs * 1000)
  
  // Create a continuous timeline of days first
  const dayPoints: { date: Date; total: number; player: number }[] = []
  let c = new Date(startDate)
  c.setHours(0,0,0,0)
  const endD = new Date(endDate)
  endD.setHours(0,0,0,0)

  while (c <= endD) {
      const iso = toIsoDateOnly(c)
      const data = dailyMap.get(iso) || { total: 0, player: 0 }
      dayPoints.push({
          date: new Date(c),
          total: data.total,
          player: data.player
      })
      c.setDate(c.getDate() + 1)
  }

  // Helper for rolling average
  function getRollingAvg(index: number, days: number, field: 'total' | 'player') {
      let sum = 0
      let count = 0
      for (let i = 0; i < days; i++) {
          if (index - i >= 0) {
              sum += dayPoints[index - i][field]
              count++
          }
      }
      return count > 0 ? sum / count : 0
  }

  // If daily, apply 7-day rolling average
  if (granularity === 'day') {
      return dayPoints.map((p, idx) => ({
          label: labelForDateUtc(p.date), // Re-use labelForDateUtc logic or similar
          // For total, we want roughly the average mentions *per player* to compare against specific player?
          // Or just total mentions? The mock data had "avg" around 500-600 and "player" around 600-1400.
          // This suggests "avg" is "Average Player Mentions" (Top players).
          // Since we don't know how many players are in the "pool", let's assume ~20 active players for normalization?
          // Or we can just return raw total and let frontend handle scaling.
          // Actually user asked for "7 day running average".
          
          // Let's assume 'avg' means "Market Average" -> Total Mentions / 15 (approx squad size relevant on social)
          avg: Math.round(getRollingAvg(idx, 7, 'total') / 15),
          player: Math.round(getRollingAvg(idx, 7, 'player'))
      }))
  } else {
      // Weekly aggregation
      // We can just sum up weeks?
      // Or do we still want rolling average? User asked for "7 day running average".
      // Usually weekly chart means "Sum of that week".
      // Let's stick to daily logic for rolling avg but aggregated if weekly?
      // No, for weekly granularity, usually it's just bucketed per week.
      
      const weeklyPoints: MentionsPoint[] = []
      // ... reuse buildWeeklyPoints logic style ...
      
      // Let's keep it simple: if weekly, just group by week
      // (Similar to buildWeeklyPoints but for this specific data structure)
      
      // Re-implement basic weekly bucketing
      let currentWeekStart = startOfWeekUtc(startDate)
      while (currentWeekStart <= endD) {
          const currentWeekEnd = endOfWeekUtc(currentWeekStart)
          
          let sumTotal = 0
          let sumPlayer = 0
          
          // Find days in this week
          dayPoints.forEach(p => {
              if (p.date >= currentWeekStart && p.date <= currentWeekEnd) {
                  sumTotal += p.total
                  sumPlayer += p.player
              }
          })
          
          weeklyPoints.push({
              label: labelForDateUtc(currentWeekStart), // Using start date as label
              avg: Math.round(sumTotal / 15), // Normalize by approx squad size
              player: sumPlayer
          })
          
          currentWeekStart = addDaysUtc(currentWeekStart, 7)
      }
      return weeklyPoints
  }
}
