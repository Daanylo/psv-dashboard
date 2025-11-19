import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import OpenAI from "openai"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

interface PlayerSentiment {
  name: string
  negative: number
  neutral: number
  positive: number
  marketValue?: number | null
  mentions?: number
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const sentiment = searchParams.get('sentiment') === 'true'

    const filePath = path.join(process.cwd(), 'public', 'data', 'psv_transfermarket_updated.csv')
    const csvText = fs.readFileSync(filePath, 'utf-8')

    const lines = csvText.split('\n').slice(1) // Skip header

    // --- NEW: Transfer market lookup ---
    const transferData: Record<string, { marketValue: number }> = {}
    const players: string[] = []

    for (const line of lines) {
      if (!line.trim()) continue

      const columns = line.match(/(?:[^,"]+|"(?:[^"]|"")*")+/g)
      if (!columns) continue

      const rawName = columns[0]?.trim().replace(/^"|"$/g, '')
      const rawValue = columns[7]?.trim().replace(/^"|"$/g, '')

      if (rawName) {
        players.push(rawName)
        transferData[rawName] = {
          marketValue: Number(rawValue) || 0
        }
      }
    }

    // Load 100 comments
    const commentsPath = path.join(process.cwd(), 'public', 'data', 'comments_combined.csv')
    const commentsText = fs.readFileSync(commentsPath, 'utf-8')
    const commentLines = commentsText.split('\n').slice(1).slice(0, 100)

    const comments: Array<{
      comment: string
      negative: number
      neutral: number
      positive: number
    }> = []

    for (const line of commentLines) {
      if (!line.trim()) continue

      const columns = line.match(/(?:[^,"]+|"(?:[^"]|"")*")+/g)
      if (!columns || columns.length < 7) continue

      const comment = columns[2]?.trim().replace(/^"|"$/g, '') || ''
      const neg = parseFloat(columns[4]?.trim() || '0')
      const neu = parseFloat(columns[6]?.trim() || '0')
      const pos = parseFloat(columns[5]?.trim() || '0')

      if (!isNaN(neg) && !isNaN(neu) && !isNaN(pos)) {
        comments.push({
          comment,
          negative: neg,
          neutral: neu,
          positive: pos
        })
      }
    }

    // Sentiment logic
    const playerSentiments: PlayerSentiment[] = []

    const processPlayer = async (playerName: string): Promise<PlayerSentiment | null> => {
      try {
        const commentsList = comments.map((c, idx) => `${idx + 1}. "${c.comment}"`).join('\n')

        const response = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are a helpful assistant that identifies comments mentioning a PSV player. Respond with JSON: {"matches":[1,3,5]}.'
            },
            {
              role: 'user',
              content: `Player name: "${playerName}"\n\nComments:\n${commentsList}`
            }
          ],
          response_format: { type: "json_object" },
          temperature: 0.1
        })

        const results = JSON.parse(response.choices[0]?.message?.content || '{"matches":[]}')
        const indices = results.matches || []

        const matches = indices
          .filter((i: number) => i >= 1 && i <= comments.length)
          .map((i: number) => comments[i - 1])

if (matches.length > 0) {
  const avgNeg = matches.reduce((s: number, c: { negative: number; neutral: number; positive: number }) => s + c.negative, 0) / matches.length
  const avgNeu = matches.reduce((s: number, c: { negative: number; neutral: number; positive: number }) => s + c.neutral, 0) / matches.length
  const avgPos = matches.reduce((s: number, c: { negative: number; neutral: number; positive: number }) => s + c.positive, 0) / matches.length

  return {
    name: playerName,
    negative: Number(avgNeg.toFixed(2)),
    neutral: Number(avgNeu.toFixed(2)),
    positive: Number(avgPos.toFixed(2)),
    marketValue: transferData[playerName]?.marketValue ?? null,
    mentions: matches.length   
  }
}
return null
      } catch (err) {
        console.error("Sentiment error for", playerName, err)
        return null
      }
    }

    // Batch calls (avoid rate limits)
    const batchSize = 5
    for (let i = 0; i < players.length; i += batchSize) {
      const batch = players.slice(i, i + batchSize)
      const results = await Promise.all(batch.map(processPlayer))
      results.forEach(r => r && playerSentiments.push(r))
    }

    // Sort by positive sentiment
    const topPlayers = playerSentiments
      .sort((a, b) => b.positive - a.positive)
      .slice(0, 4)

    return NextResponse.json(topPlayers)

  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to process data" }, { status: 500 })
  }
}
