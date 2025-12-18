import { NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"

type Platform = {
  id: number
  platform: string
}

type SocialPost = {
  id: number
  post_id: string
  platform_id: number
  date: string
}

type Comment = {
  id: number | string
  post_id: string
  topic_id: number
  comment_text: string
}

async function loadPlatforms(): Promise<Platform[]> {
  const filePath = path.join(
    process.cwd(),
    "public",
    "data",
    "json",
    "helpers",
    "Platform.json"
  )
  const raw = await fs.readFile(filePath, "utf-8")
  return JSON.parse(raw) as Platform[]
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

const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000

export async function GET() {
  try {
    const [platforms, socialPosts, comments] = await Promise.all([
      loadPlatforms(),
      loadSocialPosts(),
      loadComments()
    ])

    // Filter comments to last 2 weeks (shifted by 1 day)
    const now = new Date()
    const end = new Date(now)
    end.setDate(now.getDate() - 1) // tot en met gisteren
    const start = new Date(end)
    start.setDate(end.getDate() - 13) // 13 dagen terug voor 14 dagen totaal

    const windowStart = start.getTime()
    const windowEnd = end.getTime()

    const recentComments = comments.filter((comment) => {
      const created = new Date(comment.created_at).getTime()
      return Number.isFinite(created) && created >= windowStart && created <= windowEnd
    })

    // Create mappings for faster lookups
    const platformMap = new Map<number, string>()
    platforms.forEach(p => platformMap.set(p.id, p.platform))

    const postToPlatformMap = new Map<string, number>()
    socialPosts.forEach(post => postToPlatformMap.set(post.post_id, post.platform_id))

    // Count comments per platform (only recent ones)
    const platformCounts = new Map<string, number>()

    for (const comment of recentComments) {
      const platformId = postToPlatformMap.get(comment.post_id)
      if (platformId) {
        const platformName = platformMap.get(platformId)
        if (platformName) {
          platformCounts.set(platformName, (platformCounts.get(platformName) || 0) + 1)
        }
      }
    }

    // Calculate percentages
    const totalComments = Array.from(platformCounts.values()).reduce((sum, count) => sum + count, 0)

    const items = Array.from(platformCounts.entries())
      .map(([platform, count]) => ({
        platform,
        count,
        percentage: Math.round((count / totalComments) * 100),
        mentions: count // Keep for backward compatibility
      }))
      .sort((a, b) => b.count - a.count) // Sort by count descending

    return NextResponse.json({
      items,
      window: {
        start: start.toISOString(),
        end: end.toISOString(),
        totalComments: recentComments.length
      }
    })
  } catch (error) {
    console.error("[where-fans-engage-most] failed", error)
    return NextResponse.json(
      { error: "Failed to calculate platform engagement" },
      { status: 500 }
    )
  }
}
