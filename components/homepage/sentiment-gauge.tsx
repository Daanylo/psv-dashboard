"use client"

import { useEffect, useState } from "react"
import { Pie, PieChart, Label } from "recharts"
import { Smile, Meh, Frown } from "lucide-react"

import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"

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
    color: "#ef4444",
  },
  neutral: {
    label: "Neutral",
    color: "#f59e0b",
  },
  positive: {
    label: "Positive",
    color: "#22c55e",
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
        console.log(stats)
      } catch (error) {
        console.error("Error loading sentiment stats:", error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  const displayData = loading || !data
    ? {
        totalComments: 0,
        averageNegativeSentiment: 0,
        averageNeutralSentiment: 0,
        averagePositiveSentiment: 0,
      }
    : data

  // Data for PieChart (segments)
  const chartData = [
    { name: "negative", value: displayData.averageNegativeSentiment, fill: "var(--color-negative)" },
    { name: "neutral", value: displayData.averageNeutralSentiment, fill: "var(--color-neutral)" },
    { name: "positive", value: displayData.averagePositiveSentiment, fill: "var(--color-positive)" },
  ]

  const totalVisitors = displayData.totalComments
  const positiveScore = displayData.averagePositiveSentiment

  return (
    <div className="flex flex-col items-center">
      <ChartContainer
        config={chartConfig}
        className="mx-auto aspect-[2/1] w-full max-w-[350px]"
      >
        <PieChart>
          <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent hideLabel />}
          />
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            innerRadius={130}
            outerRadius={150}
            startAngle={180}
            endAngle={0}
            paddingAngle={0}
            cornerRadius={5}
            cy="100%"
            stroke="transparent"
            strokeWidth={0}
          >
            <Label
              content={({ viewBox }) => {
                if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                  const { cx, cy } = viewBox
                  const size = 140
                  const iconX = (cx || 0) - size / 2
                  const iconY = (cy || 0) - size

                  return (
                    <g>
                      <foreignObject x={iconX} y={iconY} width={size} height={size}>
                         <div className="flex items-center justify-center w-full h-full">
                            <div className="bg-green-500 rounded-full p-3">
                                <Smile className="text-white w-full h-full" />
                            </div>
                         </div>
                      </foreignObject>
                    </g>
                  )
                }
              }}
            />
          </Pie>
        </PieChart>
      </ChartContainer>
      <div className="mt-2 flex flex-col items-center text-sm z-10">
        <div className="text-3xl font-bold">
          {positiveScore.toFixed(0)}%
        </div>
        <div className="flex items-center gap-2 font-medium text-green-600 mt-1">
          (+8% vs last 2 weeks)
        </div>
        <div className="text-muted-foreground mt-1">
          Total mentions analyzed {totalVisitors.toLocaleString()}
        </div>
      </div>
    </div>
  )
}
