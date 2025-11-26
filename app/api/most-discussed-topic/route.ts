import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"

interface Topic {
  id: number
  category_id: number
  created_at: string
  insight: string
  content: string
}

export async function GET() {
  try {
    // Lees comments.csv
    const commentsFilePath = path.join(process.cwd(), 'public', 'data', 'comments.csv')
    const commentsText = fs.readFileSync(commentsFilePath, 'utf-8')
    const commentsLines = commentsText.split('\n').slice(1)
    
    // Tel topic_id's
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
      
      // topic_id is op index 1
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
    
    const topicsFilePath = path.join(process.cwd(), 'public', 'data', 'json', 'topics.json')
    const topicsText = fs.readFileSync(topicsFilePath, 'utf-8')
    const topics: Topic[] = JSON.parse(topicsText)
    
    const categoriesFilePath = path.join(process.cwd(), 'public', 'data', 'json', 'helpers', 'TopicCategories.json')
    const categoriesText = fs.readFileSync(categoriesFilePath, 'utf-8')
    const categories: Array<{ id: number; category: string }> = JSON.parse(categoriesText)
    
    const topicsWithDetails = sortedTopics.map(({ topicId, count }) => {
      const topic = topics.find(t => t.id === topicId)
      const category = topic ? categories.find(c => c.id === topic.category_id) : null
      
      return {
        topicId,
        insight: topic?.insight || 'Unknown',
        content: topic?.content || '',
        category: category?.category || 'Unknown',
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

