import { NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"

type Comment = {
  id: number | string
  post_id: string
  topic_id: number
  created_at: string
}

type Topic = {
  id: number
  insight: string
  content: string
}

const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000

async function loadComments(): Promise<Comment[]> {
  const filePath = path.join(
    process.cwd(),
    "public",
    "data",
    "json",
    "post_comments.json",
  )
  const raw = await fs.readFile(filePath, "utf-8")
  return JSON.parse(raw) as Comment[]
}

async function loadTopics(): Promise<Topic[]> {
  const filePath = path.join(
    process.cwd(),
    "public",
    "data",
    "json",
    "topics.json",
  )
  const raw = await fs.readFile(filePath, "utf-8")
  return JSON.parse(raw) as Topic[]
}

async function loadRecentComments(): Promise<Comment[]> {
  const comments = await loadComments()
  const now = Date.now()
  const windowStart = now - TWO_WEEKS_MS

  return comments.filter((comment) => {
    const created = new Date(comment.created_at).getTime()
    return Number.isFinite(created) && created >= windowStart && created <= now
  })
}

export async function GET() {
  try {
    const [comments, topics] = await Promise.all([
      loadRecentComments(),
      loadTopics()
    ])

    // Create topic lookup map
    const topicMap = new Map<number, { insight: string, content: string }>()
    topics.forEach(topic => {
      topicMap.set(topic.id, { insight: topic.insight, content: topic.content })
    })

    // Count comments per topic
    const topicCounts = new Map<number, number>()

    for (const comment of comments) {
      const currentCount = topicCounts.get(comment.topic_id) || 0
      topicCounts.set(comment.topic_id, currentCount + 1)
    }

    // Convert to response format
    const items = Array.from(topicCounts.entries())
      .map(([topicId, count]) => {
        const topic = topicMap.get(topicId)
        const title = topic?.insight || `Topic ${topicId}`
        return {
          title,
          mentions: count,
        }
      })
      .sort((a, b) => b.mentions - a.mentions)
      .slice(0, 4)

    return NextResponse.json({ items })
  } catch (error) {
    console.error("[most-discussed-topics] failed", error)
    return NextResponse.json(
      { error: "Failed to calculate most discussed topics" },
      { status: 500 }
    )
  }
}
