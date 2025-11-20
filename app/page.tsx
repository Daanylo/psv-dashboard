import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import PlatformDistributionChart from "@/components/homepage/platform-distribution-chart"
import SentimentGauge from "@/components/homepage/sentiment-gauge"
import PlayerSentimentChart from "@/components/homepage/player-sentiment-chart"
import HashtagPerformanceChart from "@/components/homepage/hashtag-performance-chart"
import PlayerMentionsOverview from "@/components/homepage/player-mentions-overview"
import PlayerSentimentMarketValue from "@/components/homepage/Sentimen-market-value-chart"
import SentimentJourneyChart from "@/components/homepage/sentiment-journey-chart"
import BrandExposureOverview from "@/components/homepage/brand-exposure-overview"

export default function Home() {
  return (
    <div className="flex flex-1 px-6 py-8">
      <div className="w-full max-w-screen-2xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Fan Sentiment Gauge</CardTitle>
            </CardHeader>
            <CardContent>
                <SentimentGauge />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Top Players This Week Around Social Media</CardTitle>
            </CardHeader>
            <CardContent>
                <PlayerMentionsOverview />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Sentiment vs Market Value</CardTitle>
            </CardHeader>

            <CardContent>
              <PlayerSentimentMarketValue />
            </CardContent>
          </Card>
        </div>
        <div>
          <div className="mb-4">Sentiment Journey</div>
          <Card className="w-full mb-8">
            <CardHeader>
              <CardTitle>How it's Changing</CardTitle>
              <CardDescription>Average positive sentiment over 14 days</CardDescription>
            </CardHeader>
            <CardContent>
              <SentimentJourneyChart />
            </CardContent>
          </Card>
        </div>
        <div>
          <div className="mb-4">Quick Metrics</div>
          <div className="grid grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Player Sentiment Snapshot</CardTitle>
                <CardDescription>Distribution of fan tone per player</CardDescription>
              </CardHeader>
              <CardContent>
                <PlayerSentimentChart />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Top Performing Hashtags</CardTitle>
                <CardDescription>Content engagement by hashtag</CardDescription>
              </CardHeader>
              <CardContent>
                <HashtagPerformanceChart />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Where Fans Engage Most</CardTitle>
                <CardDescription>Platform distribution by engagement</CardDescription>
              </CardHeader>
              <CardContent>
                <PlatformDistributionChart />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Brand Exposure This Week</CardTitle>
                <CardDescription>Sponsor visibility in fan content</CardDescription>
              </CardHeader>
              <CardContent>
                <BrandExposureOverview />
              </CardContent>
            </Card>
          </div>
        </div>
        <div className="mt-8">
          <div className="mb-4">Recommended Action Based on Data</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card />
            <Card />
            <Card />
          </div>
        </div>
      </div>
    </div>
  );
}
