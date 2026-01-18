
import { NextResponse } from "next/server"
import { query } from "@/lib/db"

export async function GET() {
  try {
    const brands = await query("SELECT id, name, slug, color, logo_light, logo_dark FROM brands ORDER BY id ASC")
    return NextResponse.json(brands)
  } catch (error) {
    console.error("Failed to fetch brands settings:", error)
    return NextResponse.json({ error: "Failed to fetch brands" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const updates = Array.isArray(body) ? body : [body]

    // Process updates in parallel
    await Promise.all(updates.map(async (brand: any) => {
        // Validate input
        if (brand.id) {
            await query(
                "UPDATE brands SET color = ?, logo_light = ?, logo_dark = ? WHERE id = ?", 
                [brand.color, brand.logo_light, brand.logo_dark, brand.id]
            )
        }
    }))

    return NextResponse.json({ success: true, message: "Brands updated successfully" })
  } catch (error) {
    console.error("Failed to update brands settings:", error)
    return NextResponse.json({ error: "Failed to update brands" }, { status: 500 })
  }
}
