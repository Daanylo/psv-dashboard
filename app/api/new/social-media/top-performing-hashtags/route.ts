import { NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"

type Hashtag = {
  id: number
  hashtag: string
}

type SocialPost = {
  id: number
  post_id: string
  platform_id: number
  hashtag_id: number | null
  date: string
}

type Comment = {
  id: number | string
  post_id: string
  comment_text: string
  pos: string | number
  neg: string | number
  neu: string | number
}

const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000

async function loadHashtags(): Promise<Hashtag[]> {
  const filePath = path.join(
    process.cwd(),
    "public",
    "data",
    "json",
    "helpers",
    "Hashtag.json"
  )
  const raw = await fs.readFile(filePath, "utf-8")
  return JSON.parse(raw) as Hashtag[]
}

async function loadSocialPosts(): Promise<SocialPost[]> {
  const filePath = path.join(
    process.cwd(),
    "public",
    "data",
    "json",
    "social_posts.json"
  )
  const raw = await fs.readFile(filePath, "utf-8")
  return JSON.parse(raw) as SocialPost[]
}

async function loadComments(): Promise<Comment[]> {
  const filePath = path.join(
    process.cwd(),
    "public",
    "data",
    "json",
    "post_comments.json"
  )
  const raw = await fs.readFile(filePath, "utf-8")
  return JSON.parse(raw) as Comment[]
}

function parseSentimentValue(value: string | number | undefined): number {
  if (typeof value === "number") return value
  if (typeof value === "string") {
    const num = parseFloat(value)
    return Number.isFinite(num) ? num : 0
  }
  return 0
}

function calculateHashtagSentiment(comments: Comment[]): { positive: number; negative: number; neutral: number } {
  if (!comments.length) {
    return { positive: 33, negative: 33, neutral: 34 }
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
    positive: Math.round((totalPos / count) * 100) / 100,
    negative: Math.round((totalNeg / count) * 100) / 100,
    neutral: Math.round((totalNeu / count) * 100) / 100,
  }
}

function calculateChangePercentage(current: number, previous: number): number {
  if (previous === 0) {
    return current > 0 ? 100 : 0 // If no previous mentions, it's 100% growth if current > 0
  }
  return Math.round(((current - previous) / previous) * 100)
}

export async function GET() {
  try {
    const [hashtags, socialPosts, comments] = await Promise.all([
      loadHashtags(),
      loadSocialPosts(),
      loadComments()
    ])

    // Define time windows
    const now = new Date()
    const currentEnd = new Date(now)
    currentEnd.setDate(now.getDate() - 1) // Yesterday
    const currentStart = new Date(currentEnd)
    currentStart.setDate(currentEnd.getDate() - 13) // 14 days back

    const previousEnd = new Date(currentStart)
    previousEnd.setDate(currentStart.getDate() - 1) // Day before current period
    const previousStart = new Date(previousEnd)
    previousStart.setDate(previousEnd.getDate() - 13) // Another 14 days back

    // Filter posts for both periods
    const currentPosts = socialPosts.filter((post) => {
      const postDate = new Date(post.date).getTime()
      return Number.isFinite(postDate) &&
             postDate >= currentStart.getTime() &&
             postDate <= currentEnd.getTime()
    })

    const previousPosts = socialPosts.filter((post) => {
      const postDate = new Date(post.date).getTime()
      return Number.isFinite(postDate) &&
             postDate >= previousStart.getTime() &&
             postDate <= previousEnd.getTime()
    })

    // Create mappings
    const hashtagMap = new Map<number, string>()
    hashtags.forEach(h => hashtagMap.set(h.id, h.hashtag))

    // Count hashtags for current period
    const currentCounts = new Map<number, { count: number; comments: Comment[] }>()
    const currentPostToHashtagMap = new Map<string, number | null>()
    currentPosts.forEach(post => currentPostToHashtagMap.set(post.post_id, post.hashtag_id))

    for (const comment of comments) {
      const hashtagId = currentPostToHashtagMap.get(comment.post_id)
      if (hashtagId) {
        const existing = currentCounts.get(hashtagId) || { count: 0, comments: [] }
        existing.count++
        existing.comments.push(comment)
        currentCounts.set(hashtagId, existing)
      }
    }

    // Count hashtags for previous period
    const previousCounts = new Map<number, number>()
    const previousPostToHashtagMap = new Map<string, number | null>()
    previousPosts.forEach(post => previousPostToHashtagMap.set(post.post_id, post.hashtag_id))

    for (const comment of comments) {
      const hashtagId = previousPostToHashtagMap.get(comment.post_id)
      if (hashtagId) {
        previousCounts.set(hashtagId, (previousCounts.get(hashtagId) || 0) + 1)
      }
    }

    // Calculate final stats with change percentage
    const items = Array.from(currentCounts.entries())
      .map(([hashtagId, data]) => {
        const hashtag = hashtagMap.get(hashtagId) || `#unknown`
        const previousCount = previousCounts.get(hashtagId) || 0
        const change = calculateChangePercentage(data.count, previousCount)
        const sentiment = calculateHashtagSentiment(data.comments)
        return {
          tag: hashtag,
          mentions: data.count,
          change,
          positive: sentiment.positive,
          negative: sentiment.negative,
          neutral: sentiment.neutral,
        }
      })
      .sort((a, b) => b.change - a.change)
    .slice(0, 4)

    return NextResponse.json({
      items,
      window: {
        current: {
          start: currentStart.toISOString(),
          end: currentEnd.toISOString()
        },
        previous: {
          start: previousStart.toISOString(),
          end: previousEnd.toISOString()
        }
      }
    })
  } catch (error) {
    console.error("[top-performing-hashtags] failed", error)
    return NextResponse.json(
      { error: "Failed to calculate top hashtags" },
      { status: 500 }
    )
  }
}
