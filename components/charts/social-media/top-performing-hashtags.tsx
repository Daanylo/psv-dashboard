"use client"

import { useEffect, useMemo, useState } from "react"
import { MoveDown, MoveUp } from "lucide-react"
import { Badge } from "@/components/ui/badge"

type Hashtag = {
  tag: string
  mentions: number
  change: number // percentage change vs vorige 2 weken
  positive?: number
  negative?: number
  neutral?: number
}

type Trend = "up" | "down" | "neutral"

export default function TopPerformingHashtags() {
  const [items, setItems] = useState<Hashtag[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        setLoading(true)
        const res = await fetch(
          "/api/new/social-media/top-performing-hashtags",
          { cache: "no-store" },
        )
        if (!res.ok) throw new Error(`Request failed: ${res.status}`)
        const json = (await res.json()) as { items?: Hashtag[] }
        if (!cancelled) setItems(json.items ?? [])
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || "Failed to load hashtags")
          setItems([])
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

  const maxMentions = useMemo(
    () => Math.max(...items.map((i) => i.mentions), 1),
    [items],
  )

  if (loading) {
    return (
      <div className="rounded bg-muted/10 px-4 py-6 text-sm text-muted-foreground min-h-[200px] flex items-center justify-center">
        Loading...
      </div>
    )
  }

  if (!items.length) {
    return (
      <div className="rounded border border-dashed border-muted-foreground/30 bg-muted/10 px-4 py-6 text-sm text-muted-foreground">
        {error || "No hashtags available."}
      </div>
    )
  }

  return (
    <div className="space-y-7">
      {items.map((item) => {
        const trend: Trend =
          item.change > 0 ? "up" : item.change < 0 ? "down" : "neutral"
        // Bar fill is purely the positive percentage (0–100)
        const positiveWidth =
          typeof item.positive === "number" ? item.positive : 0
        const width = Math.min(100, Math.max(0, positiveWidth))

        return (
          <div key={item.tag} className="space-y-5">
            <div className="flex items-center justify-between">
              <span className="text-base font-semibold">{item.tag}</span>
              <div className="flex items-center gap-2">
                {trend === "up" && (
                  <Badge
                    variant="secondary"
                    className="bg-[#3DC25126] text-[#3DC251] border-transparent"
                  >
                    <MoveUp className="h-3 w-3 text-[#3DC251]" />
                    {item.change}%
                  </Badge>
                )}
                {trend === "down" && (
                  <Badge
                    variant="secondary"
                    className="bg-[#FF434A26] text-[#FF434A] border-transparent"
                  >
                    <MoveDown className="h-3 w-3 text-[#FF434A]" />
                    {item.change}%
                  </Badge>
                )}
                {trend === "neutral" && (
                  <Badge
                    variant="secondary"
                    className="bg-[#9CA3AF26] text-[#212529] border-transparent"
                  >
                    {item.change}%
                  </Badge>
                )}
              </div>
            </div>
            <div className="h-5 w-full rounded-md bg-muted overflow-hidden border border-border/60 relative">
              <div
                className="h-full rounded-md flex items-center justify-end pr-1.5"
                style={{ width: `${width}%`, backgroundColor: "#0B8DFF" }}
              >
                <span className="text-[10px] font-medium text-white">
                  {item.mentions}
                </span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
