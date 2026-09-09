import { ChartColumnBig } from "lucide-react";

import { Card } from "@/components/ui/card";
import {
  getDailyVolume,
  getHitsByServer,
  getHitsByTool,
  getLatencyByTool,
  getOverviewStats,
  listEvents,
} from "@/lib/events";
import EventCharts from "./components/event_charts";
import EventsTable from "./components/events_table";

export const dynamic = "force-dynamic";

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from, to } = await searchParams;
  const range = { from, to };

  const events = listEvents(range);
  const overview = getOverviewStats(range);
  const hitsByTool = getHitsByTool(range);
  const hitsByServer = getHitsByServer(range);
  const dailyVolume = getDailyVolume(range);
  const latencyByTool = getLatencyByTool(range);

  return (
    <div className="mx-auto flex w-[80%] flex-col gap-6">
      <div className="flex flex-row gap-2 items-center">
        <ChartColumnBig className="size-9" />
        <h1 className="text-4xl font-semibold tracking-tight m-0">Metrics</h1>
      </div>

      <EventCharts
        overview={overview}
        hitsByTool={hitsByTool}
        hitsByServer={hitsByServer}
        dailyVolume={dailyVolume}
        latencyByTool={latencyByTool}
      />

      <Card className="p-4">
        <EventsTable events={events} dateRange={{ from, to }} />
      </Card>
    </div>
  );
}
