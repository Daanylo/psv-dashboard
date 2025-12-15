"use client"

import { useEffect, useState } from "react"

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart"

type JourneyEvent = {
  title: string
  competition?: string
  home?: string
  away?: string
  result?: string
  time?: string
}

type JourneyDay = {
  date: string // YYYY-MM-DD
  pos: number // 0-100
  neg: number // 0-100
  neu: number // 0-100
  events: JourneyEvent[]
}

type JourneyPoint = {
  label: string
  sentiment: number
  pos: number
  neg: number
  neu: number
  hasEvent: boolean
  events: JourneyEvent[]
  isoDate: string
}

const chartConfig: ChartConfig = {
  sentiment: {
    label: "Sentiment",
    color: "#0b8dff",
  },
}

export default function SentimentJourney() {
  const [data, setData] = useState<JourneyPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        setLoading(true)
        const res = await fetch("/api/new/sentiment-brand/sentiment-journey", {
          cache: "no-store",
        })
        if (!res.ok) throw new Error(`Request failed: ${res.status}`)
        const json = (await res.json()) as { days?: JourneyDay[] }
        const points =
          json.days?.map((day) => {
            const date = day.date ?? ""
            const [year, month, dayNum] = date.split("-")
            const label = `${parseInt(dayNum, 10)}-${parseInt(
              month,
              10,
            )}` // D-M
            const pos = day.pos ?? 0
            return {
              label,
              sentiment: pos, // show positive line only
              pos,
              neg: day.neg ?? 0,
              neu: day.neu ?? 0,
              hasEvent: Boolean(day.events?.length),
              events: day.events ?? [],
              isoDate: date,
            }
          }) ?? []
        if (!cancelled) setData(points)
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || "Failed to load sentiment journey")
          setData([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div className="rounded bg-muted/10 px-4 py-8 text-sm text-muted-foreground min-h-[280px] flex items-center justify-center">
        Loading sentiment journey…
      </div>
    )
  }

  if (!data.length) {
    return (
      <div className="rounded border border-dashed border-muted-foreground/30 bg-muted/10 px-4 py-6 text-sm text-muted-foreground">
        {error || "No sentiment journey data available."}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <ChartContainer
        config={chartConfig}
        className="w-full h-[280px] aspect-auto"
      >
        <LineChart
          data={data}
          margin={{ top: 10, right: 24, left: 0, bottom: 12 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#d7d7d7" />
          <ChartTooltip
            cursor={{ stroke: "#c7c7c7", strokeDasharray: "4 4" }}
            content={({ active, payload }) => {
              if (!active || !payload || !payload.length) return null
              const point = payload[0].payload as JourneyPoint
              const d = new Date(point.isoDate)
              const dateLabel = !Number.isNaN(d.getTime())
                ? d.toLocaleDateString("nl-NL", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })
                : point.label
              return (
                <div className="rounded-lg border border-black bg-black px-3 py-2 shadow-md space-y-2 text-white">
                  <div className="font-semibold text-sm text-white">
                    {dateLabel}
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-[10px] w-[10px] rounded-[2px]"
                        style={{ backgroundColor: "#3DC251" }}
                      />
                      <span>Positive: {point.pos.toFixed(0)}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-[10px] w-[10px] rounded-[2px]"
                        style={{ backgroundColor: "#FF434A" }}
                      />
                      <span>Negative: {point.neg.toFixed(0)}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-[10px] w-[10px] rounded-[2px]"
                        style={{ backgroundColor: "#9CA3AF" }}
                      />
                      <span>Neutral: {point.neu.toFixed(0)}%</span>
                    </div>
                  </div>
                  {point.events.length ? (
                    <div className="border-t border-zinc-700 pt-2 text-xs space-y-2 text-zinc-100">
                      <div className="font-semibold text-zinc-300">Events</div>
                      {point.events.map((ev, idx) => (
                        <div
                          key={idx}
                          className="space-y-1 whitespace-pre-line leading-4"
                        >
                          <div className="font-semibold">
                            {ev.title ||
                              [ev.home, ev.away]
                                .filter(Boolean)
                                .join(" vs ")}
                          </div>
                          {ev.competition && (
                            <div className="text-zinc-300">{ev.competition}</div>
                          )}
                          {ev.result && <div>Result: {ev.result}</div>}
                          {ev.time && <div className="text-zinc-300">Time: {ev.time}</div>}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              )
            }}
          />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={{ stroke: "#d7d7d7" }}
            tick={{ fontSize: 12, fill: "#545252" }}
            height={32}
          />
          <YAxis
            domain={[0, 100]}
            ticks={[0, 20, 40, 60, 80, 100]}
            tickLine={false}
            axisLine={{ stroke: "#d7d7d7" }}
            tick={{ fontSize: 12, fill: "#545252" }}
            width={36}
          />
          <Line
            type="monotone"
            dataKey="sentiment"
            stroke="#0b8dff"
            strokeWidth={3}
            dot={(props: any) => {
              const { cx, cy, payload, index } = props
              const point = payload as JourneyPoint | undefined
              const color = point?.hasEvent ? "#ff941a" : "#0b8dff"
              const radius = point?.hasEvent ? 6 : 5

              return (
                <circle
                  key={`dot-${point?.label ?? index}`}
                  cx={cx}
                  cy={cy}
                  r={radius}
                  fill={color}
                  stroke="#ffffff"
                  strokeWidth={1.5}
                />
              )
            }}
            activeDot={{
              r: 8,
              stroke: "#ffffff",
              strokeWidth: 2,
              fill: "#16a34a",
            }}
            isAnimationActive={false}
          />
        </LineChart>
      </ChartContainer>

      <div className="flex flex-wrap items-center justify-center gap-5 text-xs text-[#545252]">
        <LegendItem color="#ff941a" label="Days with events" />
        <LegendItem color="#0b8dff" label="No events" />
      </div>
    </div>
  )
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="h-[10px] w-[10px] rounded-[2px]"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      <span>{label}</span>
    </div>
  )
}
