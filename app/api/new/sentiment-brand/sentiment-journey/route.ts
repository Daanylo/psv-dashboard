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

type CommentRecord = {
  id: number | string
  comment_text: string
  created_at: string
  date: string
  pos: string | number
  neg: string | number
  neu: string | number
  topic_id: number
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
  // Try ISO format (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr
  }
  // Fallback: Try other formats
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

async function loadComments(): Promise<CommentRecord[]> {
  const filePath = path.join(
    process.cwd(),
    "public",
    "data",
    "json",
    "post_comments.json",
  )
  const raw = await fs.readFile(filePath, "utf-8")
  return JSON.parse(raw) as CommentRecord[]
}

function parseSentimentValue(value: string | number | undefined): number {
  if (typeof value === "number") return value
  if (typeof value === "string") {
    const num = parseFloat(value)
    return Number.isFinite(num) ? num : 0
  }
  return 0
}

function calculateAverageSentiment(comments: CommentRecord[]): { pos: number; neg: number; neu: number } {
  if (!comments.length) {
    return { pos: 33, neg: 33, neu: 34 } // Default even distribution when no comments
  }

  let totalPos = 0
  let totalNeg = 0
  let totalNeu = 0

  for (const comment of comments) {
    totalPos += parseSentimentValue(comment.pos)
    totalNeg += parseSentimentValue(comment.neg)
    totalNeu += parseSentimentValue(comment.neu)
  }

  const count = comments.length
  return {
    pos: Math.round((totalPos / count) * 100) / 100,
    neg: Math.round((totalNeg / count) * 100) / 100,
    neu: Math.round((totalNeu / count) * 100) / 100,
  }
}


export async function GET() {
  try {
    const [events, comments] = await Promise.all([
      loadEvents(),
      loadComments()
    ])

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

      // Filter comments for this day
      const dayComments = comments.filter((comment) => {
        const commentDate = comment.date.split('T')[0] // Extract YYYY-MM-DD from ISO string
        return commentDate === iso
      })

      const { pos, neg, neu } = calculateAverageSentiment(dayComments)

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
