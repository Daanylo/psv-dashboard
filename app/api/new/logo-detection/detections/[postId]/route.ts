import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const postId = (await params).postId;
    
    const detections = await query<any[]>(
      `SELECT * FROM logo_detections WHERE post_id = ? ORDER BY confidence DESC`,
      [postId]
    );

    return NextResponse.json({ 
      detections: detections.map(d => ({
        id: d.id,
        label: d.logo_label,
        confidence: Number(d.confidence),
        visibilityScore: d.visibility_score == null ? null : Number(d.visibility_score),
        box: {
          x: Number(d.box_x),
          y: Number(d.box_y),
          width: Number(d.box_width),
          height: Number(d.box_height)
        }
      }))
    });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch detections' },
      { status: 500 }
    );
  }
}
