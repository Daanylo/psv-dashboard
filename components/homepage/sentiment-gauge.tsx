"use client"

import { useEffect, useState } from "react"
import { Label, PolarRadiusAxis, RadialBar, RadialBarChart } from "recharts"
import { ChartContainer, ChartConfig, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Smile, Frown, Meh } from "lucide-react"

interface SentimentStats {
  totalComments: number
  averageNegativeSentiment: number
  averagePositiveSentiment: number
  averageNeutralSentiment: number
  percentages: {
    negative: string
    positive: string
    neutral: string
  }
}

const chartConfig = {
  negative: {
    label: "Negative",
    color: "#ef4444", // red
  },
  neutral: {
    label: "Neutral",
    color: "#f59e0b", // yellow/orange
  },
  positive: {
    label: "Positive",
    color: "#22c55e", // green
  },
} satisfies ChartConfig

export default function SentimentGauge() {
  const [data, setData] = useState<SentimentStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const response = await fetch('/api/sentiment-stats')
        if (!response.ok) {
          throw new Error('Failed to fetch sentiment stats')
        }
        const stats = await response.json()
        setData(stats)
      } catch (error) {
        console.error("Error loading sentiment stats:", error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  // Display data
  const displayData = loading || !data
    ? {
        totalComments: 0,
        averageNegativeSentiment: 0,
        averageNeutralSentiment: 0,
        averagePositiveSentiment: 0,
      }
    : data

  // Chart data
  const chartData = [{
    negative: displayData.averageNegativeSentiment,
    neutral: displayData.averageNeutralSentiment,
    positive: displayData.averagePositiveSentiment,
  }]

  return (
    <div className="relative w-full">
      <ChartContainer config={chartConfig} className="w-full">
        <RadialBarChart
          data={chartData}
          startAngle={180}
          endAngle={0}
          innerRadius={140}
          outerRadius={220}
          cx="50%"
          cy="80%"
          margin={{ top: 0, right: 20, bottom: 0, left: 20 }}
        >
          <ChartTooltip
            cursor={false}
            content={({ active, payload }) => {
              if (!active || !payload || !payload.length) return null
              
              const data = payload[0]?.payload || chartData[0]
              return (
                <div className="rounded-lg border bg-background px-3 py-2 shadow-md">
                  <div className="font-semibold mb-2">Sentiment Overview</div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm">
                      <div 
                        className="w-3 h-3 rounded-sm" 
                        style={{ backgroundColor: chartConfig.positive.color }}
                      />
                      <span>Positive: {data.positive?.toFixed(1) || displayData.averagePositiveSentiment.toFixed(1)}%</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <div 
                        className="w-3 h-3 rounded-sm" 
                        style={{ backgroundColor: chartConfig.neutral.color }}
                      />
                      <span>Neutral: {data.neutral?.toFixed(1) || displayData.averageNeutralSentiment.toFixed(1)}%</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <div 
                        className="w-3 h-3 rounded-sm" 
                        style={{ backgroundColor: chartConfig.negative.color }}
                      />
                      <span>Negative: {data.negative?.toFixed(1) || displayData.averageNegativeSentiment.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              )
            }}
          />
          <PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
            <Label
              content={({ viewBox }) => {
                if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                  // Determine mood icon and color
                  let MoodIcon = Meh
                  let moodColor = chartConfig.neutral.color
                  if (data) {
                    if (data.averagePositiveSentiment > 50) {
                      MoodIcon = Smile
                      moodColor = chartConfig.positive.color
                    } else if (data.averageNegativeSentiment > 50) {
                      MoodIcon = Frown
                      moodColor = chartConfig.negative.color
                    }
                  }
                  
                  const iconSize = 48
                  const iconX = (viewBox.cx || 0) - iconSize / 2
                  const iconY = (viewBox.cy || 0) - 95
                  
                  return (
                    <g>
                      <foreignObject
                        x={iconX}
                        y={iconY}
                        width={iconSize}
                        height={iconSize}
                      >
                        <div className="flex items-center justify-center w-full h-full">
                          <MoodIcon 
                            size={iconSize} 
                            color={moodColor}
                            strokeWidth={2}
                          />
                        </div>
                      </foreignObject>
                      <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle">
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy || 0) - 16}
                          className="fill-foreground text-2xl font-bold"
                        >
                          {displayData.averagePositiveSentiment.toFixed(1)}%
                        </tspan>
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy || 0) + 4}
                          className="fill-muted-foreground text-sm"
                        >
                          Positive
                        </tspan>
                      </text>
                    </g>
                  )
                }
              }}
            />
          </PolarRadiusAxis>
          <RadialBar
            dataKey="negative"
            stackId="sentiment"
            cornerRadius={5}
            fill="var(--color-negative)"
            className="stroke-transparent stroke-2"
          />
          <RadialBar
            dataKey="neutral"
            fill="var(--color-neutral)"
            stackId="sentiment"
            cornerRadius={5}
            className="stroke-transparent stroke-2"
          />
          <RadialBar
            dataKey="positive"
            fill="var(--color-positive)"
            stackId="sentiment"
            cornerRadius={5}
            className="stroke-transparent stroke-2"
          />
        </RadialBarChart>
      </ChartContainer>
      <div className="text-center mt-2">
        <p className="text-sm text-muted-foreground">
          {displayData.totalComments.toLocaleString()} comments analyzed
        </p>
      </div>
    </div>
  )
}

