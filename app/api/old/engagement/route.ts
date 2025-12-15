import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import OpenAI from "openai"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

interface PlayerEngagement {
  name: string
  engagement: number
}

export async function GET() {
  try {
    // Read player names
    const playersPath = path.join(process.cwd(), "public", "data", "psv_transfermarket_updated.csv")
    const playerLines = fs.readFileSync(playersPath, "utf-8").split("\n").slice(1)
    const players: string[] = []

    for (const line of playerLines) {
      const cols = line.match(/(?:[^,"]+|"(?:[^"]|"")*")+/g)
      const name = cols?.[0]?.trim().replace(/^"|"$/g, "")
      if (name) players.push(name)
    }

    //Read engagement posts CSV
    const postsPath = path.join(process.cwd(), "public", "data", "socials_posts_overview.csv")
    const postLines = fs.readFileSync(postsPath, "utf-8").split("\n").slice(1).slice(0, 100) // First 100 posts
    const posts: Array<{ 
        content: string; 
        likes: number; 
        comments: number; 
        shares: number }> = []

    for (const line of postLines) {
      if (!line.trim()) continue

      const cols = line.match(/(?:[^,"]+|"(?:[^"]|"")*")+/g)
      const content = cols?.[1]?.trim().replace(/^"|"$/g, "") || ""
      const num_comments = parseFloat(cols?.[4] || "0")
      const num_shares = parseFloat(cols?.[5] || "0")
      const likes = parseFloat(cols?.[6] || "0")

      posts.push({ 
        content, 
        likes, 
        comments: num_comments, 
        shares: num_shares 
    })
    }

    // Match posts to players 
    const playerEngagements: PlayerEngagement[] = []

    const processPlayer = async (playerName: string): Promise<PlayerEngagement | null> => {
      try {
        const postList = posts.map((p, i) => `${i + 1}. "${p.content}"`).join("\n")

        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content:
                "You are a helpful assistant that identifies which posts mention a specific PSV Eindhoven player. Respond with JSON: {\"matches\": [1,2,3]} where numbers are the post indices (1-based).",
            },
            {
              role: "user",
              content: `Player: "${playerName}"\nPosts:\n${postList}`,
            },
          ],
          response_format: { type: "json_object" },
          temperature: 0.1,
        })

        const result = JSON.parse(response.choices[0]?.message?.content || '{"matches": []}')
        const matchIndices = result.matches || []

        const matchedPosts = matchIndices
          .filter((i: number) => i >= 1 && i <= posts.length)
          .map((i: number) => posts[i - 1])

        if (matchedPosts.length === 0) return null

        // Sum engagement
        const totalEngagement = matchedPosts.reduce(
          (sum: any, p: { likes: any; comments: any; shares: any }) => sum + p.likes + p.comments + p.shares,
          0
        )
        const avgEngagement = totalEngagement / matchedPosts.length

        return { name: playerName, engagement: Number(avgEngagement.toFixed(1)) }
      } catch (err) {
        console.error(`[Engagement] Error for player ${playerName}:`, err)
        return null
      }
    }

    // Batch players (avoid rate limits)
    const batchSize = 5
    for (let i = 0; i < players.length; i += batchSize) {
      const batch = players.slice(i, i + batchSize)
      const results = await Promise.all(batch.map(processPlayer))
      results.forEach((r) => r && playerEngagements.push(r))
    }

    // Sort by engagement, top 4
    const topPlayers = playerEngagements
      .sort((a, b) => b.engagement - a.engagement)
      .slice(0, 4)

    return NextResponse.json(topPlayers)
  } catch (error) {
    console.error("Error processing engagement:", error)
    return NextResponse.json({ error: "Failed to process engagement" }, { status: 500 })
  }
}
