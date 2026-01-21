"use client"

import { useEffect, useState } from "react"
import { Separator } from "@/components/ui/separator"

interface MostDiscussedTopic {
  topicId: number
  insight: string
  content: string
  category: string
  count: number
}

export default function MostDiscussedTopic() {
  const [data, setData] = useState<MostDiscussedTopic[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const response = await fetch('/api/most-discussed-topic')
        if (!response.ok) {
          throw new Error('Failed to fetch most discussed topics')
        }
        const topicsData = await response.json()
        setData(Array.isArray(topicsData) ? topicsData : [])
      } catch (error) {
        console.error("Error loading most discussed topics:", error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-muted-foreground">No data available</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full space-y-6">
      {data.map((topic, index) => (
        <div key={topic.topicId} className="flex-1 flex flex-col">
          <div className="flex items-start gap-4 py-2">
            <div className="text-2xl font-bold text-muted-foreground min-w-[2rem]">
              {index + 1}
            </div>
            <div className="flex-1">
              <div className="font-semibold text-lg">{topic.insight}</div>
            </div>
          </div>
          {index < data.length - 1 && <Separator className="mt-6" />}
        </div>
      ))}
    </div>
  )
}

