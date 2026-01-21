import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"

type Granularity = "day" | "week"

type SentimentJourneyPoint = {
  label: string
  sentiment: number
  isoStart: string
  isoEnd: string
}

type SentimentJourneySummary = {
  positiveCount: number
  negativeCount: number
  positiveChangePct: number
  negativeChangePct: number
}

function parseIsoDateOnly(value: string | null) {
  if (!value) return null
  const d = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(d.getTime())) return null
  return d
}

function toIsoDateOnly(d: Date) {
  const copy = new Date(d)
  copy.setUTCHours(0, 0, 0, 0)
  return copy.toISOString().slice(0, 10)
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

function parseCsvLine(line: string) {
  const columns: string[] = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      inQuotes = !inQuotes
      continue
    }

    if (char === "," && !inQuotes) {
      columns.push(current)
      current = ""
      continue
    }

    current += char
  }

  columns.push(current)
  return columns
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function percentChange(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : 100
  return ((current - previous) / previous) * 100
}

type CountsByKey = Map<string, { pos: number; neg: number }>

function aggregateCommentsByRange(
  lines: string[],
  startInclusive: Date,
  endInclusive: Date,
  granularity: Granularity
) {
  const byKey: CountsByKey = new Map()
  let posTotal = 0
  let negTotal = 0

  for (const line of lines) {
    if (!line.trim()) continue

    const cols = parseCsvLine(line)
    if (cols.length < 8) continue

    const dateRaw = (cols[2] || "").trim()
    const labelRaw = (cols[7] || "").trim().toLowerCase()

    if (!dateRaw || !labelRaw) continue

    const d = new Date(`${dateRaw}T00:00:00.000Z`)
    if (Number.isNaN(d.getTime())) continue

    if (d < startInclusive || d > endInclusive) continue

    let keyDateStart = d
    let keyDateEnd = d

    if (granularity === "week") {
      keyDateStart = startOfWeekUtc(d)
      keyDateEnd = endOfWeekUtc(d)
    }

    const key = toIsoDateOnly(keyDateStart)
    const current = byKey.get(key) ?? { pos: 0, neg: 0 }

    if (labelRaw === "positive") {
      current.pos += 1
      posTotal += 1
    } else if (labelRaw === "negative") {
      current.neg += 1
      negTotal += 1
    }

    byKey.set(key, current)
  }

  const points: SentimentJourneyPoint[] = Array.from(byKey.entries())
    .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
    .map(([key, counts]) => {
      const rangeStart = parseIsoDateOnly(key)!
      const rangeEnd = granularity === "week" ? endOfWeekUtc(rangeStart) : rangeStart

      const total = counts.pos + counts.neg
      const score = total === 0 ? 0 : ((counts.pos - counts.neg) / total) * 100
      const label = rangeStart.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })

      return {
        label,
        sentiment: clamp(Math.round(score), -100, 100),
        isoStart: toIsoDateOnly(rangeStart),
        isoEnd: toIsoDateOnly(rangeEnd),
      }
    })

  return { points, posTotal, negTotal }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const start = parseIsoDateOnly(url.searchParams.get("start"))
    const end = parseIsoDateOnly(url.searchParams.get("end"))
    const granularityParam = url.searchParams.get("granularity")

    if (!start || !end) {
      return NextResponse.json(
        { error: "Missing or invalid start/end (expected YYYY-MM-DD)" },
        { status: 400 }
      )
    }

    const granularity: Granularity =
      granularityParam === "week" || granularityParam === "day"
        ? (granularityParam as Granularity)
        : "day"

    const startInclusive = new Date(start)
    startInclusive.setUTCHours(0, 0, 0, 0)

    const endInclusive = new Date(end)
    endInclusive.setUTCHours(0, 0, 0, 0)

    const days =
      Math.floor((endInclusive.getTime() - startInclusive.getTime()) / (24 * 60 * 60 * 1000)) + 1

    const previousEnd = addDaysUtc(startInclusive, -1)
    const previousStart = addDaysUtc(previousEnd, -(days - 1))

    const filePath = path.join(process.cwd(), "public", "data", "comments.csv")
    const csvText = fs.readFileSync(filePath, "utf-8")
    const lines = csvText.split("\n").slice(1)

    const currentAgg = aggregateCommentsByRange(lines, startInclusive, endInclusive, granularity)
    const previousAgg = aggregateCommentsByRange(lines, previousStart, previousEnd, granularity)

    const summary: SentimentJourneySummary = {
      positiveCount: currentAgg.posTotal,
      negativeCount: currentAgg.negTotal,
      positiveChangePct: percentChange(currentAgg.posTotal, previousAgg.posTotal),
      negativeChangePct: percentChange(currentAgg.negTotal, previousAgg.negTotal),
    }

    return NextResponse.json({
      points: currentAgg.points,
      summary,
      meta: {
        start: toIsoDateOnly(startInclusive),
        end: toIsoDateOnly(endInclusive),
        previousStart: toIsoDateOnly(previousStart),
        previousEnd: toIsoDateOnly(previousEnd),
        granularity,
      },
    })
  } catch (error) {
    console.error("Error building sentiment journey:", error)
    return NextResponse.json(
      { error: "Failed to build sentiment journey" },
      { status: 500 }
    )
  }
}
