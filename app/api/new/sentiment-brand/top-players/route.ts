import { NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"
import OpenAI from "openai"

type Player = {
  name: string
  number?: string
  country?: string
}

type CommentRecord = {
  id: number | string
  post_id: string
  comment_text: string
  pos: string | number
  neg: string | number
  neu: string | number
  created_at: string
}

type PlayerAlias = {
  name: string
  number?: string
  aliases: string[]
}

type PlayerSentiment = {
  name: string
  positive: number
  neutral: number
  negative: number
  mentionCount: number
}

const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000
const BATCH_SIZE = 50

const stripDiacritics = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")

const unique = (items: string[]) => Array.from(new Set(items.filter(Boolean)))

function buildPlayerAliases(players: Player[]): PlayerAlias[] {
  return players.map((player) => {
    const name = player.name.trim()
    const parts = name.split(/\s+/)
    const first = parts[0] || ""
    const last = parts.slice(1).join(" ")
    const stripped = stripDiacritics(name)
    const strippedFirst = stripDiacritics(first)
    const strippedLast = stripDiacritics(last)

    const aliases = unique([
      name,
      stripped,
      first,
      last,
      strippedFirst,
      strippedLast,
    ]).map((a) => a.toLowerCase())

    return { name, number: player.number, aliases }
  })
}

async function loadPlayers(): Promise<PlayerAlias[]> {
  const filePath = path.join(
    process.cwd(),
    "public",
    "data",
    "json",
    "players.json",
  )
  const raw = await fs.readFile(filePath, "utf-8")
  const parsed = JSON.parse(raw) as Player[]
  return buildPlayerAliases(parsed)
}

function parseSentimentValue(value: string | number | undefined): number {
  if (typeof value === "number") return value
  if (typeof value === "string") {
    const num = parseFloat(value)
    return Number.isFinite(num) ? num : 0
  }
  return 0
}

async function loadRecentComments(): Promise<CommentRecord[]> {
  const filePath = path.join(
    process.cwd(),
    "public",
    "data",
    "json",
    "post_comments.json",
  )
  const raw = await fs.readFile(filePath, "utf-8")
  const parsed = JSON.parse(raw) as CommentRecord[]

  const now = Date.now()
  const windowStart = now - TWO_WEEKS_MS

  return parsed.filter((comment) => {
    const created = new Date(comment.created_at).getTime()
    return Number.isFinite(created) && created >= windowStart && created <= now
  })
}

const chunk = <T>(arr: T[], size: number): T[][] => {
  const result: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size))
  }
  return result
}

async function mapCommentsToPlayers(
  comments: CommentRecord[],
  players: PlayerAlias[],
  openai: OpenAI,
): Promise<Record<string | number, string[]>> {
  const mappings: Record<string | number, string[]> = {}

  const commentBatches = chunk(comments, BATCH_SIZE)

  for (const batch of commentBatches) {
    const promptPlayers = players
      .map(
        (p, idx) =>
          `${idx + 1}. ${p.name} | aliases: ${p.aliases
            .map((a) => `"${a}"`)
            .join(", ")}`,
      )
      .join("\n")

    const promptComments = batch
      .map((c) => `- id: ${c.id} | text: "${c.comment_text}"`)
      .join("\n")

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Identify which PSV players are mentioned in each comment. Match using names or provided aliases (case/diacritics/typos tolerated). Only return players from the provided list.",
        },
        {
          role: "user",
          content: `Players:\n${promptPlayers}\n\nComments:\n${promptComments}\n\nReturn JSON: {"matches":[{"comment_id":<id>,"players":["Player Name", ...]}]}. Only include comments that mention at least one player.`,
        },
      ],
    })

    try {
      const content = response.choices[0]?.message?.content
      const parsed =
        (content && JSON.parse(content)) || ({ matches: [] } as any)
      const matches = parsed.matches || []

      for (const match of matches) {
        if (!match || !match.comment_id || !Array.isArray(match.players))
          continue

        const cid = match.comment_id as string | number
        const cleanPlayers = (match.players as string[])
          .map((p) => p?.toString().trim())
          .filter(Boolean)

        if (!cleanPlayers.length) continue
        mappings[cid] = cleanPlayers
      }
    } catch (error) {
      console.error("[top-players] Failed to parse OpenAI response", error)
      continue
    }
  }

  return mappings
}

function aggregatePlayerSentiment(
  comments: CommentRecord[],
  mappings: Record<string | number, string[]>,
): PlayerSentiment[] {
  const totals = new Map<string, {
    pos: number
    neg: number
    neu: number
    count: number
  }>()

  for (const comment of comments) {
    const players = mappings[comment.id]
    if (!players?.length) continue

    const pos = parseSentimentValue(comment.pos)
    const neg = parseSentimentValue(comment.neg)
    const neu = parseSentimentValue(comment.neu)

    for (const playerName of players) {
      const entry = totals.get(playerName) || {
        pos: 0,
        neg: 0,
        neu: 0,
        count: 0,
      }
      entry.pos += pos
      entry.neg += neg
      entry.neu += neu
      entry.count += 1
      totals.set(playerName, entry)
    }
  }

  const aggregates: PlayerSentiment[] = []
  for (const [name, data] of totals.entries()) {
    if (data.count === 0) continue
    aggregates.push({
      name,
      positive: Math.round((data.pos / data.count) * 100) / 100,
      neutral: Math.round((data.neu / data.count) * 100) / 100,
      negative: Math.round((data.neg / data.count) * 100) / 100,
      mentionCount: data.count,
    })
  }

  return aggregates
}

export async function GET() {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured" },
        { status: 501 },
      )
    }

    const openai = new OpenAI({ apiKey })

    const [players, comments] = await Promise.all([
      loadPlayers(),
      loadRecentComments(),
    ])

    if (!comments.length) {
      return NextResponse.json(
        { error: "No recent comments found" },
        { status: 200 },
      )
    }

    const commentToPlayers = await mapCommentsToPlayers(comments, players, openai)
    const playerSentiments = aggregatePlayerSentiment(comments, commentToPlayers)

    // Sort by positive percentage descending and take top 4
    const topPlayers = playerSentiments
      .sort((a, b) => b.positive - a.positive)
      .slice(0, 4)
      .map(({ mentionCount, ...player }) => player) // Remove mentionCount from response

    return NextResponse.json({ items: topPlayers })
  } catch (error) {
    console.error("[top-players] failed", error)
    return NextResponse.json(
      { error: "Failed to analyze top players" },
      { status: 500 }
    )
  }
}
