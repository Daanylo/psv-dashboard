import { NextResponse } from "next/server"

const mockTopics = [
  { title: "PSV vs Ajax (Eredivisie)", mentions: 5200 },
  { title: "Champions League: PSV vs Liverpool", mentions: 4100 },
  { title: "Atlético Madrid clash build-up", mentions: 2900 },
  { title: "Ismael Saibari interview", mentions: 2100 },
]

export async function GET() {
  return NextResponse.json({ items: mockTopics })
}
