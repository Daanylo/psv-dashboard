"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

type Alignment = "undervalued" | "overvalued"

type SentimentMarketEntry = {
  id?: string | number
  name: string
  sentimentScore: number
  marketValue: string
  alignment: Alignment
  avatarUrl: string
  rationale?: string
  sentimentBadgeLabel?: string
  sentimentBadgeColor?: string
}

const alignmentTokens: Record<
  Alignment,
  {
    borderClass: string
    badgeColor: string
    background: string
    description: string
  }
> = {
  undervalued: {
    borderClass: "border-transparent",
    badgeColor: "#3DC251",
    background: "#f1f1f1",
    description: "Fan sentiment vs value:",
  },
  overvalued: {
    borderClass: "border-transparent",
    badgeColor: "#FF434A",
    background: "#f1f1f1",
    description: "Fan sentiment vs value:",
  },
}

const defaultEntries: SentimentMarketEntry[] = [
  {
    id: "saibari",
    name: "Ismael Saibari",
    sentimentScore: 65,
    marketValue: "€28M",
    alignment: "undervalued",
    avatarUrl: "/player_images/34.png",
    sentimentBadgeLabel: "65% Positive",
    sentimentBadgeColor: "#3DC251",
  },
  {
    id: "pepi",
    name: "Ricardo Pepi",
    sentimentScore: 45,
    marketValue: "€32M",
    alignment: "overvalued",
    avatarUrl: "/player_images/9.png",
    sentimentBadgeLabel: "45% Positive",
    sentimentBadgeColor: "#FF434A",
  },
]

function SentimentMarketCard({ entry }: { entry: SentimentMarketEntry }) {
  const [imgError, setImgError] = useState(false)
  const token = alignmentTokens[entry.alignment]
  const initials = entry.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?"

  return (
    <article
      className={cn(
        "relative flex w-full items-center gap-4 px-5 py-5 sm:px-6",
        "border bg-[#f1f1f1]",
        token.borderClass
      )}
      style={{ background: token.background }}
    >
      <div className="relative h-[76px] w-[76px] shrink-0 overflow-hidden rounded-full bg-white">
        {imgError ? (
          <div className="flex h-full w-full items-center justify-center bg-neutral-200 text-sm font-semibold text-neutral-600">
            {initials}
          </div>
        ) : (
          <img
            src={entry.avatarUrl}
            alt={entry.name}
            className="h-full w-full object-cover"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        )}
      </div>

      <div className="flex flex-col gap-1 text-left">
        <p className="text-base font-semibold text-[#212529]">{entry.name}</p>
        <p className="text-sm text-[#545252]">
          Market value:{" "}
          <span className="text-[#212529] font-semibold">
            {entry.marketValue}
          </span>
        </p>
        <p className="text-sm text-[#545252]">
          Sentiment:{" "}
          {entry.sentimentBadgeLabel ? (
            <Badge
              variant="secondary"
              className="ml-2 border-transparent font-semibold"
              style={{
                backgroundColor: `${entry.sentimentBadgeColor ?? "#212529"}26`,
                color: entry.sentimentBadgeColor ?? "#212529",
              }}
            >
              {entry.sentimentBadgeLabel}
            </Badge>
          ) : null}
        </p>
      </div>

    </article>
  )
}

export default function SentimentVsMarketValue({
  items = defaultEntries,
  className,
}: {
  items?: SentimentMarketEntry[]
  className?: string
}) {
  const data = items ?? defaultEntries

  if (!data || data.length === 0) {
    return (
      <div
        className={cn(
          "rounded border border-dashed border-muted-foreground/30 bg-muted/10 px-4 py-6 text-sm text-muted-foreground",
          className
        )}
      >
        No sentiment vs market value data available.
      </div>
    )
  }

  return (
    <div className={cn("space-y-4 w-full", className)}>
      {data.map((entry) => (
        <SentimentMarketCard
          key={entry.id ?? `${entry.name}-${entry.alignment}`}
          entry={entry}
        />
      ))}
    </div>
  )
}
