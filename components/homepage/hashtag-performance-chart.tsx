"use client"

import { useEffect, useState } from "react"
import { BarChart, Bar, XAxis, YAxis, Cell } from "recharts"
import { ChartContainer, ChartConfig, ChartTooltip } from "@/components/ui/chart"

interface HashtagPerformance {
  hashtag: string
  totalEngagement: number
  totalComments: number
  totalShares: number
  totalLikes: number
  postCount: number
  averageEngagement: number
}

const chartConfig = {
  engagement: {
    label: "Engagement",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig

export default function HashtagPerformanceChart() {
  const [data, setData] = useState<HashtagPerformance[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const response = await fetch('/api/hashtag-performance')
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || 'Failed to fetch hashtag performance')
        }
        const hashtags = await response.json()
        // Check if it's an array
        if (Array.isArray(hashtags)) {
          // Take top 4
          setData(hashtags.slice(0, 4))
        } else {
          console.error("Invalid response format:", hashtags)
        }
      } catch (error) {
        console.error("Error loading hashtag performance:", error)
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

  // Chart data formatten voor Recharts
  const chartData = data.map((item) => ({
    hashtag: item.hashtag,
    engagement: item.totalEngagement,
    comments: item.totalComments,
    shares: item.totalShares,
    likes: item.totalLikes,
    posts: item.postCount,
  }))

  return (
    <ChartContainer config={chartConfig} className="h-80 w-full">
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 20, right: 60, left: 20, bottom: 5 }}
      >
        <ChartTooltip
          content={({ active, payload }) => {
            if (!active || !payload || !payload[0]) return null
            const data = payload[0].payload
            return (
              <div className="rounded-lg border bg-background px-3 py-2 shadow-md">
                <div className="font-semibold mb-2">{data.hashtag}</div>
                <div className="space-y-1 text-sm">
                  <div>Used in: {data.posts} {data.posts === 1 ? 'post' : 'posts'}</div>
                  <div>Likes: {data.likes.toLocaleString()}</div>
                  <div>Comments: {data.comments.toLocaleString()}</div>
                  <div>Shares: {data.shares.toLocaleString()}</div>
                  <div className="font-medium mt-1">Total: {data.engagement.toLocaleString()}</div>
                </div>
              </div>
            )
          }}
        />
        <XAxis type="number" hide domain={[0, 'dataMax']} />
        <YAxis
          type="category"
          dataKey="hashtag"
          width={120}
          tick={{ fontSize: 12 }}
        />
        <Bar
          dataKey="engagement"
          radius={[0, 4, 4, 0]}
        >
          {chartData.map((entry) => (
            <Cell
              key={`cell-${entry.hashtag}`}
              fill="#3b82f6"
            />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}

