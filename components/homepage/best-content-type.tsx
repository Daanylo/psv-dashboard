"use client";

import { Camera, Video, MessageCircle, Image as ImageIcon } from "lucide-react";

interface ContentType {
  label: string;
  value: number; // percentage
  icon: React.ReactNode;
}

const CONTENT: ContentType[] = [
  { label: "Video", value: 40, icon: <Video className="w-5 h-5" /> },
  { label: "Stories", value: 27, icon: <Camera className="w-5 h-5" /> },
  { label: "Photo", value: 18, icon: <ImageIcon className="w-5 h-5" /> },
  { label: "Text", value: 15, icon: <MessageCircle className="w-5 h-5" /> },
];

export default function BestContentTypeEngagement() {
  return (
    <div className="rounded-xl border-none bg-white p-6 ">
      <div className="flex items-center justify-between">
        <span className="text-sm text-blue-600 cursor-pointer hover:underline ">
        </span>
      </div>


      <div className="mt-6 space-y-6">
        {CONTENT.map((item) => (
          <div key={item.label}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-gray-700">{item.icon}</span>
                <span className="font-medium">{item.label}</span>
              </div>
              <span className="font-semibold">{item.value}%</span>
            </div>

            {/* Progress Bar */}
            <div className="relative h-3 w-full bg-gray-200 rounded-full overflow-hidden">
              <div
                className="absolute left-0 top-0 h-full bg-green-500 rounded-full"
                style={{ width: `${item.value}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
