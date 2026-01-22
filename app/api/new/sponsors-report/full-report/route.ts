import { NextResponse } from "next/server"
import { query } from "@/lib/db"

function clampInt(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.trunc(value)))
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)

    const startMs = Number(searchParams.get("start") || "0")
    const endMs = Number(searchParams.get("end") || "0")
    const brandKey = (searchParams.get("brand") || "").trim().toLowerCase()

    const limitRaw = Number(searchParams.get("limit") || "60")
    const limit = clampInt(Number.isFinite(limitRaw) ? limitRaw : 60, 1, 200)

    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs <= 0 || endMs <= 0 || !brandKey) {
      return NextResponse.json({ error: "Missing or invalid start/end/brand" }, { status: 400 })
    }

    const start = Math.floor(startMs / 1000)
    const end = Math.floor(endMs / 1000)

    const brandRows = await query<
      Array<{
        name: string
        slug: string
        color: string | null
        logo_light_url: string | null
        logo_dark_url: string | null
      }>
    >(
      `SELECT name, slug, color, logo_light_url, logo_dark_url
       FROM brands
       WHERE slug = ?
       LIMIT 1`,
      [brandKey],
    )

    const brand = brandRows[0]
    if (!brand) {
      return NextResponse.json({ error: "Brand not found" }, { status: 404 })
    }

    const rows = await query<
      Array<{
        post_id: number
        shortcode: string | null
        url: string | null
        taken_at_timestamp: number | null
        caption: string | null
        like_count: number | null
        comment_count: number | null
        impressions: number | string | null
        image_width: number | null
        image_height: number | null
        sentiment_score: number | null
        detection_id: number
        logo_label: string
        visibility_score: number | null
        box_x: number
        box_y: number
        box_width: number
        box_height: number
      }>
    >(
      `SELECT
         ip.id as post_id,
         ip.shortcode,
         ip.url,
         CAST(ip.taken_at_timestamp AS UNSIGNED) as taken_at_timestamp,
         ip.caption,
         ip.like_count,
         ip.comment_count,
         COALESCE(ip.estimated_reach, ip.video_view_count, 0) as impressions,
         ip.image_width,
         ip.image_height,
         ips.sentiment_score as sentiment_score,
         ld.id as detection_id,
         ld.logo_label,
         ld.visibility_score,
         ld.box_x,
         ld.box_y,
         ld.box_width,
         ld.box_height
       FROM instagram_posts ip
       JOIN logo_detections ld ON ip.id = ld.post_id
       JOIN brands b ON ld.brand_id = b.id
       LEFT JOIN instagram_post_sentiment ips ON ips.post_id = ip.id
       WHERE ip.taken_at_timestamp >= ? AND ip.taken_at_timestamp <= ?
         AND b.slug = ?
         AND TRIM(BOTH '\\r' FROM ld.logo_label) != 'psv'
       ORDER BY impressions DESC
       LIMIT ${limit * 25}`,
      [start, end, brandKey],
    )

    const postsById = new Map<
      number,
      {
        id: string
        shortcode: string | null
        url: string
        imageSrc: string
        takenAtTimestamp: number
        caption: string
        likes: number
        comments: number
        impressions: number
        sentimentScore: number | null
        sentiment: { total: number; positive: number; neutral: number; negative: number }
        imageWidth: number | null
        imageHeight: number | null
        detections: Array<{
          id: string
          label: string
          visibilityScore: number | null
          box: { x: number; y: number; width: number; height: number }
        }>
      }
    >()

    for (const r of rows) {
      const id = Number(r.post_id)
      const shortcode = r.shortcode || null
      const postUrl = r.url || (shortcode ? `https://www.instagram.com/p/${shortcode}/` : "")
      const imageSrc = shortcode ? `https://www.instagram.com/p/${shortcode}/media/?size=l` : r.url || ""
      const takenAt = Number(r.taken_at_timestamp || 0)

      if (!postsById.has(id)) {
        postsById.set(id, {
          id: String(id),
          shortcode,
          url: postUrl,
          imageSrc,
          takenAtTimestamp: takenAt,
          caption: r.caption || "",
          likes: Number(r.like_count || 0),
          comments: Number(r.comment_count || 0),
          impressions: Number(r.impressions || 0),
          sentimentScore: r.sentiment_score == null ? null : Number(r.sentiment_score),
          sentiment: { total: 0, positive: 0, neutral: 0, negative: 0 },
          imageWidth: r.image_width == null ? null : Number(r.image_width),
          imageHeight: r.image_height == null ? null : Number(r.image_height),
          detections: [],
        })
      }

      const post = postsById.get(id)!
      post.detections.push({
        id: String(r.detection_id),
        label: String(r.logo_label || ""),
        visibilityScore: r.visibility_score == null ? null : Number(r.visibility_score),
        box: {
          x: Number(r.box_x),
          y: Number(r.box_y),
          width: Number(r.box_width),
          height: Number(r.box_height),
        },
      })
    }

    const posts = Array.from(postsById.values())
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, limit)

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

    const truncated = postsById.size > limit

    return NextResponse.json({
      meta: { startMs, endMs, brand: brandKey, truncated, limit },
      brand: {
        name: brand.name,
        slug: brand.slug,
        color: brand.color || "#111827",
        logoLightUrl: brand.logo_light_url,
        logoDarkUrl: brand.logo_dark_url,
      },
      posts,
    })
  } catch (error) {
    console.error("Failed to build sponsor full report", error)
    return NextResponse.json({ error: "Failed to build full report" }, { status: 500 })
  }
}
