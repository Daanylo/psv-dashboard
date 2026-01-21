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

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const start = parseIsoDateOnly(url.searchParams.get("start"))
    const end = parseIsoDateOnly(url.searchParams.get("end"))
    const playerIdParam = url.searchParams.get("player_id")
    const playerId = playerIdParam ? Number(playerIdParam) : null

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

    const playerRows = await query<Array<{ aliases: unknown; instagram_url: unknown }>>(
      `SELECT aliases, instagram_url FROM players WHERE fotmob_id = ? LIMIT 1`,
      [playerId],
    )

    const aliases = parseAliases(playerRows[0]?.aliases)
    const handles = uniq(
      [
        ...aliases.map((a) => a.trim().replace(/^@/, "")),
        handleFromInstagramUrl(playerRows[0]?.instagram_url) ?? "",
      ]
        .map((a) => a.trim().replace(/^@/, ""))
        .filter((a) => looksLikeInstagramHandle(a)),
    ).slice(0, 12)

    if (handles.length === 0) {
      return NextResponse.json({
        meta: { start: toIsoDateOnly(start), end: toIsoDateOnly(end), playerId },
        items: [],
      })
    }

    const clauses = handles.map(() => `JSON_CONTAINS(ip.tagged_users, CAST('1' AS JSON), ?)`)
    const whereTagged = `(${clauses.join(" OR ")})`

    const paths = handles.map((h) => `$."${h}"`)

    const rows = await query<
      Array<{
        id: number
        shortcode: string | null
        url: string | null
        impressions: number | string | null
      }>
    >(
      `SELECT
         ip.id,
         ip.shortcode,
         ip.url,
         COALESCE(ip.estimated_reach, ip.video_view_count, 0) as impressions
       FROM instagram_posts ip
       WHERE ip.tagged_users IS NOT NULL
         AND CAST(ip.taken_at_timestamp AS UNSIGNED) >= ?
         AND CAST(ip.taken_at_timestamp AS UNSIGNED) <= ?
         AND ${whereTagged}
       ORDER BY impressions DESC
         LIMIT 3`,
      [startTs, endTs, ...paths],
    )

    const items = rows.map((r) => {
      const shortcode = r.shortcode || null
      const imageUrl = shortcode
        ? `https://www.instagram.com/p/${shortcode}/media/?size=l`
        : r.url || ""

      return {
        id: String(r.id),
        shortcode,
        url: r.url || (shortcode ? `https://www.instagram.com/p/${shortcode}/` : ""),
        imageUrl,
        impressions: Number(r.impressions ?? 0),
      }
    })

    return NextResponse.json({
      meta: { start: toIsoDateOnly(start), end: toIsoDateOnly(end), playerId },
      items,
    })
  } catch (error) {
    console.error("Error loading social appearances:", error)
    return NextResponse.json(
      { error: "Failed to load social appearances" },
      { status: 500 },
    )
  }
}
