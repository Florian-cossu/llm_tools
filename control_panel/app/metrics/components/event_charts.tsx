"use client";

import type { ReactNode } from "react";
import { Activity, AlertTriangle, CircleCheck, Timer, type LucideIcon } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { useLocale } from "@/hooks/use-locale";
import type { DailyVolume, OverviewStats, ServerCount, ToolCount, ToolLatency } from "@/lib/events";

/**
 * Sequential magnitude hue (blue) for hit-count charts; latency gets the next
 * categorical slot (orange) so it reads as a distinct measure at a glance -
 * both are `docs`-external conventions from the dataviz skill's reference
 * palette, not values this app defines anywhere else.
 */
const BLUE = { light: "#2a78d6", dark: "#3987e5" };
const ORANGE = { light: "#eb6834", dark: "#d95926" };
/** Status colors are fixed and mode-invariant - never themed, never reused for a series. */
const STATUS_GOOD = "#0ca30c";
const STATUS_CRITICAL = "#d03b3b";

function formatDay(day: string, locale: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  return Number.isNaN(date.getTime())
    ? day
    : date.toLocaleDateString(locale, { month: "short", day: "numeric", timeZone: "UTC" });
}

function ChartCard({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card size="sm" className={className}>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function StatTile({ label, value, icon: Icon }: { label: string; value: string; icon: LucideIcon }) {
  return (
    <Card size="sm">
      <CardContent className="gap-1">
        <span className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          <Icon className="size-3.5" />
          {label}
        </span>
        <span className="text-3xl font-semibold">{value}</span>
      </CardContent>
    </Card>
  );
}

function EmptyState({ message }: { message: string }) {
  return <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">{message}</div>;
}

type MagnitudeDatum = { label: string; value: number };

/** A single-series horizontal bar chart for comparing magnitude across categories. */
function MagnitudeBarChart({
  data,
  theme,
  valueFormatter = (value) => value.toLocaleString(),
}: {
  data: MagnitudeDatum[];
  theme: { light: string; dark: string };
  valueFormatter?: (value: number) => string;
}) {
  if (data.length === 0) return <EmptyState message="No data for this range." />;

  const config: ChartConfig = { value: { label: "Value", theme } };
  const height = Math.max(140, data.length * 36 + 24);

  return (
    <ChartContainer config={config} className="w-full" style={{ height, aspectRatio: "auto" }}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 40, bottom: 4, left: 4 }}>
        <CartesianGrid horizontal={false} className="stroke-border" />
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="label"
          tickLine={false}
          axisLine={false}
          width={110}
          tick={{ fontSize: 12 }}
          className="fill-muted-foreground"
        />
        <ChartTooltip
          cursor={{ fill: "var(--muted)" }}
          content={<ChartTooltipContent labelFormatter={(label) => String(label)} />}
        />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20} fill="var(--color-value)">
          <LabelList
            dataKey="value"
            position="right"
            className="fill-foreground text-xs"
            formatter={(value) => valueFormatter(Number(value))}
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

/** A single-series area chart for event volume over time. */
function VolumeChart({ data }: { data: DailyVolume[] }) {
  const locale = useLocale();

  if (data.length === 0) return <EmptyState message="No data for this range." />;

  const config: ChartConfig = { count: { label: "Events", theme: BLUE } };

  return (
    <ChartContainer config={config} className="w-full" style={{ height: 220, aspectRatio: "auto" }}>
      <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} className="stroke-border" />
        <XAxis
          dataKey="day"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(day) => formatDay(day, locale)}
          tick={{ fontSize: 11 }}
          className="fill-muted-foreground"
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={32}
          allowDecimals={false}
          tick={{ fontSize: 11 }}
          className="fill-muted-foreground"
        />
        <ChartTooltip
          cursor={{ stroke: "var(--border)" }}
          content={<ChartTooltipContent labelFormatter={(label) => formatDay(String(label), locale)} />}
        />
        <Area
          dataKey="count"
          type="monotone"
          stroke="var(--color-count)"
          fill="var(--color-count)"
          fillOpacity={0.1}
          strokeWidth={2}
        />
      </AreaChart>
    </ChartContainer>
  );
}

/**
 * Success/error is a state, not a series - it wears the fixed status palette
 * (never the categorical one) and is always paired with an icon + label,
 * per the dataviz skill's color rules.
 */
function SuccessErrorBar({ successCount, errorCount }: { successCount: number; errorCount: number }) {
  const total = successCount + errorCount;
  if (total === 0) return <EmptyState message="No data for this range." />;

  const successPct = Math.round((successCount / total) * 100);
  const errorPct = 100 - successPct;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-6 w-full gap-0.5">
        {successCount > 0 && (
          <div
            className="flex items-center justify-center text-xs font-medium text-white"
            style={{
              width: `${successPct}%`,
              backgroundColor: STATUS_GOOD,
              borderRadius: errorCount > 0 ? "9999px 0 0 9999px" : "9999px",
            }}
          >
            {successPct >= 12 ? `${successPct}%` : null}
          </div>
        )}
        {errorCount > 0 && (
          <div
            className="flex items-center justify-center text-xs font-medium text-white"
            style={{
              width: `${errorPct}%`,
              backgroundColor: STATUS_CRITICAL,
              borderRadius: successCount > 0 ? "0 9999px 9999px 0" : "9999px",
            }}
          >
            {errorPct >= 12 ? `${errorPct}%` : null}
          </div>
        )}
      </div>
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <CircleCheck className="size-3.5" style={{ color: STATUS_GOOD }} />
          Success · {successCount.toLocaleString()}
        </span>
        <span className="flex items-center gap-1.5">
          <AlertTriangle className="size-3.5" style={{ color: STATUS_CRITICAL }} />
          Error · {errorCount.toLocaleString()}
        </span>
      </div>
    </div>
  );
}

export default function EventCharts({
  overview,
  hitsByTool,
  hitsByServer,
  dailyVolume,
  latencyByTool,
}: {
  overview: OverviewStats;
  hitsByTool: ToolCount[];
  hitsByServer: ServerCount[];
  dailyVolume: DailyVolume[];
  latencyByTool: ToolLatency[];
}) {
  const errorCount = overview.total - overview.successCount;
  const successRate = overview.total > 0 ? Math.round((overview.successCount / overview.total) * 100) : null;

  const toolData = hitsByTool.map((t) => ({ label: t.tool_slug, value: t.count }));
  const serverData = hitsByServer.map((s) => ({ label: s.server_name, value: s.count }));
  const latencyData = latencyByTool.map((t) => ({ label: t.tool_slug, value: t.avg_duration_ms }));

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile label="Total events" value={overview.total.toLocaleString()} icon={Activity} />
        <StatTile
          label="Success rate"
          value={successRate !== null ? `${successRate}%` : "—"}
          icon={CircleCheck}
        />
        <StatTile
          label="Avg duration"
          value={overview.avgDurationMs !== null ? `${overview.avgDurationMs} ms` : "—"}
          icon={Timer}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Volume over time" className="lg:col-span-2">
          <VolumeChart data={dailyVolume} />
        </ChartCard>
        <ChartCard title="Hits per tool">
          <MagnitudeBarChart data={toolData} theme={BLUE} />
        </ChartCard>
        <ChartCard title="Hits per server">
          <MagnitudeBarChart data={serverData} theme={BLUE} />
        </ChartCard>
        <ChartCard title="Success vs. error">
          <SuccessErrorBar successCount={overview.successCount} errorCount={errorCount} />
        </ChartCard>
        <ChartCard title="Avg latency per tool (ms)">
          <MagnitudeBarChart data={latencyData} theme={ORANGE} valueFormatter={(v) => `${v}`} />
        </ChartCard>
      </div>
    </div>
  );
}
