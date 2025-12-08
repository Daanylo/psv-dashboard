"use client"

import { useState } from "react"
import { ChevronRight, ChevronDown } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

export default function HomePage() {
  const [open, setOpen] = useState(true)
  const [socialOpen, setSocialOpen] = useState(true)

  return (
    <main className="max-w-screen-2xl mx-auto px-6 py-8 space-y-6">
      <section>
        <h2 className="text-xl font-bold font-psv-branding">OVERVIEW</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <Card className="rounded-none shadow-none">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Card 1</p>
            </CardContent>
          </Card>
          <Card className="rounded-none shadow-none">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Card 2</p>
            </CardContent>
          </Card>
          <Card className="rounded-none shadow-none">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Card 3</p>
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
            <ChevronDown className="h-5 w-5 text-[#2D9E3F] transition-transform duration-200 group-hover:scale-110" />
          ) : (
            <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform duration-200 group-hover:scale-110" />
          )}
        </button>
        {open && (
          <div id="sentiment-brand-panel" className="space-y-4 mt-4">
            <Card className="rounded-none shadow-none">
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Large card</p>
              </CardContent>
            </Card>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="rounded-none shadow-none">
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Card A</p>
                </CardContent>
              </Card>
              <Card className="rounded-none shadow-none">
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Card B</p>
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
            <ChevronDown className="h-5 w-5 text-[#2D9E3F] transition-transform duration-200 group-hover:scale-110" />
          ) : (
            <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform duration-200 group-hover:scale-110" />
          )}
        </button>
        {socialOpen && (
          <div id="social-media-panel" className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <Card className="rounded-none shadow-none">
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Card 1</p>
              </CardContent>
            </Card>
            <Card className="rounded-none shadow-none">
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Card 2</p>
              </CardContent>
            </Card>
            <Card className="rounded-none shadow-none">
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Card 3</p>
              </CardContent>
            </Card>
            <Card className="rounded-none shadow-none">
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Card 4</p>
              </CardContent>
            </Card>
          </div>
        )}
      </section>
    </main>
  )
}
