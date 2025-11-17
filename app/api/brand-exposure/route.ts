import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { InstagramPost } from '@/lib/types/instagram';
import { LogoDetection } from '@/lib/types/logo-detection';

interface BrandExposureData {
  logo_label: string;
  post: InstagramPost;
  total_detections: number;
  current_week_count: number;
  previous_week_count: number;
  percentage_change: number;
}

export async function GET() {
  try {
    const topLogos = await query<Array<{ logo_label: string; total_count: number }>>(
      `SELECT 
        TRIM(logo_label) as logo_label,
        COUNT(*) as total_count
      FROM logo_detections
      WHERE verified != -1
      GROUP BY TRIM(logo_label)
      ORDER BY total_count DESC
      LIMIT 3`
    );

    if (topLogos.length === 0) {
      return NextResponse.json({
        data: [],
        message: 'No logo detections found'
      });
    }

    const brandExposureData: BrandExposureData[] = [];
    const usedPostIds = new Set<number>();

    const now = new Date();
    const currentWeekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const previousWeekStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const previousWeekEnd = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    for (const logo of topLogos) {
      const postWithLogo = await query<InstagramPost[]>(
        `SELECT DISTINCT p.* 
        FROM instagram_posts p
        INNER JOIN logo_detections ld ON p.id = ld.post_id
        WHERE TRIM(ld.logo_label) = ?
        AND ld.verified != -1
        AND p.id NOT IN (${usedPostIds.size > 0 ? Array.from(usedPostIds).join(',') : '0'})
        ORDER BY p.taken_at_timestamp DESC
        LIMIT 1`,
        [logo.logo_label]
      );

      if (postWithLogo.length === 0) continue;

      usedPostIds.add(postWithLogo[0].id);

      const currentWeekCount = await query<Array<{ count: number }>>(
        `SELECT COUNT(*) as count
        FROM logo_detections ld
        INNER JOIN instagram_posts p ON ld.post_id = p.id
        WHERE TRIM(ld.logo_label) = ?
        AND ld.verified != -1
        AND p.taken_at_timestamp >= ?`,
        [logo.logo_label, Math.floor(currentWeekStart.getTime() / 1000)]
      );

      const previousWeekCount = await query<Array<{ count: number }>>(
        `SELECT COUNT(*) as count
        FROM logo_detections ld
        INNER JOIN instagram_posts p ON ld.post_id = p.id
        WHERE TRIM(ld.logo_label) = ?
        AND ld.verified != -1
        AND p.taken_at_timestamp >= ?
        AND p.taken_at_timestamp < ?`,
        [
          logo.logo_label,
          Math.floor(previousWeekStart.getTime() / 1000),
          Math.floor(previousWeekEnd.getTime() / 1000)
        ]
      );

      const currentCount = currentWeekCount[0]?.count || 0;
      const previousCount = previousWeekCount[0]?.count || 0;

      let percentageChange = 0;
      if (previousCount > 0) {
        percentageChange = ((currentCount - previousCount) / previousCount) * 100;
      } else if (currentCount > 0 && previousCount === 0) {
        percentageChange = 0;
      }

      brandExposureData.push({
        logo_label: logo.logo_label,
        post: {
          ...postWithLogo[0],
          url: `https://www.instagram.com/p/${postWithLogo[0].shortcode}/media/?size=l`
        },
        total_detections: Number(logo.total_count),
        current_week_count: currentCount,
        previous_week_count: previousCount,
        percentage_change: Math.round(percentageChange * 10) / 10
      });
    }

    const overallCurrentWeek = await query<Array<{ count: number }>>(
      `SELECT COUNT(*) as count
      FROM logo_detections ld
      INNER JOIN instagram_posts p ON ld.post_id = p.id
      WHERE ld.verified != -1
      AND p.taken_at_timestamp >= ?`,
      [Math.floor(currentWeekStart.getTime() / 1000)]
    );

    const overallPreviousWeek = await query<Array<{ count: number }>>(
      `SELECT COUNT(*) as count
      FROM logo_detections ld
      INNER JOIN instagram_posts p ON ld.post_id = p.id
      WHERE ld.verified != -1
      AND p.taken_at_timestamp >= ?
      AND p.taken_at_timestamp < ?`,
      [
        Math.floor(previousWeekStart.getTime() / 1000),
        Math.floor(previousWeekEnd.getTime() / 1000)
      ]
    );

    const overallCurrentTotal = overallCurrentWeek[0]?.count || 0;
    const overallPreviousTotal = overallPreviousWeek[0]?.count || 0;

    let overallVisibilityChange = 0;
    if (overallPreviousTotal > 0) {
      overallVisibilityChange = ((overallCurrentTotal - overallPreviousTotal) / overallPreviousTotal) * 100;
    } else if (overallCurrentTotal > 0 && overallPreviousTotal === 0) {
      overallVisibilityChange = 0;
    }

    return NextResponse.json({
      data: brandExposureData,
      week_start: new Date().toISOString().slice(0, 10),
      overall_current_week_detections: overallCurrentTotal,
      overall_previous_week_detections: overallPreviousTotal,
      overall_visibility_change: Math.round(overallVisibilityChange * 10) / 10
    });

  } catch (error) {
    console.error('Brand exposure API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch brand exposure data' },
      { status: 500 }
    );
  }
}
