"use client"

import Link from "next/link"
import { useState } from "react"
import { ChevronRight, ChevronDown, Info, MoveRight } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import WhereFansEngageMost from "@/components/charts/social-media/where-fans-engage-most"
import BestContentType from "@/components/charts/social-media/best-content-type"
import TopPerformingHashtags from "@/components/charts/social-media/top-performing-hashtags"
import MostDiscussedTopics from "@/components/charts/social-media/most-discussed-topics"
import SentimentVsMarketValue from "@/components/charts/overview/sentiment-vs-market-value"
import PlayerMentions from "@/components/charts/overview/player-mentions"
import AverageTeamSentimentGauge from "@/components/charts/overview/average-team-sentiment-gauge"
import TopBrandExposure from "@/components/charts/sentiment-brand/top-brand-exposure"
import SentimentJourney from "@/components/charts/sentiment-brand/sentiment-journey"
import TopPlayers from "@/components/charts/sentiment-brand/top-players"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export default function HomePage() {
  const [open, setOpen] = useState(true)
  const [socialOpen, setSocialOpen] = useState(true)

  return (
    <main className="max-w-screen-2xl mx-auto px-6 py-8 space-y-6">
      <section>
        <h2 className="text-xl font-bold font-psv-branding">OVERVIEW</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <Card className="rounded-none shadow-none">
            <CardHeader className="px-4 pb-2 pt-0 flex items-start justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-semibold font-psv-branding">AVERAGE TEAM SENTIMENT GAUGE</CardTitle>
                <Link href="/sponsors" aria-label="Ga naar sponsors">
                  <MoveRight className="h-4 w-4 text-muted-foreground transition-colors hover:text-[#2D9E3F]" />
                </Link>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground transition-colors hover:text-[#2D9E3F]" />
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  className="bg-black text-white border-none"
                >
                  <div className="flex flex-col gap-1 text-sm text-white leading-snug">
                    <span>Average team sentiment</span>
                    <span>based on all football players results</span>
                  </div>
                </TooltipContent>
              </Tooltip>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <AverageTeamSentimentGauge />
            </CardContent>
          </Card>
          <Card className="rounded-none shadow-none">
            <CardHeader className="px-4 pb-2 pt-0 flex items-start justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-semibold font-psv-branding">PLAYER MENTIONS OVERVIEW</CardTitle>
                <Link href="/sponsors" aria-label="Ga naar sponsors">
                  <MoveRight className="h-4 w-4 text-muted-foreground transition-colors hover:text-[#2D9E3F]" />
                </Link>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground transition-colors hover:text-[#2D9E3F]" />
                </TooltipTrigger>
                <TooltipContent side="top" className="bg-black text-white border-none">
                  <div className="flex flex-col gap-1 text-sm text-white leading-snug">
                    <span>Shows total mentions per player across channels</span>
                    <span>Use to spot spikes in player visibility</span>
                  </div>
                </TooltipContent>
              </Tooltip>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <PlayerMentions />
            </CardContent>
          </Card>
          <Card className="rounded-none shadow-none">
            <CardHeader className="px-4 pb-2 pt-0 flex items-start justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-semibold font-psv-branding">SENTIMENT VS MARKET VALUE</CardTitle>
                <Link href="/sponsors" aria-label="Ga naar sponsors">
                  <MoveRight className="h-4 w-4 text-muted-foreground transition-colors hover:text-[#2D9E3F]" />
                </Link>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground transition-colors hover:text-[#2D9E3F]" />
                </TooltipTrigger>
                <TooltipContent side="top" className="bg-black text-white border-none">
                  <div className="flex flex-col gap-1 text-sm text-white leading-snug">
                    <span>Compares fan sentiment to current player value</span>
                    <span>Highlights over/undervalued perceptions</span>
                  </div>
                </TooltipContent>
              </Tooltip>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <SentimentVsMarketValue />
            </CardContent>
          </Card>
        </div>
      </section>

      <section>
        <button
          type="button"
          onClick={() => setOpen(prev => !prev)}
          className="flex items-center gap-2 group"
          aria-expanded={open}
          aria-controls="sentiment-brand-panel"
        >
          <h2 className="text-xl font-bold font-psv-branding">SENTIMENT & BRAND</h2>
          {open ? (
            <ChevronDown className="h-5 w-5 text-[#2D9E3F] transition-colors duration-200" />
          ) : (
            <ChevronRight className="h-5 w-5 text-muted-foreground transition-colors duration-200" />
          )}
        </button>
        {open && (
          <div id="sentiment-brand-panel" className="space-y-4 mt-4">
            <Card className="rounded-none shadow-none">
              <CardHeader className="px-4 pb-2 pt-0 flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base font-semibold font-psv-branding">SENTIMENT JOURNEY</CardTitle>
                  <Link href="/sponsors" aria-label="Ga naar sponsors">
                    <MoveRight className="h-4 w-4 text-muted-foreground transition-colors hover:text-[#2D9E3F]" />
                  </Link>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground transition-colors hover:text-[#2D9E3F]" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="bg-black text-white border-none">
                    <div className="flex flex-col gap-1 text-sm text-white leading-snug">
                      <span>Tracks daily sentiment and key events</span>
                      <span>Use to see how spikes align with matches or news</span>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <SentimentJourney />
              </CardContent>
            </Card>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="rounded-none shadow-none">
                <CardHeader className="px-4 pb-2 pt-0 flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base font-semibold font-psv-branding">TOP PLAYERS</CardTitle>
                    <Link href="/sponsors" aria-label="Ga naar sponsors">
                      <MoveRight className="h-4 w-4 text-muted-foreground transition-colors hover:text-[#2D9E3F]" />
                    </Link>
                  </div>
                <div className="flex items-center gap-2">
                  <Select defaultValue="positive">
                    <SelectTrigger
                      className="h-9 w-[214px] border-[#e6e6e6] text-sm font-normal text-[#212529] rounded-none"
                      aria-label="Top players filter"
                    >
                      <SelectValue placeholder="Select filter" />
                    </SelectTrigger>
                    <SelectContent className="text-sm w-[214px] rounded-none">
                      <SelectItem
                        value="positive"
                        className="rounded-none data-[highlighted]:rounded-none focus:rounded-none"
                      >
                        Top Positive Sentiment
                      </SelectItem>
                      <SelectItem
                        value="influence"
                        className="rounded-none data-[highlighted]:rounded-none focus:rounded-none"
                      >
                        Top Influence on Social Media
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground transition-colors hover:text-[#2D9E3F]" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="bg-black text-white border-none">
                      <div className="flex flex-col gap-1 text-sm text-white leading-snug">
                        <span>Filter top players by sentiment or influence</span>
                        <span>Helps compare fan tone vs social impact</span>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </div>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <TopPlayers />
                </CardContent>
              </Card>
              <Card className="rounded-none shadow-none">
              <CardHeader className="px-4 pb-2 pt-0 flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base font-semibold font-psv-branding">TOP 3 BRAND EXPOSURE THIS WEEK</CardTitle>
                  <Link href="/sponsors" aria-label="Ga naar sponsors">
                    <MoveRight className="h-4 w-4 text-muted-foreground transition-colors hover:text-[#2D9E3F]" />
                  </Link>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground transition-colors hover:text-[#2D9E3F]" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="bg-black text-white border-none">
                    <div className="flex flex-col gap-1 text-sm text-white leading-snug">
                      <span>Ranks brands by visibility in the last week</span>
                      <span>Use to track sponsor exposure trends</span>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </CardHeader>
                <CardContent className="p-4 pt-0">
                  <TopBrandExposure />
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </section>

      <section>
        <button
          type="button"
          onClick={() => setSocialOpen(prev => !prev)}
          className="flex items-center gap-2 group"
          aria-expanded={socialOpen}
          aria-controls="social-media-panel"
        >
          <h2 className="text-xl font-bold font-psv-branding">SOCIAL MEDIA</h2>
          {socialOpen ? (
            <ChevronDown className="h-5 w-5 text-[#2D9E3F] transition-colors duration-200" />
          ) : (
            <ChevronRight className="h-5 w-5 text-muted-foreground transition-colors duration-200" />
          )}
        </button>
        {socialOpen && (
          <div id="social-media-panel" className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <Card className="rounded-none shadow-none">
            <CardHeader className="px-4 pb-2 pt-0 flex items-start justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-semibold font-psv-branding">WHERE FANS ENGAGE MOST</CardTitle>
                <Link href="/sponsors" aria-label="Ga naar sponsors">
                  <MoveRight className="h-4 w-4 text-muted-foreground transition-colors hover:text-[#2D9E3F]" />
                </Link>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground transition-colors hover:text-[#2D9E3F]" />
                </TooltipTrigger>
                <TooltipContent side="top" className="bg-black text-white border-none">
                  <div className="flex flex-col gap-1 text-sm text-white leading-snug">
                    <span>Breakdown of fan engagement by platform</span>
                    <span>Helps prioritize channels with the most activity</span>
                  </div>
                </TooltipContent>
              </Tooltip>
            </CardHeader>
              <CardContent className="p-4 pt-0">
                <WhereFansEngageMost />
              </CardContent>
            </Card>
            <Card className="rounded-none shadow-none">
            <CardHeader className="px-4 pb-2 pt-0 flex items-start justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-semibold font-psv-branding">BEST CONTENT TYPE BASED ON ENGAGEMENT</CardTitle>
                <Link href="/sponsors" aria-label="Ga naar sponsors">
                  <MoveRight className="h-4 w-4 text-muted-foreground transition-colors hover:text-[#2D9E3F]" />
                </Link>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground transition-colors hover:text-[#2D9E3F]" />
                </TooltipTrigger>
                <TooltipContent side="top" className="bg-black text-white border-none">
                  <div className="flex flex-col gap-1 text-sm text-white leading-snug">
                    <span>Ranks content formats by engagement rate</span>
                    <span>Use to plan posts that perform best</span>
                  </div>
                </TooltipContent>
              </Tooltip>
            </CardHeader>
              <CardContent className="p-4 pt-0">
                <BestContentType />
              </CardContent>
            </Card>
            <Card className="rounded-none shadow-none">
            <CardHeader className="px-4 pb-2 pt-0 flex items-start justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-semibold font-psv-branding">TOP PERFORMING HASHTAGS</CardTitle>
                <Link href="/sponsors" aria-label="Ga naar sponsors">
                  <MoveRight className="h-4 w-4 text-muted-foreground transition-colors hover:text-[#2D9E3F]" />
                </Link>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground transition-colors hover:text-[#2D9E3F]" />
                </TooltipTrigger>
                <TooltipContent side="top" className="bg-black text-white border-none">
                  <div className="flex flex-col gap-1 text-sm text-white leading-snug">
                    <span>Shows hashtags driving the most engagement</span>
                    <span>Use to select tags for upcoming posts</span>
                  </div>
                </TooltipContent>
              </Tooltip>
            </CardHeader>
              <CardContent className="p-4 pt-0">
                <TopPerformingHashtags />
              </CardContent>
            </Card>
            <Card className="rounded-none shadow-none">
              <CardHeader className="px-4 pb-2 pt-0 flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base font-semibold font-psv-branding">THE MOST DISCUSSED TOPICS</CardTitle>
                  <Link href="/sponsors" aria-label="Ga naar sponsors">
                    <MoveRight className="h-4 w-4 text-muted-foreground transition-colors hover:text-[#2D9E3F]" />
                  </Link>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground transition-colors hover:text-[#2D9E3F]" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="bg-black text-white border-none">
                    <div className="flex flex-col gap-1 text-sm text-white leading-snug">
                      <span>Identifies trending topics fans discuss</span>
                      <span>Use to tailor messaging to current buzz</span>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <MostDiscussedTopics />
              </CardContent>
            </Card>
          </div>
        )}
      </section>
    </main>
  )
}
