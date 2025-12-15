import { NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"

type EventEntry = {
  date_display?: string
  day_of_week?: string
  time?: string
  club?: string
  competition?: string
  home?: string
  away?: string
  result?: string
  event?: string
  details?: string
  club_id?: number
}

type JourneyDay = {
  date: string // YYYY-MM-DD
  pos: number
  neg: number
  neu: number
  events: Array<{
    title: string
    competition?: string
    home?: string
    away?: string
    result?: string
    time?: string
  }>
}

function toIsoDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

function parseDateString(dateStr?: string): string | null {
  if (!dateStr) return null
  // Try ISO / RFC parse
  const direct = Date.parse(dateStr)
  if (!Number.isNaN(direct)) {
    return toIsoDate(new Date(direct))
  }
  // Try formats like "26 October 2025"
  const parsed = Date.parse(dateStr.replace(/\//g, "-"))
  if (!Number.isNaN(parsed)) {
    return toIsoDate(new Date(parsed))
  }
  return null
}

async function loadEvents(): Promise<EventEntry[]> {
  const filePath = path.join(
    process.cwd(),
    "public",
    "data",
    "json",
    "events.json",
  )
  const raw = await fs.readFile(filePath, "utf-8")
  return JSON.parse(raw) as EventEntry[]
}

function randomDistribution() {
  // simple random split that sums to 100
  const a = Math.random()
  const b = Math.random()
  const c = Math.random()
  const sum = a + b + c
  const pos = Math.round((a / sum) * 100)
  const neg = Math.round((b / sum) * 100)
  let neu = 100 - pos - neg
  // adjust tiny rounding drift
  if (neu < 0) neu = 0
  return { pos, neg, neu }
}

export async function GET() {
  try {
    const events = await loadEvents()

    const today = new Date()
    const end = new Date(today)
    end.setDate(today.getDate() - 1) // tot en met gisteren
    const start = new Date(end)
    start.setDate(end.getDate() - 13) // 14 dagen exclusief vandaag

    const days: JourneyDay[] = []
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const iso = toIsoDate(d)
      const matches = events.filter((evt) => {
        if (evt.club_id !== 1) return false
        const parsed = parseDateString(evt.date_display)
        return parsed === iso
      })
      const { pos, neg, neu } = randomDistribution()

      days.push({
        date: iso,
        pos,
        neg,
        neu,
        events: matches.map((m) => ({
          title: m.event || `${m.home ?? ""} vs ${m.away ?? ""}`.trim(),
          competition: m.competition,
          home: m.home,
          away: m.away,
          result: m.result,
          time: m.time,
        })),
      })
    }

    return NextResponse.json({ days })
  } catch (error) {
    console.error("[sentiment-journey] failed", error)
    return NextResponse.json(
      { error: "Failed to build sentiment journey" },
      { status: 500 },
    )
  }
}
