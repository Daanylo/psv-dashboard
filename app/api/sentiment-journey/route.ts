import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"

export interface SentimentJourneyData {
  date: string
  sentiment: number
  commentCount: number
  match?: {
    home: string
    away: string
    result: string
    competition: string
  }
}

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'public', 'data', 'comments.csv')
    const csvText = fs.readFileSync(filePath, 'utf-8')
    const lines = csvText.split('\n').slice(1)
    
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startDate = new Date(today)
    startDate.setDate(today.getDate() - 7)
    const endDate = new Date(today)
    endDate.setDate(today.getDate() + 6)

    const matchesFilePath = path.join(process.cwd(), 'public', 'data', 'matches.csv')
    const matchesText = fs.readFileSync(matchesFilePath, 'utf-8')
    const matchesLines = matchesText.split('\n').slice(1)
    
    const matchesMap: Record<string, { home: string; away: string; result: string; competition: string }> = {}
    
    for (const line of matchesLines) {
      if (!line.trim()) continue
      
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
      
      if (columns.length < 7) continue
      
      const dateStr = columns[0]?.trim()
      const home = columns[3]?.trim()
      const away = columns[4]?.trim()
      const result = columns[5]?.trim()
      const competition = columns[2]?.trim()
      
      if (!dateStr || !home || !away || !result) continue
      
      try {
        const cleanDateStr = dateStr.replace(/\+00:00$/, '').split(' ')[0]
        const dateParts = cleanDateStr.split('-')
        if (dateParts.length !== 3) continue
        
        const year = parseInt(dateParts[0], 10)
        const month = parseInt(dateParts[1], 10) - 1
        const day = parseInt(dateParts[2], 10)
        
        if (isNaN(year) || isNaN(month) || isNaN(day)) continue
        
        const dateMidnight = new Date(year, month, day)
        if (dateMidnight < startDate || dateMidnight > endDate) continue
        
        const dateOnly = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        matchesMap[dateOnly] = { home, away, result, competition: competition || '' }
      } catch (error) {
        continue
      }
    }
    
    const dateMap: Record<string, { 
      dayPositive: number; 
      dayNegative: number; 
      dayTotal: number 
    }> = {}
    
    for (const line of lines) {
      if (!line.trim()) continue
      
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
      
      if (columns.length < 8) continue
      
      const dateStr = columns[2]?.trim()
      const sentimentLabel = columns[7]?.trim().toLowerCase()
      
      if (!dateStr || dateStr === 'date' || !sentimentLabel) continue
      
      let dateOnly: string
      try {
        const cleanDateStr = dateStr.replace(/\+00:00$/, '').split(' ')[0]
        const dateParts = cleanDateStr.split('-')
        if (dateParts.length !== 3) {
          continue
        }
        
        const year = parseInt(dateParts[0], 10)
        const month = parseInt(dateParts[1], 10) - 1
        const day = parseInt(dateParts[2], 10)
        
        if (isNaN(year) || isNaN(month) || isNaN(day)) {
          continue
        }
        
        const dateMidnight = new Date(year, month, day)
        if (dateMidnight < startDate || dateMidnight > endDate) {
          continue
        }
        
        dateOnly = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      } catch (error) {
        continue
      }
      
      if (!dateMap[dateOnly]) {
        dateMap[dateOnly] = { dayPositive: 0, dayNegative: 0, dayTotal: 0 }
      }
      
      dateMap[dateOnly].dayTotal += 1
      if (sentimentLabel === 'positive') {
        dateMap[dateOnly].dayPositive += 1
      } else if (sentimentLabel === 'negative') {
        dateMap[dateOnly].dayNegative += 1
      }
    }
    
    const allDatesInRange: string[] = []
    const currentDate = new Date(startDate)
    while (currentDate <= endDate) {
      const year = currentDate.getFullYear()
      const month = String(currentDate.getMonth() + 1).padStart(2, '0')
      const day = String(currentDate.getDate()).padStart(2, '0')
      const dateStr = `${year}-${month}-${day}`
      allDatesInRange.push(dateStr)
      currentDate.setDate(currentDate.getDate() + 1)
    }
    
    if (allDatesInRange.length === 0) {
      return NextResponse.json([])
    }

    let maxTotal = 0
    allDatesInRange.forEach(date => {
      const data = dateMap[date]
      if (data && data.dayTotal > maxTotal) {
        maxTotal = data.dayTotal
      }
    })

    const unscaledScores: Record<string, number> = {}
    let minUnscaled = Infinity
    let maxUnscaled = -Infinity

    allDatesInRange.forEach(date => {
      const data = dateMap[date]
      if (data && data.dayTotal > 0) {
        const unscaled = ((data.dayPositive - data.dayNegative) / data.dayTotal) * Math.sqrt(data.dayTotal / maxTotal)
        unscaledScores[date] = unscaled
        
        if (unscaled < minUnscaled) minUnscaled = unscaled
        if (unscaled > maxUnscaled) maxUnscaled = unscaled
      } else {
        unscaledScores[date] = 0
      }
    })

    const result: SentimentJourneyData[] = allDatesInRange.map((date) => {
      const data = dateMap[date]
      const match = matchesMap[date]
      const commentCount = data ? data.dayTotal : 0
      
      let scaledSentiment = 0.0
      if (commentCount > 0 && maxUnscaled !== minUnscaled) {
        const unscaled = unscaledScores[date]
        scaledSentiment = ((unscaled - minUnscaled) / (maxUnscaled - minUnscaled)) * 2 - 1
      }
      
      return {
        date,
        sentiment: scaledSentiment,
        commentCount,
        ...(match && { match }),
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
