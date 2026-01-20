import { NextResponse } from "next/server"
import { loadMatches, parseIsoDateOnly, toIsoDateOnly } from "@/lib/overview-data"

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const start = parseIsoDateOnly(url.searchParams.get("start"))
    const end = parseIsoDateOnly(url.searchParams.get("end"))

    if (!start || !end) {
      return NextResponse.json(
        { error: "Missing or invalid start/end (expected YYYY-MM-DD)" },
        { status: 400 },
      )
    }

    const matches = await loadMatches(start, end)

    return NextResponse.json({
      meta: { start: toIsoDateOnly(start), end: toIsoDateOnly(end) },
      matches: matches.map((m) => ({
        id: Number(m.fotmob_match_id),
        homeTeamName: m.home_team_name,
        awayTeamName: m.away_team_name,
        scoreStr: m.score_str,
        tournamentName: m.tournament_name,
        matchUtcTime: m.match_utc_time,
        finished: Number(m.finished ?? 0) === 1,
      })),
    })
  } catch (error) {
    console.error("Error loading matches:", error)
    return NextResponse.json({ error: "Failed to load matches" }, { status: 500 })
  }
}
