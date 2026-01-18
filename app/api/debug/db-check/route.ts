import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  try {
    const totalDetections = await query("SELECT COUNT(*) as count FROM logo_detections");
    const totalPosts = await query("SELECT COUNT(*) as count FROM instagram_posts");
    
    // Check timestamps
    const timestamps = await query(`
      SELECT 
        MIN(taken_at_timestamp) as min_ts, 
        MAX(taken_at_timestamp) as max_ts,
        FROM_UNIXTIME(MIN(taken_at_timestamp)) as min_date,
        FROM_UNIXTIME(MAX(taken_at_timestamp)) as max_date
      FROM instagram_posts
    `);

    // Check join count for last 365 days
    const oneYearAgo = Math.floor(Date.now() / 1000) - 31536000;
    const recentDetections = await query(`
      SELECT COUNT(ld.id) as count
      FROM instagram_posts ip
      JOIN logo_detections ld ON ip.id = ld.post_id
      WHERE ip.taken_at_timestamp >= ?
    `, [oneYearAgo]);

    // Check sample detection brands
    const brands = await query(`
      SELECT logo_label, COUNT(*) as count 
      FROM logo_detections 
      GROUP BY logo_label 
      ORDER BY count DESC 
      LIMIT 10
    `);

    return NextResponse.json({
      totalDetections: totalDetections[0],
      totalPosts: totalPosts[0],
      timestamps: timestamps[0],
      recentDetections365d: recentDetections[0],
      brands,
      now: Math.floor(Date.now() / 1000)
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
}
