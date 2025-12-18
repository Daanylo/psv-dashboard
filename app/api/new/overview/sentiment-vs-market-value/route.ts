import { NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"
import OpenAI from "openai"

type Player = {
  id: number
  name: string
  number?: string
  country?: string
  market_value: string
}

type CommentRecord = {
  id: number | string
  comment_text: string
  created_at: string
  pos?: string | number
  neg?: string | number
  neu?: string | number
}

type PlayerAlias = {
  name: string
  number?: string
  aliases: string[]
  market_value: string
}

type SentimentMarketEntry = {
  id: string | number
  name: string
  sentimentScore: number
  marketValue: string
  alignment: "undervalued" | "overvalued"
  avatarUrl: string
  rationale?: string
  sentimentBadgeLabel?: string
  sentimentBadgeColor?: string
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

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

    return {
      name,
      number: player.number,
      aliases,
      market_value: player.market_value,
    }
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
      console.error("[sentiment-vs-market-value] Failed to parse OpenAI response", error)
      continue
    }
  }

  return mappings
}

function aggregatePlayerSentiment(
  comments: CommentRecord[],
  mappings: Record<string | number, string[]>,
  playerAliases: PlayerAlias[],
): SentimentMarketEntry[] {
  const totals = new Map<
    string,
    { pos: number; neg: number; neu: number; count: number; market_value: string }
  >()

  for (const comment of comments) {
    const mentionedPlayers = mappings[comment.id]
    if (!mentionedPlayers?.length) continue

    const pos = parseSentimentValue(comment.pos)
    const neg = parseSentimentValue(comment.neg)
    const neu = parseSentimentValue(comment.neu)

    for (const playerName of mentionedPlayers) {
      const player = playerAliases.find((p) => p.name === playerName)
      const marketValue = player?.market_value || "0"

      const entry = totals.get(playerName) || {
        pos: 0,
        neg: 0,
        neu: 0,
        count: 0,
        market_value: marketValue,
      }
      entry.pos += pos
      entry.neg += neg
      entry.neu += neu
      entry.count += 1
      totals.set(playerName, entry)
    }
  }

  const aggregates: SentimentMarketEntry[] = []
  for (const [name, data] of totals.entries()) {
    if (data.count === 0) continue

    const avgPositive = data.pos / data.count
    const avgNegative = data.neg / data.count
    const sentimentScore = Math.round(avgPositive - avgNegative)

    const marketValueNum = parseFloat(data.market_value)
    const marketValueM = marketValueNum / 1000000

    // Determine alignment: high positive sentiment relative to market value = undervalued
    // Low sentiment relative to market value = overvalued
    const alignment: "undervalued" | "overvalued" =
      sentimentScore > marketValueM * 2 ? "undervalued" : "overvalued"

    aggregates.push({
      id: name.toLowerCase().replace(/\s+/g, "-"),
      name,
      sentimentScore,
      marketValue: `€${marketValueM.toFixed(1)}M`,
      alignment,
      avatarUrl: `/player_images/${playerAliases.find((p) => p.name === name)?.number || "default"}.png`,
      rationale: `${data.count} mentions, ${avgPositive.toFixed(1)}% positive sentiment`,
      sentimentBadgeLabel: `${Math.round(avgPositive)}%`,
      sentimentBadgeColor: avgPositive > 50 ? "#3DC251" : "#FF434A",
    })
  }

  return aggregates
}

export async function GET() {
  try {
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

    const commentToPlayers = await mapCommentsToPlayers(comments, players)
    const playerSentiments = aggregatePlayerSentiment(
      comments,
      commentToPlayers,
      players,
    )

    // Sort by sentiment score descending and separate by alignment
    const sorted = playerSentiments.sort((a, b) => b.sentimentScore - a.sentimentScore)
    const undervalued = sorted.filter((p) => p.alignment === "undervalued").slice(0, 1)
    const overvalued = sorted.filter((p) => p.alignment === "overvalued").slice(0, 1)

    // Combine: undervalued first (top), then overvalued (bottom)
    const items = [...undervalued, ...overvalued]

    return NextResponse.json({ items })
  } catch (error) {
    console.error("[sentiment-vs-market-value] failed", error)
    return NextResponse.json(
      { error: "Failed to analyze sentiment vs market value" },
      { status: 500 },
    )
  }
}
