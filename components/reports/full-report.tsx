"use client"

import Image from "next/image"
import { Heart, MessageCircle } from "lucide-react"
import { useState } from "react"

const A4_WIDTH_PX = 794
const A4_HEIGHT_PX = 1123

function safeNumber(value: unknown) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value)
}

function formatShortDateFromTsSeconds(tsSeconds: number) {
  const d = new Date(tsSeconds * 1000)
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function clampBoxToRect(
  box: { left: number; top: number; width: number; height: number },
  rect: { left: number; top: number; width: number; height: number },
) {
  const boxRight = box.left + box.width
  const boxBottom = box.top + box.height
  const rectRight = rect.left + rect.width
  const rectBottom = rect.top + rect.height

  const left = Math.max(box.left, rect.left)
  const top = Math.max(box.top, rect.top)
  const right = Math.min(boxRight, rectRight)
  const bottom = Math.min(boxBottom, rectBottom)

  const width = Math.max(0, right - left)
  const height = Math.max(0, bottom - top)

  return { left, top, width, height }
}

export type SponsorReportDetection = {
  id: string
  label: string
  visibilityScore: number | null
  box: { x: number; y: number; width: number; height: number }
}

export type SponsorReportPost = {
  id: string
  shortcode: string | null
  url: string
  imageSrc: string
  takenAtTimestamp: number
  caption: string
  likes: number
  comments: number
  impressions: number
  sentimentScore: number | null
  sentiment: { total: number; positive: number; neutral: number; negative: number }
  imageWidth: number | null
  imageHeight: number | null
  detections: SponsorReportDetection[]
}

export type SponsorFullReportData = {
  meta: { startMs: number; endMs: number; brand: string; truncated: boolean; limit: number }
  brand: { name: string; slug: string; color: string; logoLightUrl: string | null; logoDarkUrl: string | null }
  posts: SponsorReportPost[]
}

export type PlayerFullReportPost = {
  id: string
  shortcode: string | null
  url: string
  imageSrc: string
  takenAtTimestamp: number
  caption: string
  likes: number
  comments: number
  impressions: number
  sentimentScore: number | null
  sentiment: { total: number; positive: number; neutral: number; negative: number }
}

export type PlayerFullReportData = {
  meta: { startIso: string; endIso: string; playerId: number; truncated: boolean; limit: number }
  player: { name: string; fotmobId: number }
  handles: string[]
  posts: PlayerFullReportPost[]
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2">
      <div className="text-[10px] font-semibold tracking-wide text-muted-foreground">{label}</div>
      <div className="text-xs font-semibold tabular-nums text-foreground">{value}</div>
    </div>
  )
}

function SentimentStackedBar({
  sentiment,
}: {
  sentiment: { total: number; positive: number; neutral: number; negative: number }
}) {
  const parts = sentimentPercentParts(sentiment)
  if (!parts) {
    return <div className="mt-3 text-xs text-muted-foreground">Sentiment: —</div>
  }

  const total = safeNumber(sentiment.total)

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between text-[10px] font-semibold tracking-wide text-muted-foreground">
        <div>SENTIMENT</div>
        <div className="tabular-nums">{total.toLocaleString()} comments</div>
      </div>

      <div className="mt-1 h-2 w-full overflow-hidden rounded bg-muted">
        <div className="flex h-full w-full">
          <div className="h-full bg-emerald-500" style={{ width: `${clamp(parts.positivePct, 0, 100)}%` }} />
          <div className="h-full bg-zinc-300" style={{ width: `${clamp(parts.neutralPct, 0, 100)}%` }} />
          <div className="h-full bg-rose-500" style={{ width: `${clamp(parts.negativePct, 0, 100)}%` }} />
        </div>
      </div>

      <div className="mt-1 flex items-center justify-between gap-3 text-[10px] text-muted-foreground">
        <div className="tabular-nums">
          <span className="font-semibold text-emerald-700">Pos</span> {parts.positivePct}%
        </div>
        <div className="tabular-nums">
          <span className="font-semibold text-zinc-700">Neu</span> {parts.neutralPct}%
        </div>
        <div className="tabular-nums">
          <span className="font-semibold text-rose-700">Neg</span> {parts.negativePct}%
        </div>
      </div>
    </div>
  )
}

function sentimentPercentParts(sentiment: { total: number; positive: number; neutral: number; negative: number }) {
  const total = safeNumber(sentiment.total)
  if (!total) return null

  const positive = safeNumber(sentiment.positive)
  const neutral = safeNumber(sentiment.neutral)
  const negative = safeNumber(sentiment.negative)

  const positivePct = Math.round((positive / total) * 100)
  const neutralPct = Math.round((neutral / total) * 100)
  const negativePct = Math.max(0, 100 - positivePct - neutralPct)

  return { positivePct, neutralPct, negativePct }
}

function SponsorPostCard({
  post,
  brandColor,
}: {
  post: SponsorReportPost
  brandColor: string
}) {
  const [measured, setMeasured] = useState<{ w: number; h: number } | null>(null)

  const imageWidth = post.imageWidth ?? measured?.w ?? null
  const imageHeight = post.imageHeight ?? measured?.h ?? null
  const cardSizePx = 340
  const containScale = imageWidth && imageHeight ? Math.min(cardSizePx / imageWidth, cardSizePx / imageHeight) : null
  const containDisplayW = containScale && imageWidth ? imageWidth * containScale : null
  const containDisplayH = containScale && imageHeight ? imageHeight * containScale : null
  const containOffsetX = containDisplayW != null ? (cardSizePx - containDisplayW) / 2 : null
  const containOffsetY = containDisplayH != null ? (cardSizePx - containDisplayH) / 2 : null
  return (
    <div className="grid grid-cols-[340px_1fr] gap-5 rounded-xl border border-border bg-background p-5 shadow-sm">
      <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-background">
        <div className="relative w-full overflow-hidden bg-muted" style={{ width: cardSizePx, height: cardSizePx }}>
          <a
            href={post.url || "#"}
            target={post.url ? "_blank" : undefined}
            rel={post.url ? "noopener noreferrer" : undefined}
            className={post.url ? "block h-full w-full" : "block h-full w-full pointer-events-none"}
          >
            <Image
              src={post.imageSrc}
              alt="Post"
              fill
              sizes="340px"
              className="object-contain"
              onLoadingComplete={(img) => {
                const w = Number((img as HTMLImageElement | null)?.naturalWidth || 0)
                const h = Number((img as HTMLImageElement | null)?.naturalHeight || 0)
                if (w > 0 && h > 0) setMeasured({ w, h })
              }}
            />
          </a>

          {imageWidth && imageHeight && containScale != null && containOffsetX != null && containOffsetY != null
            ? post.detections.map((d) => {
                const imageRect = {
                  left: containOffsetX,
                  top: containOffsetY,
                  width: containDisplayW || 0,
                  height: containDisplayH || 0,
                }

                if (!imageRect.width || !imageRect.height) return null

                const leftPx = d.box.x * containScale + containOffsetX
                const topPx = d.box.y * containScale + containOffsetY
                const widthPx = Math.max(0, d.box.width * containScale)
                const heightPx = Math.max(0, d.box.height * containScale)

                const clipped = clampBoxToRect(
                  { left: leftPx, top: topPx, width: widthPx, height: heightPx },
                  imageRect,
                )

                if (!clipped.width || !clipped.height) return null

                const labelText = d.visibilityScore != null ? `${d.visibilityScore.toFixed(1)}%` : d.label
                const labelHeight = 16
                const labelTopPreferred = clipped.top - labelHeight - 2
                const labelTopBottom = clipped.top + clipped.height + 2

                const labelTop =
                  labelTopPreferred >= imageRect.top
                    ? labelTopPreferred
                    : labelTopBottom + labelHeight <= imageRect.top + imageRect.height
                      ? labelTopBottom
                      : imageRect.top + 2

                const labelLeft = clamp(clipped.left, imageRect.left + 2, imageRect.left + imageRect.width - 2)
                const labelMaxWidth = Math.max(0, imageRect.left + imageRect.width - labelLeft - 2)

                return (
                  <div key={d.id} className="absolute" style={{ left: 0, top: 0 }}>
                    <div
                      className="absolute"
                      style={{
                        left: `${clipped.left}px`,
                        top: `${clipped.top}px`,
                        width: `${clipped.width}px`,
                        height: `${clipped.height}px`,
                        border: `2px solid ${brandColor}`,
                        boxShadow: "0 0 0 1px rgba(0,0,0,0.25)",
                      }}
                    />
                    <div
                      className="absolute rounded px-1.5 py-0.5 text-[10px] font-medium text-white bg-black/70 backdrop-blur-sm whitespace-nowrap overflow-hidden text-ellipsis"
                      style={{
                        left: `${labelLeft}px`,
                        top: `${labelTop}px`,
                        maxWidth: `${labelMaxWidth}px`,
                        borderLeft: `3px solid ${brandColor}`,
                      }}
                    >
                      {labelText}
                    </div>
                  </div>
                )
              })
            : null}

          <div className="absolute top-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm tracking-tight tabular-nums">
            {`Imp: ${formatCompactNumber(post.impressions)}`}
          </div>
        </div>

        <div className="shrink-0 h-20 border-t border-border bg-muted px-3 py-3 flex flex-col">
          <div className="flex justify-between w-full items-start">
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <div className="truncate">{formatShortDateFromTsSeconds(post.takenAtTimestamp)}</div>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <div className="inline-flex items-center gap-1">
                <Heart className="h-4 w-4" />
                <span className="tabular-nums">{safeNumber(post.likes).toLocaleString()}</span>
              </div>
              <div className="inline-flex items-center gap-1">
                <MessageCircle className="h-4 w-4" />
                <span className="tabular-nums">{safeNumber(post.comments).toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div
            className="mt-2 text-xs leading-relaxed text-foreground/90 overflow-auto flex-1"
            style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}
          >
            <span className="break-words">{post.caption || "—"}</span>
          </div>
        </div>
      </div>

      <div className="min-w-0">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-xs font-semibold tracking-wide text-muted-foreground">POST METRICS</div>
            <div className="mt-1 font-psv-branding italic text-2xl leading-none text-foreground tabular-nums">
              {formatCompactNumber(post.impressions)}
              <span className="ml-2 font-sans text-base font-semibold not-italic text-muted-foreground">impressions</span>
            </div>
            <div className="mt-2 text-sm text-muted-foreground">
              Engagement:{" "}
              <span className="font-semibold tabular-nums text-foreground">
                {(safeNumber(post.likes) + safeNumber(post.comments)).toLocaleString()}
              </span>
            </div>

            <SentimentStackedBar sentiment={post.sentiment} />
          </div>

          <div className="shrink-0 text-right">
            <div className="text-[10px] font-semibold tracking-wide text-muted-foreground">DETECTIONS</div>
            <div className="mt-1 font-psv-branding italic text-3xl leading-none tabular-nums text-foreground">{post.detections.length}</div>
            <div className="mt-1 text-[10px] text-muted-foreground">boxes shown</div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-4">
          <div>
            <div className="text-[10px] font-semibold tracking-wide text-muted-foreground">AVG VISIBILITY</div>
            <div className="mt-1 text-sm font-semibold tabular-nums text-foreground">
              {post.detections.length ? `${(post.detections.reduce((sum, d) => sum + safeNumber(d.visibilityScore), 0) / post.detections.length).toFixed(1)}%` : "—"}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-semibold tracking-wide text-muted-foreground">BEST VISIBILITY</div>
            <div className="mt-1 text-sm font-semibold tabular-nums text-foreground">
              {post.detections.length ? `${Math.max(...post.detections.map((d) => safeNumber(d.visibilityScore))).toFixed(1)}%` : "—"}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-semibold tracking-wide text-muted-foreground">VALUE EST.</div>
            <div className="mt-1 text-sm font-semibold tabular-nums text-foreground">
              {`€${Math.round((post.impressions * (post.detections.reduce((max, d) => Math.max(max, safeNumber(d.visibilityScore)), 0) / 100) * 0.015) || 0).toLocaleString()}`}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function PlayerPostCard({ post, handleHint }: { post: PlayerFullReportPost; handleHint: string }) {
  return (
    <div className="grid grid-cols-[340px_1fr] gap-5 rounded-xl border border-border bg-background p-5 shadow-sm">
      <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-background">
        <div className="relative w-full overflow-hidden bg-muted" style={{ width: 340, height: 340 }}>
          <a
            href={post.url || "#"}
            target={post.url ? "_blank" : undefined}
            rel={post.url ? "noopener noreferrer" : undefined}
            className={post.url ? "block h-full w-full" : "block h-full w-full pointer-events-none"}
          >
            <Image src={post.imageSrc} alt="Post" fill sizes="340px" className="object-contain" />
          </a>

          <div className="absolute top-2 left-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm tracking-tight">
            Tagged: {handleHint}
          </div>
          <div className="absolute top-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm tracking-tight tabular-nums">
            {`Imp: ${formatCompactNumber(post.impressions)}`}
          </div>
        </div>

        <div className="shrink-0 h-20 border-t border-border bg-muted px-3 py-3 flex flex-col">
          <div className="flex justify-between w-full items-start">
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <div className="truncate">{formatShortDateFromTsSeconds(post.takenAtTimestamp)}</div>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <div className="inline-flex items-center gap-1">
                <Heart className="h-4 w-4" />
                <span className="tabular-nums">{safeNumber(post.likes).toLocaleString()}</span>
              </div>
              <div className="inline-flex items-center gap-1">
                <MessageCircle className="h-4 w-4" />
                <span className="tabular-nums">{safeNumber(post.comments).toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div
            className="mt-2 text-xs leading-relaxed text-foreground/90 overflow-auto flex-1"
            style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}
          >
            <span className="break-words">{post.caption || "—"}</span>
          </div>
        </div>
      </div>

      <div className="min-w-0">
        <div className="text-xs font-semibold tracking-wide text-muted-foreground">POST METRICS</div>
        <div className="mt-1 font-psv-branding italic text-2xl leading-none text-foreground tabular-nums">
          {formatCompactNumber(post.impressions)}
          <span className="ml-2 font-sans text-base font-semibold not-italic text-muted-foreground">impressions</span>
        </div>
        <div className="mt-2 text-sm text-muted-foreground">
          Engagement:{" "}
          <span className="font-semibold tabular-nums text-foreground">{(safeNumber(post.likes) + safeNumber(post.comments)).toLocaleString()}</span>
        </div>

        <SentimentStackedBar sentiment={post.sentiment} />
      </div>
    </div>
  )
}

export function SponsorFullReport({ data }: { data: SponsorFullReportData }) {
  const startLabel = new Date(data.meta.startMs).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  const endLabel = new Date(data.meta.endMs).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })

  const totalImpressions = data.posts.reduce((sum, p) => sum + safeNumber(p.impressions), 0)
  const totalDetections = data.posts.reduce((sum, p) => sum + p.detections.length, 0)
  const brandColor = data.brand.color || "#111827"

  const postsPerPage = 2
  const pages: SponsorReportPost[][] = []
  for (let i = 0; i < data.posts.length; i += postsPerPage) {
    pages.push(data.posts.slice(i, i + postsPerPage))
  }

  return (
    <div className="font-sans">
      <div
        data-pdf-page
        className="overflow-hidden bg-white text-black"
        style={{ width: A4_WIDTH_PX, height: A4_HEIGHT_PX }}
      >
        <div className="h-full p-12">
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold tracking-[0.2em] text-muted-foreground">SPONSOR FULL REPORT</div>
              <div className="mt-3 font-psv-branding italic text-5xl leading-tight text-foreground">{data.brand.name}</div>
              <div className="mt-3 text-sm text-muted-foreground">{startLabel} – {endLabel}</div>
              <div className="mt-2 text-xs text-muted-foreground">Generated from detected logo exposures</div>
            </div>

            <div className="shrink-0 rounded-xl border border-border bg-background p-4" style={{ minWidth: 240 }}>
              <div className="flex items-center gap-3">
                {data.brand.logoDarkUrl || data.brand.logoLightUrl ? (
                  <Image
                    src={data.brand.logoDarkUrl || data.brand.logoLightUrl || "https://placehold.co/140x40"}
                    alt={data.brand.name}
                    width={140}
                    height={40}
                    className="h-8 w-auto object-contain"
                  />
                ) : (
                  <div className="h-8 w-32 rounded bg-muted" />
                )}
                <div className="h-8 w-1 rounded" style={{ backgroundColor: brandColor }} />
              </div>

              <div className="mt-4 grid grid-cols-1 gap-2">
                <MetricPill label="Posts" value={data.posts.length.toLocaleString()} />
                <MetricPill label="Detections" value={totalDetections.toLocaleString()} />
                <MetricPill label="Impressions" value={formatCompactNumber(totalImpressions)} />
              </div>
            </div>
          </div>

          <div className="mt-10 rounded-2xl border border-border bg-muted/30 p-8">
            <div className="text-xs font-semibold tracking-wide text-muted-foreground">HIGHLIGHTS</div>
            <div className="mt-2 font-psv-branding italic text-2xl leading-none text-foreground">Top exposures with logo bounding boxes</div>
            <div className="mt-2 text-sm text-muted-foreground">
              Each post includes detected logo regions, visibility score, impressions, engagement and caption metadata.
            </div>
            {data.meta.truncated ? (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
                Report is capped at {data.meta.limit} posts for performance.
              </div>
            ) : null}
          </div>

          <div className="mt-10 flex items-end justify-between">
            <div className="text-xs text-muted-foreground">Brand key: {data.brand.slug}</div>
            <div className="text-xs text-muted-foreground">PSV Dashboard</div>
          </div>
        </div>
      </div>

      {pages.map((posts, idx) => (
        <div
          key={idx}
          data-pdf-page
          className="overflow-hidden bg-white text-black"
          style={{ width: A4_WIDTH_PX, height: A4_HEIGHT_PX }}
        >
          <div className="h-full p-10">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold tracking-wide text-muted-foreground">{data.brand.name} • Full report</div>
              <div className="text-xs text-muted-foreground">{startLabel} – {endLabel}</div>
            </div>
            <div className="mt-1 h-px w-full bg-border" />

            <div className="mt-6 space-y-6">
              {posts.map((p) => (
                <SponsorPostCard key={p.id} post={p} brandColor={brandColor} />
              ))}
            </div>

            <div className="mt-6 flex items-center justify-between text-[10px] text-muted-foreground">
              <div>Generated: {new Date().toLocaleDateString("en-US")}</div>
              <div>Page {idx + 2} / {pages.length + 1}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function PlayerFullReport({ data }: { data: PlayerFullReportData }) {
  const handleHint = data.handles.length ? `@${data.handles[0]}` : "player"

  const postsPerPage = 2
  const pages: PlayerFullReportPost[][] = []
  for (let i = 0; i < data.posts.length; i += postsPerPage) {
    pages.push(data.posts.slice(i, i + postsPerPage))
  }

  const totalImpressions = data.posts.reduce((sum, p) => sum + safeNumber(p.impressions), 0)

  return (
    <div className="font-sans">
      <div
        data-pdf-page
        className="overflow-hidden bg-white text-black"
        style={{ width: A4_WIDTH_PX, height: A4_HEIGHT_PX }}
      >
        <div className="h-full p-12">
          <div className="text-[11px] font-semibold tracking-[0.2em] text-muted-foreground">PLAYER FULL REPORT</div>
          <div className="mt-3 font-psv-branding italic text-5xl leading-tight text-foreground">{data.player.name}</div>
          <div className="mt-3 text-sm text-muted-foreground">{data.meta.startIso} – {data.meta.endIso}</div>
          <div className="mt-2 text-xs text-muted-foreground">Tagged appearances based on Instagram handles/aliases</div>

          <div className="mt-10 grid grid-cols-3 gap-3">
            <MetricPill label="Tagged posts" value={data.posts.length.toLocaleString()} />
            <MetricPill label="Impressions" value={formatCompactNumber(totalImpressions)} />
            <MetricPill label="Handles" value={data.handles.length ? data.handles.map((h) => `@${h}`).join(", ") : "—"} />
          </div>

          {data.meta.truncated ? (
            <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
              Report is capped at {data.meta.limit} posts for performance.
            </div>
          ) : null}

          <div className="mt-10 rounded-2xl border border-border bg-muted/30 p-8">
            <div className="text-xs font-semibold tracking-wide text-muted-foreground">HIGHLIGHTS</div>
            <div className="mt-2 font-psv-branding italic text-2xl leading-none text-foreground">All tagged appearances with metrics</div>
            <div className="mt-2 text-sm text-muted-foreground">
              Each post includes impressions, engagement, sentiment and caption metadata.
            </div>
          </div>

          <div className="mt-10 flex items-end justify-between">
            <div className="text-xs text-muted-foreground">Player ID: {data.player.fotmobId}</div>
            <div className="text-xs text-muted-foreground">PSV Dashboard</div>
          </div>
        </div>
      </div>

      {pages.map((posts, idx) => (
        <div
          key={idx}
          data-pdf-page
          className="overflow-hidden bg-white text-black"
          style={{ width: A4_WIDTH_PX, height: A4_HEIGHT_PX }}
        >
          <div className="h-full p-10">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold tracking-wide text-muted-foreground">{data.player.name} • Full report</div>
              <div className="text-xs text-muted-foreground">{data.meta.startIso} – {data.meta.endIso}</div>
            </div>
            <div className="mt-1 h-px w-full bg-border" />

            <div className="mt-6 space-y-6">
              {posts.map((p) => (
                <PlayerPostCard key={p.id} post={p} handleHint={handleHint} />
              ))}
            </div>

            <div className="mt-6 flex items-center justify-between text-[10px] text-muted-foreground">
              <div>Generated: {new Date().toLocaleDateString("en-US")}</div>
              <div>Page {idx + 2} / {pages.length + 1}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
