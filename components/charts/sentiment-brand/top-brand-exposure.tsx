"use client"

import { useEffect, useState } from "react"

type BrandCard = {
  name: string
  exposure: number
  sentiment: number
  image: string
  logo: string
}

type Summary = {
  exposure: number
  sentiment: number
}

export default function TopBrandExposure() {
  const [brands, setBrands] = useState<BrandCard[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        setLoading(true)
        const res = await fetch(
          "/api/new/sentiment-brand/top-brand-exposure",
          { cache: "no-store" },
        )
        if (!res.ok) throw new Error(`Request failed: ${res.status}`)
        const json = (await res.json()) as {
          items?: BrandCard[]
          summary?: Summary
        }
        if (!cancelled) {
          setBrands(json.items ?? [])
          setSummary(json.summary ?? null)
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || "Failed to load brand exposure")
          setBrands([])
          setSummary(null)
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
      <div className="rounded bg-muted/10 px-4 py-6 text-sm text-muted-foreground min-h-[240px] flex items-center justify-center">
        Loading...
      </div>
    )
  }

  if (!brands.length) {
    return (
      <div className="rounded border border-dashed border-muted-foreground/30 bg-muted/10 px-4 py-6 text-sm text-muted-foreground">
        {error || "No brand exposure data available."}
      </div>
    )
  }
  return (
    <div className="flex h-full flex-col gap-6">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 flex-1">
        {brands.map((brand) => (
          <div
            key={brand.name}
            className="bg-[#f5f5f5] flex flex-col h-full"
          >
            <div className="h-[225px] w-full overflow-hidden">
              <img
                src={brand.image}
                alt={brand.name}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </div>

            <div className="bg-[#eaeaea] flex items-center justify-center px-4 h-[46px]">
              <img
                src={brand.logo}
                alt={`${brand.name} logo`}
                className="h-[70%] w-auto max-w-[70%] object-contain"
                loading="lazy"
              />
            </div>

            <div className="px-4 py-3 space-y-2">
              <MetricRow label="Exposure" value={brand.exposure} />
              <MetricRow label="Sentiment" value={brand.sentiment} />
            </div>
          </div>
        ))}
      </div>

      <div className="h-px w-full bg-[#ececec]" />

      <div className="mt-auto">
        <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-[#545252]">
          <span className="font-semibold">Regular Post Metrics :</span>
          <span className="flex items-center gap-1">
            Exposure:
            <strong className="text-[#212529]">
              {summary?.exposure ?? 0}%
            </strong>
          </span>
          <span className="flex items-center gap-2">
            Sentiment:
            <SentimentBar value={summary?.sentiment ?? 0} />
            <strong className="text-[#212529]">
              {summary?.sentiment ?? 0}%
            </strong>
          </span>
        </div>
      </div>
    </div>
  )
}

function MetricRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between text-[14px] text-[#545252]">
      <span>{label}</span>
      <div className="flex items-center gap-2">
        <SentimentBar value={value} />
        <span className="text-[#212529]">{value}%</span>
      </div>
    </div>
  )
}

function SentimentBar({ value }: { value: number }) {
  return (
    <div className="h-[6px] w-16 rounded-full bg-[#d9d9d9] overflow-hidden">
      <div
        className="h-full bg-[#3dc251]"
        style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }}
      />
    </div>
  )
}
