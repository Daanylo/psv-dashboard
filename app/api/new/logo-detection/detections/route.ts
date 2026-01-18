import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { postId, detections } = body as {
      postId: string;
      detections: Array<{
        label: string;
        confidence: number;
        box: { x: number; y: number; width: number; height: number };
      }>;
    };

    if (!postId) {
      return NextResponse.json(
        { error: 'Invalid request body: postId is required' },
        { status: 400 }
      );
    }

    // Transaction-like behavior usually good here, but for simplicity:
    // 1. Delete existing
    await query(
      `DELETE FROM logo_detections WHERE post_id = ?`,
      [postId]
    );

    // 2. Insert new
    if (detections && detections.length > 0) {
      const values: any[] = [];
      const placeholders: string[] = [];

      detections.forEach(det => {
        placeholders.push('(?, ?, ?, ?, ?, ?, ?, ?, ?)');
        values.push(
            postId, 
            det.label, 
            det.confidence || 1.0, // Manual additions have 1.0 confidence usually
            det.box.x, 
            det.box.y, 
            det.box.width, 
            det.box.height, 
            'manual', // Model version or 'manual'
            0.5 // Default threshold
        );
      });

      const sql = `INSERT INTO logo_detections 
        (post_id, logo_label, confidence, box_x, box_y, box_width, box_height, model_version, confidence_threshold) 
        VALUES ${placeholders.join(', ')}`;

      await query(sql, values);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'Failed to save detections', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
