"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { ArrowUp, ArrowDown } from "lucide-react"

// Local lightweight Badge fallback (shadcn not required here)
function Badge({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-md text-sm font-medium ${className}`}>
      {children}
    </span>
  )
}

interface PlayerSentiment {
  name: string
  mentions: number
  positive: number
  marketValue?: number
}

export default function PlayerSentimentMarketValue() {
  const [mostPositive, setMostPositive] = useState<PlayerSentiment | null>(null)
  const [mostNegative, setMostNegative] = useState<PlayerSentiment | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // mock data
    const mockPositive = {
      name: "Bakayoko",
      mentions: 100,
      positive: 82,
      marketValue: 8.5,
    }

    const mockNegative = {
      name: "Guus Til",
      mentions: 100,
      positive: 20,
      marketValue: 12,
    }

    setMostPositive(mockPositive)
    setMostNegative(mockNegative)
    setLoading(false)
  }, [])

  if (loading) return <p className="text-center text-muted-foreground">Loading...</p>
  if (!mostPositive || !mostNegative) return <p>No data available</p>

  return (
    <Card className="p-0 border-none shadow-none bg-transparent">
      <div className="space-y-4 mt-4">

        {/* ---------------- ITEM 1 ---------------- */}
        <Card className="bg-[#f7f7f7] p-9 rounded-xl border-none shadow-sm w-full mt-5">
          <div className="flex items-center justify-between w-full">

            {/* LEFT SIDE */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-white shadow flex items-center justify-center">
                <ArrowUp className="text-blue-600" size={20} />
              </div>

              <div className="flex flex-col">
                <span className="font-semibold">{mostPositive.name}</span>
                <span className="text-sm text-muted-foreground">High popularity</span>
              </div>
            </div>

            {/* RIGHT SIDE */}
            <div className="flex flex-col items-end">
              <Badge className="bg-green-100 text-green-700 px-3 py-1">Underrated</Badge>
              <span className="mt-2 text-sm font-medium">
                €{(mostPositive.marketValue ?? 8.5).toFixed(1)}M
              </span>
            </div>
          </div>
        </Card>

        {/* ---------------- ITEM 2 ---------------- */}
        <Card className="bg-[#f7f7f7] p-9 rounded-xl border-none shadow-sm w-full">
          <div className="flex items-center justify-between w-full">

            {/* LEFT SIDE */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-white shadow flex items-center justify-center">
                <ArrowDown className="text-blue-600" size={20} />
              </div>

              <div className="flex flex-col">
                <span className="font-semibold">{mostNegative.name}</span>
                <span className="text-sm text-muted-foreground">Low popularity</span>
              </div>
            </div>

            {/* RIGHT SIDE */}
            <div className="flex flex-col items-end">
              <Badge className="bg-red-100 text-red-700 px-3 py-1">Overrated</Badge>
              <span className="mt-2 text-sm font-medium">
                €{(mostNegative.marketValue ?? 12).toFixed(1)}M
              </span>
            </div>
          </div>
        </Card>

      </div>
    </Card>
  )
}  