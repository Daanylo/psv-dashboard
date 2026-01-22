import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { computeVisibilityScore } from '@/lib/visibility-score';

function brandKey(value: string) {
  return value.trim().toLowerCase()
}

function normalizeBrandName(label: string | null | undefined) {
  const name = (label ?? '').trim()
  if (!name) return null
  const lowered = name.toLowerCase()
  if (lowered === 'unknown' || lowered === 'other' || lowered === 'none') return null
  return name
}

function slugify(value: string) {
  const base = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return base || 'brand'
}

function isDuplicateEntryError(error: unknown) {
  const err = error as any
  return err?.code === 'ER_DUP_ENTRY' || err?.errno === 1062
}

async function findBrandIdByName(name: string) {
  const rows = await query<Array<{ id: number }>>(
    `SELECT id FROM brands WHERE name = ? LIMIT 1`,
    [name]
  )
  const id = rows[0]?.id
  return id == null ? null : Number(id)
}

async function createBrandAndReturnId(name: string) {
  const baseSlug = slugify(name)

  for (let attempt = 0; attempt < 50; attempt++) {
    const slug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`
    try {
      const result = await query<{ insertId?: number }>(
        `INSERT INTO brands (name, slug) VALUES (?, ?)` ,
        [name, slug]
      )

      const insertedId = Number((result as any)?.insertId ?? 0)
      if (insertedId) return insertedId

      const existingId = await findBrandIdByName(name)
      if (existingId != null) return existingId

      throw new Error('Failed to resolve brand id after insert')
    } catch (error) {
      if (!isDuplicateEntryError(error)) throw error

      const msg = String((error as any)?.message ?? '')
      if (msg.includes("for key 'name'") || msg.includes('for key `name`') || msg.includes('brands.name')) {
        const existingId = await findBrandIdByName(name)
        if (existingId != null) return existingId
        continue
      }

      if (msg.includes("for key 'slug'") || msg.includes('for key `slug`') || msg.includes('brands.slug')) {
        continue
      }

      const existingId = await findBrandIdByName(name)
      if (existingId != null) return existingId

      throw error
    }
  }

  throw new Error(`Unable to create unique slug for brand: ${name}`)
}

async function resolveBrandIdsForDetections(labels: Array<string>) {
  const uniqueNames: string[] = []
  const seen = new Set<string>()

  for (const label of labels) {
    const name = normalizeBrandName(label)
    if (!name) continue
    const key = brandKey(name)
    if (seen.has(key)) continue
    seen.add(key)
    uniqueNames.push(name)
  }

  const map = new Map<string, number>()
  if (uniqueNames.length === 0) return map

  const placeholders = uniqueNames.map(() => '?').join(',')
  const existing = await query<Array<{ id: number; name: string }>>(
    `SELECT id, name FROM brands WHERE name IN (${placeholders})`,
    uniqueNames
  )

  for (const row of existing) {
    map.set(brandKey(row.name), Number(row.id))
  }

  for (const name of uniqueNames) {
    const key = brandKey(name)
    if (map.has(key)) continue
    const id = await createBrandAndReturnId(name)
    map.set(key, id)
  }

  return map
}

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
      const brandIdsByKey = await resolveBrandIdsForDetections(detections.map(d => d.label))
      const values: any[] = [];
      const placeholders: string[] = [];

      detections.forEach(det => {
        const modelVersion = (det.modelVersion ?? '').trim() || 'manual'
        const threshold = Number.isFinite(Number(confidenceThreshold)) ? Number(confidenceThreshold) : 0.5
        const name = normalizeBrandName(det.label)
        const brandId = name ? (brandIdsByKey.get(brandKey(name)) ?? null) : null
        const visibilityScore = computeVisibilityScore({
          imageWidth: resolvedImageWidth,
          imageHeight: resolvedImageHeight,
          boxX: det.box?.x,
          boxY: det.box?.y,
          boxWidth: det.box?.width,
          boxHeight: det.box?.height,
        })

        placeholders.push('(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        values.push(
            postId, 
            brandId,
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
        (post_id, brand_id, logo_label, confidence, box_x, box_y, box_width, box_height, model_version, confidence_threshold, visibility_score) 
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
