import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import OpenAI from "openai"

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null

interface PlayerSentiment {
  name: string
  mentions: number
  negative: number
  neutral: number
  positive: number
  positiveMentions: number
  negativeMentions: number
}

// --- MARKET VALUE MATCHING FUNCTION ---
function getMarketValueForPlayer(playerName: string, marketValueCsv: string) {
  const lines = marketValueCsv.split("\n").slice(1);

  for (const line of lines) {
    if (!line.trim()) continue;

    const columns = line.match(/(?:[^,"]+|"(?:[^"]|"")*")+/g);
    if (!columns) continue;

    const name = columns[0]?.trim().replace(/^"|"$/g, "");
    const marketValueRaw = columns[7]?.trim();

    if (name?.toLowerCase() === playerName.toLowerCase()) {
      const value = parseFloat(marketValueRaw);
      return isNaN(value) ? 0 : value;
    }
  }

  return 0;
}

export async function GET(request: Request) {
  try {
    if (!openai) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured" },
        { status: 501 },
      )
    }
    const filePath = path.join(process.cwd(), "public", "data", "psv_transfermarket_updated.csv");
    const csvText = fs.readFileSync(filePath, "utf-8");

    const lines = csvText.split("\n").slice(1);
    const players: string[] = [];

    for (const line of lines) {
      if (!line.trim()) continue;

      const columns = line.match(/(?:[^,"]+|"(?:[^"]|"")*")+/g);
      const name = columns?.[0]?.trim().replace(/^"|"$/g, "");

      if (name) players.push(name);
    }

    // LOAD COMMENTS
    const commentsPath = path.join(process.cwd(), "public", "data", "comments_combined.csv");
    const commentsText = fs.readFileSync(commentsPath, "utf-8");
    const commentLines = commentsText.split("\n").slice(1).slice(0, 100);

    const comments: Array<{
      comment: string;
      topic: string;
      negative: number;
      neutral: number;
      positive: number;
    }> = [];

    for (const line of commentLines) {
      if (!line.trim()) continue;

      const columns = line.match(/(?:[^,"]+|"(?:[^"]|"")*")+/g);
      if (!columns || columns.length < 7) continue;

      const comment = columns[2]?.trim().replace(/^"|"$/g, '') || ''
      const topic = columns[3]?.trim().replace(/^"|"$/g, '') || ''
      const neg = parseFloat(columns[4]?.trim() || "0");
      const neu = parseFloat(columns[6]?.trim() || "0");
      const pos = parseFloat(columns[5]?.trim() || "0");

      comments.push({ comment, topic, negative: neg, neutral: neu, positive: pos });
    }

    // PROCESS PLAYERS
    const playerSentiments: PlayerSentiment[] = [];

    const processPlayer = async (playerName: string): Promise<PlayerSentiment | null> => {
      try {
        const commentsList = comments
        .map((c, idx) => `${idx + 1}. Comment: "${c.comment}" | Topic: "${c.topic}"`)
        .join("\n");


        const response = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [
    {
      role: "system",
      content:
        'You ONLY match comments that explicitly include the player’s name or known nickname. If the player’s name or nickname is NOT written in the comment, DO NOT match it. Do NOT match based on PSV, emojis, general praise, or generic references. Return ONLY JSON with the indices of comments that literally contain the player name or nickname.',
    },
    {
      role: "user",
      content: `Player to detect: "${playerName}"

RULES FOR MATCHING:

1. A comment matches if it contains the EXACT player name, last name, nickname, initials, or @tag.
2. A comment ALSO matches if its TOPIC clearly refers to this player
   (example: Topic: "Schouten ’s haircut" → matches Jerdy Schouten).
3. If neither the comment text nor the topic refer to the player → do NOT match.
4. Do NOT match emoji-only comments unless topic or text mentions the player.

Return ONLY JSON like {"matches":[4,19]}.

Comments + Topics:
${commentsList}`

    }
  ],
  response_format: { type: "json_object" },
  temperature: 0.1
});


        const result = JSON.parse(response.choices[0]?.message?.content || '{"matches": []}');
        const matchIndices = result.matches || [];

        const matching = matchIndices
          .filter((idx: number) => idx >= 1 && idx <= comments.length)
          .map((idx: number) => comments[idx - 1]);


        if (matching.length === 0) return null;

        const avgNegative = matching.reduce((s: number, c: { negative: number }) => s + c.negative, 0) / matching.length;
        const avgNeutral = matching.reduce((s: number, c: { neutral: number }) => s + c.neutral, 0) / matching.length;
        const avgPositive = matching.reduce((s: number, c: { positive: number }) => s + c.positive, 0) / matching.length;

        // COUNT REAL POS/NEG MENTIONS
        const positiveMentions = matching.filter(
          (c: { positive: number; negative: number; neutral: number }) => c.positive > c.negative && c.positive > c.neutral
        ).length;

        const negativeMentions = matching.filter(
          (c: { positive: number; negative: number; neutral: number }): boolean => c.negative > c.positive && c.negative > c.neutral
        ).length;

        return {
          name: playerName,
          mentions: matching.length,
          negative: Number(avgNegative.toFixed(2)),
          neutral: Number(avgNeutral.toFixed(2)),
          positive: Number(avgPositive.toFixed(2)),
          positiveMentions,
          negativeMentions
        };
      } catch (error) {
        console.error(`[Player Sentiment] Error for ${playerName}:`, error);
        return null;
      }
    };

    // LIMIT CONCURRENCY
    const batchSize = 5;
    for (let i = 0; i < players.length; i += batchSize) {
      const batch = players.slice(i, i + batchSize);
      const results = await Promise.all(batch.map(processPlayer));
      for (const r of results) if (r) playerSentiments.push(r);
    }

    const validPlayers = playerSentiments.filter(p => p.mentions > 0);

    // MARKET VALUE FILE
    const mvPath = path.join(process.cwd(), "public", "data", "psv_transfermarket_updated.csv");
    const mvText = fs.readFileSync(mvPath, "utf-8");

    // SENTIMENT + VALUE MERGE
    const sentimentVsValue = validPlayers.map(p => {
      const mv = getMarketValueForPlayer(p.name, mvText) / 1_000_000;

      let status: "Undervalued" | "Overvalued" | "Balanced";

      if (p.positiveMentions > p.negativeMentions && mv < 8) {
        status = "Undervalued";
      } else if (p.negativeMentions > p.positiveMentions && mv > 8) {
        status = "Overvalued";
      } else {
        status = "Balanced";
      }

      return {
        name: p.name,
        marketValue: Number(mv.toFixed(1)),
        positiveMentions: p.positiveMentions,
        negativeMentions: p.negativeMentions,
        status
      };
    });

    return NextResponse.json({ sentimentVsValue });

  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
