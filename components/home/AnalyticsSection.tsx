import { AnalyticsView } from "@/components/home/AnalyticsView";
import { getAnalytics } from "@/lib/dune";

export async function AnalyticsSection() {
  const [robinhood, arbitrum] = await Promise.all([getAnalytics("robinhood"), getAnalytics("arbitrum")]);
  return <AnalyticsView chains={{ robinhood, arbitrum }} />;
}
