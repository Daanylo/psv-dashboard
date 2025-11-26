import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"

export async function GET() {
  try {
    const commentsFilePath = path.join(process.cwd(), 'public', 'data', 'comments.csv')
    const commentsText = fs.readFileSync(commentsFilePath, 'utf-8')
    const commentsLines = commentsText.split('\n').slice(1)
    
    const topicCounts: Record<number, number> = {}
    
    for (const line of commentsLines) {
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
      
      if (columns.length < 2) continue
      

      const topicIdStr = columns[1]?.trim()
      if (!topicIdStr) continue
      
      const topicId = parseInt(topicIdStr, 10)
      if (isNaN(topicId)) continue
      
      topicCounts[topicId] = (topicCounts[topicId] || 0) + 1
    }
    
    const sortedTopics = Object.entries(topicCounts)
      .map(([topicIdStr, count]) => ({
        topicId: parseInt(topicIdStr, 10),
        count: count as number
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4)
    
    if (sortedTopics.length === 0) {
      return NextResponse.json({ error: 'No topics found' }, { status: 404 })
    }
    
    const topicsFilePath = path.join(process.cwd(), 'public', 'data', 'topics.csv')
    const topicsText = fs.readFileSync(topicsFilePath, 'utf-8')
    const topicsLines = topicsText.split('\n').slice(1)
    
    const topicsMap: Record<number, { category_id: number; insight: string; content: string }> = {}
    
    for (const line of topicsLines) {
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
      
      if (columns.length < 5) continue
      
      // topics.csv: id, category_id, created_at, insight, content
      const id = parseInt(columns[0]?.trim(), 10)
      const categoryId = parseInt(columns[1]?.trim(), 10)
      const insight = columns[3]?.trim() || ''
      const content = columns[4]?.trim() || ''
      
      if (!isNaN(id) && !isNaN(categoryId)) {
        topicsMap[id] = { category_id: categoryId, insight, content }
      }
    }
    
    const categoriesFilePath = path.join(process.cwd(), 'public', 'data', 'categories.csv')
    const categoriesText = fs.readFileSync(categoriesFilePath, 'utf-8')
    const categoriesLines = categoriesText.split('\n').slice(1)
    
    const categoriesMap: Record<number, string> = {}
    
    for (const line of categoriesLines) {
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
      
      if (columns.length < 3) continue
      
      const id = parseInt(columns[0]?.trim(), 10)
      const category = columns[2]?.trim() || ''
      
      if (!isNaN(id)) {
        categoriesMap[id] = category
      }
    }
    
    const topicsWithDetails = sortedTopics.map(({ topicId, count }) => {
      const topic = topicsMap[topicId]
      const category = topic ? categoriesMap[topic.category_id] : null
      
      return {
        topicId,
        insight: topic?.insight || 'Unknown',
        content: topic?.content || '',
        category: category || 'Unknown',
        count
      }
    })
    
    return NextResponse.json(topicsWithDetails)
  } catch (error) {
    console.error('Error processing most discussed topic:', error)
    return NextResponse.json(
      { error: 'Failed to process most discussed topic' },
      { status: 500 }
    )
  }
}

