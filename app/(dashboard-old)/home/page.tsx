import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import PlatformDistributionChart from "@/components/homepage/platform-distribution-chart"
import SentimentGauge from "@/components/homepage/sentiment-gauge"
import PlayerSentimentChart from "@/components/homepage/player-sentiment-chart"
import HashtagPerformanceChart from "@/components/homepage/hashtag-performance-chart"
import PlayerMentionsOverview from "@/components/homepage/player-mentions-overview"
import PlayerSentimentMarketValue from "@/components/homepage/sentiment-market-value-chart"
import SentimentJourneyChart from "@/components/homepage/sentiment-journey-chart"
import BrandExposureOverview from "@/components/homepage/brand-exposure-overview"
import MostDiscussedTopic from "@/components/homepage/most-discussed-topic"
import BestContentTypeEngagement from "@/components/homepage/best-content-type"

export default function Home() {
  return (
    <div className="flex flex-1 px-6 py-8">
      <div className="w-full max-w-screen-2xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="flex flex-col">
            <CardHeader className="items-center pb-0">
              <CardTitle>Fan Sentiment Gauge</CardTitle>
            </CardHeader>
            <SentimentGauge />
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Player Mentions Overview</CardTitle>
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
                <CardTitle>Brand Exposure This Week</CardTitle>
                <CardDescription>Sponsor visibility in fan content</CardDescription>
              </CardHeader>
              <CardContent>
                <BrandExposureOverview />
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
                <CardTitle>Best Content Type Based on Engagement</CardTitle>
                <CardDescription>Content performance based on fan interactions</CardDescription>
              </CardHeader>
              <CardContent>
                <BestContentTypeEngagement />
              </CardContent>
            </Card>
          </div>
        </div>
        <div className="mt-8">
          <div className="grid grid-cols-2 gap-6">
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
                <CardTitle>The Most Discussed Topics</CardTitle>
                <CardDescription>Topics generating the highest fan discussion</CardDescription>
              </CardHeader>
              <CardContent>
                <MostDiscussedTopic />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
