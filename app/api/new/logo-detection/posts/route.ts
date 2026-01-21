import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50'), 1), 500);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0'), 0);

    // Get posts with detection count
    // Use string interpolation for LIMIT/OFFSET to ensure compatibility
    // with different mysql2 execution modes (execute vs query)
    const posts = await query<{
      id: number;
      shortcode: string;
      url: string;
      taken_at_timestamp: number;
      detection_count: number;
    }[]>(
      `SELECT ip.id, ip.shortcode, ip.url, ip.taken_at_timestamp, COUNT(ld.id) as detection_count
       FROM instagram_posts ip
       LEFT JOIN logo_detections ld ON ip.id = ld.post_id
       GROUP BY ip.id
       ORDER BY ip.taken_at_timestamp DESC 
       LIMIT ${limit} OFFSET ${offset}`
    );

    const countResult = await query<Array<{ total: number }>>(
      'SELECT COUNT(*) as total FROM instagram_posts'
    );

    // console.log(`Fetched ${posts.length} posts`);

    return NextResponse.json({
      posts: posts.map(p => ({
        ...p,
        id: p.id.toString(), // Ensure IDs are strings for consistency
        detectionCount: Number(p.detection_count)
      })),
      total: countResult[0]?.total || 0,
    });
  } catch (error) {
    console.error('Database error in logo-detection/posts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch posts', details: String(error) },
      { status: 500 }
    );
  }
}
