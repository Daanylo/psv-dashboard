"use client"

import { useMemo } from "react"
import { Pie, PieChart, Cell } from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

const data = [
  { platform: "instagram", label: "Instagram", value: 38 },
  { platform: "tiktok", label: "TikTok", value: 28 },
  { platform: "youtube", label: "YouTube", value: 22 },
  { platform: "facebook", label: "Facebook", value: 12 },
]

export default function WhereFansEngageMost() {
  const config = useMemo<ChartConfig>(
    () => ({
      instagram: { label: "Instagram", color: "#3DC2B2" },
      tiktok: { label: "TikTok", color: "#964DC9" },
      youtube: { label: "YouTube", color: "#FF632F" },
      facebook: { label: "Facebook", color: "#3358EC" },
    }),
    []
  )

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
                style={{ backgroundColor: config[item.platform].color }}
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
