// app/api/new/overview/sentiment-vs-market-value/route.ts
import { NextResponse } from "next/server"

const mockItems = [
  {
    id: "saibari",
    name: "Ismael Saibari",
    sentimentScore: 65,
    marketValue: "€28M",
    alignment: "undervalued",
    avatarUrl: "/player_images/34.png",
    sentimentBadgeLabel: "65% Positive",
    sentimentBadgeColor: "#3DC251",
  },
  {
    id: "pepi",
    name: "Ricardo Pepi",
    sentimentScore: 45,
    marketValue: "€32M",
    alignment: "overvalued",
    avatarUrl: "/player_images/9.png",
    sentimentBadgeLabel: "45% Positive",
    sentimentBadgeColor: "#FF434A",
  },
]

export async function GET() {
  return NextResponse.json({ items: mockItems })
}