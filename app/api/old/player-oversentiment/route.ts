import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import OpenAI from "openai"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

interface PlayerSentiment {
  name: string
  mentions: number
  negative: number
  neutral: number
  positive: number
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const sentiment = searchParams.get('sentiment') === 'true'

    const filePath = path.join(process.cwd(), 'public', 'data', 'psv_transfermarket_updated.csv')
    const csvText = fs.readFileSync(filePath, 'utf-8')
    
    const lines = csvText.split('\n').slice(1) // Skip de eerste regel (header)
    const players: string[] = []
    
    for (const line of lines) {
      if (!line.trim()) continue
      
      // Parse CSV line - handle commas in quoted fields
      const columns = line.match(/(?:[^,"]+|"(?:[^"]|"")*")+/g)
      const name = columns?.[0]?.trim().replace(/^"|"$/g, '') // Remove quotes if present
      
      if (name) {
        players.push(name)
      }
    }

    // Sentiment analysis: load first 100 comments
    const commentsPath = path.join(process.cwd(), 'public', 'data', 'comments_combined.csv')
    const commentsText = fs.readFileSync(commentsPath, 'utf-8')
    const commentLines = commentsText.split('\n').slice(1).slice(0, 100) // Skip header, take first 100
    
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
      const negSentiment = parseFloat(columns[4]?.trim() || '0')
      const neuSentiment = parseFloat(columns[6]?.trim() || '0')
      const posSentiment = parseFloat(columns[5]?.trim() || '0')

      if (!isNaN(negSentiment) && !isNaN(neuSentiment) && !isNaN(posSentiment)) {
        comments.push({
          comment,
          negative: negSentiment,
          neutral: neuSentiment,
          positive: posSentiment,
        })
      }
    }

    // For each player, use OpenAI to match in comments and calculate sentiment
    // Process players in parallel with batch comment analysis
    const playerSentiments: PlayerSentiment[] = []

    // Process all players in parallel (with concurrency limit to avoid rate limits)
    const processPlayer = async (playerName: string): Promise<PlayerSentiment | null> => {
      try {
        // Send all comments in one batch request
        const commentsList = comments.map((c, idx) => `${idx + 1}. "${c.comment}"`).join('\n')
        
        const response = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are a helpful assistant that determines which comments mention a specific PSV Eindhoven player. Consider variations like nicknames, shortened names, typos, or references to nationality/position. Respond with JSON: {"matches": [1, 3, 5]} where numbers are the comment indices (1-based) that mention the player.',
            },
            {
              role: 'user',
              content: `Player name: "${playerName}"\n\nComments (all about PSV Eindhoven):\n${commentsList}\n\nWhich comment numbers mention this player? Return JSON with array of comment numbers (1-based).`,
            },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.1,
        })

        const result = JSON.parse(response.choices[0]?.message?.content || '{"matches": []}')
        const matchIndices = result.matches || []
        
        // Get matching comments based on indices
        const matchingComments = matchIndices
          .filter((idx: number) => idx >= 1 && idx <= comments.length)
          .map((idx: number) => comments[idx - 1])

        if (matchingComments.length > 0) {
          const avgNegative = matchingComments.reduce((sum: number, c: { negative: number; neutral: number; positive: number }) => sum + c.negative, 0) / matchingComments.length
          const avgNeutral = matchingComments.reduce((sum: number, c: { negative: number; neutral: number; positive: number }) => sum + c.neutral, 0) / matchingComments.length
          const avgPositive = matchingComments.reduce((sum: number, c: { negative: number; neutral: number; positive: number }) => sum + c.positive, 0) / matchingComments.length

          return {
            name: playerName,
            mentions: matchingComments.length,
            negative: Number(avgNegative.toFixed(2)),
            neutral: Number(avgNeutral.toFixed(2)),
            positive: Number(avgPositive.toFixed(2)),
          }
        } else {
          return null
        }
      } catch (error) {
        console.error(`[Player Sentiment] Error analyzing player ${playerName}:`, error)
        return null
      }
    }

    // Process players in batches of 5 to avoid rate limits
    const batchSize = 5
    for (let i = 0; i < players.length; i += batchSize) {
      const batch = players.slice(i, i + batchSize)
      
      const results = await Promise.all(batch.map(processPlayer))
      
      for (const result of results) {
        if (result) {
          playerSentiments.push(result)
        }
      }
    }

    const validPlayers = playerSentiments.filter(p => p.mentions > 0)
    const mostMentioned = [...validPlayers].sort((a, b) => b.mentions - a.mentions).slice(0, 2)
    const mostPositive = validPlayers.reduce((prev,curr) => curr.positive > prev.positive ? curr : prev )
    const mostNegative = validPlayers.reduce((prev,curr) => curr.negative > prev.negative ? curr:prev) 
    return NextResponse.json({
      mostMentioned,
      mostPositive,
      mostNegative,
    })
  } catch (error) {
    console.error('Error processing data:', error)
    return NextResponse.json(
      { error: 'Failed to process data' },
      { status: 500 }
    )
  }
}

