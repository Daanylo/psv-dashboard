import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { InstagramPost } from '@/lib/types/instagram';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50'), 1), 500);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0'), 0);

    const posts = await query<InstagramPost[]>(
      `SELECT * FROM instagram_posts ORDER BY taken_at_timestamp DESC LIMIT ${limit} OFFSET ${offset}`
    );

    const countResult = await query<Array<{ total: number }>>(
      'SELECT COUNT(*) as total FROM instagram_posts'
    );

    return NextResponse.json({
      posts,
      total: countResult[0]?.total || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch posts', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
