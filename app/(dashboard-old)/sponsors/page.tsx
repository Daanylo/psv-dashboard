'use client';

import { useState, useEffect, useRef } from 'react';
import { InstagramPost } from '@/lib/types/instagram';
import { RefreshCw, TrendingUp } from 'lucide-react';
import { detectLogos, Detection } from '@/lib/onnx-detector';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts';

interface BrandExposure {
  logo_label: string;
  count: number;
  avg_confidence: number;
}

interface WeeklyData {
  week: string;
  count: number;
  brands: { [key: string]: number };
}

interface BrandStats {
  label: string;
  total: number;
  posts: number;
  avgPerPost: number;
}

export default function SponsorsPage() {
  const [posts, setPosts] = useState<InstagramPost[]>([]);
  const [currentPostIndex, setCurrentPostIndex] = useState(0);
  const [selectedPost, setSelectedPost] = useState<InstagramPost | null>(null);
  const [exposures, setExposures] = useState<BrandExposure[]>([]);
  const [loading, setLoading] = useState(true);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [detecting, setDetecting] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [confidenceThreshold] = useState(0.5);
  const imageRef = useRef<HTMLImageElement>(null);
  const [allDetections, setAllDetections] = useState<any[]>([]);
  const [brandStats, setBrandStats] = useState<BrandStats[]>([]);
  const [weeklyData, setWeeklyData] = useState<WeeklyData[]>([]);

  useEffect(() => {
    loadPosts();
    loadAllDetections();
  }, []);

  useEffect(() => {
    if (posts.length > 0) {
      setSelectedPost(posts[currentPostIndex]);
    }
  }, [currentPostIndex, posts]);

  useEffect(() => {
    if (selectedPost) {
      loadExposures(selectedPost.id);
      loadDetections(selectedPost.id);
      setImageLoaded(false);
    }
  }, [selectedPost]);

  const loadPosts = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/instagram-posts?limit=1000');
      if (!response.ok) throw new Error('Failed to fetch posts');
      const data = await response.json();
      setPosts(data.posts);
      if (data.posts.length > 0) {
        setSelectedPost(data.posts[0]);
      }
    } catch (err) {
      console.error('Failed to load posts:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadAllDetections = async () => {
    try {
      const response = await fetch('/api/logo-detections/bulk?limit=10000');
      if (!response.ok) return;
      const data = await response.json();
      
      if (data.detections) {
        setAllDetections(data.detections);
        
        const postsResponse = await fetch('/api/instagram-posts?limit=1000');
        if (postsResponse.ok) {
          const postsData = await postsResponse.json();
          calculateBrandStats(data.detections, postsData.posts);
        }
        calculateWeeklyData(data.detections);
      }
    } catch (err) {
      console.error('Failed to load all detections:', err);
    }
  };

  const calculateBrandStats = (detections: any[], posts: any[]) => {
    const brandMap: { [key: string]: { total: number; postIds: Set<number> } } = {};
    
    detections.forEach((det) => {
      const label = det.logo_label.toLowerCase().trim();
      if (!brandMap[label]) {
        brandMap[label] = { total: 0, postIds: new Set() };
      }
      brandMap[label].total += 1;
      brandMap[label].postIds.add(det.post_id);
    });

    const stats: BrandStats[] = Object.entries(brandMap).map(([label, data]) => ({
      label,
      total: data.total,
      posts: data.postIds.size,
      avgPerPost: data.total / data.postIds.size,
    })).sort((a, b) => b.total - a.total);

    setBrandStats(stats);
  };

  const calculateWeeklyData = (detections: any[]) => {
    const weekMap: { [key: string]: { count: number; brands: { [key: string]: number } } } = {};
    const allBrands = new Set<string>();
    
    detections.forEach((det) => {
      const date = new Date(det.post_date);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      const weekKey = weekStart.toISOString().split('T')[0];
      
      const label = det.logo_label.toLowerCase().trim();
      allBrands.add(label);
      
      if (!weekMap[weekKey]) {
        weekMap[weekKey] = { count: 0, brands: {} };
      }
      weekMap[weekKey].count += 1;
      weekMap[weekKey].brands[label] = (weekMap[weekKey].brands[label] || 0) + 1;
    });

    const weekly: WeeklyData[] = Object.entries(weekMap)
      .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
      .slice(-12)
      .map(([week, data]) => {
        const brandsData: { [key: string]: number } = {};
        allBrands.forEach(brand => {
          brandsData[brand] = data.brands[brand] || 0;
        });
        
        return {
          week: new Date(week).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          count: data.count,
          brands: brandsData,
        };
      });

    setWeeklyData(weekly);
  };

  const loadDetections = async (postId: number) => {
    try {
      const response = await fetch(`/api/logo-detections/${postId}`);
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
        } else {
          setDetections([]);
        }
      }
    } catch (err) {
      console.error('Failed to load detections:', err);
      setDetections([]);
    }
  };

  const loadExposures = async (postId: number) => {
    try {
      const response = await fetch(`/api/logo-detections/${postId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.detections && data.detections.length > 0) {
          const grouped = data.detections.reduce((acc: any, det: any) => {
            const label = det.logo_label.toLowerCase().trim();
            if (!acc[label]) {
              acc[label] = { logo_label: label, count: 0, total_confidence: 0 };
            }
            acc[label].count += 1;
            acc[label].total_confidence += parseFloat(det.confidence);
            return acc;
          }, {});

          const exposureData: BrandExposure[] = Object.values(grouped).map((item: any) => ({
            logo_label: item.logo_label,
            count: item.count,
            avg_confidence: item.total_confidence / item.count,
          }));

          setExposures(exposureData.sort((a, b) => b.count - a.count));
        } else {
          setExposures([]);
        }
      }
    } catch (err) {
      console.error('Failed to load exposures:', err);
      setExposures([]);
    }
  };

  const runDetection = async () => {
    if (!imageRef.current || !selectedPost) return;

    setDetecting(true);

    try {
      const results = await detectLogos(imageRef.current, confidenceThreshold);
      setDetections(results);

      const response = await fetch('/api/logo-detections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId: selectedPost.id,
          detections: results,
          confidenceThreshold,
        }),
      });

      if (response.ok) {
        await loadExposures(selectedPost.id);
      }
    } catch (err) {
      console.error('Detection failed:', err);
    } finally {
      setDetecting(false);
    }
  };

  const goToPrevPost = () => {
    if (currentPostIndex > 0) {
      setCurrentPostIndex(currentPostIndex - 1);
    }
  };

  const goToNextPost = () => {
    if (currentPostIndex < posts.length - 1) {
      setCurrentPostIndex(currentPostIndex + 1);
    }
  };

  const getImageUrl = (post: InstagramPost, size: 'm' | 'l' = 'm') => {
    const instagramUrl = `https://www.instagram.com/p/${post.shortcode}/media/?size=${size}`;
    return `/api/proxy-image?url=${encodeURIComponent(instagramUrl)}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 p-6 flex items-center justify-center">
        <div className="text-zinc-500 dark:text-zinc-400">Loading sponsors data...</div>
      </div>
    );
  }

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 p-3">
      <div className="max-w-[1800px] mx-auto">
        <div className="mb-3">
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Sponsor Analytics</h1>
        </div>

        <div className="grid gap-4" style={{ gridTemplateColumns: 'auto 1fr' }}>
          <div className="space-y-3">
            <div className="bg-white dark:bg-zinc-800 rounded-lg shadow p-3">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  Post {currentPostIndex + 1} / {posts.length}
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={goToPrevPost}
                    disabled={currentPostIndex === 0}
                    className="px-3 py-1 text-xs bg-zinc-100 dark:bg-zinc-700 rounded hover:bg-zinc-200 dark:hover:bg-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    ← Prev
                  </button>
                  <button
                    onClick={goToNextPost}
                    disabled={currentPostIndex >= posts.length - 1}
                    className="px-3 py-1 text-xs bg-zinc-100 dark:bg-zinc-700 rounded hover:bg-zinc-200 dark:hover:bg-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next →
                  </button>
                </div>
              </div>
            </div>

            {selectedPost && (
              <div className="bg-white dark:bg-zinc-800 rounded-lg shadow overflow-hidden">
                <div className="flex justify-center">
                  <TooltipProvider delayDuration={200}>
                    <div className="relative inline-block">
                      <img
                        ref={imageRef}
                        src={getImageUrl(selectedPost, 'l')}
                        alt={selectedPost.caption || 'Instagram post'}
                        crossOrigin="anonymous"
                        onLoad={() => setImageLoaded(true)}
                        className="h-auto block max-h-[600px]"
                      />
                    {imageLoaded && imageRef.current && detections.map((det, idx) => {
                      const img = imageRef.current!;
                      if (!img.naturalWidth || !img.clientWidth) return null;
                      
                      const scaleX = img.clientWidth / img.naturalWidth;
                      const scaleY = img.clientHeight / img.naturalHeight;
                      const boxX = det.box.x * scaleX;
                      const boxY = det.box.y * scaleY;
                      const boxWidth = det.box.width * scaleX;
                      const boxHeight = det.box.height * scaleY;
                      
                      return (
                        <Tooltip key={idx}>
                          <TooltipTrigger asChild>
                            <div
                              className="absolute cursor-pointer z-10 bg-white/30 hover:bg-black/40 hover:border-black/70 transition-all"
                              style={{
                                left: `${boxX}px`,
                                top: `${boxY}px`,
                                width: `${boxWidth}px`,
                                height: `${boxHeight}px`,
                              }}
                            />
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
                </div>
                
                <div className="p-2 border-t border-zinc-200 dark:border-zinc-700">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3 text-xs">
                      <div className="flex items-center gap-1">
                        <span>❤️</span>
                        <span className="font-medium">{selectedPost.like_count.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span>💬</span>
                        <span className="font-medium">{selectedPost.comment_count}</span>
                      </div>
                    </div>
                    
                    <button
                      onClick={runDetection}
                      disabled={detecting}
                      className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:bg-zinc-400"
                    >
                      <RefreshCw className={`w-3 h-3 ${detecting ? 'animate-spin' : ''}`} />
                      {detecting ? '...' : detections.length > 0 ? 'Update' : 'Detect'}
                    </button>
                  </div>

                  <div className="text-xs mb-1">
                    <a
                      href={selectedPost.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold hover:underline"
                    >
                      @{selectedPost.owner_username}
                    </a>
                    <span className="ml-2 text-zinc-500 dark:text-zinc-400">
                      {new Date(selectedPost.taken_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="bg-white dark:bg-zinc-800 rounded-lg shadow p-3">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-3">Quick Stats</h3>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div>
                  <div className="text-xs text-zinc-600 dark:text-zinc-400 mb-1">Total Brands</div>
                  <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{brandStats.length}</div>
                </div>
                <div>
                  <div className="text-xs text-zinc-600 dark:text-zinc-400 mb-1">Total Appearances</div>
                  <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{allDetections.length}</div>
                </div>
                <div>
                  <div className="text-xs text-zinc-600 dark:text-zinc-400 mb-1">Avg per Post</div>
                  <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                    {posts.length > 0 ? (allDetections.length / posts.length).toFixed(1) : 0}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white dark:bg-zinc-800 rounded-lg shadow p-3">
                <div className="text-xs text-zinc-600 dark:text-zinc-400 mb-1">Top Brand</div>
                <div className="text-lg font-bold text-zinc-900 dark:text-zinc-50 capitalize">
                  {brandStats[0]?.label || '-'}
                </div>
                <div className="text-xs text-zinc-500">{brandStats[0]?.total || 0} appearances</div>
              </div>
              <div className="bg-white dark:bg-zinc-800 rounded-lg shadow p-3">
                <div className="text-xs text-zinc-600 dark:text-zinc-400 mb-1">Most Consistent</div>
                <div className="text-lg font-bold text-zinc-900 dark:text-zinc-50 capitalize">
                  {brandStats.sort((a, b) => b.avgPerPost - a.avgPerPost)[0]?.label || '-'}
                </div>
                <div className="text-xs text-zinc-500">
                  {brandStats.sort((a, b) => b.avgPerPost - a.avgPerPost)[0]?.avgPerPost.toFixed(1) || 0} per post
                </div>
              </div>
              <div className="bg-white dark:bg-zinc-800 rounded-lg shadow p-3">
                <div className="text-xs text-zinc-600 dark:text-zinc-400 mb-1">Weekly Trend</div>
                <div className="flex items-center gap-1">
                  <TrendingUp className="w-4 h-4 text-green-600" />
                  <span className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                    {weeklyData.length > 1 
                      ? ((weeklyData[weeklyData.length - 1].count / weeklyData[weeklyData.length - 2].count - 1) * 100).toFixed(0)
                      : 0}%
                  </span>
                </div>
                <div className="text-xs text-zinc-500">vs last week</div>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-800 rounded-lg shadow p-4">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-3">Weekly Appearances</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="week" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
                  <RechartsTooltip 
                    contentStyle={{ fontSize: '12px', backgroundColor: '#1f2937', border: 'none', borderRadius: '6px' }}
                  />
                  {brandStats.slice(0, 6).map((brand, idx) => (
                    <Line 
                      key={brand.label}
                      type="monotone" 
                      dataKey={`brands.${brand.label}`}
                      name={brand.label}
                      stroke={COLORS[idx % COLORS.length]} 
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white dark:bg-zinc-800 rounded-lg shadow p-4">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-3">Top Brands</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={brandStats.slice(0, 6)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
                  <RechartsTooltip 
                    contentStyle={{ fontSize: '12px', backgroundColor: '#1f2937', border: 'none', borderRadius: '6px' }}
                  />
                  <Bar dataKey="total" fill="#3b82f6">
                    {brandStats.slice(0, 6).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white dark:bg-zinc-800 rounded-lg shadow p-3">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-3">Brand Rankings</h3>
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {brandStats.slice(0, 15).map((brand, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-500 dark:text-zinc-400 font-mono text-xs">
                        #{idx + 1}
                      </span>
                      <span className="font-medium capitalize">{brand.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-600 dark:text-zinc-400">{brand.total}</span>
                      <div 
                        className="h-2 rounded-full bg-blue-500"
                        style={{ width: `${(brand.total / brandStats[0]?.total) * 60}px` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
