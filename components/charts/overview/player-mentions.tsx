"use client"

import { cn } from "@/lib/utils"
import { useEffect, useState } from "react"

type SentimentVariant = "positive" | "negative"

type PlayerMention = {
  id?: string | number
  name: string
  sentiment: SentimentVariant
  percentage: number
  avatarUrl: string
  description?: string
}

const localFallback = "/no_image.png"

const sentimentTokens: Record<
  SentimentVariant,
  {
    borderClass: string
    badgeColor: string
    background: string
    label: string
    description: string
  }
> = {
  positive: {
    borderClass: "border-[rgba(61,194,81,0.5)]",
    badgeColor: "#3DC251",
    background:
      "linear-gradient(90deg, rgba(61, 194, 81, 0.12) 0%, rgba(61, 194, 81, 0.12) 100%), linear-gradient(90deg, #f1f1f1 0%, #f1f1f1 100%)",
    label: "Positive",
    description: "Positive mentions:",
  },
  negative: {
    borderClass: "border-[rgba(255,67,74,0.5)]",
    badgeColor: "#FF434A",
    background:
      "linear-gradient(90deg, rgba(255, 67, 74, 0.12) 0%, rgba(255, 67, 74, 0.12) 100%), linear-gradient(90deg, #f1f1f1 0%, #f1f1f1 100%)",
    label: "Negative",
    description: "Negative mentions:",
  },
}


function PlayerMentionCard({ mention }: { mention: PlayerMention }) {
  const sentiment = sentimentTokens[mention.sentiment]

  return (
    <article
      className={cn(
        "relative flex w-full items-center gap-4 px-5 py-5 sm:px-6",
        "border bg-[#f1f1f1]",
        sentiment.borderClass
      )}
      style={{ background: sentiment.background }}
    >
      <div className="relative h-[76px] w-[76px] shrink-0 overflow-hidden rounded-full bg-white">
        <img
          src={mention.avatarUrl}
          alt={mention.name}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </div>

      <div className="flex flex-col gap-1 text-left">
        <p className="text-base font-semibold text-[#212529]">
          {mention.name}
        </p>
        <p className="text-sm text-[#545252]">
          <span>{sentiment.description} </span>
          <span className="text-[#212529] font-semibold">
            {mention.percentage}%
          </span>
        </p>
      </div>

      <span
        className="absolute right-0 top-0 flex h-[38px] items-center justify-center px-3 text-base font-bold uppercase tracking-[0.02em] text-white font-psv-branding"
        style={{
          backgroundColor: sentiment.badgeColor,
          clipPath: "polygon(8.6% 0, 100% 0, 100% 100%, 0% 100%)",
          minWidth: "120px",
        }}
      >
        {sentiment.label}
      </span>
    </article>
  )
}

function avatarFromNumber(num?: string | number) {
  if (num === undefined || num === null) return localFallback
  const clean = `${num}`.trim()
  if (!clean) return localFallback
  return `/player_images/${clean}.png`
}

export default function PlayerMentions({ className }: { className?: string }) {
  const [items, setItems] = useState<PlayerMention[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const res = await fetch("/api/new/overview/player-mentions", {
          cache: "no-store",
        })
        if (!res.ok) {
          throw new Error(`API ${res.status}`)
        }
        const data = await res.json()

        const next: PlayerMention[] = []
        if (data?.top_positive) {
          next.push({
            id: data.top_positive.name ?? "top-positive",
            name: data.top_positive.name ?? "Top positive",
            sentiment: "positive",
            percentage: Number(data.top_positive.positive ?? 0),
            avatarUrl: avatarFromNumber(data.top_positive.number),
            description: `${data.top_positive.count ?? 0} comments`,
          })
        }
        if (data?.top_negative) {
          next.push({
            id: data.top_negative.name ?? "top-negative",
            name: data.top_negative.name ?? "Top negative",
            sentiment: "negative",
            percentage: Number(data.top_negative.negative ?? 0),
            avatarUrl: avatarFromNumber(data.top_negative.number),
            description: `${data.top_negative.count ?? 0} comments`,
          })
        }

        if (!cancelled) {
          setItems(next)
          setLoading(false)
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message ?? "Failed to load player mentions")
          setLoading(false)
        }
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div
        className={cn(
          "rounded bg-muted/10 px-4 py-8 text-sm text-muted-foreground min-h-[240px] flex items-center justify-center",
          className
        )}
      >
        <div className="font-medium text-[#212529]">Loading...</div>
      </div>
    )
  }

  if (!items || items.length === 0) {
    return (
      <div
        className={cn(
          "rounded border border-dashed border-muted-foreground/30 bg-muted/10 px-4 py-6 text-sm text-muted-foreground",
          className
        )}
      >
        {error ? `Kon player mentions niet laden: ${error}` : "No player mentions available."}
      </div>
    )
  }

  return (
    <div className={cn("space-y-4 w-full", className)}>
      {items.map((mention) => (
        <PlayerMentionCard
          key={mention.id ?? `${mention.name}-${mention.sentiment}`}
          mention={mention}
        />
      ))}
    </div>
  )
}
