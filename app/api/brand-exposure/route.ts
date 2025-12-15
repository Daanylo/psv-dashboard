import { NextResponse } from "next/server"

// Mock data: top 3 brand exposures this week
const items = [
  {
    logo_label: "Philips",
    post: {
      id: 1,
      url: "https://images.unsplash.com/photo-1523755231516-e43fd2e8dca5?auto=format&fit=crop&w=800&q=80",
      caption: "Matchday spotlight",
      taken_at: "2025-12-02T10:00:00Z",
    },
    current_week_count: 320,
    previous_week_count: 250,
    percentage_change: 28, // +28% week over week
  },
  {
    logo_label: "Puma",
    post: {
      id: 2,
      url: "https://images.unsplash.com/photo-1521417531039-73c3ee8b2ae0?auto=format&fit=crop&w=800&q=80",
      caption: "Training session buzz",
      taken_at: "2025-12-03T12:00:00Z",
    },
    current_week_count: 270,
    previous_week_count: 210,
    percentage_change: 29,
  },
  {
    logo_label: "Brainport",
    post: {
      id: 3,
      url: "https://images.unsplash.com/photo-1526481280695-3c469c2f88b8?auto=format&fit=crop&w=800&q=80",
      caption: "Community event highlight",
      taken_at: "2025-12-05T15:00:00Z",
    },
    current_week_count: 190,
    previous_week_count: 180,
    percentage_change: 6,
  },
]

const overall_current_week_detections = items.reduce(
  (sum, i) => sum + i.current_week_count,
  0,
)
const overall_previous_week_detections = items.reduce(
  (sum, i) => sum + i.previous_week_count,
  0,
)
const overall_visibility_change = overall_previous_week_detections
  ? Math.round(
      ((overall_current_week_detections - overall_previous_week_detections) /
        overall_previous_week_detections) *
        100,
    )
  : 0

export async function GET() {
  return NextResponse.json({
    data: items,
    overall_current_week_detections,
    overall_previous_week_detections,
    overall_visibility_change,
  })
}
