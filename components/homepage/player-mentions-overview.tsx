"use client"

import { useEffect, useState } from "react"
import { Card,CardAction, CardContent, CardDescription, CardEmotion, CardFooter, CardHeader,CardTitle,} from "@/components/ui/card"
import { ChartContainer, ChartConfig, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

interface PlayerSentiment {
  name: string
  mentions: number
  negative: number
  neutral: number
  positive: number
}

const cardConfig = {
  negative :{
    label: "Negative",
    color: "#ef4444",
  },
  positive:{
    label: "Positive",  
    color: "#22c55e",
  }
} 




export default function PlayerMentionsOverview() {
  const [mostPositive, setMostPositive] = useState<PlayerSentiment | null>(null)
  const [mostNegative, setMostNegative] = useState<PlayerSentiment | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
      async function loadData() {
        try {
          const response = await fetch('/api/player-oversentiment')
          if (!response.ok) {
            throw new Error('Failed to fetch player sentiment')
          }
          const json = await response.json()
        setMostPositive(json.mostPositive)
        setMostNegative(json.mostNegative)
        } catch (error) {
          console.error("Error loading player sentiment:", error)
        } finally {
          setLoading(false)
        }
      }
      loadData()
    }, [])

     if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (!mostPositive || !mostNegative) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-muted-foreground">No data available</p>
      </div>
    )
  }

  return (
    
    <div className="space-y-2">
      {/* 🟩 Card: jugador más positivo */}
      <CardEmotion className="min-h-[88px] bg-green-50 border border-green-100 rounded-xl shadow-sm p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-6 h-6 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5.121 17.804A4 4 0 017 16h10a4 4 0 011.879.496M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </div>
          <div className="flex flex-col">
            <p className="font-semibold">{mostPositive.name}</p>
            <div className="text-sm">
              {mostPositive.mentions} <span className="text-gray-400">mentions</span>
            </div>
          </div>
        </div>
        <div className="self-start text-green-700 font-medium text-sm"> Positive Sentiment </div>
      </CardEmotion>

      {/* 🟥 Card: jugador más negativo */}
      <CardEmotion className="min-h-[88px] bg-red-50 border border-red-100 rounded-xl shadow-sm p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-6 h-6 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5.121 17.804A4 4 0 017 16h10a4 4 0 011.879.496M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </div>
          <div className="flex flex-col">
            <p className="font-semibold">{mostNegative.name}</p>
            <div className="text-sm">
              {mostNegative.mentions} <span className="text-gray-400">mentions</span>
            </div>
          </div>
        </div>
        <div className="self-start text-red-700 font-medium text-sm"> Negative Sentiment </div>
      </CardEmotion>
    </div>
  )
}


