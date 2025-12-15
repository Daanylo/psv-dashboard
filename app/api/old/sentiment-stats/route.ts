import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'public', 'data', 'comments.csv')
    const csvText = fs.readFileSync(filePath, 'utf-8')
    const lines = csvText.split('\n').slice(1) // Skip de eerste regel (header)

    let positiveCount = 0
    let negativeCount = 0
    let neutralCount = 0
    let totalCount = 0
    
    for (const line of lines) {
      if (!line.trim()) continue
      
      // Parse CSV line (handling commas in quoted fields)
      const columns: string[] = []
      let current = ''
      let inQuotes = false
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i]
        if (char === '"') {
          inQuotes = !inQuotes
        } else if (char === ',' && !inQuotes) {
          columns.push(current.trim())
          current = ''
        } else {
          current += char
        }
      }
      columns.push(current.trim())
      
      if (columns.length < 8) continue // Need at least up to sentiment_label (index 7)
      
      // comments.csv: post_id_x, topic_id, date, comment_text, pos, neg, neu, sentiment_label, ...
      const sentimentLabel = columns[7]?.trim().toLowerCase()
      
      if (!sentimentLabel) continue
      
      totalCount++
      if (sentimentLabel === 'positive') {
        positiveCount++
      } else if (sentimentLabel === 'negative') {
        negativeCount++
      } else if (sentimentLabel === 'neutral') {
        neutralCount++
      }
    }
    
    // Bereken percentages
    const positivePercentage = totalCount > 0 ? (positiveCount / totalCount) * 100 : 0
    const negativePercentage = totalCount > 0 ? (negativeCount / totalCount) * 100 : 0
    const neutralPercentage = totalCount > 0 ? (neutralCount / totalCount) * 100 : 0
    
    return NextResponse.json({
      totalComments: totalCount,
      averageNegativeSentiment: Number(negativePercentage.toFixed(2)),
      averagePositiveSentiment: Number(positivePercentage.toFixed(2)),
      averageNeutralSentiment: Number(neutralPercentage.toFixed(2)),
      percentages: {
        negative: `${negativePercentage.toFixed(2)}%`,
        positive: `${positivePercentage.toFixed(2)}%`,
        neutral: `${neutralPercentage.toFixed(2)}%`
      }
    })
  } catch (error) {
    console.error('Error processing sentiment data:', error)
    return NextResponse.json(
      { error: 'Failed to process sentiment data' },
      { status: 500 }
    )
  }
}
