"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { ArrowUp, ArrowDown, Minus, Smile, Frown, DollarSign, User } from "lucide-react";

interface PlayerValue {
  name: string;
  marketValue: number;
  positiveMentions: number;
  negativeMentions: number;
  status: "Undervalued" | "Overvalued" | "Balanced";
}

export default function SentimentVsMarketValue() {
  const [players, setPlayers] = useState<PlayerValue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/player-value?sentiment=true");
      const data = await res.json();
      setPlayers(data.sentimentVsValue);
      setLoading(false);
    }
    load();
  }, []);

  if (loading)
    return <p className="text-center text-muted-foreground">Loading...</p>;

  const filtered = players.filter(
    p => p.positiveMentions + p.negativeMentions > 0
  );

  const withNet = filtered.map(p => ({
    ...p,
    net: p.positiveMentions - p.negativeMentions
  }));

  // SAME PICKING LOGIC
  const mostUndervalued = [...withNet]
    .sort((a, b) => (b.net !== a.net ? b.net - a.net : a.marketValue - b.marketValue))[0];

  const mostOvervalued = [...withNet]
    .sort((a, b) => (a.net !== b.net ? a.net - b.net : b.marketValue - a.marketValue))[0];

  // HARD-CODE DISPLAY ORDER + custom status
  const display = [
    { ...mostUndervalued, forcedStatus: "Undervalued", forcedMood: "normal" },
    { ...mostOvervalued, forcedStatus: "Overvalued", forcedMood: "sad" }
  ];

  return (
    <div className="space-y-2">
      {display.map((p, i) => {
        const net = p.net;

        // NORMAL SENTIMENT ICONS FOR TOP CARD
        const hasPos = net > 0;
        const hasNeg = net < 0;

        // BOTTOM CARD ALWAYS SAD + DOWN ARROW
        const forceSad = p.forcedMood === "sad";

        // LABEL ALWAYS BASED ON forcedStatus
        const shownStatus = p.forcedStatus;

        return (
          <Card
            key={i}
            className="min-h-[88px] bg-[#f7f7f7] p-4 rounded-xl border border-gray-200 shadow-sm"
          >
            <div className="flex items-center justify-between">

              {/* LEFT SIDE */}
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center">
                  <User className="text-white" size={20} />
                </div>


                <div className="flex flex-col">
                    <span className="font-semibold">{p.name}</span>

                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      {forceSad ? (
                        <Frown size={16} className="text-gray-600" />
                      ) : hasPos ? (
                        <Smile size={16} className="text-gray-600" />
                      ) : hasNeg ? (
                        <Frown size={16} className="text-gray-600" />
                      ) : (
                        <Minus size={14} className="text-gray-600" />
                      )}

                      <span>
                        Mentions: <strong>{net}</strong>
                      </span>
                    </div>
                  </div>
                </div>

                {/* RIGHT SIDE LABEL */}
                <div className="flex flex-col items-end">
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      shownStatus === "Undervalued"
                        ? "bg-orange-200 text-orange-800"
                        : "bg-red-200 text-red-800"
                    }`}
                  >
                    {shownStatus}
                  </span>

                  <div className="mt-1 flex items-center gap-1 text-sm font-medium">
                    <DollarSign size={16} className="text-gray-700" />
                    <span>Market Value: €{p.marketValue.toFixed(1)}M</span>
                  </div>
                </div>

              </div>
            </Card>
        );
      })}
    </div>
  );
}
