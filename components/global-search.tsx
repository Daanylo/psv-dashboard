"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"

type SearchResultType = "event" | "player" | "sponsor"

type SearchResultItem = {
  type: SearchResultType
  title: string
  subtitle?: string | null
  href: string
}

type Props = {
  value?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  className?: string
}

function typeLabel(t: SearchResultType) {
  switch (t) {
    case "event":
      return "Events"
    case "player":
      return "Players"
    case "sponsor":
      return "Sponsors"
  }
}

export function GlobalSearch({
  value,
  onValueChange,
  placeholder = "Search events, players, sponsors…",
  className,
}: Props) {
  const router = useRouter()

  const [internalValue, setInternalValue] = useState("")
  const inputValue = value ?? internalValue

  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<SearchResultItem[]>([])
  const [activeIndex, setActiveIndex] = useState<number>(-1)

  const rootRef = useRef<HTMLDivElement | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const grouped = useMemo(() => {
    const groups = new Map<SearchResultType, Array<{ r: SearchResultItem; idx: number }>>()
    for (let i = 0; i < results.length; i++) {
      const r = results[i]
      const list = groups.get(r.type) ?? []
      list.push({ r, idx: i })
      groups.set(r.type, list)
    }

    const order: SearchResultType[] = ["event", "player", "sponsor"]
    return order
      .map((t) => ({ type: t, items: groups.get(t) ?? [] }))
      .filter((g) => g.items.length > 0)
  }, [results])

  const flatResults = useMemo(() => results, [results])

  const setValue = (next: string) => {
    if (onValueChange) onValueChange(next)
    else setInternalValue(next)
  }

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current) return
      if (!rootRef.current.contains(e.target as Node)) {
        setOpen(false)
        setActiveIndex(-1)
      }
    }

    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [])

  useEffect(() => {
    const q = inputValue.trim()
    const isNumeric = q.length > 0 && /^[0-9]+$/.test(q)
    const shouldQuery = q.length >= 2 || isNumeric

    abortRef.current?.abort()

    if (!shouldQuery) {
      setLoading(false)
      setResults([])
      setActiveIndex(-1)
      return
    }

    const ctrl = new AbortController()
    abortRef.current = ctrl

    setLoading(true)

    const handle = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/new/search?q=${encodeURIComponent(q)}`, {
          signal: ctrl.signal,
        })

        if (!res.ok) {
          setResults([])
          setActiveIndex(-1)
          return
        }

        const data = (await res.json()) as { results?: SearchResultItem[] }
        const next = Array.isArray(data.results) ? data.results : []
        setResults(next)
        setActiveIndex(next.length ? 0 : -1)
      } catch {
        setResults([])
        setActiveIndex(-1)
      } finally {
        setLoading(false)
      }
    }, 150)

    return () => {
      window.clearTimeout(handle)
      ctrl.abort()
    }
  }, [inputValue])

  const navigate = (href: string) => {
    setValue("")
    setOpen(false)
    setActiveIndex(-1)
    router.push(href)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open && e.key !== "Tab") setOpen(true)

    if (e.key === "Escape") {
      e.preventDefault()
      setOpen(false)
      setActiveIndex(-1)
      return
    }

    if (e.key === "ArrowDown") {
      e.preventDefault()
      if (!flatResults.length) return
      setActiveIndex((i) => (i + 1) % flatResults.length)
      return
    }

    if (e.key === "ArrowUp") {
      e.preventDefault()
      if (!flatResults.length) return
      setActiveIndex((i) => (i - 1 + flatResults.length) % flatResults.length)
      return
    }

    if (e.key === "Enter") {
      const hit = flatResults[activeIndex]
      if (!hit) return
      e.preventDefault()
      navigate(hit.href)
    }
  }

  return (
    <div ref={rootRef} className={"relative " + (className ?? "")}
    >
      <input
        value={inputValue}
        onChange={(e) => {
          setValue(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className="border-input placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 dark:hover:bg-input/50 h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-2 text-sm transition-[color] outline-none focus:border-primary"
        aria-label="Search"
        aria-expanded={open}
        aria-haspopup="listbox"
      />

      {open ? (
        <div
          role="listbox"
          className="bg-popover text-popover-foreground absolute left-0 right-0 top-full z-50 mt-2 rounded-md border shadow-md"
        >
          {loading ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">Searching…</div>
          ) : results.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">No results</div>
          ) : (
            <div className="max-h-[320px] overflow-auto py-1">
              {grouped.map((group) => (
                <div key={group.type}>
                  <div className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground">
                    {typeLabel(group.type)}
                  </div>
                  {group.items.map(({ r, idx }) => {
                    const active = idx === activeIndex
                    return (
                      <button
                        key={r.href}
                        type="button"
                        onClick={() => navigate(r.href)}
                        onMouseEnter={() => setActiveIndex(idx)}
                        className={
                          "flex w-full flex-col gap-0.5 px-3 py-2 text-left text-sm hover:bg-accent " +
                          (active ? "bg-accent" : "")
                        }
                      >
                        <div className="truncate">{r.title}</div>
                        {r.subtitle ? (
                          <div className="truncate text-xs text-muted-foreground">{r.subtitle}</div>
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
