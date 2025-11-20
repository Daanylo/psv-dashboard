'use client';

import { useEffect, useState } from 'react';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';

interface BrandExposureItem {
  logo_label: string;
  post: {
    id: number;
    url: string;
    caption: string | null;
    taken_at: string;
  };
  current_week_count: number;
  previous_week_count: number;
  percentage_change: number;
}

export default function BrandExposureOverview() {
  const [data, setData] = useState<BrandExposureItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [overallVisibility, setOverallVisibility] = useState<{
    current: number;
    previous: number;
    change: number;
  } | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch('/api/brand-exposure');
        if (!response.ok) {
          throw new Error('Failed to fetch brand exposure data');
        }
        const result = await response.json();
        setData(result.data || []);
        setOverallVisibility({
          current: result.overall_current_week_detections || 0,
          previous: result.overall_previous_week_detections || 0,
          change: result.overall_visibility_change || 0
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const getTrendIcon = (change: number) => {
    if (change > 0) return <ArrowUp className="w-4 h-4 text-green-500" />;
    if (change < 0) return <ArrowDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-zinc-400" />;
  };

  const getTrendColor = (change: number) => {
    if (change > 0) return 'text-green-600 dark:text-green-400';
    if (change < 0) return 'text-red-600 dark:text-red-400';
    return 'text-zinc-500 dark:text-zinc-400';
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Brand Exposure
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 animate-pulse"
            >
              <div className="aspect-square bg-zinc-200 dark:bg-zinc-700 rounded-lg mb-3" />
              <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-24 mb-2" />
              <div className="h-6 bg-zinc-200 dark:bg-zinc-700 rounded w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Brand Exposure
        </h2>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Brand Exposure
        </h2>
        <div className="bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-lg p-8 text-center">
          <p className="text-zinc-500 dark:text-zinc-400">
            No brand exposure data available yet
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {data.map((item, index) => (
          <div
            key={item.logo_label}
            className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden hover:shadow-lg transition-shadow"
          >
            <div className="relative aspect-square bg-zinc-100 dark:bg-zinc-900">
              <img
                src={`/api/proxy-image?url=${encodeURIComponent(item.post.url)}`}
                alt={item.post.caption || 'Instagram post'}
                className="w-full h-full object-cover"
              />
              <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm px-2 py-1 rounded-full">
                <span className="text-white text-xs font-medium">#{index + 1}</span>
              </div>
            </div>

            <div className="p-4 space-y-3">
              <div>
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 capitalize">
                  {item.logo_label.trim()}
                </h3>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-zinc-200 dark:border-zinc-700">
                <div>
                  <div className="flex items-center gap-1">
                    {getTrendIcon(item.percentage_change)}
                    <span className={`text-lg font-bold ${getTrendColor(item.percentage_change)}`}>
                      {item.percentage_change > 0 ? '+' : ''}
                      {item.percentage_change}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {overallVisibility && (
        <div className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                Average visibility increase/decrease
              </h3>
            </div>
            <div className="flex items-center gap-2">
              {getTrendIcon(overallVisibility.change)}
              <span className={`text-2xl font-bold ${getTrendColor(overallVisibility.change)}`}>
                {overallVisibility.change > 0 ? '+' : ''}
                {overallVisibility.change}%
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
