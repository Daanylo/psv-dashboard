"use client"

import { useEffect, useState } from "react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts"
import { ChartContainer, ChartConfig, ChartTooltip } from "@/components/ui/chart"

type JourneyEvent = {
  title: string
  competition?: string
  home?: string
  away?: string
  result?: string
  time?: string
}

type JourneyDay = {
  date: string
  sentiment: number
  events: JourneyEvent[]
}

const chartConfig = {
  sentiment: {
    label: "Sentiment",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig

export default function SentimentJourneyChart() {
  const [data, setData] = useState<JourneyDay[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const response = await fetch("/api/new/sentiment-brand/sentiment-journey", {
          cache: "no-store",
        })
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || "Failed to fetch sentiment journey")
        }
        const journeyData = await response.json()
        const days: JourneyDay[] = Array.isArray(journeyData)
          ? journeyData
          : Array.isArray(journeyData?.days)
          ? journeyData.days
          : []
        setData(days)
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

  const chartData = [...data]
    .sort(
      (a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime(),
    )
    .map((item) => {
      const date = new Date(item.date)
      const day = date.getDate().toString().padStart(2, "0")
      const month = (date.getMonth() + 1).toString().padStart(2, "0")
      return {
        date: item.date,
        dateLabel: `${day}-${month}`,
        sentiment: item.sentiment,
        hasEvent: (item.events?.length ?? 0) > 0,
        events: item.events ?? [],
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
                    <div>Sentiment: {data.sentiment.toFixed(0)}</div>
                    {data.events && data.events.length > 0 && (
                      <div className="mt-2 pt-2 border-t">
                        <div className="font-semibold text-xs text-muted-foreground">Events</div>
                        {data.events.map((evt: JourneyEvent, idx: number) => (
                          <div key={idx} className="text-xs space-y-0.5">
                            <div className="font-semibold">{evt.title}</div>
                            {evt.home && evt.away && (
                              <div>{evt.home} vs {evt.away}</div>
                            )}
                            {evt.result && <div className="font-semibold">Result: {evt.result}</div>}
                            {evt.competition && (
                              <div className="text-muted-foreground">{evt.competition}</div>
                            )}
                            {evt.time && <div className="text-muted-foreground">{evt.time}</div>}
                          </div>
                        ))}
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
            domain={[0, 100]}
            tick={{ fontSize: 12 }}
            ticks={[0, 25, 50, 75, 100]}
            label={{ value: "Sentiment", angle: -90, position: "insideLeft" }}
          />
          <Line
            type="monotone"
            dataKey="sentiment"
            stroke="#3b82f6"
            strokeWidth={3}
            dot={(props: any) => {
              const { payload } = props
              if (payload.hasEvent) {
                // Paarse marker voor matches
                return <circle key={`dot-${payload.date}`} cx={props.cx} cy={props.cy} r={10} fill="#9333ea" />
              }
              return <circle key={`dot-${payload.date}`} cx={props.cx} cy={props.cy} r={5} fill="#3b82f6" />
            }}
            activeDot={(props: any) => {
              const { payload } = props
              if (payload.hasEvent) {
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

