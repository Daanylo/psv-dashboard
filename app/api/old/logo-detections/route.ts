import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { LogoDetection } from '@/lib/types/logo-detection';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { postId, detections, confidenceThreshold } = body as {
      postId: number;
      detections: Array<{
        label: string;
        confidence: number;
        box: { x: number; y: number; width: number; height: number };
      }>;
      confidenceThreshold: number;
    };

    if (!postId || !detections || !Array.isArray(detections)) {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    await query(
      `DELETE FROM logo_detections WHERE post_id = ${postId}`
    );

    if (detections.length > 0) {
      const values = detections.map(det => [
        postId,
        det.label,
        det.confidence,
        det.box.x,
        det.box.y,
        det.box.width,
        det.box.height,
        'best.onnx',
        confidenceThreshold
      ]);

      const placeholders = values.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
      const flatValues = values.flat();

      await query(
        `INSERT INTO logo_detections 
        (post_id, logo_label, confidence, box_x, box_y, box_width, box_height, model_version, confidence_threshold) 
        VALUES ${placeholders}`,
        flatValues
      );
    }

    const savedDetections = await query<LogoDetection[]>(
      `SELECT * FROM logo_detections WHERE post_id = ${postId} ORDER BY confidence DESC`
    );

    return NextResponse.json({ 
      success: true,
      count: savedDetections.length,
      detections: savedDetections
    });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'Failed to save detections', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
