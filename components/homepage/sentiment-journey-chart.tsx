"use client"

import { useEffect, useState } from "react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts"
import { ChartContainer, ChartConfig, ChartTooltip } from "@/components/ui/chart"

interface SentimentJourneyData {
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

const chartConfig = {
  sentiment: {
    label: "Sentiment",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig

export default function SentimentJourneyChart() {
  const [data, setData] = useState<SentimentJourneyData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const response = await fetch('/api/sentiment-journey')
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || 'Failed to fetch sentiment journey')
        }
        const journeyData = await response.json()
        if (Array.isArray(journeyData)) {
          setData(journeyData)
        } else {
          console.error("Invalid response format:", journeyData)
        }
      } catch (error) {
        console.error("Error loading sentiment journey:", error)
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

  const chartData = data.map((item) => {
    const date = new Date(item.date)
    const day = date.getDate().toString().padStart(2, '0')
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    return {
      date: item.date,
      dateLabel: `${day}-${month}`,
      sentiment: item.sentiment,
      commentCount: item.commentCount,
      match: item.match,
    }
  })

  return (
    <div className="w-full">
      <ChartContainer config={chartConfig} className="h-96 w-full">
        <LineChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <ChartTooltip
            content={({ active, payload }) => {
              if (!active || !payload || !payload[0]) return null
              const data = payload[0].payload
              return (
                <div className="rounded-lg border bg-background px-3 py-2 shadow-md">
                  <div className="font-semibold mb-2">{data.dateLabel}</div>
                  <div className="space-y-1 text-sm">
                    <div>Sentiment: {data.sentiment.toFixed(1)}</div>
                    <div>Comments: {data.commentCount.toLocaleString()}</div>
                    {data.match && (
                      <div className="mt-2 pt-2 border-t">
                        <div className="font-semibold text-xs text-muted-foreground">Match</div>
                        <div className="text-xs">{data.match.home} vs {data.match.away}</div>
                        <div className="text-xs font-semibold">Result: {data.match.result}</div>
                        <div className="text-xs text-muted-foreground">{data.match.competition}</div>
                      </div>
                    )}
                  </div>
                </div>
              )
            }}
          />
          <XAxis
            dataKey="dateLabel"
            tick={{ fontSize: 12 }}
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis
            domain={[-1.0, 1.0]}
            tick={{ fontSize: 12 }}
            ticks={[-1.0, -0.5, 0.0, 0.5, 1.0]}
            label={{ value: 'Sentiment', angle: -90, position: 'insideLeft' }}
          />
          <Line
            type="monotone"
            dataKey="sentiment"
            stroke="#3b82f6"
            strokeWidth={3}
            dot={(props: any) => {
              const { payload } = props
              if (payload.match) {
                // Paarse marker voor matches
                return <circle key={`dot-${payload.date}`} cx={props.cx} cy={props.cy} r={10} fill="#9333ea" />
              }
              return <circle key={`dot-${payload.date}`} cx={props.cx} cy={props.cy} r={5} fill="#3b82f6" />
            }}
            activeDot={(props: any) => {
              const { payload } = props
              if (payload.match) {
                return <circle key={`active-${payload.date}`} cx={props.cx} cy={props.cy} r={12} fill="#9333ea" />
              }
              return <circle key={`active-${payload.date}`} cx={props.cx} cy={props.cy} r={7} fill="#3b82f6" />
            }}
          />
        </LineChart>
      </ChartContainer>
      <div className="flex items-center justify-center gap-6">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-[#9333ea]"></div>
          <span className="text-sm text-muted-foreground">Matches</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-[#3b82f6]"></div>
          <span className="text-sm text-muted-foreground">Dates without events</span>
        </div>
      </div>
    </div>
  )
}

