"use client"

import Image from "next/image"

export default function Header() {
  return (
    <header className="border-b">
      <div className="w-full max-w-screen-2xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Image
              src="/sponsor-logos/psv-logo.svg"
              alt="PSV Logo"
              width={60}
              height={45}
              priority
            />
            <div className="flex flex-col">
              <h1 className="text-lg font-bold">PSV Dashboard</h1>
              <p className="text-xs text-muted-foreground">Live dashboard - Updated weekly</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}

