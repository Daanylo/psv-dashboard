import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '1000';
    
    const [rows] = await pool.query(
      `SELECT 
        ld.id,
        ld.post_id,
        ld.logo_label,
        ld.confidence,
        ld.box_x,
        ld.box_y,
        ld.box_width,
        ld.box_height,
        ip.taken_at as post_date
      FROM logo_detections ld
      JOIN instagram_posts ip ON ld.post_id = ip.id
      ORDER BY ip.taken_at DESC
      LIMIT ?`,
      [parseInt(limit)]
    );

    return NextResponse.json({ detections: rows });
  } catch (error) {
    console.error('Error fetching bulk detections:', error);
    return NextResponse.json(
      { error: 'Failed to fetch detections' },
      { status: 500 }
    );
  }
}
