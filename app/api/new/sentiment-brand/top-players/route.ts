import { NextResponse } from "next/server"

const mockPlayers = [
  { name: "Ismael Saibari", positive: 75, neutral: 15, negative: 10 },
  { name: "Kiliann Sildilia", positive: 73, neutral: 16, negative: 11 },
  { name: "Dennis Man", positive: 69, neutral: 23, negative: 8 },
  { name: "Adamo Nagalo", positive: 66, neutral: 25, negative: 9 },
]

export async function GET() {
  return NextResponse.json({ items: mockPlayers })
}
