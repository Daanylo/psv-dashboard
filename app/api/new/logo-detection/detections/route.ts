import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { computeVisibilityScore } from '@/lib/visibility-score';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { postId, detections, imageWidth, imageHeight, confidenceThreshold } = body as {
      postId: string;
      detections: Array<{
        label: string;
        confidence: number;
        box: { x: number; y: number; width: number; height: number };
        modelVersion?: string;
      }>;
      imageWidth?: number;
      imageHeight?: number;
      confidenceThreshold?: number;
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

    let resolvedImageWidth: number | null = Number.isFinite(Number(imageWidth)) ? Number(imageWidth) : null
    let resolvedImageHeight: number | null = Number.isFinite(Number(imageHeight)) ? Number(imageHeight) : null

    if (!resolvedImageWidth || !resolvedImageHeight) {
      const rows = await query<Array<{ image_width: number | null; image_height: number | null }>>(
        `SELECT image_width, image_height FROM instagram_posts WHERE id = ? LIMIT 1`,
        [postId],
      )
      resolvedImageWidth = rows[0]?.image_width != null ? Number(rows[0].image_width) : null
      resolvedImageHeight = rows[0]?.image_height != null ? Number(rows[0].image_height) : null
    }

    // 2. Insert new
    if (detections && detections.length > 0) {
      const values: any[] = [];
      const placeholders: string[] = [];

      detections.forEach(det => {
        const modelVersion = (det.modelVersion ?? '').trim() || 'manual'
        const threshold = Number.isFinite(Number(confidenceThreshold)) ? Number(confidenceThreshold) : 0.5
        const visibilityScore = computeVisibilityScore({
          imageWidth: resolvedImageWidth,
          imageHeight: resolvedImageHeight,
          boxX: det.box?.x,
          boxY: det.box?.y,
          boxWidth: det.box?.width,
          boxHeight: det.box?.height,
        })

        placeholders.push('(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        values.push(
            postId, 
            det.label, 
            det.confidence || 1.0, // Manual additions have 1.0 confidence usually
            det.box.x, 
            det.box.y, 
            det.box.width, 
            det.box.height, 
            modelVersion,
            threshold,
            visibilityScore
        );
      });

      const sql = `INSERT INTO logo_detections 
        (post_id, logo_label, confidence, box_x, box_y, box_width, box_height, model_version, confidence_threshold, visibility_score) 
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
