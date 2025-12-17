"use client"

import { useState } from "react"
import { ChevronRight, ChevronDown } from "lucide-react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default function BrandingPage() {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [brandDropdownOpen, setBrandDropdownOpen] = useState(false)

  return (
    <main className="max-w-screen-2xl mx-auto px-6 py-8 space-y-6">
      <section>
        <h1 className="text-2xl font-bold font-psv-branding">OVERVIEW</h1>
        <div className="mt-4 space-y-4">
          <Card className="rounded-none shadow-none">
            <CardContent>
              {/* Content will go here */}
            </CardContent>
          </Card>

          <Card className="rounded-none shadow-none">
            <CardHeader className="px-4 pb-2 pt-0">
              <CardTitle className="text-base font-semibold font-psv-branding">SOCIAL MEDIA POSTS</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Social media posts content will go here */}
            </CardContent>
          </Card>

          <div className="grid grid-cols-5 gap-4">
            <Card className="rounded-none shadow-none">
              <CardHeader className="px-4 pb-2 pt-0">
                <CardTitle className="text-base font-semibold font-psv-branding">BRAND IMPRESSIONS</CardTitle>
              </CardHeader>
              <CardContent>
                {/* Content will go here */}
              </CardContent>
            </Card>

            <Card className="rounded-none shadow-none">
              <CardHeader className="px-4 pb-2 pt-0">
                <CardTitle className="text-base font-semibold font-psv-branding">AVERAGE FAN SENTIMENT</CardTitle>
              </CardHeader>
              <CardContent>
                {/* Content will go here */}
              </CardContent>
            </Card>

            <Card className="rounded-none shadow-none">
              <CardHeader className="px-4 pb-2 pt-0">
                <CardTitle className="text-base font-semibold font-psv-branding">AVERAGE VISIBILITY SCORE</CardTitle>
              </CardHeader>
              <CardContent>
                {/* Content will go here */}
              </CardContent>
            </Card>

            <Card className="rounded-none shadow-none">
              <CardHeader className="px-4 pb-2 pt-0">
                <CardTitle className="text-base font-semibold font-psv-branding">BRAND EXPOSURES</CardTitle>
              </CardHeader>
              <CardContent>
                {/* Content will go here */}
              </CardContent>
            </Card>

            <Card className="rounded-none shadow-none">
              <CardHeader className="px-4 pb-2 pt-0">
                <CardTitle className="text-base font-semibold font-psv-branding">EXPOSURES PER POST</CardTitle>
              </CardHeader>
              <CardContent>
                {/* Content will go here */}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-4">
            <Card className="rounded-none shadow-none">
              <CardHeader className="px-4 pb-2 pt-0">
                <CardTitle className="text-base font-semibold font-psv-branding">Efficiency vs. Volume</CardTitle>
              </CardHeader>
              <CardContent>
                {/* Content will go here */}
              </CardContent>
            </Card>

            <Card className="rounded-none shadow-none">
              <CardHeader className="px-4 pb-2 pt-0">
                <CardTitle className="text-base font-semibold font-psv-branding">MISSED OPPORTUNITIES</CardTitle>
              </CardHeader>
              <CardContent>
                {/* Content will go here */}
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section>
            <button
              type="button"
              onClick={() => setDropdownOpen((prev: boolean) => !prev)}
              className="flex items-center gap-2 group"
              aria-expanded={dropdownOpen}
              aria-controls="dropdown-panel"
            >
              <h2 className="text-xl font-bold font-psv-branding">COMPARE</h2>
              {dropdownOpen ? (
                <ChevronDown className="h-5 w-5 text-[#2D9E3F] transition-colors duration-200" />
              ) : (
                <ChevronRight className="h-5 w-5 text-muted-foreground transition-colors duration-200" />
              )}
            </button>
            {dropdownOpen && (
              <div id="dropdown-panel" className="space-y-4 mt-4">
                <Card className="rounded-none shadow-none">
                  <CardContent>
                    {/* Content will go here */}
                  </CardContent>
                </Card>

                <div className="grid grid-cols-3 gap-4">
                  <Card className="rounded-none shadow-none">
                    <CardHeader className="px-4 pb-2 pt-0">
                      <CardTitle className="text-base font-semibold font-psv-branding">VISIBILITY SHARE</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {/* Brand growth content will go here */}
                    </CardContent>
                  </Card>

                  <Card className="rounded-none shadow-none">
                    <CardHeader className="px-4 pb-2 pt-0">
                      <CardTitle className="text-base font-semibold font-psv-branding">TREND GAP</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {/* Engagement rate content will go here */}
                    </CardContent>
                  </Card>

                  <Card className="rounded-none shadow-none">
                    <CardHeader className="px-4 pb-2 pt-0">
                      <CardTitle className="text-base font-semibold font-psv-branding">EXPOSURE QUALITY RADAR</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {/* Reach analysis content will go here */}
                    </CardContent>
                  </Card>
                </div>

                <Card className="rounded-none shadow-none">
                  <CardHeader className="px-4 pb-2 pt-0">
                    <CardTitle className="text-base font-semibold font-psv-branding">TREND GAP</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {/* Trend gap content will go here */}
                  </CardContent>
                </Card>
              </div>
            )}
          </section>

          <section>
            <button
              type="button"
              onClick={() => setBrandDropdownOpen((prev: boolean) => !prev)}
              className="flex items-center gap-2 group"
              aria-expanded={brandDropdownOpen}
              aria-controls="brand-dropdown-panel"
            >
              <h2 className="text-xl font-bold font-psv-branding">BRAND</h2>
              {brandDropdownOpen ? (
                <ChevronDown className="h-5 w-5 text-[#2D9E3F] transition-colors duration-200" />
              ) : (
                <ChevronRight className="h-5 w-5 text-muted-foreground transition-colors duration-200" />
              )}
            </button>
            {brandDropdownOpen && (
              <div id="brand-dropdown-panel" className="space-y-4 mt-4">
                <Card className="rounded-none shadow-none">
                  <CardContent>
                    {/* Content will go here */}
                  </CardContent>
                </Card>

                <Card className="rounded-none shadow-none">
                  <CardHeader className="px-4 pb-2 pt-0">
                    <CardTitle className="text-base font-semibold font-psv-branding">BEST EXPOSURES</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {/* Best exposures content will go here */}
                  </CardContent>
                </Card>

                <div className="grid grid-cols-3 gap-4">
                  <Card className="rounded-none shadow-none">
                    <CardHeader className="px-4 pb-2 pt-0">
                      <CardTitle className="text-base font-semibold font-psv-branding">ESTIMATED AMOUNT OF IMPRESSIONS</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {/* Estimated amount of impressions content will go here */}
                    </CardContent>
                  </Card>

                  <Card className="rounded-none shadow-none">
                    <CardHeader className="px-4 pb-2 pt-0">
                      <CardTitle className="text-base font-semibold font-psv-branding">AVERAGE FAN SENTIMENT</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {/* Average fan sentiment content will go here */}
                    </CardContent>
                  </Card>

                  <Card className="rounded-none shadow-none">
                    <CardHeader className="px-4 pb-2 pt-0">
                      <CardTitle className="text-base font-semibold font-psv-branding">ESTIMATED MEDIA VALUE</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {/* Estimated media value content will go here */}
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <Card className="rounded-none shadow-none">
                    <CardHeader className="px-4 pb-2 pt-0">
                      <CardTitle className="text-base font-semibold font-psv-branding">visibility share</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {/* Content will go here */}
                    </CardContent>
                  </Card>

                  <Card className="rounded-none shadow-none">
                    <CardHeader className="px-4 pb-2 pt-0">
                      <CardTitle className="text-base font-semibold font-psv-branding">EXPOSURE QUALITY RADAR</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {/* Content will go here */}
                    </CardContent>
                  </Card>

                  <Card className="rounded-none shadow-none">
                    <CardHeader className="px-4 pb-2 pt-0">
                      <CardTitle className="text-base font-semibold font-psv-branding">APPEARANCE HEATMAP</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {/* Content will go here */}
                    </CardContent>
                  </Card>

                  <Card className="rounded-none shadow-none">
                    <CardHeader className="px-4 pb-2 pt-0">
                      <CardTitle className="text-base font-semibold font-psv-branding">CUMULATIVE IMPACT</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {/* Content will go here */}
                    </CardContent>
                  </Card>

                  <Card className="rounded-none shadow-none">
                    <CardHeader className="px-4 pb-2 pt-0">
                      <CardTitle className="text-base font-semibold font-psv-branding">VISIBILITY OVER TIME</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {/* Content will go here */}
                    </CardContent>
                  </Card>
                </div>

                <Card className="rounded-none shadow-none">
                  <CardHeader className="px-4 pb-2 pt-0">
                    <CardTitle className="text-base font-semibold font-psv-branding">EFFICIENCY VS. VOLUME</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {/* Content will go here */}
                  </CardContent>
                </Card>
              </div>
            )}
          </section>
    </main>
  )
}
