export type VisibilityScoreInput = {
  imageWidth: number | null | undefined
  imageHeight: number | null | undefined
  boxX: number | null | undefined
  boxY: number | null | undefined
  boxWidth: number | null | undefined
  boxHeight: number | null | undefined
}

export function computeVisibilityScore(input: VisibilityScoreInput): number | null {
  const imageWidth = Number(input.imageWidth)
  const imageHeight = Number(input.imageHeight)
  const boxX = Number(input.boxX)
  const boxY = Number(input.boxY)
  const boxWidth = Number(input.boxWidth)
  const boxHeight = Number(input.boxHeight)

  if (!Number.isFinite(imageWidth) || !Number.isFinite(imageHeight) || imageWidth <= 0 || imageHeight <= 0) return null
  if (!Number.isFinite(boxWidth) || !Number.isFinite(boxHeight) || boxWidth <= 0 || boxHeight <= 0) return null
  if (!Number.isFinite(boxX) || !Number.isFinite(boxY)) return null

  const imageArea = imageWidth * imageHeight
  const boxArea = boxWidth * boxHeight
  if (!Number.isFinite(imageArea) || imageArea <= 0) return null
  if (!Number.isFinite(boxArea) || boxArea <= 0) return null

  const sizeComponent = Math.min(1, Math.sqrt(boxArea / imageArea) * 2.236)

  const centerX = boxX + boxWidth / 2
  const centerY = boxY + boxHeight / 2
  const dx = centerX - imageWidth / 2
  const dy = centerY - imageHeight / 2
  const dist = Math.sqrt(dx * dx + dy * dy)

  const maxDist = Math.sqrt(Math.pow(imageWidth / 2, 2) + Math.pow(imageHeight / 2, 2))
  const positionComponent = Math.max(0, 1 - (maxDist === 0 ? 0 : dist / maxDist))

  const score = Math.min(100, (0.7 * sizeComponent + 0.3 * positionComponent) * 100)
  if (!Number.isFinite(score)) return null

  return Math.round(score * 10000) / 10000
}
