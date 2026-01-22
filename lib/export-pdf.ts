export async function exportNodeToPdf(node: HTMLElement, filename: string) {
  try {
    const { toPng } = await import("html-to-image")
    const jsPDF = (await import("jspdf")).default

    const getFontEmbedCSS = async () => {
      try {
        const fonts = [
          { name: "PSVBranding", url: "/fonts/PSVBranding-Regular.woff2", weight: 400, style: "normal" },
          { name: "PSVBranding", url: "/fonts/PSVBranding-Bold.woff2", weight: 700, style: "normal" },
          { name: "PSVBranding", url: "/fonts/PSVBranding-BoldItalic.woff2", weight: 700, style: "italic" },
          { name: "Open Sans", url: "/fonts/OpenSans-Regular.woff2", weight: 400, style: "normal" },
          { name: "Open Sans", url: "/fonts/OpenSans-Bold.woff2", weight: 700, style: "normal" },
        ] as const

        const parts = await Promise.all(
          fonts.map(async (font) => {
            const res = await fetch(font.url)
            if (!res.ok) throw new Error(`Failed to fetch font ${font.url}`)
            const blob = await res.blob()

            return await new Promise<string>((resolve, reject) => {
              const reader = new FileReader()
              reader.onloadend = () => {
                if (typeof reader.result === "string") {
                  resolve(
                    `@font-face { font-family: "${font.name}"; src: url(${reader.result}) format("woff2"); font-weight: ${font.weight}; font-style: ${font.style}; }`,
                  )
                } else {
                  reject(new Error("Font embed: reader result not a string"))
                }
              }
              reader.onerror = () => reject(new Error("Font embed: reader error"))
              reader.readAsDataURL(blob)
            })
          }),
        )

        const overrideCSS = `
          :root {
            --font-open-sans: "Open Sans", sans-serif !important;
            --font-sans: "Open Sans", sans-serif !important;
          }
        `

        return parts.join("\n") + overrideCSS
      } catch (e) {
        console.warn("Font embedding failed, continuing without custom fonts", e)
        return ""
      }
    }

    const fontCSS = await getFontEmbedCSS()

    const width = node.scrollWidth
    const height = node.scrollHeight

    const images = Array.from(node.querySelectorAll("img"))
    const imageRestoreFns: Array<() => void> = []

    await Promise.all(
      images.map(async (img) => {
        try {
          if (img.loading !== "eager") img.loading = "eager"

          if (!img.complete) {
            await new Promise((resolve) => {
              img.onload = () => resolve(null)
              img.onerror = () => resolve(null)
            })
          }

          const currentSrc = img.currentSrc || img.src
          if (currentSrc && !currentSrc.startsWith("data:")) {
            const response = await fetch(currentSrc)
            const blob = await response.blob()

            const base64 = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader()
              reader.onloadend = () => {
                if (typeof reader.result === "string") resolve(reader.result)
                else reject(new Error("Failed to convert image to base64"))
              }
              reader.onerror = () => reject(new Error("Failed to convert image to base64"))
              reader.readAsDataURL(blob)
            })

            const prevSrc = img.getAttribute("src")
            const prevSrcSet = img.getAttribute("srcset")

            img.src = base64
            img.removeAttribute("srcset")

            imageRestoreFns.push(() => {
              if (prevSrc) img.setAttribute("src", prevSrc)
              else img.removeAttribute("src")

              if (prevSrcSet) img.setAttribute("srcset", prevSrcSet)
            })
          }
        } catch (e) {
          console.warn("Failed to inline image for export", e)
        }
      }),
    )

    await new Promise((r) => setTimeout(r, 100))

    const dataUrl = await toPng(node, {
      cacheBust: true,
      pixelRatio: 2,
      fontEmbedCSS: fontCSS,
      backgroundColor: "#ffffff",
      width,
      height,
      style: {
        height: "auto",
        overflow: "visible",
        maxHeight: "none",
        margin: "0",
        maxWidth: "none",
        width: `${width}px`,
      },
    })

    imageRestoreFns.forEach((restore) => restore())

    const pdf = new jsPDF({
      orientation: width > height ? "landscape" : "portrait",
      unit: "px",
      format: [width, height],
    })

    pdf.addImage(dataUrl, "PNG", 0, 0, width, height)
    pdf.save(filename)
  } catch (err) {
    console.error("Export failed details:", err)
  }
}

export async function exportPagesToPdf(pages: HTMLElement[], filename: string) {
  try {
    const { toPng } = await import("html-to-image")
    const jsPDF = (await import("jspdf")).default

    if (!pages.length) return

    const getFontEmbedCSS = async () => {
      try {
        const fonts = [
          { name: "PSVBranding", url: "/fonts/PSVBranding-Regular.woff2", weight: 400, style: "normal" },
          { name: "PSVBranding", url: "/fonts/PSVBranding-Bold.woff2", weight: 700, style: "normal" },
          { name: "PSVBranding", url: "/fonts/PSVBranding-BoldItalic.woff2", weight: 700, style: "italic" },
          { name: "Open Sans", url: "/fonts/OpenSans-Regular.woff2", weight: 400, style: "normal" },
          { name: "Open Sans", url: "/fonts/OpenSans-Bold.woff2", weight: 700, style: "normal" },
        ] as const

        const parts = await Promise.all(
          fonts.map(async (font) => {
            const res = await fetch(font.url)
            if (!res.ok) throw new Error(`Failed to fetch font ${font.url}`)
            const blob = await res.blob()

            return await new Promise<string>((resolve, reject) => {
              const reader = new FileReader()
              reader.onloadend = () => {
                if (typeof reader.result === "string") {
                  resolve(
                    `@font-face { font-family: "${font.name}"; src: url(${reader.result}) format("woff2"); font-weight: ${font.weight}; font-style: ${font.style}; }`,
                  )
                } else {
                  reject(new Error("Font embed: reader result not a string"))
                }
              }
              reader.onerror = () => reject(new Error("Font embed: reader error"))
              reader.readAsDataURL(blob)
            })
          }),
        )

        const overrideCSS = `
          :root {
            --font-open-sans: "Open Sans", sans-serif !important;
            --font-sans: "Open Sans", sans-serif !important;
          }
        `

        return parts.join("\n") + overrideCSS
      } catch (e) {
        console.warn("Font embedding failed, continuing without custom fonts", e)
        return ""
      }
    }

    const fontCSS = await getFontEmbedCSS()

    const allImages = pages.flatMap((p) => Array.from(p.querySelectorAll("img")))
    const imageRestoreFns: Array<() => void> = []

    await Promise.all(
      allImages.map(async (img) => {
        try {
          if (img.loading !== "eager") img.loading = "eager"

          if (!img.complete) {
            await new Promise((resolve) => {
              img.onload = () => resolve(null)
              img.onerror = () => resolve(null)
            })
          }

          const currentSrc = img.currentSrc || img.src
          if (currentSrc && !currentSrc.startsWith("data:")) {
            const response = await fetch(currentSrc)
            const blob = await response.blob()

            const base64 = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader()
              reader.onloadend = () => {
                if (typeof reader.result === "string") resolve(reader.result)
                else reject(new Error("Failed to convert image to base64"))
              }
              reader.onerror = () => reject(new Error("Failed to convert image to base64"))
              reader.readAsDataURL(blob)
            })

            const prevSrc = img.getAttribute("src")
            const prevSrcSet = img.getAttribute("srcset")

            img.src = base64
            img.removeAttribute("srcset")

            imageRestoreFns.push(() => {
              if (prevSrc) img.setAttribute("src", prevSrc)
              else img.removeAttribute("src")

              if (prevSrcSet) img.setAttribute("srcset", prevSrcSet)
            })
          }
        } catch (e) {
          console.warn("Failed to inline image for export", e)
        }
      }),
    )

    await new Promise((r) => setTimeout(r, 100))

    const first = pages[0]
    const pageWidth = first.scrollWidth
    const pageHeight = first.scrollHeight

    const pdf = new jsPDF({
      orientation: pageWidth > pageHeight ? "landscape" : "portrait",
      unit: "px",
      format: [pageWidth, pageHeight],
    })

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i]
      const width = page.scrollWidth
      const height = page.scrollHeight

      const dataUrl = await toPng(page, {
        cacheBust: true,
        pixelRatio: 2,
        fontEmbedCSS: fontCSS,
        backgroundColor: "#ffffff",
        width,
        height,
        style: {
          height: "auto",
          overflow: "visible",
          maxHeight: "none",
          margin: "0",
          maxWidth: "none",
          width: `${width}px`,
        },
      })

      if (i > 0) pdf.addPage([pageWidth, pageHeight], pageWidth > pageHeight ? "landscape" : "portrait")
      pdf.addImage(dataUrl, "PNG", 0, 0, width, height)
    }

    imageRestoreFns.forEach((restore) => restore())

    pdf.save(filename)
  } catch (err) {
    console.error("Export failed details:", err)
  }
}
