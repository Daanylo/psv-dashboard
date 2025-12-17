"use client"

import { useEffect, useMemo, useState } from "react"
import { Pie, PieChart, Cell } from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

type PlatformData = {
  platform: string
  label: string
  value: number
}

export default function WhereFansEngageMost() {
  const [data, setData] = useState<PlatformData[]>([])
  const [loading, setLoading] = useState(true)

  const config = useMemo<ChartConfig>(
    () => ({
      instagram: { label: "Instagram", color: "#3DC2B2" },
      tiktok: { label: "TikTok", color: "#964DC9" },
      youtube: { label: "YouTube", color: "#FF632F" },
      facebook: { label: "Facebook", color: "#3358EC" },
    }),
    []
  )

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/new/social-media/where-fans-engage-most", {
        cache: "no-store",
      })
      const { items = [] } = (await res.json()) as {
        items?: { platform: string; mentions: number }[]
      }

      const total = items.reduce((sum, item) => sum + (item.mentions || 0), 0)
      const platformData = items.map((item) => ({
        platform: item.platform.toLowerCase(),
        label: item.platform,
        value: total > 0 ? Math.round((item.mentions / total) * 100) : 0,
      }))

      setData(platformData)
      setLoading(false)
    }

    load()
  }, [])

  if (loading) {
    return (
      <div className="rounded bg-muted/10 px-4 py-8 text-sm text-muted-foreground min-h-[280px] flex items-center justify-center">
        Loading engagement data…
      </div>
    )
  }

  return (
    <div className="flex flex-col md:flex-row gap-4 items-start">
      <ChartContainer
        config={config}
        className="w-full md:w-1/2 aspect-square"
      >
        <PieChart>
          <ChartTooltip
            content={
              <ChartTooltipContent
                nameKey="label"
                formatter={(value) => `${value}%`}
              />
            }
          />
          <Pie
            data={data}
            dataKey="value"
            nameKey="label"
            innerRadius="0%"
            outerRadius="80%"
            strokeWidth={2}
            paddingAngle={0}
          >
            {data.map((item) => (
              <Cell
                key={item.platform}
                fill={`var(--color-${item.platform})`}
                stroke="transparent"
              />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>

      <div className="flex-1 divide-y divide-border md:self-center md:space-y-2 px-2 md:px-3">
        {data.map((item) => (
          <div
            key={item.platform}
            className="flex items-center justify-between px-3 md:px-4 py-3 pr-6 md:pr-8"
          >
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-[2px]"
                style={{ backgroundColor: config[item.platform]?.color }}
              />
              <span className="text-sm font-medium">{item.label}</span>
            </div>
            <span className="text-sm text-muted-foreground font-mono">
              {item.value}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
