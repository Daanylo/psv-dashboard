import { promises as fs } from "fs"
import path from "path"
import { NextResponse } from "next/server"

type PostComment = {
  date?: string
  pos?: string
  neg?: string
  neu?: string
}

const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000
const commentsFilePath = path.join(
  process.cwd(),
  "public",
  "data",
  "json",
  "post_comments.json"
)

async function loadComments(): Promise<PostComment[]> {
  const fileContent = await fs.readFile(commentsFilePath, "utf-8")
  const parsed = JSON.parse(fileContent)

  if (!Array.isArray(parsed)) {
    throw new Error("Invalid post_comments.json format")
  }

  return parsed
}

function aggregateWindow(
  comments: PostComment[],
  startTs: number,
  endTs: number
) {
  let count = 0
  let posSum = 0
  let negSum = 0
  let neuSum = 0

  for (const comment of comments) {
    const timestampSource = comment?.date
    if (!timestampSource) continue

    const ts = new Date(timestampSource).getTime()
    if (Number.isNaN(ts)) continue

    if (ts >= startTs && ts <= endTs) {
      count += 1
      const pos = Number.parseFloat(comment.pos ?? "")
      const neg = Number.parseFloat(comment.neg ?? "")
      const neu = Number.parseFloat(comment.neu ?? "")

      posSum += Number.isFinite(pos) ? pos : 0
      negSum += Number.isFinite(neg) ? neg : 0
      neuSum += Number.isFinite(neu) ? neu : 0
    }
  }

  const safeDiv = (sum: number) => (count > 0 ? sum / count : 0)

  return {
    count,
    avgPos: safeDiv(posSum),
    avgNeg: safeDiv(negSum),
    avgNeu: safeDiv(neuSum),
  }
}

export async function GET() {
  try {
    const comments = await loadComments()
    const now = Date.now()
    const currentStart = now - TWO_WEEKS_MS
    const previousStart = now - 2 * TWO_WEEKS_MS
    const previousEnd = now - TWO_WEEKS_MS

    const currentWindow = aggregateWindow(comments, currentStart, now)
    const previousWindow = aggregateWindow(comments, previousStart, previousEnd)

    const pctChange = (current: number, previous: number) => {
      if (!Number.isFinite(previous) || previous === 0) return current > 0 ? 100 : 0
      return ((current - previous) / previous) * 100
    }

    return NextResponse.json({
      current_window: {
        total_comments: currentWindow.count,
        average_positive: Math.round(currentWindow.avgPos * 100) / 100,
        average_negative: Math.round(currentWindow.avgNeg * 100) / 100,
        average_neutral: Math.round(currentWindow.avgNeu * 100) / 100,
      },
      previous_window: {
        total_comments: previousWindow.count,
        average_positive: Math.round(previousWindow.avgPos * 100) / 100,
        average_negative: Math.round(previousWindow.avgNeg * 100) / 100,
        average_neutral: Math.round(previousWindow.avgNeu * 100) / 100,
      },
      average_positive_pct: Math.round(
        pctChange(currentWindow.avgPos, previousWindow.avgPos) * 100
      ) / 100
    })
  } catch (error) {
    console.error("average-team-sentiment-gauge API error:", error)
    return NextResponse.json(
      { error: "Failed to calculate comments for last 2 weeks" },
      { status: 500 }
    )
  }
}
