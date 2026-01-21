"use client"

import { useEffect, useState } from "react"

import { cn } from "@/lib/utils"

type PlayerTone = {
  name: string
  positive: number
  neutral: number
  negative: number
}

const toneColors = {
  positive: "#3DC251",
  neutral: "#D2D2D2",
  negative: "#FF434A",
}

function ToneBar({ player }: { player: PlayerTone }) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-[#212529]">{player.name}</p>
      <div className="flex h-8 overflow-hidden rounded-[10px]">
        <div
          className="h-full flex items-center justify-center text-white text-[11px] font-bold"
          style={{
            width: `${player.positive}%`,
            backgroundColor: toneColors.positive,
            minWidth: player.positive > 0 ? "4%" : "0",
          }}
          aria-label={`Positive ${player.positive}%`}
        >
          {player.positive > 5 ? `${player.positive}%` : ""}
        </div>
        <div
          className="h-full flex items-center justify-center text-gray-700 text-[11px] font-bold"
          style={{
            width: `${player.neutral}%`,
            backgroundColor: toneColors.neutral,
            minWidth: player.neutral > 0 ? "4%" : "0",
          }}
          aria-label={`Neutral ${player.neutral}%`}
        >
          {player.neutral > 5 ? `${player.neutral}%` : ""}
        </div>
        <div
          className="h-full flex items-center justify-center text-white text-[11px] font-bold"
          style={{
            width: `${player.negative}%`,
            backgroundColor: toneColors.negative,
            minWidth: player.negative > 0 ? "4%" : "0",
          }}
          aria-label={`Negative ${player.negative}%`}
        >
          {player.negative > 5 ? `${player.negative}%` : ""}
        </div>
      </div>
    </div>
  )
}

export default function TopPlayers({
  className,
}: {
  className?: string
}) {
  const [players, setPlayers] = useState<PlayerTone[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        setLoading(true)
        const res = await fetch("/api/new/sentiment-brand/top-players", {
          cache: "no-store",
        })
        if (!res.ok) throw new Error(`Request failed: ${res.status}`)
        const json = (await res.json()) as { items?: PlayerTone[] }
        if (!cancelled) setPlayers(json.items ?? [])
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || "Failed to load players")
          setPlayers([])
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
      <div className={cn("rounded bg-muted/10 px-4 py-6 text-sm text-muted-foreground min-h-[200px] flex items-center justify-center", className)}>
        Loading...
      </div>
    )
  }

  if (!players.length) {
    return (
      <div className={cn("rounded border border-dashed border-muted-foreground/30 bg-muted/10 px-4 py-6 text-sm text-muted-foreground", className)}>
        {error || "No player sentiment data available."}
      </div>
    )
  }

  return (
    <div className={cn("flex h-full flex-col gap-6", className)}>
      <div className="space-y-5 flex-1">
        {players.map((player) => (
          <ToneBar key={player.name} player={player} />
        ))}
      </div>

      <div className="mt-8 h-px w-full bg-[#ececec]" />


      <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-[#545252]">
        <div className="flex items-center gap-2">
          <span
            className="h-[10px] w-[10px] rounded-[2px]"
            style={{ backgroundColor: toneColors.positive }}
          />
          <span>Positive</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="h-[10px] w-[10px] rounded-[2px]"
            style={{ backgroundColor: toneColors.neutral }}
          />
          <span>Neutral</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="h-[10px] w-[10px] rounded-[2px]"
            style={{ backgroundColor: toneColors.negative }}
          />
          <span>Negative</span>
        </div>
      </div>
    </div>
  )
}
