import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"

interface HashtagPerformance {
  hashtag: string
  totalEngagement: number
  totalComments: number
  totalShares: number
  totalLikes: number
  postCount: number
  averageEngagement: number
}

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'public', 'data', 'socials_posts_overview.csv')
    const csvText = fs.readFileSync(filePath, 'utf-8')
    
    // Parse CSV properly handling multi-line fields
    const lines: string[] = []
    let currentLine = ''
    let inQuotes = false
    
    for (let i = 0; i < csvText.length; i++) {
      const char = csvText[i]
      const nextChar = csvText[i + 1]
      
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          currentLine += '"'
          i++ // Skip next quote
        } else {
          // Toggle quote state
          inQuotes = !inQuotes
          currentLine += char
        }
      } else if (char === '\n' && !inQuotes) {
        // End of line
        if (currentLine.trim()) {
          lines.push(currentLine)
        }
        currentLine = ''
      } else {
        currentLine += char
      }
    }
    // Add last line if exists
    if (currentLine.trim()) {
      lines.push(currentLine)
    }
    
    // Skip header
    const dataLines = lines.slice(1)

    // Map to store hashtag performance
    const hashtagStats: Record<string, {
      comments: number
      shares: number
      likes: number
      postCount: number
    }> = {}

    for (const line of dataLines) {
      if (!line.trim()) continue

      // Parse CSV line - handle commas in quoted fields
      const columns: string[] = []
      let current = ''
      let inQuotes = false
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i]
        const nextChar = line[i + 1]
        
        if (char === '"') {
          if (inQuotes && nextChar === '"') {
            current += '"'
            i++
          } else {
            inQuotes = !inQuotes
            current += char
          }
        } else if (char === ',' && !inQuotes) {
          columns.push(current.trim())
          current = ''
        } else {
          current += char
        }
      }
      columns.push(current.trim()) // Add last column
      
      if (columns.length < 8) continue

      const source = columns[0]?.replace(/^"|"$/g, '').trim().toLowerCase() || ''
      let hashtagsStr = columns[3]?.replace(/^"|"$/g, '').trim() || ''
      
      // Replace double quotes with single quotes for JSON parsing
      hashtagsStr = hashtagsStr.replace(/""/g, '"')
      
      const numComments = parseFloat(columns[4]?.replace(/^"|"$/g, '').trim() || '0') || 0
      const numShares = parseFloat(columns[5]?.replace(/^"|"$/g, '').trim() || '0') || 0 // Facebook shares
      const likes = parseFloat(columns[6]?.replace(/^"|"$/g, '').trim() || '0') || 0
      const shareCount = parseFloat(columns[7]?.replace(/^"|"$/g, '').trim() || '0') || 0 // TikTok/other shares

      // Skip if no hashtags
      if (!hashtagsStr || hashtagsStr === '' || hashtagsStr === 'null') continue

      // Parse hashtags (JSON array format: ["hashtag1", "hashtag2"])
      let hashtags: string[] = []
      try {
        // Try to parse as JSON
        if (hashtagsStr.startsWith('[')) {
          hashtags = JSON.parse(hashtagsStr)
        } else {
          // If not JSON, try to split by comma
          hashtags = hashtagsStr.split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase())
        }
      } catch (error) {
        // If parsing fails, try to extract hashtags manually
        const hashtagMatches = hashtagsStr.match(/["']?([^"',]+)["']?/g)
        if (hashtagMatches) {
          hashtags = hashtagMatches.map(h => h.replace(/["']/g, '').trim().toLowerCase())
        }
      }

      // Determine shares table based on platform
      let shares = 0
      if (source === 'facebook') {
        shares = numShares
      } else if (source === 'tiktok') {
        shares = shareCount
      } else if (source === 'instagram') {
        // Instagram doesn't show shares, so we use 0
        shares = 0
      } else if (source === 'youtube') {
        // YouTube uses share_count if available, otherwise num_shares
        shares = shareCount || numShares
      } else {
        // Default: use share_count if available, otherwise num_shares
        shares = shareCount || numShares
      }

      // Process each hashtag
      for (const hashtag of hashtags) {
        if (!hashtag || hashtag === '') continue

        const normalizedHashtag = hashtag.toLowerCase().replace(/^#/, '')

        if (!hashtagStats[normalizedHashtag]) {
          hashtagStats[normalizedHashtag] = {
            comments: 0,
            shares: 0,
            likes: 0,
            postCount: 0,
          }
        }

        hashtagStats[normalizedHashtag].comments += numComments
        hashtagStats[normalizedHashtag].shares += shares
        hashtagStats[normalizedHashtag].likes += likes
        hashtagStats[normalizedHashtag].postCount += 1
      }
    }

    // Calculate performance metrics for each hashtag
    const results: HashtagPerformance[] = Object.entries(hashtagStats)
      .map(([hashtag, stats]) => {
        const totalEngagement = stats.comments + stats.shares + stats.likes
        const averageEngagement = stats.postCount > 0 ? totalEngagement / stats.postCount : 0

        return {
          hashtag: `#${hashtag}`,
          totalEngagement: Math.round(totalEngagement),
          totalComments: Math.round(stats.comments),
          totalShares: Math.round(stats.shares),
          totalLikes: Math.round(stats.likes),
          postCount: stats.postCount,
          averageEngagement: Math.round(averageEngagement * 100) / 100,
        }
      })
      .filter(item => item.totalEngagement > 0) // Only include hashtags with engagement
      .sort((a, b) => b.totalEngagement - a.totalEngagement) // Sort by total engagement descending

    return NextResponse.json(results)
  } catch (error) {
    console.error('Error processing hashtag performance:', error)
    return NextResponse.json(
      { error: 'Failed to process hashtag performance data' },
      { status: 500 }
    )
  }
}

