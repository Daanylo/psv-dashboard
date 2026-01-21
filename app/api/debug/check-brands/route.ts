
import { NextResponse } from "next/server"
import { query } from "@/lib/db"

export async function GET() {
  try {
    const rows = await query(`
        SELECT DISTINCT TRIM(BOTH '\\r' FROM logo_label) as brand_name 
        FROM logo_detections 
        WHERE TRIM(BOTH '\\r' FROM logo_label) NOT LIKE 'psv'
        ORDER BY brand_name
    `);
    console.log("DEBUG_BRANDS_LIST:", JSON.stringify(rows));
    return NextResponse.json(rows);
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
