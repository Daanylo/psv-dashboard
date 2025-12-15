import { NextResponse } from "next/server"

const mockPlatforms = [
  { platform: "Instagram", mentions: 8200 },
  { platform: "TikTok", mentions: 6100 },
  { platform: "YouTube", mentions: 4300 },
  { platform: "Facebook", mentions: 2100 },
]

export async function GET() {
  return NextResponse.json({ items: mockPlatforms })
}
