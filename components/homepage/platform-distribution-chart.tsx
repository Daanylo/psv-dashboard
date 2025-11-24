"use client"

import { useEffect, useState } from "react"
import { PieChart, Pie, Cell, Legend, ResponsiveContainer } from "recharts"
import { ChartContainer, ChartConfig, ChartTooltip } from "@/components/ui/chart"

interface PlatformDistribution {
  platform: string
  count: number
  percentage: number
}

const chartConfig = {
  engagement: {
    label: "Engagement",
    theme: {
      light: "hsl(var(--chart-1))",
      dark: "hsl(var(--chart-1))",
    },
  },
} satisfies ChartConfig

export default function PlatformDistributionChart() {
  const [data, setData] = useState<PlatformDistribution[]>([])
  const [total, setTotal] = useState<number>(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const response = await fetch('/api/platform-distribution')
        if (!response.ok) {
          throw new Error('Failed to fetch platform distribution')
        }
        const result = await response.json()
        // Handle both old format (array) and new format (object with platforms and total)
        if (Array.isArray(result)) {
          setData(result)
        } else {
          setData(result.platforms || [])
          setTotal(result.total || 0)
        }
      } catch (error) {
        console.error("Error loading platform distribution:", error)
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

  // Platform specifieke kleuren voor in de charts (zoals op afbeelding)
  const platformColors: Record<string, string> = {
    Instagram: "#9333EA", // Paars
    TikTok: "#F59E0B", // Licht oranje/beige
    YouTube: "#EF4444", // Licht rood/salmon
    Facebook: "#3B82F6", // Licht blauw
  }

  // Chart data formatten voor Recharts PieChart
  const chartData = data.map((item) => ({
    name: item.platform,
    value: item.percentage,
    count: item.count,
    fill: platformColors[item.platform] || "#888888",
  }))

  return (
    <div className="flex items-center gap-8 w-full">
      <ChartContainer config={chartConfig} className="h-[400px] w-[400px] flex-shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              outerRadius={140}
              innerRadius={85}
              fill="#8884d8"
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Pie>
            <ChartTooltip
              content={({ active, payload }) => {
                if (!active || !payload || !payload[0]) return null
                const data = payload[0].payload
                const value = data.value ?? 0
                return (
                  <div className="rounded-lg border bg-background px-3 py-2 shadow-md">
                    <div className="font-semibold mb-2">{data.name}</div>
                    <div className="space-y-1 text-sm">
                      <div>{data.count.toLocaleString()} comments</div>
                      <div>{value.toFixed(1)}%</div>
                    </div>
                  </div>
                )
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </ChartContainer>
      <div className="flex flex-col gap-4 flex-shrink-0 min-w-[150px]">
        {chartData.map((entry, index) => (
          <div key={index} className="flex items-center gap-3">
            <div
              className="w-5 h-5 rounded-sm flex-shrink-0"
              style={{ backgroundColor: entry.fill }}
            />
            <div className="flex items-center gap-2">
              <span className="text-base font-medium">{entry.name}</span>
              <span className="text-sm text-muted-foreground">{entry.value.toFixed(0)}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

