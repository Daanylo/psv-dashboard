import { NextResponse } from "next/server"

const mockHashtags = [
  { tag: "#PSV", mentions: 8200, change: 18, positive: 50, negative: 30, neutral: 20 },
  { tag: "#ChampionsLeague", mentions: 6100, change: 12, positive: 45, negative: 35, neutral: 20 },
  { tag: "#Saibari", mentions: 4300, change: 0, positive: 40, negative: 30, neutral: 30 },
  { tag: "#PhillipsStadium", mentions: 2900, change: -20, positive: 35, negative: 25, neutral: 40 },
]

export async function GET() {
  const top = [...mockHashtags]
    .sort((a, b) => (b.mentions ?? 0) - (a.mentions ?? 0))
    .slice(0, 4)
  return NextResponse.json({ items: top })
}
