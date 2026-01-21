import { NextResponse } from "next/server"

const mockBrands = [
  {
    name: "Puma",
    exposure: 75,
    sentiment: 60,
    image: "/posts/post-template.png",
    logo: "/sponsor-logos/puma-logo.svg",
  },
  {
    name: "50c mobiel",
    exposure: 63,
    sentiment: 55,
    image: "/posts/post-template.png",
    logo: "/sponsor-logos/50plus-logo.svg",
  },
  {
    name: "Brainport Eindhoven",
    exposure: 60,
    sentiment: 58,
    image: "/posts/post-template.png",
    logo: "/sponsor-logos/brainport-logo.svg",
  },
]

const mockSummary = {
  exposure: 64,
  sentiment: 40,
}

export async function GET() {
  return NextResponse.json({
    items: mockBrands,
    summary: mockSummary,
  })
}
