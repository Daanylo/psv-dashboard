import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"

export interface SentimentJourneyData {
  date: string
  sentiment: number
  commentCount: number
}

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'public', 'data', 'comments_combined_temp.csv')
    const csvText = fs.readFileSync(filePath, 'utf-8')
    const lines = csvText.split('\n').slice(1) // Skip header
    
    // Map voor datum -> { totalPosSentiment, count }
    const dateMap: Record<string, { totalPosSentiment: number; count: number }> = {}
    const uniqueDates = new Set<string>()
    
    // Verzamel alle datums en bereken gemiddelde positieve sentiment per dag
    for (const line of lines) {
      if (!line.trim()) continue
      
      // Parse CSV line (handling quoted fields)
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
      columns.push(current.trim()) // Add last column
      
      if (columns.length < 10) continue // We need at least 10 columns (date is index 9)
      
      const dateStr = columns[9]?.trim() // date is column 9 (last column, index 9)
      const posSentimentStr = columns[5]?.trim() // pos_sentiment (%) is column 5
      
      if (!dateStr || dateStr === 'date' || !posSentimentStr) continue
      
      // Parse positieve sentiment
      const posSentiment = parseFloat(posSentimentStr)
      if (isNaN(posSentiment)) continue
      
      // Valideer en parse datum - alleen YYYY-MM-DD formaat accepteren
      // Check of het een geldige datum string is (YYYY-MM-DD)
      const datePattern = /^\d{4}-\d{2}-\d{2}$/
      if (!datePattern.test(dateStr)) {
        // Probeer te parsen als het een datum met tijd is
        try {
          const cleanDateStr = dateStr.replace(/\+00:00$/, '').split(' ')[0] // Neem alleen het datum deel
          if (!datePattern.test(cleanDateStr)) {
            continue // Skip als het nog steeds geen geldig formaat is
          }
          const date = new Date(cleanDateStr)
          if (isNaN(date.getTime())) {
            continue
          }
          const dateOnly = date.toISOString().split('T')[0]
          
          uniqueDates.add(dateOnly)
          if (!dateMap[dateOnly]) {
            dateMap[dateOnly] = { totalPosSentiment: 0, count: 0 }
          }
          dateMap[dateOnly].totalPosSentiment += posSentiment
          dateMap[dateOnly].count += 1
        } catch (error) {
          continue
        }
      } else {
        // Direct geldig YYYY-MM-DD formaat
        const date = new Date(dateStr)
        if (isNaN(date.getTime())) {
          continue
        }
        const dateOnly = date.toISOString().split('T')[0]
        
        uniqueDates.add(dateOnly)
        if (!dateMap[dateOnly]) {
          dateMap[dateOnly] = { totalPosSentiment: 0, count: 0 }
        }
        dateMap[dateOnly].totalPosSentiment += posSentiment
        dateMap[dateOnly].count += 1
      }
    }
    
    // Sorteer alle unieke datums chronologisch
    const sortedDates = Array.from(uniqueDates).sort()
    if (sortedDates.length === 0) {
      return NextResponse.json([])
    }
    
    // Pak de laatste 14 datums (de meest recente 14 datums)
    const last14Dates = sortedDates.length >= 14 
      ? sortedDates.slice(-14) 
      : sortedDates // Als er minder dan 14 datums zijn, gebruik alle datums
    
    // Converteer naar array met gemiddelde positieve sentiment per dag
    // Converteer percentage (0-100) naar sentiment range (-1.0 tot 1.0)
    // We gebruiken: sentiment = (posSentiment% / 100) * 2 - 1
    // Dit geeft: 0% -> -1.0, 50% -> 0.0, 100% -> 1.0
    const result: SentimentJourneyData[] = last14Dates.map((date) => {
      const data = dateMap[date]
      if (!data || data.count === 0) {
        return {
          date,
          sentiment: 0,
          commentCount: 0,
        }
      }
      
      const avgPosSentiment = data.totalPosSentiment / data.count // Percentage 0-100
      // Converteer naar -1.0 tot 1.0 range
      const sentiment = (avgPosSentiment / 100) * 2 - 1
      
      return {
        date,
        sentiment,
        commentCount: data.count,
      }
    })
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error processing sentiment journey:', error)
    return NextResponse.json(
      { error: 'Failed to process sentiment journey data' },
      { status: 500 }
    )
  }
}

