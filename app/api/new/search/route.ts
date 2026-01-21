import { NextResponse } from "next/server"
import { query } from "@/lib/db"

type SearchResultType = "event" | "player" | "sponsor"

type SearchResultItem = {
  type: SearchResultType
  title: string
  subtitle?: string | null
  href: string
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const qRaw = (url.searchParams.get("q") ?? "").trim()

    if (!qRaw) {
      return NextResponse.json({ results: [] })
    }

    const q = qRaw.slice(0, 100)
    const like = `%${q}%`

    const qNum = Number(q)
    const hasNum = Number.isFinite(qNum) && qNum > 0

    const [matches, players, brands] = await Promise.all([
      query<
        Array<{
          fotmob_match_id: number
          home_team_name: string
          away_team_name: string
          tournament_name: string | null
          score_str: string | null
          match_utc_time: string | Date | null
        }>
      >(
        `SELECT fotmob_match_id, home_team_name, away_team_name, tournament_name, score_str, match_utc_time
         FROM matches
         WHERE match_utc_time IS NOT NULL
           AND (
             ${hasNum ? "fotmob_match_id = ? OR" : ""}
             home_team_name LIKE ?
             OR away_team_name LIKE ?
             OR tournament_name LIKE ?
             OR score_str LIKE ?
           )
         ORDER BY match_utc_time DESC
         LIMIT 6`,
        hasNum
          ? [qNum, like, like, like, like]
          : [like, like, like, like],
      ),
      query<Array<{ fotmob_id: number; name: string; shirt_number: number | null; aliases: string | null }>>(
        `SELECT fotmob_id, name, shirt_number, aliases
         FROM players
         WHERE name LIKE ?
            OR aliases LIKE ?
         ORDER BY name ASC
         LIMIT 8`,
        [like, like],
      ),
      query<Array<{ slug: string; name: string }>>(
        `SELECT slug, name
         FROM brands
         WHERE name LIKE ?
            OR slug LIKE ?
         ORDER BY name ASC
         LIMIT 8`,
        [like, like],
      ),
    ])

    const results: SearchResultItem[] = []

    for (const m of matches) {
      const title = `${m.home_team_name} vs ${m.away_team_name}`
      const subtitleParts: string[] = []
      if (m.tournament_name) subtitleParts.push(m.tournament_name)
      if (m.score_str) subtitleParts.push(m.score_str)
      const subtitle = subtitleParts.join(" · ")

      results.push({
        type: "event",
        title,
        subtitle: subtitle || null,
        href: `/events?match_id=${Number(m.fotmob_match_id)}`,
      })
    }

    for (const p of players) {
      const number = p.shirt_number != null ? `#${p.shirt_number}` : null
      results.push({
        type: "player",
        title: p.name,
        subtitle: number,
        href: `/players?player_id=${Number(p.fotmob_id)}`,
      })
    }

    for (const b of brands) {
      results.push({
        type: "sponsor",
        title: b.name,
        subtitle: b.slug,
        href: `/sponsors-report?brand=${encodeURIComponent(b.slug)}`,
      })
    }

    return NextResponse.json({ results })
  } catch (error) {
    console.error("Search failed:", error)
    return NextResponse.json({ results: [] }, { status: 500 })
  }
}
