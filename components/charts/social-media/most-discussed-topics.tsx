"use client"

import { useEffect, useState } from "react"

type Topic = { title: string; mentions: number | string }

export default function MostDiscussedTopics() {
  const [topics, setTopics] = useState<Topic[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        setLoading(true)
        const res = await fetch("/api/new/social-media/most-discussed-topics", {
          cache: "no-store",
        })
        if (!res.ok) throw new Error(`Request failed: ${res.status}`)
        const json = (await res.json()) as { items?: Topic[] }
        if (!cancelled) setTopics(json.items ?? [])
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || "Failed to load topics")
          setTopics([])
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
      <div className="rounded bg-muted/10 px-4 py-6 text-sm text-muted-foreground min-h-[200px] flex items-center justify-center">
        Loading...
      </div>
    )
  }

  if (!topics.length) {
    return (
      <div className="rounded border border-dashed border-muted-foreground/30 bg-muted/10 px-4 py-6 text-sm text-muted-foreground">
        {error || "No topics available."}
      </div>
    )
  }

  return (
    <div className="grid gap-6">
      {topics.map((item, index) => (
        <div
          key={item.title}
          className="bg-[#F5F5F5] px-6 py-6 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-muted-foreground">
              {index + 1}.
            </span>
            <span className="text-sm font-semibold">{item.title}</span>
          </div>
          <span className="text-xs font-mono" style={{ color: "#212529" }}>
            {typeof item.mentions === "number"
              ? `${item.mentions.toLocaleString()} mentions`
              : `${item.mentions} mentions`}
          </span>
        </div>
      ))}
    </div>
  )
}
