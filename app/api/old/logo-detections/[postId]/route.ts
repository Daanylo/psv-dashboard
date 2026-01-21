import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { LogoDetection } from '@/lib/types/logo-detection';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { postId: postIdStr } = await params;
    const postId = parseInt(postIdStr);

    if (isNaN(postId)) {
      return NextResponse.json(
        { error: 'Invalid post ID' },
        { status: 400 }
      );
    }

    const detections = await query<LogoDetection[]>(
      `SELECT * FROM logo_detections WHERE post_id = ${postId} ORDER BY confidence DESC`
    );

    return NextResponse.json({ detections });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch detections' },
      { status: 500 }
    );
  }
}
