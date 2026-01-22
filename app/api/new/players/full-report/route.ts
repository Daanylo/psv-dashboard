import { NextResponse } from "next/server"
import { query } from "@/lib/db"
import { parseIsoDateOnly, toIsoDateOnly } from "@/lib/overview-data"

function looksLikeInstagramHandle(value: string) {
  const v = value.trim().replace(/^@/, "")
  if (v.length < 3 || v.length > 40) return false
  if (v.includes(" ")) return false
  return /^[A-Za-z0-9._]+$/.test(v)
}

function handleFromInstagramUrl(raw: unknown) {
  if (!raw) return null
  const text = String(raw).trim()
  if (!text) return null

  try {
    const url = new URL(text)
    const parts = url.pathname.split("/").filter(Boolean)
    if (parts.length === 0) return null
    const candidate = parts[0]
    if (!candidate) return null
    if (candidate === "p" || candidate === "reel" || candidate === "tv") return null
    const cleaned = candidate.replace(/^@/, "")
    return looksLikeInstagramHandle(cleaned) ? cleaned : null
  } catch {
    const cleaned = text
      .replace(/^@/, "")
      .replace(/^https?:\/\/www\.instagram\.com\//i, "")
      .split("/")[0]
      ?.trim()
    if (!cleaned) return null
    if (cleaned === "p" || cleaned === "reel" || cleaned === "tv") return null
    return looksLikeInstagramHandle(cleaned) ? cleaned : null
  }
}

function uniq<T>(values: T[]) {
  return Array.from(new Set(values))
}

function parseAliases(raw: unknown) {
  if (raw == null) return []
  if (Array.isArray(raw)) return raw.map((v) => String(v)).filter(Boolean)

  const text = String(raw)
  return text
    .split(/[,;|\n\r]+/)
    .map((p) => p.trim())
    .filter(Boolean)
}

function clampInt(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.trunc(value)))
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const start = parseIsoDateOnly(url.searchParams.get("start"))
    const end = parseIsoDateOnly(url.searchParams.get("end"))
    const playerIdParam = url.searchParams.get("player_id")
    const playerId = playerIdParam ? Number(playerIdParam) : null

    const limitRaw = Number(url.searchParams.get("limit") || "60")
    const limit = clampInt(Number.isFinite(limitRaw) ? limitRaw : 60, 1, 200)

    if (!start || !end || !playerId) {
      return NextResponse.json(
        { error: "Missing or invalid start/end/player_id" },
        { status: 400 },
      )
    }

    const startInclusive = new Date(start)
    startInclusive.setUTCHours(0, 0, 0, 0)

    const endInclusive = new Date(end)
    endInclusive.setUTCHours(23, 59, 59, 999)

    const startTs = Math.floor(startInclusive.getTime() / 1000)
    const endTs = Math.floor(endInclusive.getTime() / 1000)

    const playerRow = await query<Array<{ aliases: unknown; instagram_url: unknown; name: string }>>(
      `SELECT name, aliases, instagram_url FROM players WHERE fotmob_id = ? LIMIT 1`,
      [playerId],
    )

    const player = playerRow[0]
    if (!player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 })
    }

    const aliases = parseAliases(player.aliases)
    const handles = uniq(
      [
        ...aliases.map((a) => a.trim().replace(/^@/, "")),
        handleFromInstagramUrl(player.instagram_url) ?? "",
      ]
        .map((a) => a.trim().replace(/^@/, ""))
        .filter((a) => looksLikeInstagramHandle(a)),
    ).slice(0, 12)

    if (handles.length === 0) {
      return NextResponse.json({
        meta: { startIso: toIsoDateOnly(start), endIso: toIsoDateOnly(end), playerId, truncated: false, limit },
        player: { name: player.name, fotmobId: playerId },
        handles: [],
        posts: [],
      })
    }

    const clauses = handles.map(() => `JSON_CONTAINS(ip.tagged_users, CAST('1' AS JSON), ?)`)
    const whereTagged = `(${clauses.join(" OR ")})`
    const paths = handles.map((h) => `$\."${h}"`)

    const rows = await query<
      Array<{
        id: number
        shortcode: string | null
        url: string | null
        taken_at_timestamp: number | null
        caption: string | null
        like_count: number | null
        comment_count: number | null
        impressions: number | string | null
        sentiment_score: number | null
      }>
    >(
      `SELECT
         ip.id,
         ip.shortcode,
         ip.url,
         CAST(ip.taken_at_timestamp AS UNSIGNED) as taken_at_timestamp,
         ip.caption,
         ip.like_count,
         ip.comment_count,
         COALESCE(ip.estimated_reach, ip.video_view_count, 0) as impressions,
         ips.sentiment_score as sentiment_score
       FROM instagram_posts ip
       LEFT JOIN instagram_post_sentiment ips ON ips.post_id = ip.id
       WHERE ip.tagged_users IS NOT NULL
         AND CAST(ip.taken_at_timestamp AS UNSIGNED) >= ?
         AND CAST(ip.taken_at_timestamp AS UNSIGNED) <= ?
         AND ${whereTagged}
       ORDER BY impressions DESC
       LIMIT ${limit + 1}`,
      [startTs, endTs, ...paths],
    )

    const truncated = rows.length > limit

    const posts = rows.slice(0, limit).map((r) => {
      const shortcode = r.shortcode || null
      const imageSrc = shortcode ? `https://www.instagram.com/p/${shortcode}/media/?size=l` : r.url || ""

      return {
        id: String(r.id),
        shortcode,
        url: r.url || (shortcode ? `https://www.instagram.com/p/${shortcode}/` : ""),
        imageSrc,
        takenAtTimestamp: Number(r.taken_at_timestamp || 0),
        caption: r.caption || "",
        likes: Number(r.like_count || 0),
        comments: Number(r.comment_count || 0),
        impressions: Number(r.impressions || 0),
        sentimentScore: r.sentiment_score == null ? null : Number(r.sentiment_score),
        sentiment: { total: 0, positive: 0, neutral: 0, negative: 0 },
      }
    })

    if (posts.length) {
      const postIds = posts.map((p) => Number(p.id)).filter((id) => Number.isFinite(id))
      if (postIds.length) {
        const placeholders = postIds.map(() => "?").join(",")
        const sentimentRows = await query<
          Array<{ post_id: number; total: number | string; positive: number | string; negative: number | string }>
        >(
          `SELECT
             post_id,
             COUNT(*) as total,
             SUM(CASE WHEN LOWER(sentiment) = 'positive' THEN 1 ELSE 0 END) as positive,
             SUM(CASE WHEN LOWER(sentiment) = 'negative' THEN 1 ELSE 0 END) as negative
           FROM instagram_comments
           WHERE post_id IN (${placeholders})
           GROUP BY post_id`,
          postIds,
        )

        const sentimentByPostId = new Map<number, { total: number; positive: number; negative: number }>()
        for (const row of sentimentRows) {
          sentimentByPostId.set(Number(row.post_id), {
            total: Number(row.total || 0),
            positive: Number(row.positive || 0),
            negative: Number(row.negative || 0),
          })
        }

        for (const post of posts) {
          const id = Number(post.id)
          const s = sentimentByPostId.get(id)
          if (!s) continue
          const neutral = Math.max(0, s.total - s.positive - s.negative)
          post.sentiment = {
            total: s.total,
            positive: s.positive,
            negative: s.negative,
            neutral,
          }
        }
      }
    }

    return NextResponse.json({
      meta: { startIso: toIsoDateOnly(start), endIso: toIsoDateOnly(end), playerId, truncated, limit },
      player: { name: player.name, fotmobId: playerId },
      handles,
      posts,
    })
  } catch (error) {
    console.error("Error building player full report:", error)
    return NextResponse.json({ error: "Failed to build full report" }, { status: 500 })
  }
}
