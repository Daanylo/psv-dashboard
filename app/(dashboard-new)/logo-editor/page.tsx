"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import Image from "next/image"
import { detectLogos, Detection } from "@/lib/onnx-detector"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { 
  Loader2, 
  Trash2, 
  Plus, 
  Save, 
  RefreshCw,
  Target,
  Image as ImageIcon
} from "lucide-react"
import { cn } from "@/lib/utils"

// Types
type Post = {
  id: string
  shortcode: string
  url: string
  taken_at_timestamp: number
  detectionCount: number
}

type EditorDetection = {
  id: string // temporary ID for UI
  label: string
  confidence: number
  box: {
    x: number // pixels
    y: number // pixels
    width: number // pixels
    height: number // pixels
  }
}

export default function LogoDetectionPage() {
  // State
  const [posts, setPosts] = useState<Post[]>([])
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null)
  const [loadingPosts, setLoadingPosts] = useState(true)
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  
  // Fetch posts
  const fetchPosts = async (currentOffset: number) => {
    try {
      const res = await fetch(`/api/new/logo-detection/posts?limit=50&offset=${currentOffset}`)
      const data = await res.json()
      
      const newPosts = data.posts || []
      
      if (currentOffset === 0) {
        setPosts(newPosts)
        setOffset(50) // Next offset
        if (newPosts.length > 0 && !selectedPostId) {
          setSelectedPostId(newPosts[0].id)
        }
      } else {
        setPosts(prev => [...prev, ...newPosts])
        setOffset(prev => prev + 50)
      }
      
      if (newPosts.length < 50) {
        setHasMore(false)
      }
    } catch (err) {
      console.error("Failed to load posts", err)
    } finally {
      setLoadingPosts(false)
      setLoadingMore(false)
    }
  }

  useEffect(() => {
    fetchPosts(0)
  }, [])

  const handleLoadMore = () => {
    setLoadingMore(true)
    fetchPosts(offset)
  }

  const selectedPost = useMemo(() => 
    posts.find(p => p.id === selectedPostId), 
    [posts, selectedPostId]
  )

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
        {/* Sidebar: Posts List */}
        <aside className="w-80 border-r bg-muted/10 flex flex-col">
          <div className="p-4 border-b">
            <h2 className="font-semibold text-lg flex items-center gap-2">
              <ImageIcon className="w-5 h-5" />
              Posts
            </h2>
            <p className="text-xs text-muted-foreground">Select a post to label</p>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-2">
              {loadingPosts ? (
                <div className="flex justify-center p-4">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                posts.map(post => (
                  <div
                    key={post.id}
                    onClick={() => setSelectedPostId(post.id)}
                    className={cn(
                      "flex items-start gap-3 p-3 rounded-md cursor-pointer transition-colors border text-left",
                      selectedPostId === post.id
                        ? "bg-accent border-primary/50"
                        : "bg-card hover:bg-accent/50 border-transparent"
                    )}
                  >
                    <div className="w-12 h-12 bg-muted rounded overflow-hidden flex-shrink-0 relative">
                      {/* Use proxy to avoid CORP/CORS blocking on thumbnails */}
                       <img 
                         src={`/api/old/proxy-image?url=${encodeURIComponent(post.shortcode ? `https://www.instagram.com/p/${post.shortcode}/media/?size=t` : post.url)}`}
                         className="object-cover w-full h-full"
                         alt="thumb"
                         loading="lazy"
                       />
                    </div>
                    <div className="overflow-hidden">
                      <div className="text-xs font-medium truncate mb-1">
                        {new Date(post.taken_at_timestamp * 1000).toLocaleDateString()}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                         <Target className="w-3 h-3" />
                         {post.detectionCount} detections
                      </div>
                    </div>
                  </div>
                ))
              )}

              {hasMore && !loadingPosts && posts.length > 0 && (
                <div className="pt-2 pb-4 px-2">
                  <Button 
                    variant="outline" 
                    className="w-full text-xs h-8" 
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                  >
                    {loadingMore && <Loader2 className="w-3 h-3 mr-2 animate-spin" />}
                    Load More
                  </Button>
                </div>
              )}
            </div>
          </ScrollArea>
        </aside>

        {/* Main Content: Editor */}
        <main className="flex-1 overflow-y-auto bg-background">
          {selectedPost ? (
            <DetectionEditor post={selectedPost} onUpdate={() => {
                // Refresh posts list to update counts if we wanted
                // For now just keep local state 
            }} />
          ) : (
             <div className="flex items-center justify-center h-full text-muted-foreground">
               Select a post to start editing
             </div>
          )}
        </main>
    </div>
  )
}

function DetectionEditor({ post, onUpdate }: { post: Post, onUpdate: () => void }) {
    const [detections, setDetections] = useState<EditorDetection[]>([])
    const [loadingDetections, setLoadingDetections] = useState(false)
    const [saving, setSaving] = useState(false)
    const [runningModel, setRunningModel] = useState(false)
    const [imageDimensions, setImageDimensions] = useState<{ width: number, height: number } | null>(null)
    const [drawingBox, setDrawingBox] = useState<{ startX: number, startY: number, currentX: number, currentY: number } | null>(null)
    const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null)
    
    // Refs
    const imageRef = useRef<HTMLImageElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    // Construct Proxy URL for Canvas/ONNX compatibility
    const imageUrl = useMemo(() => {
        const url = post.shortcode ? `https://www.instagram.com/p/${post.shortcode}/media/?size=l` : post.url
        return `/api/old/proxy-image?url=${encodeURIComponent(url)}`
    }, [post])

    // Load detections
    useEffect(() => {
        if (!post) return
        setDetections([])
        async function load() {
            setLoadingDetections(true)
            try {
                const res = await fetch(`/api/new/logo-detection/detections/${post.id}`)
                const data = await res.json()
                const loaded = data.detections.map((d: any) => ({
                    ...d,
                    id: d.id.toString() || Math.random().toString(36).substr(2, 9)
                }))
                setDetections(loaded)
            } catch (e) {
                console.error(e)
            } finally {
                setLoadingDetections(false)
            }
        }
        load()
    }, [post])

    const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
        const { naturalWidth, naturalHeight } = e.currentTarget
        setImageDimensions({ width: naturalWidth, height: naturalHeight })
    }

    // Auto Detect
    const handleRunDetection = async () => {
        if (!imageRef.current) return
        setRunningModel(true)
        try {
            const results = await detectLogos(imageRef.current, 0.4) // 0.4 threshold
            
            // Merge results: add new ones
            const newDetections = results.map(d => ({
                id: Math.random().toString(36).substr(2, 9),
                label: d.label,
                confidence: d.confidence,
                box: d.box // box is already in pixels relative to natural size
            }))

            setDetections(prev => [...prev, ...newDetections])
        } catch (e) {
            console.error("Model failed", e)
            alert("Model execution failed. Check console.")
        } finally {
            setRunningModel(false)
        }
    }

    // Save
    const handleSave = async () => {
        setSaving(true)
        try {
             await fetch("/api/new/logo-detection/detections", {
                 method: "POST",
                 body: JSON.stringify({
                     postId: post.id,
                     detections: detections
                 })
             })
             alert("Saved!")
             onUpdate()
        } catch (e) {
            console.error(e)
            alert("Failed to save")
        } finally {
            setSaving(false)
        }
    }

    // Drawing Logic
    const getRelativeCoords = (e: React.MouseEvent) => {
        if (!imageRef.current || !imageDimensions) return null
        const rect = imageRef.current.getBoundingClientRect()
        
        // Calculate scale factor between displayed image and natural image
        const scaleX = imageDimensions.width / rect.width
        const scaleY = imageDimensions.height / rect.height

        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        }
    }

    const handleMouseDown = (e: React.MouseEvent) => {
        // Only allow drawing if clicking on image/overlay, not buttons
        if ((e.target as HTMLElement).closest('button')) return;
        
        const coords = getRelativeCoords(e)
        if (!coords) return

        setSelectedBoxId(null)
        setDrawingBox({
            startX: coords.x,
            startY: coords.y,
            currentX: coords.x,
            currentY: coords.y
        })
    }

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!drawingBox) return
        const coords = getRelativeCoords(e)
        if (!coords) return
        
        setDrawingBox(prev => prev ? ({ ...prev, currentX: coords.x, currentY: coords.y }) : null)
    }

    const handleMouseUp = () => {
        if (!drawingBox || !imageDimensions) return;
        
        const x = Math.min(drawingBox.startX, drawingBox.currentX)
        const y = Math.min(drawingBox.startY, drawingBox.currentY)
        const width = Math.abs(drawingBox.currentX - drawingBox.startX)
        const height = Math.abs(drawingBox.currentY - drawingBox.startY)
        
        setDrawingBox(null)

        if (width < 10 || height < 10) return // Ignore tiny boxes

        // Create new detection
        const newDet: EditorDetection = {
            id: Math.random().toString(36).substr(2, 9),
            label: "unknown",
            confidence: 1.0,
            box: { x, y, width, height }
        }
        
        setDetections(prev => [...prev, newDet])
        setSelectedBoxId(newDet.id)
    }

    const updateLabel = (id: string, label: string) => {
        setDetections(prev => prev.map(d => d.id === id ? { ...d, label } : d))
    }

    const deleteDetection = (id: string) => {
        setDetections(prev => prev.filter(d => d.id !== id))
        if (selectedBoxId === id) setSelectedBoxId(null)
    }

    return (
        <div className="flex flex-col h-full">
            {/* Toolbar */}
            <div className="p-4 border-b flex items-center justify-between bg-card z-10">
                <div className="flex items-center gap-2">
                    <h2 className="font-semibold">{post.url || post.shortcode}</h2>
                    <span className="text-muted-foreground text-sm">
                        {imageDimensions ? `${imageDimensions.width}x${imageDimensions.height}px` : "Loading..."}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleRunDetection} disabled={runningModel || !imageDimensions}>
                        {runningModel ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                         AI Detect
                    </Button>
                    <Button size="sm" onClick={handleSave} disabled={saving}>
                        {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                        Save Changes
                    </Button>
                </div>
            </div>

            {/* Editor Area */}
            <div className="flex-1 flex overflow-hidden">
                {/* Image Canvas */}
                <div className="flex-1 bg-zinc-900/5 dark:bg-zinc-900/50 p-8 overflow-auto flex items-center justify-center relative select-none">
                     <div 
                        className="relative shadow-lg inline-block"
                        ref={containerRef}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                     >
                        <img 
                            ref={imageRef}
                            src={imageUrl} 
                            onLoad={handleImageLoad}
                            draggable={false}
                            className="max-h-[80vh] max-w-full block"
                            alt="To annotate"
                            crossOrigin="anonymous" 
                        />
                        
                        {/* Render Detections */}
                        {imageDimensions && detections.map(det => {
                            const style = {
                                left: `${(det.box.x / imageDimensions.width) * 100}%`,
                                top: `${(det.box.y / imageDimensions.height) * 100}%`,
                                width: `${(det.box.width / imageDimensions.width) * 100}%`,
                                height: `${(det.box.height / imageDimensions.height) * 100}%`
                            }
                            return (
                                <div
                                    key={det.id}
                                    style={style}
                                    className={cn(
                                        "absolute border-2 transition-colors cursor-pointer group",
                                        selectedBoxId === det.id 
                                          ? "border-primary bg-primary/20 z-20" 
                                          : "border-yellow-400 bg-yellow-400/10 hover:border-yellow-300 z-10"
                                    )}
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        setSelectedBoxId(det.id)
                                    }}
                                >
                                    <span className="absolute -top-6 left-0 bg-black/75 text-white text-xs px-1.5 py-0.5 rounded whitespace-nowrap">
                                        {det.label} {Math.round(det.confidence * 100)}%
                                    </span>
                                </div>
                            )
                        })}

                        {/* Drawing Box */}
                        {drawingBox && imageDimensions && (
                            <div 
                                className="absolute border-2 border-primary bg-primary/10 z-30"
                                style={{
                                    left: `${(Math.min(drawingBox.startX, drawingBox.currentX) / imageDimensions.width) * 100}%`,
                                    top: `${(Math.min(drawingBox.startY, drawingBox.currentY) / imageDimensions.height) * 100}%`,
                                    width: `${(Math.abs(drawingBox.currentX - drawingBox.startX) / imageDimensions.width) * 100}%`,
                                    height: `${(Math.abs(drawingBox.currentY - drawingBox.startY) / imageDimensions.height) * 100}%`,
                                }}
                            />
                        )}
                     </div>
                </div>

                {/* Right Panel: Labels List */}
                <div className="w-72 bg-card border-l flex flex-col">
                    <div className="p-4 font-semibold border-b">Detections ({detections.length})</div>
                    <ScrollArea className="flex-1 p-4">
                        <div className="space-y-3">
                            {detections.map(det => (
                                <div 
                                    key={det.id} 
                                    className={cn(
                                        "p-3 rounded-md border text-sm space-y-2",
                                        selectedBoxId === det.id ? "bg-accent border-primary" : "bg-background"
                                    )}
                                    onClick={() => setSelectedBoxId(det.id)}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="font-medium">
                                            {selectedBoxId === det.id ? (
                                                <Input 
                                                    value={det.label} 
                                                    onChange={e => updateLabel(det.id, e.target.value)}
                                                    className="h-7 text-xs"
                                                    autoFocus
                                                />
                                            ) : (
                                                <span className="capitalize">{det.label}</span>
                                            )}
                                        </div>
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="h-6 w-6 text-destructive hover:text-destructive"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                deleteDetection(det.id)
                                            }}
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </Button>
                                    </div>
                                    <div className="text-xs text-muted-foreground flex justify-between">
                                        <span>Conf: {(det.confidence * 100).toFixed(0)}%</span>
                                        <span>{Math.round(det.box.width)}x{Math.round(det.box.height)}px</span>
                                    </div>
                                </div>
                            ))}
                            
                            {detections.length === 0 && (
                                <div className="text-center text-muted-foreground text-sm py-8">
                                    No detections yet. Draw a box on the image or use AI Detect.
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </div>
            </div>
        </div>
    )
}
