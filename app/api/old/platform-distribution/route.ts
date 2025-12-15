import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"

export interface PlatformDistribution {
  platform: string
  count: number
  percentage: number
}

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'public', 'data', 'comments_combined.csv')
    const csvText = fs.readFileSync(filePath, 'utf-8')
    const lines = csvText.split('\n').slice(1) // Skip de eerste regel (header)
    
    // Initialiseer alle platforms met 0
    const platformCounts: Record<string, number> = {
      tiktok: 0,
      facebook: 0,
      instagram: 0,
      youtube: 0,
    }
    let total = 0
    
    for (const line of lines) {
      if (!line.trim()) continue
      
      const platform = line.split(',')[0]?.trim().toLowerCase()
      
      if (platform && ['tiktok', 'facebook', 'instagram', 'youtube'].includes(platform)) {
        platformCounts[platform] = (platformCounts[platform] ?? 0) + 1
        total++
      }
    }
    
    const platformNameMap: Record<string, string> = {
      tiktok: 'TikTok',
      facebook: 'Facebook',
      instagram: 'Instagram',
      youtube: 'YouTube',
    }
    
    // Alle platforms zijn geretourneerd
    const result: PlatformDistribution[] = ['tiktok', 'facebook', 'instagram', 'youtube']
      .map((platform) => {
        const count = platformCounts[platform] ?? 0
        const validCount = Number.isFinite(count) ? count : 0
        const percentage = total > 0 ? (validCount / total) * 100 : 0
        return {
          platform: platformNameMap[platform],
          count: validCount,
          percentage: Number.isFinite(percentage) ? percentage : 0,
        }
      })
      .sort((a, b) => b.percentage - a.percentage)
    
    return NextResponse.json({
      platforms: result,
      total: total
    })
  } catch (error) {
    console.error('Error processing CSV:', error)
    return NextResponse.json(
      { error: 'Failed to process data' },
      { status: 500 }
    )
  }
}

