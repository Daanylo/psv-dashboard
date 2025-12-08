'use client';

import { useState, useRef, useEffect } from 'react';
import { detectLogos, Detection } from '@/lib/onnx-detector';
import { InstagramPost } from '@/lib/types/instagram';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export default function LogoDetection() {
  const [imageUrl, setImageUrl] = useState<string>('');
  const [detections, setDetections] = useState<Detection[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [modelLoading, setModelLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(0.5);
  const [posts, setPosts] = useState<InstagramPost[]>([]);
  const [currentPostIndex, setCurrentPostIndex] = useState<number>(0);
  const [loadingPosts, setLoadingPosts] = useState<boolean>(false);
  const [imageLoaded, setImageLoaded] = useState<boolean>(false);
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    loadPosts();
  }, []);

  useEffect(() => {
    if (posts.length > 0) {
      loadPostImage(currentPostIndex);
    }
  }, [currentPostIndex, posts]);

  const loadPosts = async () => {
    setLoadingPosts(true);
    setError('');
    try {
      const response = await fetch('/api/instagram-posts?limit=100');
      if (!response.ok) throw new Error('Failed to fetch posts');
      const data = await response.json();
      setPosts(data.posts);
      if (data.posts.length > 0) {
        setCurrentPostIndex(0);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load posts');
    } finally {
      setLoadingPosts(false);
    }
  };

  const loadPostImage = async (index: number) => {
    if (posts[index]) {
      const post = posts[index];
      
      setDetections([]);
      setError('');
      setImageLoaded(false);
      
      const instagramUrl = `https://www.instagram.com/p/${post.shortcode}/media/?size=l`;
      const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(instagramUrl)}`;
      setImageUrl(proxyUrl);
      
      try {
        const response = await fetch(`/api/logo-detections/${post.id}`);
        if (response.ok) {
          const data = await response.json();
          if (data.detections && data.detections.length > 0) {
            const loadedDetections = data.detections.map((d: any) => ({
              label: d.logo_label,
              confidence: parseFloat(d.confidence),
              box: {
                x: parseFloat(d.box_x),
                y: parseFloat(d.box_y),
                width: parseFloat(d.box_width),
                height: parseFloat(d.box_height),
              },
            }));
            setDetections(loadedDetections);
          }
        }
      } catch (err) {
        console.error('Failed to load detections:', err);
      }
    }
  };

  const handlePrevPost = () => {
    if (currentPostIndex > 0) {
      setCurrentPostIndex(currentPostIndex - 1);
    }
  };

  const handleNextPost = () => {
    if (currentPostIndex < posts.length - 1) {
      setCurrentPostIndex(currentPostIndex + 1);
    }
  };



  const runDetection = async () => {
    if (!imageRef.current) return;

    setLoading(true);
    setModelLoading(true);
    setError('');
    setDetections([]);

    try {
      const results = await detectLogos(imageRef.current, confidenceThreshold);
      setDetections(results);
      setModelLoading(false);

      if (currentPost) {
        try {
          const response = await fetch('/api/logo-detections', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              postId: currentPost.id,
              detections: results,
              confidenceThreshold,
            }),
          });

          if (!response.ok) {
            console.error('Failed to save detections to database');
          }
        } catch (saveErr) {
          console.error('Error saving detections:', saveErr);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Detection failed');
      setModelLoading(false);
    } finally {
      setLoading(false);
    }
  };



  const currentPost = posts.length > 0 ? posts[currentPostIndex] : null;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 p-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold mb-4 text-zinc-900 dark:text-zinc-50">
          Logo Detection
        </h1>

        <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-lg p-4 mb-4">
          {loadingPosts ? (
            <div className="text-center py-4 text-zinc-500 dark:text-zinc-400 text-sm">
              Loading posts...
            </div>
          ) : posts.length > 0 ? (
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={handlePrevPost}
                disabled={currentPostIndex === 0}
                className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-sm
                         rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors
                         disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                ← Prev
              </button>
              <div className="text-center">
                <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {currentPostIndex + 1} / {posts.length}
                </div>
              </div>
              <button
                onClick={handleNextPost}
                disabled={currentPostIndex === posts.length - 1}
                className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-sm
                         rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors
                         disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                Next →
              </button>
            </div>
          ) : (
            <div className="text-center py-4 text-zinc-500 dark:text-zinc-400 text-sm">
              No posts found in database
            </div>
          )}

          {error && (
            <div className="mt-3 p-3 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 rounded-lg text-sm">
              {error}
            </div>
          )}
        </div>

        {imageUrl && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-lg overflow-hidden">
              <TooltipProvider delayDuration={200}>
                <div className="relative inline-block w-full">
                  <img
                    ref={imageRef}
                    src={imageUrl}
                    alt="Input"
                    crossOrigin={imageUrl.startsWith('/api/') ? undefined : 'anonymous'}
                    onLoad={() => setImageLoaded(true)}
                    onError={() => setError('Failed to load image. Please check the URL or try another image.')}
                    className="w-full h-auto block"
                  />
                  {imageLoaded && imageRef.current && detections.map((det, idx) => {
                    const img = imageRef.current!;
                    if (!img.naturalWidth || !img.clientWidth) return null;
                    
                    const scaleX = img.clientWidth / img.naturalWidth;
                    const scaleY = img.clientHeight / img.naturalHeight;
                    const centerX = (det.box.x + det.box.width / 2) * scaleX;
                    const centerY = (det.box.y + det.box.height / 2) * scaleY;
                    
                    return (
                      <Tooltip key={idx}>
                        <TooltipTrigger asChild>
                          <div
                            className="absolute cursor-pointer z-10"
                            style={{
                              left: `${centerX}px`,
                              top: `${centerY}px`,
                              transform: 'translate(-50%, -50%)',
                            }}
                          >
                            <div className="w-5 h-5 bg-black rounded-full flex items-center justify-center shadow-lg border-2 border-white hover:scale-110 transition-transform">
                              <div className="w-2 h-2 bg-white rounded-full"></div>
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="font-semibold capitalize">{det.label}</p>
                          <p className="text-xs text-muted-foreground">{(det.confidence * 100).toFixed(1)}% confidence</p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </TooltipProvider>
              
              {currentPost && (
                <div className="p-4 border-t border-zinc-200 dark:border-zinc-700">
                  <div className="flex items-center gap-4 mb-3 text-sm">
                    <button className="flex items-center gap-1.5 hover:text-red-600 transition-colors">
                      <span>❤️</span>
                      <span className="font-medium">{currentPost.like_count.toLocaleString()}</span>
                    </button>
                    <button className="flex items-center gap-1.5 hover:text-blue-600 transition-colors">
                      <span>💬</span>
                      <span className="font-medium">{currentPost.comment_count}</span>
                    </button>
                    {currentPost.video_view_count && (
                      <div className="flex items-center gap-1.5">
                        <span>👁️</span>
                        <span className="font-medium">{currentPost.video_view_count.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="text-sm mb-2">
                    <a
                      href={currentPost.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold hover:underline"
                    >
                      @{currentPost.owner_username}
                    </a>
                    {currentPost.owner_is_verified === 1 && (
                      <span className="ml-1 text-blue-500">✓</span>
                    )}
                  </div>
                  
                  {currentPost.caption && (
                    <p className="text-sm text-zinc-700 dark:text-zinc-300 line-clamp-3 mb-2">
                      {currentPost.caption}
                    </p>
                  )}
                  
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    {new Date(currentPost.taken_at).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-lg p-4">
                <div className="mb-3">
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    Confidence: {confidenceThreshold.toFixed(2)}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={confidenceThreshold}
                    onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))}
                    className="w-full"
                  />
                </div>

                <button
                  onClick={runDetection}
                  disabled={loading}
                  className="w-full px-4 py-2.5 bg-green-600 text-white rounded-lg 
                           hover:bg-green-700 transition-colors font-medium text-sm
                           disabled:bg-zinc-400 disabled:cursor-not-allowed"
                >
                  {modelLoading ? 'Loading model...' : loading ? 'Detecting...' : 'Detect Logos'}
                </button>
              </div>

              <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-lg p-4">
                <h3 className="text-sm font-semibold mb-3 text-zinc-900 dark:text-zinc-50">
                  Detections ({detections.length})
                </h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {detections.length === 0 && !loading && (
                    <p className="text-zinc-500 dark:text-zinc-400 text-xs">
                      No detections yet
                    </p>
                  )}
                  {detections.map((det, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-zinc-50 dark:bg-zinc-700 rounded-lg border border-zinc-200 dark:border-zinc-600"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 capitalize">
                          {det.label}
                        </span>
                        <span className="text-xs text-zinc-600 dark:text-zinc-400">
                          {(det.confidence * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        {Math.round(det.box.x)}, {Math.round(det.box.y)} · {Math.round(det.box.width)}×{Math.round(det.box.height)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
