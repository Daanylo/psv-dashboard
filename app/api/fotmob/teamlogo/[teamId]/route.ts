import { NextResponse } from "next/server"

export async function GET(_req: Request, context: { params: Promise<{ teamId: string }> }) {
  try {
    const { teamId } = await context.params
    const id = Number(teamId)

    if (!id || !Number.isFinite(id)) {
      return new NextResponse("Invalid teamId", { status: 400 })
    }

    const upstreamUrl = `https://images.fotmob.com/image_resources/logo/teamlogo/${id}.png`

    const res = await fetch(upstreamUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0",
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: "https://www.fotmob.com/",
      },
      cache: "force-cache",
    })

    if (!res.ok) {
      return new NextResponse("Upstream error", { status: res.status })
    }

    const bytes = await res.arrayBuffer()
    const contentType = res.headers.get("content-type") ?? "image/png"

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    })
  } catch (error) {
    console.error("FotMob teamlogo proxy failed:", error)
    return new NextResponse("Failed to load logo", { status: 500 })
  }
}
