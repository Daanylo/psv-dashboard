"use client"

import { Clapperboard, Camera, Image as ImageIcon, MessageCircle } from "lucide-react"

const data = [
  { type: "Video", value: 40, key: "video", icon: Clapperboard },
  { type: "Stories", value: 27, key: "stories", icon: Camera },
  { type: "Photo", value: 18, key: "photo", icon: ImageIcon },
  { type: "Text", value: 15, key: "text", icon: MessageCircle },
]

export default function BestContentType() {
  return (
    <div className="space-y-7">
      {data.map((item) => {
        const Icon = item.icon
        return (
          <div key={item.key} className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Icon className="h-5 w-5 text-foreground" />
                <span className="text-base font-semibold">{item.type}</span>
              </div>
              <span className="text-sm text-muted-foreground font-mono">{item.value}%</span>
            </div>
            <div className="h-5 w-full rounded-md bg-muted overflow-hidden border border-border/60">
              <div
                className="h-full rounded-md"
                style={{ width: `${item.value}%`, backgroundColor: "#0B8DFF" }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
