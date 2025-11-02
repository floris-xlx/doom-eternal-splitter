"use client";
import { useEffect, useMemo, useState } from "react";
import {
  Map as MapIcon,
  BarChart3,
  Timer as TimerIcon,
  Activity as ActivityIcon,
  TrendingUp as TrendingUpIcon,
  Link2 as LinkIcon,
  Clock3 as ClockIcon,
  Images as ImagesIcon,
  Zap,
  Target,
  Gauge,
  PieChart,
  LineChart,
} from "lucide-react";
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ReTooltip,
  Legend as ReLegend,
  LineChart as ReLineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  ReferenceLine,
  PieChart as RePieChart,
  Pie,
  Cell,
  ComposedChart,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Match = {
  template: string;
  percentage: number;
  coordinates: { x: number; y: number };
  time: string;
  livesplit_current_time?: string | null;
  run_id?: number;
  marker?: string | null;
};

const palette = [
  "#60a5fa",
  "#f472b6",
  "#34d399",
  "#f59e0b",
  "#a78bfa",
  "#fb7185",
  "#22d3ee",
  "#f97316",
];

function parseLiveSplitSeconds(v?: string | null): number | null {
  if (!v) return null;
  const m = v.trim().match(/^(\d{2}):(\d{2}):(\d{2})(?:[\.,](\d+))?$/);
  if (!m) return null;
  const hh = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  const ss = parseInt(m[3], 10);
  const frac = m[4] ? parseFloat("0." + m[4]) : 0;
  return hh * 3600 + mm * 60 + ss + frac;
}

function secondsToLabel(s: number): string {
  const hh = Math.floor(s / 3600)
    .toString()
    .padStart(2, "0");
  const mm = Math.floor((s % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const ss = Math.floor(s % 60)
    .toString()
    .padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function lerpColor(
  a: [number, number, number],
  b: [number, number, number],
  t: number
): string {
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bch = Math.round(a[2] + (b[2] - a[2]) * t);
  return `rgb(${r}, ${g}, ${bch})`;
}

const CustomTooltip = ({ active, payload, labelFormatter }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-sm border bg-card p-3 text-sm shadow-none">
      {labelFormatter && <div className="mb-2 font-medium">{labelFormatter(payload[0].payload)}</div>}
      {payload.map((entry: any, idx: number) => (
        <div key={idx} className="flex items-center gap-2" style={{ color: entry.color }}>
          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span>{entry.name}:</span>
          <span className="font-medium">{typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function HomePage() {
  const [data, setData] = useState<Match[]>([]);
  const [shots, setShots] = useState<{ name: string; size: number; mtime: number }[]>([]);

  useEffect(() => {
    fetch("/api/data")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData([]));
  }, []);

  useEffect(() => {
    fetch("/api/screenshots")
      .then((r) => r.json())
      .then((list) => Array.isArray(list) ? setShots(list) : setShots([]))
      .catch(() => setShots([]));
  }, []);

  const templates = useMemo(
    () => Array.from(new Set(data.map((d) => d.template))),
    [data]
  );

  const enriched = useMemo(() => {
    return data.map((d) => ({
      ...d,
      livesplitSeconds: parseLiveSplitSeconds(d.livesplit_current_time),
      date: new Date(d.time),
      runId: typeof d.run_id === "number" ? d.run_id : null,
    }));
  }, [data]);

  const liveMinMax = useMemo(() => {
    const vals = enriched
      .map((d) => d.livesplitSeconds)
      .filter((v): v is number => typeof v === "number");
    if (!vals.length) return { min: 0, max: 1 };
    return { min: Math.min(...vals), max: Math.max(...vals) };
  }, [enriched]);

  const heatmapPoints = useMemo(() => {
    const span = Math.max(1e-6, liveMinMax.max - liveMinMax.min);
    return enriched
      .filter((d) => typeof d.livesplitSeconds === "number")
      .map((d) => {
        const t = ((d.livesplitSeconds as number) - liveMinMax.min) / span;
        const color = lerpColor([59, 130, 246], [239, 68, 68], t);
        return {
          x: d.coordinates.x,
          y: d.coordinates.y,
          color,
          pct: d.percentage,
          live: d.livesplitSeconds as number,
        };
      });
  }, [enriched, liveMinMax]);

  const byTemplate = useMemo(() => {
    const m = new Map<string, { live: number; pct: number }[]>();
    templates.forEach((tpl) => m.set(tpl, []));
    for (const d of enriched) {
      if (typeof d.livesplitSeconds !== "number") continue;
      const arr = m.get(d.template)!;
      arr.push({ live: d.livesplitSeconds, pct: d.percentage });
    }
    for (const arr of m.values()) arr.sort((a, b) => a.live - b.live);
    return m;
  }, [enriched, templates]);

  const perRtMinute = useMemo(() => {
    const b: Record<string, number> = {};
    for (const d of enriched) {
      const key = `${d.date.getHours().toString().padStart(2, "0")}:${d.date
        .getMinutes()
        .toString()
        .padStart(2, "0")}`;
      b[key] = (b[key] || 0) + 1;
    }
    return Object.entries(b)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => ({ minute: k, count: v }));
  }, [enriched]);

  const perLiveMinute = useMemo(() => {
    const b = new Map<number, number>();
    for (const d of enriched) {
      if (typeof d.livesplitSeconds !== "number") continue;
      const key = Math.floor(d.livesplitSeconds / 60);
      b.set(key, (b.get(key) || 0) + 1);
    }
    return Array.from(b.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([m, c]) => ({
        minute: m,
        count: c,
        label: secondsToLabel(m * 60),
      }));
  }, [enriched]);

  const cumulativeLive = useMemo(() => {
    const pts = enriched
      .filter((d) => typeof d.livesplitSeconds === "number")
      .sort(
        (a, b) =>
          (a.livesplitSeconds as number) - (b.livesplitSeconds as number)
      );
    let acc = 0;
    return pts.map((d) => ({ live: d.livesplitSeconds as number, cum: ++acc }));
  }, [enriched]);

  const intervals = useMemo(() => {
    const byRun = new Map<number, number[]>();
    for (const d of enriched) {
      if (typeof d.livesplitSeconds !== "number") continue;
      const id = d.runId ?? -1;
      const arr = byRun.get(id) ?? [];
      arr.push(d.livesplitSeconds);
      byRun.set(id, arr);
    }
    const diffs: number[] = [];
    for (const arr of byRun.values()) {
      if (arr.length < 2) continue;
      arr.sort((a, b) => a - b);
      for (let i = 1; i < arr.length; i++) {
        const delta = arr[i] - arr[i - 1];
        if (Number.isFinite(delta) && delta > 0) diffs.push(delta);
      }
    }
    return diffs;
  }, [enriched]);

  const avgInterval = useMemo(() => {
    if (!intervals.length) return null as number | null;
    const sum = intervals.reduce((a, b) => a + b, 0);
    return sum / intervals.length;
  }, [intervals]);

  const templateDistribution = useMemo(() => {
    const counts = new Map<string, number>();
    templates.forEach((tpl) => counts.set(tpl, 0));
    for (const d of enriched) {
      counts.set(d.template, (counts.get(d.template) || 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [enriched, templates]);

  const percentageDistribution = useMemo(() => {
    const buckets = [0, 50, 60, 70, 80, 90, 95, 100];
    const counts = new Map<number, number>();
    buckets.forEach((b) => counts.set(b, 0));
    for (const d of enriched) {
      const bucket = buckets.find((b, i) => d.percentage < buckets[i + 1] || i === buckets.length - 1) || 0;
      counts.set(bucket, (counts.get(bucket) || 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([range, count]) => ({
        range: `${range}-${buckets[buckets.indexOf(range) + 1] || 100}%`,
        count,
      }))
      .filter((d) => d.count > 0);
  }, [enriched]);

  const markerStats = useMemo(() => {
    const markerCounts = new Map<string, number>();
    for (const d of enriched) {
      if (d.marker) {
        markerCounts.set(d.marker, (markerCounts.get(d.marker) || 0) + 1);
      }
    }
    return Array.from(markerCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [enriched]);

  const runStats = useMemo(() => {
    const runs = new Map<number, { count: number; start: number; end: number }>();
    for (const d of enriched) {
      if (typeof d.livesplitSeconds !== "number") continue;
      const id = d.runId ?? -1;
      const existing = runs.get(id) || { count: 0, start: Infinity, end: -Infinity };
      existing.count++;
      existing.start = Math.min(existing.start, d.livesplitSeconds);
      existing.end = Math.max(existing.end, d.livesplitSeconds);
      runs.set(id, existing);
    }
    return Array.from(runs.values())
      .map((r) => ({
        ...r,
        duration: r.end - r.start,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [enriched]);

  const hourlyDistribution = useMemo(() => {
    const hours = new Map<number, number>();
    for (let i = 0; i < 24; i++) hours.set(i, 0);
    for (const d of enriched) {
      const hour = d.date.getHours();
      hours.set(hour, (hours.get(hour) || 0) + 1);
    }
    return Array.from(hours.entries())
      .map(([hour, count]) => ({
        hour: `${hour.toString().padStart(2, "0")}:00`,
        count,
      }));
  }, [enriched]);

  const detectionRate = useMemo(() => {
    if (!enriched.length) return [];
    const sorted = [...enriched].sort((a, b) => a.date.getTime() - b.date.getTime());
    const windowSize = Math.max(1, Math.floor(sorted.length / 50));
    const result: { time: string; rate: number }[] = [];
    for (let i = 0; i < sorted.length; i += windowSize) {
      const window = sorted.slice(i, Math.min(i + windowSize, sorted.length));
      if (window.length < 2) continue;
      const duration = (window[window.length - 1].date.getTime() - window[0].date.getTime()) / 1000;
      const rate = duration > 0 ? window.length / duration : 0;
      result.push({
        time: window[0].date.toLocaleTimeString(),
        rate: rate * 60,
      });
    }
    return result;
  }, [enriched]);

  const [liveConnected, setLiveConnected] = useState<boolean | null>(null);
  useEffect(() => {
    let active = true;
    const tick = async () => {
      try {
        const res = await fetch("/api/livesplit", { cache: "no-store" });
        const j = await res.json();
        if (!active) return;
        setLiveConnected(!!j?.connected);
      } catch {
        if (!active) return;
        setLiveConnected(false);
      }
    };
    tick();
    const id = setInterval(tick, 3000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  const stats = useMemo(() => {
    const withLive = enriched.filter((d) => typeof d.livesplitSeconds === "number");
    return {
      total: enriched.length,
      withLiveSplit: withLive.length,
      templates: templates.length,
      runs: new Set(enriched.map((d) => d.runId).filter((id): id is number => id !== null)).size,
      avgPercentage: enriched.reduce((sum, d) => sum + d.percentage, 0) / enriched.length || 0,
    };
  }, [enriched, templates]);

  return (
    <main className="p-6 space-y-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-primary">Speedrun Analytics</h1>
          <div className="flex items-center gap-3">
            <Badge variant={liveConnected ? "default" : "secondary"} className="gap-2">
              <LinkIcon className="w-3 h-3" />
              {liveConnected === null
                ? "LiveSplit: Unknown"
                : liveConnected
                ? "Connected"
                : "Disconnected"}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Total Detections</CardDescription>
              <CardTitle className="text-2xl">{stats.total.toLocaleString()}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>With LiveSplit</CardDescription>
              <CardTitle className="text-2xl">{stats.withLiveSplit.toLocaleString()}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Templates</CardDescription>
              <CardTitle className="text-2xl">{stats.templates}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Avg Interval</CardDescription>
              <CardTitle className="text-2xl">
                {avgInterval == null ? "n/a" : secondsToLabel(avgInterval)}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="charts">Charts</TabsTrigger>
          <TabsTrigger value="analysis">Analysis</TabsTrigger>
          <TabsTrigger value="screenshots">Screenshots</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapIcon className="w-5 h-5" />
                  Coordinate Heatmap
                </CardTitle>
                <CardDescription>Detections colored by LiveSplit time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <ScatterChart margin={{ top: 8, right: 16, bottom: 16, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      type="number"
                      dataKey="x"
                      tick={{ fill: "hsl(var(--muted-foreground))" }}
                      stroke="hsl(var(--border))"
                    />
                    <YAxis
                      type="number"
                      dataKey="y"
                      tick={{ fill: "hsl(var(--muted-foreground))" }}
                      stroke="hsl(var(--border))"
                    />
                    <ReTooltip
                      cursor={{ strokeDasharray: "3 3" }}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null as any;
                        const p = payload[0].payload as any;
                        return (
                          <div className="rounded-sm border bg-card p-3 text-sm shadow-none">
                            <div className="font-medium">X: {p.x}, Y: {p.y}</div>
                            <div>LiveSplit: {secondsToLabel(p.live)}</div>
                            <div>Match: {p.pct.toFixed(2)}%</div>
                          </div>
                        ) as any;
                      }}
                    />
                    <Scatter
                      name="detections"
                      data={heatmapPoints}
                      shape={(props: any) => {
                        const { cx, cy, payload } = props;
                        return <circle cx={cx} cy={cy} r={3} fill={payload.color} />;
                      }}
                    />
                  </ScatterChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="w-5 h-5" />
                  Template Distribution
                </CardTitle>
                <CardDescription>Detection count by template</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <RePieChart>
                    <ReTooltip content={<CustomTooltip />} />
                    <Pie
                      data={templateDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {templateDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={palette[index % palette.length]} />
                      ))}
                    </Pie>
                  </RePieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="charts" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ActivityIcon className="w-5 h-5" />
                  Percentage vs LiveSplit Time
                </CardTitle>
                <CardDescription>Match percentage over run time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <ReLineChart margin={{ top: 8, right: 16, bottom: 16, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      type="number"
                      dataKey="live"
                      tickFormatter={secondsToLabel}
                      tick={{ fill: "hsl(var(--muted-foreground))" }}
                      stroke="hsl(var(--border))"
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fill: "hsl(var(--muted-foreground))" }}
                      stroke="hsl(var(--border))"
                    />
                    <ReTooltip
                      labelFormatter={(l) => secondsToLabel(Number(l))}
                      content={<CustomTooltip labelFormatter={(p: any) => secondsToLabel(p.live)} />}
                    />
                    <ReLegend />
                    {[...byTemplate.entries()].map(([tpl, arr], i) => (
                      <Line
                        key={tpl}
                        type="monotone"
                        dataKey="pct"
                        name={tpl}
                        data={arr}
                        stroke={palette[i % palette.length]}
                        dot={false}
                        strokeWidth={2}
                      />
                    ))}
                    <ReferenceLine y={100} stroke="hsl(var(--brand))" strokeDasharray="4 4" />
                  </ReLineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUpIcon className="w-5 h-5" />
                  Cumulative Detections
                </CardTitle>
                <CardDescription>Total detections over LiveSplit time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart
                    data={cumulativeLive}
                    margin={{ top: 8, right: 16, bottom: 16, left: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="live"
                      tickFormatter={secondsToLabel}
                      tick={{ fill: "hsl(var(--muted-foreground))" }}
                      stroke="hsl(var(--border))"
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fill: "hsl(var(--muted-foreground))" }}
                      stroke="hsl(var(--border))"
                    />
                    <ReTooltip
                      labelFormatter={(l) => secondsToLabel(Number(l))}
                      content={<CustomTooltip labelFormatter={(p: any) => secondsToLabel(p.live)} />}
                    />
                    <Area
                      type="monotone"
                      dataKey="cum"
                      stroke="hsl(var(--brand))"
                      fill="hsl(var(--brand))"
                      fillOpacity={0.2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Detections per Real-Time Minute
                </CardTitle>
                <CardDescription>Detection frequency by time of day</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={perRtMinute}
                    margin={{ top: 8, right: 16, bottom: 16, left: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="minute"
                      tick={{ fill: "hsl(var(--muted-foreground))" }}
                      angle={-30}
                      height={50}
                      textAnchor="end"
                      stroke="hsl(var(--border))"
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fill: "hsl(var(--muted-foreground))" }}
                      stroke="hsl(var(--border))"
                    />
                    <ReTooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" fill="hsl(var(--brand))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TimerIcon className="w-5 h-5" />
                  Detections per LiveSplit Minute
                </CardTitle>
                <CardDescription>Detection frequency during runs</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={perLiveMinute}
                    margin={{ top: 8, right: 16, bottom: 16, left: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: "hsl(var(--muted-foreground))" }}
                      angle={-30}
                      height={50}
                      textAnchor="end"
                      stroke="hsl(var(--border))"
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fill: "hsl(var(--muted-foreground))" }}
                      stroke="hsl(var(--border))"
                    />
                    <ReTooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" fill="hsl(var(--brand))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gauge className="w-5 h-5" />
                  Percentage Distribution
                </CardTitle>
                <CardDescription>Distribution of match percentages</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={percentageDistribution}
                    margin={{ top: 8, right: 16, bottom: 16, left: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="range"
                      tick={{ fill: "hsl(var(--muted-foreground))" }}
                      stroke="hsl(var(--border))"
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fill: "hsl(var(--muted-foreground))" }}
                      stroke="hsl(var(--border))"
                    />
                    <ReTooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" fill="hsl(var(--brand))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClockIcon className="w-5 h-5" />
                  Hourly Distribution
                </CardTitle>
                <CardDescription>Detections by hour of day</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart
                    data={hourlyDistribution}
                    margin={{ top: 8, right: 16, bottom: 16, left: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="hour"
                      tick={{ fill: "hsl(var(--muted-foreground))" }}
                      stroke="hsl(var(--border))"
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fill: "hsl(var(--muted-foreground))" }}
                      stroke="hsl(var(--border))"
                    />
                    <ReTooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" fill="hsl(var(--brand))" radius={[4, 4, 0, 0]} />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5" />
                  Detection Rate Over Time
                </CardTitle>
                <CardDescription>Detections per minute over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart
                    data={detectionRate}
                    margin={{ top: 8, right: 16, bottom: 16, left: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="time"
                      tick={{ fill: "hsl(var(--muted-foreground))" }}
                      stroke="hsl(var(--border))"
                    />
                    <YAxis
                      tick={{ fill: "hsl(var(--muted-foreground))" }}
                      stroke="hsl(var(--border))"
                    />
                    <ReTooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="rate"
                      stroke="hsl(var(--brand))"
                      fill="hsl(var(--brand))"
                      fillOpacity={0.2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="analysis" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  Top Markers
                </CardTitle>
                <CardDescription>Most frequently detected markers</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={markerStats}
                    layout="vertical"
                    margin={{ top: 8, right: 16, bottom: 16, left: 80 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      type="number"
                      tick={{ fill: "hsl(var(--muted-foreground))" }}
                      stroke="hsl(var(--border))"
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fill: "hsl(var(--muted-foreground))" }}
                      stroke="hsl(var(--border))"
                    />
                    <ReTooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" fill="hsl(var(--brand))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LineChart className="w-5 h-5" />
                  Run Statistics
                </CardTitle>
                <CardDescription>Top runs by detection count</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {runStats.map((run, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded-sm bg-muted/50">
                      <div>
                        <div className="font-medium">Run #{idx + 1}</div>
                        <div className="text-sm text-muted-foreground">
                          {run.count} detections • {secondsToLabel(run.duration)}
                        </div>
                      </div>
                      <Badge variant="secondary">{run.count}</Badge>
                    </div>
                  ))}
                  {runStats.length === 0 && (
                    <div className="text-muted-foreground text-center py-8">No run data available</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="screenshots" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImagesIcon className="w-5 h-5" />
                Screenshots Cache
              </CardTitle>
              <CardDescription>Recently captured screenshots</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {shots.map((f) => (
                  <a
                    key={f.name}
                    href={`/api/screenshots/${encodeURIComponent(f.name)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="group rounded-sm border bg-card focus:outline-none focus:ring-2 focus:ring-ring hover:bg-accent transition-colors"
                  >
                    <div className="aspect-video w-full overflow-hidden rounded-t-sm bg-muted">
                      <img
                        src={`/api/screenshots/${encodeURIComponent(f.name)}`}
                        alt={f.name}
                        className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform"
                        loading="lazy"
                      />
                    </div>
                    <div className="px-2 py-1.5 text-xs truncate text-muted-foreground">
                      {f.name}
                    </div>
                  </a>
                ))}
                {!shots.length && (
                  <div className="col-span-full text-center text-muted-foreground py-8">
                    No screenshots found.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </main>
  );
}
