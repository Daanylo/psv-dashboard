import { NextResponse } from "next/server"
import { loadPlayerDirectory } from "@/lib/overview-data"

export async function GET() {
  try {
    const { allPlayers } = await loadPlayerDirectory()
    // Sort players by name
    allPlayers.sort((a, b) => a.name.localeCompare(b.name))
    
    return NextResponse.json({ players: allPlayers })
  } catch (error) {
    console.error("Error loading players:", error)
    return NextResponse.json({ error: "Failed to load players" }, { status: 500 })
  }
}
