"use client"

import { useEffect, useMemo, useState } from "react"
import { Pie, PieChart, Cell } from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { MdiSmiley } from "@/public/icons/MdiSmiley"

const sentimentData = [
  { key: "positive", label: "Positive", value: 33 },
  { key: "neutral", label: "Neutral", value: 34 },
  { key: "negative", label: "Negative", value: 33 },
]

type SentimentGaugeResponse = {
  current_window: {
    total_comments: number
    average_positive: number
    average_negative: number
    average_neutral: number
  }
  average_positive_pct: number
}

export default function AverageTeamSentimentGauge() {
  const [totalComments, setTotalComments] = useState<number | null>(null)
  const [avgPositive, setAvgPositive] = useState<number | null>(null)
  const [avgNegative, setAvgNegative] = useState<number | null>(null)
  const [avgNeutral, setAvgNeutral] = useState<number | null>(null)
  const [deltaPositive, setDeltaPositive] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    let isMounted = true

    async function fetchTotalComments() {
      try {
        const res = await fetch(
          "/api/new/overview/average-team-sentiment-gauge",
          { cache: "no-store" }
        )
        if (!res.ok) throw new Error(`Status ${res.status}`)

        const data = (await res.json()) as SentimentGaugeResponse
        if (!isMounted) return
        setTotalComments(data.current_window?.total_comments ?? null)
        setAvgPositive(data.current_window?.average_positive ?? null)
        setAvgNegative(data.current_window?.average_negative ?? null)
        setAvgNeutral(data.current_window?.average_neutral ?? null)
        setDeltaPositive(
          Number.isFinite(data.average_positive_pct)
            ? data.average_positive_pct
            : null
        )
      } catch (err) {
        if (!isMounted) return
        setError("Failed to load average team sentiment gauge")
        console.error(err)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    fetchTotalComments()
    return () => {
      isMounted = false
    }
  }, [])

  const config = useMemo<ChartConfig>(
    () => ({
      positive: { label: "Positive", color: "#3DC251" },
      neutral: { label: "Neutral", color: "#D2D2D2" },
      negative: { label: "Negative", color: "#FF434A" },
    }),
    []
  )

  const sentimentData = useMemo(
    () => [
      {
        key: "positive",
        label: "Positive",
        value: avgPositive ?? 33,
      },
      {
        key: "neutral",
        label: "Neutral",
        value: avgNeutral ?? 34,
      },
      {
        key: "negative",
        label: "Negative",
        value: avgNegative ?? 33,
      },
    ],
    [avgPositive, avgNegative, avgNeutral]
  )

  const deltaLabel =
    deltaPositive !== null
      ? `${deltaPositive >= 0 ? "+" : ""}${deltaPositive.toFixed(1)}% vs last 2 weeks`
      : "-"

  const sentimentState = useMemo(() => {
    if (avgPositive === null || avgNegative === null || avgNeutral === null) {
      return { color: "#9CA3AF", tone: "N/A", value: null }
    }

    const max = Math.max(avgPositive, avgNegative, avgNeutral)
    if (avgPositive === max && max > 0)
      return { color: "#3DC251", tone: "Positive", value: avgPositive }
    if (avgNegative === max && max > 0)
      return { color: "#FF434A", tone: "Negative", value: avgNegative }
    return { color: "#9CA3AF", tone: "Neutral", value: avgNeutral }
  }, [avgPositive, avgNegative, avgNeutral])

  const dominantLabel =
    sentimentState.value !== null
      ? `${sentimentState.value.toFixed(1)}% ${sentimentState.tone}`
      : "-"

  if (loading) {
    return (
      <div className="rounded bg-muted/10 px-4 py-8 text-sm text-muted-foreground min-h-[240px] flex items-center justify-center">
        <div className="font-medium text-[#212529]">Loading...</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center">
      <ChartContainer
        config={config}
        className="w-full max-w-[420px] aspect-[2/1]"
      >
        <PieChart>
          <ChartTooltip
            cursor={false}
            content={
              <ChartTooltipContent
                className="bg-black text-white border-none"
                nameKey="label"
                formatter={(value, name) => (
                  <span className="flex items-center gap-2">
                    <span className="font-medium">{name}</span>
                    <span className="tabular-nums">
                      {Number.isFinite(Number(value))
                        ? `${Number(value).toFixed(1)}%`
                        : `${value}%`}
                    </span>
                  </span>
                )}
              />
            }
          />
          <Pie
            data={sentimentData}
            dataKey="value"
            nameKey="label"
            innerRadius="110%"
            outerRadius="140%"
            startAngle={-10}
            endAngle={190}
            cy="70%"
            cx="50%"
            stroke="transparent"
            paddingAngle={2}
            cornerRadius={5}
          >
            {sentimentData.map((item) => (
              <Cell
                key={item.key}
                fill={`var(--color-${item.key})`}
                stroke="transparent"
              />
            ))}
          </Pie>
          <foreignObject
            x="50%"
            y="60%"
            width="160"
            height="140"
            transform="translate(-80 -70)"
            pointerEvents="none"
          >
            <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-center">
              <MdiSmiley
                className="h-20 w-20"
                style={{ color: sentimentState.color }}
              />
              <span
                className="text-base font-semibold"
                style={{ color: sentimentState.color }}
              >
                {dominantLabel}
              </span>
              <span className="whitespace-nowrap text-xs text-muted-foreground">
                ({deltaLabel})
              </span>
            </div>
          </foreignObject>
        </PieChart>
      </ChartContainer>
      <p className="mt-3 text-lg font-semibold text-center">
        {error
          ? error
          : totalComments !== null
            ? `Total mentions analyzed: ${totalComments.toLocaleString()}`
            : "Total mentions analyzed: -"}
      </p>
    </div>
  )
}
