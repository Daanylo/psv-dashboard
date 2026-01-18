
import { NextResponse } from "next/server"
import { query } from "@/lib/db"

async function getPeriodMetrics(start: number, end: number, filterClause: string, filterParams: any[]) {
  // 1. Post metrics and Brand metrics
  const stats = await query<{
    count: number;
    impressions: number;
    likes: number;
    comments: number;
    brand_exposures: number;
    brand_impressions: number;
    avg_visibility: number;
  }[]>(
    `SELECT 
       COUNT(DISTINCT ip.id) as count, 
       SUM(COALESCE(ip.estimated_reach, ip.video_view_count, 0)) as impressions,
       SUM(ip.like_count) as likes,
       SUM(ip.comment_count) as comments,
       COUNT(ld.id) as brand_exposures,
       SUM(CASE WHEN ld.id IS NOT NULL THEN COALESCE(ip.estimated_reach, ip.video_view_count, 0) ELSE 0 END) as brand_impressions,
       AVG(ld.visibility_score) as avg_visibility
     FROM instagram_posts ip
     LEFT JOIN logo_detections ld ON ip.id = ld.post_id
     LEFT JOIN brands b ON ld.brand_id = b.id
     WHERE ip.taken_at_timestamp >= ? AND ip.taken_at_timestamp <= ? ${filterClause}`,
    [start, end, ...filterParams]
  )

  const metrics = stats[0] || { 
    count: 0, 
    impressions: 0, 
    likes: 0, 
    comments: 0,
    brand_exposures: 0,
    brand_impressions: 0,
    avg_visibility: 0
  }

  // 2. Comment likes
  const commentLikes = await query<{ likes: number }[]>(
    `SELECT SUM(ic.likes) as likes
     FROM instagram_comments ic
     JOIN instagram_posts ip ON ic.post_id = ip.id
     ${filterClause !== 'AND 1=0' ? `
       LEFT JOIN logo_detections ld ON ip.id = ld.post_id
       LEFT JOIN brands b ON ld.brand_id = b.id
     ` : ''}
     WHERE ip.taken_at_timestamp >= ? AND ip.taken_at_timestamp <= ? ${filterClause}`,
    [start, end, ...filterParams]
  )

  const totalCommentLikes = Number(commentLikes[0]?.likes || 0)

  return {
    posts: Number(metrics.count),
    impressions: Number(metrics.impressions),
    engagement: Number(metrics.likes) + Number(metrics.comments) + totalCommentLikes,
    brandExposures: Number(metrics.brand_exposures),
    brandImpressions: Number(metrics.brand_impressions),
    avgVisibility: Number(metrics.avg_visibility || 0)
  }
}

async function getTrendData(start: number, end: number, filterClause: string, filterParams: any[]) {
  const trends = await query<{ date: string; brand: string; value: number }[]>(
    `SELECT 
       DATE_FORMAT(FROM_UNIXTIME(ip.taken_at_timestamp), '%Y-%m-%d') as date,
       COALESCE(b.slug, TRIM(BOTH '\\r' FROM ld.logo_label)) as brand,
       COUNT(ld.id) as value
     FROM instagram_posts ip
     JOIN logo_detections ld ON ip.id = ld.post_id
     LEFT JOIN brands b ON ld.brand_id = b.id
     WHERE ip.taken_at_timestamp >= ? AND ip.taken_at_timestamp <= ?
       ${filterClause}
     GROUP BY date, brand
     ORDER BY date ASC`,
    [start, end, ...filterParams]
  )
  return trends
}

async function getVisibilityShare(start: number, end: number, filterClause: string, filterParams: any[]) {
  const share = await query<{ brand: string; value: number }[]>(
    `SELECT 
       COALESCE(b.slug, TRIM(BOTH '\\r' FROM ld.logo_label)) as brand,
       COUNT(ld.id) as value
     FROM instagram_posts ip
     JOIN logo_detections ld ON ip.id = ld.post_id
     LEFT JOIN brands b ON ld.brand_id = b.id
     WHERE ip.taken_at_timestamp >= ? AND ip.taken_at_timestamp <= ?
       ${filterClause}
     GROUP BY brand
     ORDER BY value DESC`,
    [start, end, ...filterParams]
  )
  return share
}

async function getMissedOpportunities(start: number, end: number, filterClause: string, filterParams: any[]) {
  // Posts with significant reach but poor visibility
  // If visibility_score is NULL (0 detections) or low (< 50)
  const posts = await query<{
    id: number;
    shortcode: string;
    url: string;
    impressions: number;
    max_visibility: number;
  }[]>(
    `SELECT 
       ip.id,
       ip.shortcode,
       ip.url,
       COALESCE(ip.estimated_reach, ip.video_view_count, 0) as impressions,
       MAX(filtered_ld.visibility_score) as max_visibility
     FROM instagram_posts ip
     LEFT JOIN (
        SELECT ld.post_id, ld.visibility_score
        FROM logo_detections ld
        LEFT JOIN brands b ON ld.brand_id = b.id
        WHERE 1=1 ${filterClause}
     ) filtered_ld ON ip.id = filtered_ld.post_id
     WHERE ip.taken_at_timestamp >= ? AND ip.taken_at_timestamp <= ?
     GROUP BY ip.id
     HAVING (max_visibility IS NULL OR max_visibility < 50)
     ORDER BY 
       (CASE WHEN max_visibility IS NULL THEN 0 ELSE 1 END) ASC,
       (CASE WHEN max_visibility IS NULL THEN impressions ELSE 0 END) DESC,
       max_visibility ASC
     LIMIT 3`,
    [...filterParams, start, end]
  )
  return posts.map(p => ({
    id: p.id.toString(),
    impressions: p.impressions,
    visibilityPct: Number(p.max_visibility || 0),
    imageSrc: p.shortcode ? `https://www.instagram.com/p/${p.shortcode}/media/?size=l` : p.url,
  }))
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  // Incoming params are in milliseconds (from Date.getTime())
  // DB stores timestamps in seconds
  const startMs = parseInt(searchParams.get("start") || "0")
  const endMs = parseInt(searchParams.get("end") || "0")
  const previousStartMs = parseInt(searchParams.get("previousStart") || "0")
  const previousEndMs = parseInt(searchParams.get("previousEnd") || "0")

  const start = Math.floor(startMs / 1000)
  const end = Math.floor(endMs / 1000)
  const previousStart = Math.floor(previousStartMs / 1000)
  const previousEnd = Math.floor(previousEndMs / 1000)

  const sortBy = searchParams.get("sortBy") || "time" // time, visibility, impressions, sentiment
  const order = searchParams.get("order") === "asc" ? "ASC" : "DESC"

  // Parse brands
  const brandsParam = searchParams.get("brands");
  let brandFilterClause = "AND (b.slug IS NULL OR b.slug != 'psv') AND TRIM(BOTH '\\r' FROM ld.logo_label) != 'psv'";
  let brandFilterParams: any[] = [];

  if (brandsParam !== null) {
      if (brandsParam.trim() === "") {
          brandFilterClause = "AND 1=0";
      } else {
          const brands = brandsParam.split(",").map(b => b.trim()).filter(b => b.length > 0);
          if (brands.length > 0) {
              const placeholders = brands.map(() => "?").join(",");
              brandFilterClause = `AND b.slug IN (${placeholders}) AND TRIM(BOTH '\\r' FROM ld.logo_label) != 'psv'`;
              brandFilterParams = brands;
          }
      }
  }

  try {
    const [currentMetrics, previousMetrics, rawTrends, visibilityShare, missedOpportunities] = await Promise.all([
      getPeriodMetrics(start, end, brandFilterClause, brandFilterParams),
      getPeriodMetrics(previousStart, previousEnd, brandFilterClause, brandFilterParams),
      getTrendData(start, end, brandFilterClause, brandFilterParams),
      getVisibilityShare(start, end, brandFilterClause, brandFilterParams),
      getMissedOpportunities(start, end, brandFilterClause, brandFilterParams)
    ])

    // Process trends into pivoted format for recharts
    // [{ date: '2023-01-01', puma: 10, brainport: 5 }, ...]
    const trendMap = new Map<string, any>();
    const allBrands = new Set<string>();

    // First pass: Collect all brands and organize by date
    rawTrends.forEach(row => {
        // Fix: Trim whitespace/newline characters from dirty DB data
        const brand = row.brand.trim().toLowerCase();
        
        // Skip psv logo for commercial trends if desired, or keep it. 
        // Keeping it for now as it's a "brand", but the frontend config filters what is shown.
        
        allBrands.add(brand);
        
        if (!trendMap.has(row.date)) {
            trendMap.set(row.date, { date: row.date });
        }
        const entry = trendMap.get(row.date);
        entry[brand] = row.value;
    });

    // Generate complete date range to fill gaps
    const startDate = new Date(start * 1000);
    const endDate = new Date(end * 1000);
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        if (!trendMap.has(dateStr)) {
            trendMap.set(dateStr, { date: dateStr });
        }
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Convert to array and sort
    const trends = Array.from(trendMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    // Fill missing brand values with 0
    trends.forEach(day => {
        allBrands.forEach(brand => {
            if (day[brand] === undefined) {
                day[brand] = 0;
            }
        });
    });

    // Apply moving average for smoother lines
    const smoothedTrends = trends.map((day, index, array) => {
        const newDay = { ...day };
        
        allBrands.forEach(brand => {
            const windowSize = 7;
            const startIdx = Math.max(0, index - windowSize + 1);
            const window = array.slice(startIdx, index + 1);
            
            const sum = window.reduce((acc, curr) => acc + (curr[brand] || 0), 0);
            const avg = sum / window.length;
            
            newDay[brand] = Number(avg.toFixed(1));
        });
        
        return newDay;
    });

    // Get posts based on sort
    let orderByClause = "taken_at_timestamp DESC"
    
    switch (sortBy) {
      case "time":
        orderByClause = `taken_at_timestamp ${order}`
        break
      case "visibility":
        orderByClause = `max_visibility ${order}`
        break
      case "impressions":
        orderByClause = `impressions ${order}`
        break
      case "sentiment":
        orderByClause = `sentiment_score ${order}`
        break
    }

    const recentPosts = await query<{
      id: number;
      shortcode: string;
      taken_at_timestamp: number;
      like_count: number;
      comment_count: number;
      caption: string;
      url: string;
      max_visibility: number | null;
      max_visibility_brand: string | null;
      impressions: number;
      sentiment_score: number | null;
    }[]>(
      `SELECT 
         ip.id, ip.shortcode, ip.taken_at_timestamp, ip.like_count, ip.comment_count, ip.caption, ip.url,
         COALESCE(ip.estimated_reach, ip.video_view_count, 0) as impressions,
         MAX(ld.visibility_score) as max_visibility,
         (
            SELECT COALESCE(b2.name, ld2.logo_label)
            FROM logo_detections ld2
            LEFT JOIN brands b2 ON ld2.brand_id = b2.id
            WHERE ld2.post_id = ip.id
            ORDER BY ld2.visibility_score DESC
            LIMIT 1
         ) as max_visibility_brand,
         (
           SELECT 
             (COALESCE(SUM(CASE WHEN sentiment='positive' THEN 1 ELSE 0 END), 0) - COALESCE(SUM(CASE WHEN sentiment='negative' THEN 1 ELSE 0 END), 0)) / (COUNT(*) + 20) * 100
           FROM instagram_comments
           WHERE post_id = ip.id
         ) as sentiment_score
       FROM instagram_posts ip
       LEFT JOIN logo_detections ld ON ip.id = ld.post_id
       LEFT JOIN brands b ON ld.brand_id = b.id
       WHERE ip.taken_at_timestamp >= ? AND ip.taken_at_timestamp <= ?
       ${brandFilterClause}
       GROUP BY ip.id
       ORDER BY ${orderByClause}
       LIMIT 3`,
      [start, end, ...brandFilterParams]
    )

    const posts = recentPosts.map(p => ({
      id: p.id.toString(),
      imageSrc: p.shortcode ? `https://www.instagram.com/p/${p.shortcode}/media/?size=l` : p.url,
      date: new Date(p.taken_at_timestamp * 1000), // Convert seconds to ms
      likes: p.like_count,
      comments: p.comment_count,
      caption: p.caption || "",
      impressions: p.impressions,
      visibilityScore: p.max_visibility !== null ? Number(p.max_visibility) : null,
      visibilityBrand: p.max_visibility_brand,
      sentimentScore: p.sentiment_score !== null ? Number(p.sentiment_score) : null
    }))

    return NextResponse.json({
      metrics: currentMetrics,
      previousMetrics: previousMetrics,
      posts,
      trends: smoothedTrends,
      visibilityShare,
      missedOpportunities
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 })
  }
}
