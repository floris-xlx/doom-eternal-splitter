"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity as ActivityIcon,
  BarChart3,
  Clock3 as ClockIcon,
  FileText,
  Gauge,
  Images as ImagesIcon,
  LineChart,
  Link2 as LinkIcon,
  Map as MapIcon,
  PieChart,
  PlayCircle,
  Target,
  Timer as TimerIcon,
  TrendingUp as TrendingUpIcon,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend as ReLegend,
  Line,
  LineChart as ReLineChart,
  Pie,
  PieChart as RePieChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDuration, formatNumber } from "@/lib/utils";
import { ImageLightbox } from "@/components/ImageLightbox";

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
  t: number,
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
      {labelFormatter && (
        <div className="mb-2 font-medium">
          {labelFormatter(payload[0].payload)}
        </div>
      )}
      {payload.map((entry: any, idx: number) => (
        <div
          key={idx}
          className="flex items-center gap-2"
          style={{ color: entry.color }}
        >
          <div
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span>{entry.name}:</span>
          <span className="font-medium">
            {typeof entry.value === "number"
              ? entry.value.toFixed(2)
              : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
};

type Run = {
  run_id: number;
  count: number;
  duration: number;
  templates: string[];
  first_timestamp: string;
  last_timestamp: string;
  preview_screenshot?: string;
};

type Segment = {
  segment_index: number;
  from_marker: string;
  to_marker: string;
  duration: number;
  from_time: number;
  to_time: number;
};

type RunSegments = {
  run_id: number;
  segments: Segment[];
  total_duration: number;
  detection_count: number;
};

type SegmentStat = {
  segment_key: string;
  count: number;
  avg_duration: number;
  min_duration: number;
  max_duration: number;
  durations: Array<{ run_id: number; duration: number }>;
};

type SegmentsData = {
  runs: RunSegments[];
  segment_statistics: SegmentStat[];
};

export default function HomePage() {
  const router = useRouter();
  const [data, setData] = useState<Match[]>([]);
  const [shots, setShots] = useState<
    { name: string; size: number; mtime: number }[]
  >([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [segmentsData, setSegmentsData] = useState<SegmentsData>({
    runs: [],
    segment_statistics: [],
  });
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

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

  useEffect(() => {
    fetch("/api/runs")
      .then((r) => r.json())
      .then((list) => Array.isArray(list) ? setRuns(list) : setRuns([]))
      .catch(() => setRuns([]));
  }, []);

  useEffect(() => {
    fetch("/api/segments")
      .then((r) => r.json())
      .then((data) =>
        setSegmentsData(data || { runs: [], segment_statistics: [] })
      )
      .catch(() => setSegmentsData({ runs: [], segment_statistics: [] }));
  }, []);

  const templates = useMemo(
    () => Array.from(new Set(data.map((d) => d.template))),
    [data],
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
      const key = `${d.date.getHours().toString().padStart(2, "0")}:${
        d.date
          .getMinutes()
          .toString()
          .padStart(2, "0")
      }`;
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
          (a.livesplitSeconds as number) - (b.livesplitSeconds as number),
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
      const bucket = buckets.find((b, i) =>
        d.percentage < buckets[i + 1] || i === buckets.length - 1
      ) || 0;
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
    const runsMap = new Map<
      number,
      { id: number; count: number; start: number; end: number }
    >();
    for (const d of enriched) {
      if (typeof d.livesplitSeconds !== "number") continue;
      const id = d.runId ?? -1;
      const existing = runsMap.get(id) ||
        { id, count: 0, start: Infinity, end: -Infinity };
      existing.count++;
      existing.start = Math.min(existing.start, d.livesplitSeconds);
      existing.end = Math.max(existing.end, d.livesplitSeconds);
      runsMap.set(id, existing);
    }
    return Array.from(runsMap.values())
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
    const sorted = [...enriched].sort((a, b) =>
      a.date.getTime() - b.date.getTime()
    );
    const windowSize = Math.max(1, Math.floor(sorted.length / 50));
    const result: { time: string; rate: number }[] = [];
    for (let i = 0; i < sorted.length; i += windowSize) {
      const window = sorted.slice(i, Math.min(i + windowSize, sorted.length));
      if (window.length < 2) continue;
      const duration =
        (window[window.length - 1].date.getTime() - window[0].date.getTime()) /
        1000;
      const rate = duration > 0 ? window.length / duration : 0;
      result.push({
        time: window[0].date.toLocaleTimeString(),
        rate: rate * 60,
      });
    }
    return result;
  }, [enriched]);

  const allRunsProgressData = useMemo(() => {
    if (!segmentsData?.runs || segmentsData.runs.length === 0) {
      return { data: [], runs: [] };
    }
    
    // Get top 10 most recent runs for readability
    const topRuns = segmentsData.runs.slice(0, 10);
    
    // Find the maximum number of detections across all runs
    const maxDetections = Math.max(...topRuns.map((r: any) => r.detection_count || 0));
    
    // Create data points for each detection index
    const data = [];
    for (let i = 1; i <= maxDetections; i++) {
      const point: any = { detection: i };
      
      topRuns.forEach((run: any) => {
        // Calculate cumulative time for this run at detection i
        if (i <= run.detection_count) {
          // Sum all segment durations up to this detection
          const cumulativeTime = run.segments
            .slice(0, i - 1)
            .reduce((sum: number, seg: any) => sum + seg.duration, 0);
          point[`run_${run.run_id}`] = cumulativeTime;
        } else {
          point[`run_${run.run_id}`] = null;
        }
      });
      
      data.push(point);
    }
    
    return { data, runs: topRuns };
  }, [segmentsData]);

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
    const withLive = enriched.filter((d) =>
      typeof d.livesplitSeconds === "number"
    );
    const runDurations = runs.map((r) => r.duration).filter((d) => d > 0);
    const avgRunDuration = runDurations.length > 0
      ? runDurations.reduce((a, b) => a + b, 0) / runDurations.length
      : 0;
    const fastestRun = runs.length > 0
      ? runs.reduce(
        (min, r) => r.duration > 0 && r.duration < min.duration ? r : min,
        runs[0],
      )
      : null;
    const slowestRun = runs.length > 0
      ? runs.reduce((max, r) => r.duration > max.duration ? r : max, runs[0])
      : null;

    return {
      total: enriched.length,
      withLiveSplit: withLive.length,
      templates: templates.length,
      runs: new Set(
        enriched.map((d) => d.runId).filter((id): id is number =>
          id !== null
        ),
      ).size,
      avgPercentage: enriched.reduce((sum, d) =>
            sum + d.percentage, 0) / enriched.length || 0,
      avgRunDuration,
      fastestRun,
      slowestRun,
      totalRuns: runs.length,
    };
  }, [enriched, templates, runs]);

  return (
    <main className="p-6 space-y-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-primary">
            Speedrun Analytics
          </h1>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/logs")}
              className="px-4 py-2 rounded-lg bg-accent hover:bg-accent/80 text-accent-foreground font-medium transition-colors flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              Logs
            </button>
            <Badge
              variant={liveConnected ? "default" : "secondary"}
              className={`gap-2 px-3 py-1.5 rounded-full transition-all ${
                liveConnected
                  ? "bg-green-600 hover:bg-green-700 animate-pulse"
                  : ""
              }`}
            >
              <LinkIcon className="w-3 h-3" />
              {liveConnected === null
                ? "LiveSplit: Unknown"
                : liveConnected
                ? "Connected"
                : "Disconnected"}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="rounded-xl">
            <CardHeader className="pb-3">
              <CardDescription>Total Detections</CardDescription>
              <CardTitle className="text-2xl">
                {formatNumber(stats.total)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="rounded-xl">
            <CardHeader className="pb-3">
              <CardDescription>With LiveSplit</CardDescription>
              <CardTitle className="text-2xl">
                {formatNumber(stats.withLiveSplit)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="rounded-xl">
            <CardHeader className="pb-3">
              <CardDescription>Templates</CardDescription>
              <CardTitle className="text-2xl">
                {formatNumber(stats.templates)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="rounded-xl">
            <CardHeader className="pb-3">
              <CardDescription>Total Runs</CardDescription>
              <CardTitle className="text-2xl">
                {formatNumber(stats.totalRuns)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="rounded-xl">
            <CardHeader className="pb-3">
              <CardDescription>Avg Interval</CardDescription>
              <CardTitle className="text-2xl">
                {avgInterval == null ? "n/a" : secondsToLabel(avgInterval)}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="rounded-xl">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardDescription>Average Run Duration</CardDescription>
                <CardTitle className="text-2xl">
                  {formatDuration(stats.avgRunDuration)}
                </CardTitle>
              </div>
              <ClockIcon className="w-8 h-8 text-muted-foreground" />
            </CardHeader>
          </Card>
          <Card className="rounded-xl bg-green-950/20 border-green-800">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardDescription className="text-green-300">
                  Fastest Run
                </CardDescription>
                <CardTitle className="text-2xl text-green-200">
                  {stats.fastestRun
                    ? formatDuration(stats.fastestRun.duration)
                    : "N/A"}
                </CardTitle>
                {stats.fastestRun && (
                  <p className="text-xs text-green-400 mt-1">
                    Run #{stats.fastestRun.run_id}
                  </p>
                )}
              </div>
              <Zap className="w-8 h-8 text-green-400" />
            </CardHeader>
          </Card>
          <Card className="rounded-xl bg-yellow-950/20 border-yellow-800">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardDescription className="text-yellow-300">
                  Slowest Run
                </CardDescription>
                <CardTitle className="text-2xl text-yellow-200">
                  {stats.slowestRun
                    ? formatDuration(stats.slowestRun.duration)
                    : "N/A"}
                </CardTitle>
                {stats.slowestRun && (
                  <p className="text-xs text-yellow-400 mt-1">
                    Run #{stats.slowestRun.run_id}
                  </p>
                )}
              </div>
              <TimerIcon className="w-8 h-8 text-yellow-400" />
            </CardHeader>
          </Card>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="rounded-xl">
          <TabsTrigger value="overview" className="rounded-lg">
            Overview
          </TabsTrigger>
          <TabsTrigger value="charts" className="rounded-lg">
            Charts
          </TabsTrigger>
          <TabsTrigger value="segments" className="rounded-lg">
            Segments
          </TabsTrigger>
          <TabsTrigger value="analysis" className="rounded-lg">
            Analysis
          </TabsTrigger>
          <TabsTrigger value="runs" className="rounded-lg">Runs</TabsTrigger>
          <TabsTrigger value="screenshots" className="rounded-lg">
            Screenshots
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapIcon className="w-5 h-5" />
                  Coordinate Heatmap
                </CardTitle>
                <CardDescription>
                  Detections colored by LiveSplit time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <ScatterChart
                    margin={{ top: 8, right: 16, bottom: 16, left: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(var(--border))"
                    />
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
                            <div className="font-medium">
                              X: {p.x}, Y: {p.y}
                            </div>
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
                        return (
                          <circle cx={cx} cy={cy} r={3} fill={payload.color} />
                        );
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
                      label={({ name, percent }) =>
                        `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {templateDistribution.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={palette[index % palette.length]}
                        />
                      ))}
                    </Pie>
                  </RePieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* All Runs Cumulative Progress */}
          {allRunsProgressData.data.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LineChart className="w-5 h-5" />
                  All Runs Cumulative Progress
                </CardTitle>
                <CardDescription>
                  Compare cumulative time across all runs (showing top 10 most recent)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <ReLineChart
                    data={allRunsProgressData.data}
                    margin={{ top: 8, right: 16, bottom: 16, left: 16 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="detection"
                      tick={{ fill: "hsl(var(--muted-foreground))" }}
                      stroke="hsl(var(--border))"
                      label={{
                        value: 'Detection #',
                        position: 'insideBottom',
                        offset: -5,
                        fill: 'hsl(var(--muted-foreground))',
                      }}
                    />
                    <YAxis
                      tick={{ fill: "hsl(var(--muted-foreground))" }}
                      stroke="hsl(var(--border))"
                      label={{
                        value: 'Time (s)',
                        angle: -90,
                        position: 'insideLeft',
                        fill: 'hsl(var(--muted-foreground))',
                      }}
                    />
                    <ReTooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const detection = payload[0].payload.detection;
                        return (
                          <div className="rounded-lg border bg-card p-3 text-sm shadow-lg">
                            <div className="font-medium mb-2">Detection #{detection}</div>
                            <div className="space-y-1">
                              {payload
                                .filter((p) => p.value !== null)
                                .sort((a, b) => (a.value as number) - (b.value as number))
                                .map((p, idx) => {
                                  const runId = p.name?.replace('run_', '');
                                  return (
                                    <div key={idx} className="flex items-center gap-2">
                                      <div
                                        className="w-2 h-2 rounded-full"
                                        style={{ backgroundColor: p.color }}
                                      />
                                      <span>
                                        Run #{runId}: {formatDuration(p.value as number)}
                                      </span>
                                    </div>
                                  );
                                })}
                            </div>
                          </div>
                        );
                      }}
                    />
                    <ReLegend
                      formatter={(value) => `Run #${value.replace('run_', '')}`}
                      wrapperStyle={{ fontSize: '12px' }}
                    />
                    {allRunsProgressData.runs.map((run: any, idx: number) => (
                      <Line
                        key={run.run_id}
                        type="monotone"
                        dataKey={`run_${run.run_id}`}
                        stroke={palette[idx % palette.length]}
                        strokeWidth={2}
                        dot={false}
                        connectNulls
                        name={`run_${run.run_id}`}
                      />
                    ))}
                  </ReLineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="charts" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ActivityIcon className="w-5 h-5" />
                  Percentage vs LiveSplit Time
                </CardTitle>
                <CardDescription>
                  Match percentage over run time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <ReLineChart
                    margin={{ top: 8, right: 16, bottom: 16, left: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(var(--border))"
                    />
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
                      content={
                        <CustomTooltip
                          labelFormatter={(p: any) => secondsToLabel(p.live)}
                        />
                      }
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
                    <ReferenceLine
                      y={100}
                      stroke="hsl(var(--brand))"
                      strokeDasharray="4 4"
                    />
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
                <CardDescription>
                  Total detections over LiveSplit time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart
                    data={cumulativeLive}
                    margin={{ top: 8, right: 16, bottom: 16, left: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(var(--border))"
                    />
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
                      content={
                        <CustomTooltip
                          labelFormatter={(p: any) => secondsToLabel(p.live)}
                        />
                      }
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
                <CardDescription>
                  Detection frequency by time of day
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={perRtMinute}
                    margin={{ top: 8, right: 16, bottom: 16, left: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(var(--border))"
                    />
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
                    <Bar
                      dataKey="count"
                      fill="hsl(var(--brand))"
                      radius={[4, 4, 0, 0]}
                    />
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
                <CardDescription>
                  Detection frequency during runs
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={perLiveMinute}
                    margin={{ top: 8, right: 16, bottom: 16, left: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(var(--border))"
                    />
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
                    <Bar
                      dataKey="count"
                      fill="hsl(var(--brand))"
                      radius={[4, 4, 0, 0]}
                    />
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
                <CardDescription>
                  Distribution of match percentages
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={percentageDistribution}
                    margin={{ top: 8, right: 16, bottom: 16, left: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(var(--border))"
                    />
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
                    <Bar
                      dataKey="count"
                      fill="hsl(var(--brand))"
                      radius={[4, 4, 0, 0]}
                    />
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
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(var(--border))"
                    />
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
                    <Bar
                      dataKey="count"
                      fill="hsl(var(--brand))"
                      radius={[4, 4, 0, 0]}
                    />
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
                <CardDescription>
                  Detections per minute over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart
                    data={detectionRate}
                    margin={{ top: 8, right: 16, bottom: 16, left: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(var(--border))"
                    />
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

        <TabsContent value="segments" className="space-y-4">
          <div className="grid gap-4">
            {/* Segment Statistics KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="rounded-xl">
                <CardHeader className="pb-3">
                  <CardDescription>Total Segments</CardDescription>
                  <CardTitle className="text-2xl">
                    {formatNumber(segmentsData.segment_statistics.length)}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card className="rounded-xl">
                <CardHeader className="pb-3">
                  <CardDescription>Unique Transitions</CardDescription>
                  <CardTitle className="text-2xl">
                    {formatNumber(
                      segmentsData.segment_statistics.filter((s) => s.count > 0)
                        .length,
                    )}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card className="rounded-xl">
                <CardHeader className="pb-3">
                  <CardDescription>Avg Segment Time</CardDescription>
                  <CardTitle className="text-2xl">
                    {segmentsData.segment_statistics.length > 0
                      ? formatDuration(
                        segmentsData.segment_statistics.reduce(
                          (sum, s) => sum + s.avg_duration,
                          0,
                        ) /
                          segmentsData.segment_statistics.length,
                      )
                      : "N/A"}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card className="rounded-xl">
                <CardHeader className="pb-3">
                  <CardDescription>Most Common Segment</CardDescription>
                  <CardTitle className="text-sm">
                    {segmentsData.segment_statistics.length > 0
                      ? segmentsData.segment_statistics[0].segment_key.length >
                          30
                        ? segmentsData.segment_statistics[0].segment_key
                          .substring(0, 30) + "..."
                        : segmentsData.segment_statistics[0].segment_key
                      : "N/A"}
                  </CardTitle>
                </CardHeader>
              </Card>
            </div>

            {/* Segment Time Comparison Across Runs */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Segment Time Comparison Across Runs
                </CardTitle>
                <CardDescription>
                  Compare segment durations between different runs
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart
                    data={segmentsData.segment_statistics.slice(0, 10).map(
                      (stat) => ({
                        name: stat.segment_key.length > 25
                          ? stat.segment_key.substring(0, 25) + "..."
                          : stat.segment_key,
                        avg: stat.avg_duration,
                        min: stat.min_duration,
                        max: stat.max_duration,
                        count: stat.count,
                      })
                    )}
                    margin={{ top: 8, right: 16, bottom: 60, left: 16 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(var(--border))"
                    />
                    <XAxis
                      dataKey="name"
                      tick={{
                        fill: "hsl(var(--muted-foreground))",
                        fontSize: 10,
                      }}
                      stroke="hsl(var(--border))"
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis
                      tick={{ fill: "hsl(var(--muted-foreground))" }}
                      stroke="hsl(var(--border))"
                      label={{
                        value: "Time (seconds)",
                        angle: -90,
                        position: "insideLeft",
                        fill: "hsl(var(--muted-foreground))",
                      }}
                    />
                    <ReTooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const data = payload[0].payload;
                        return (
                          <div className="rounded-lg border bg-card p-3 text-sm shadow-lg">
                            <div className="font-medium mb-2">{data.name}</div>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 text-green-400">
                                <div className="w-2 h-2 rounded-full bg-green-400" />
                                <span>Min: {formatDuration(data.min)}</span>
                              </div>
                              <div className="flex items-center gap-2 text-blue-400">
                                <div className="w-2 h-2 rounded-full bg-blue-400" />
                                <span>Avg: {formatDuration(data.avg)}</span>
                              </div>
                              <div className="flex items-center gap-2 text-red-400">
                                <div className="w-2 h-2 rounded-full bg-red-400" />
                                <span>Max: {formatDuration(data.max)}</span>
                              </div>
                              <div className="text-muted-foreground mt-1">
                                Runs: {data.count}
                              </div>
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Bar
                      dataKey="min"
                      fill="#22c55e"
                      name="Min"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="avg"
                      fill="#3b82f6"
                      name="Avg"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="max"
                      fill="#ef4444"
                      name="Max"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Run Duration Comparison */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TimerIcon className="w-5 h-5" />
                  Run Duration Comparison
                </CardTitle>
                <CardDescription>Total duration of each run</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart
                    data={segmentsData.runs.slice(0, 20).map((run) => ({
                      run_id: `Run ${run.run_id}`,
                      duration: run.total_duration,
                      detections: run.detection_count,
                    }))}
                    margin={{ top: 8, right: 16, bottom: 16, left: 16 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(var(--border))"
                    />
                    <XAxis
                      dataKey="run_id"
                      tick={{
                        fill: "hsl(var(--muted-foreground))",
                        fontSize: 11,
                      }}
                      stroke="hsl(var(--border))"
                    />
                    <YAxis
                      tick={{ fill: "hsl(var(--muted-foreground))" }}
                      stroke="hsl(var(--border))"
                      label={{
                        value: "Duration (seconds)",
                        angle: -90,
                        position: "insideLeft",
                        fill: "hsl(var(--muted-foreground))",
                      }}
                    />
                    <ReTooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const data = payload[0].payload;
                        return (
                          <div className="rounded-lg border bg-card p-3 text-sm shadow-lg">
                            <div className="font-medium mb-2">
                              {data.run_id}
                            </div>
                            <div className="space-y-1">
                              <div>
                                Duration: {formatDuration(data.duration)}
                              </div>
                              <div>Detections: {data.detections}</div>
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Bar
                      dataKey="duration"
                      fill="#8b5cf6"
                      radius={[4, 4, 0, 0]}
                    >
                      {segmentsData.runs.slice(0, 20).map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={palette[index % palette.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Segment Performance Table */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  Segment Performance Details
                </CardTitle>
                <CardDescription>
                  Detailed statistics for each segment
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left p-3 font-medium">Segment</th>
                        <th className="text-right p-3 font-medium">Runs</th>
                        <th className="text-right p-3 font-medium">Avg Time</th>
                        <th className="text-right p-3 font-medium">
                          Best Time
                        </th>
                        <th className="text-right p-3 font-medium">
                          Worst Time
                        </th>
                        <th className="text-right p-3 font-medium">Variance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {segmentsData.segment_statistics.slice(0, 15).map((
                        stat,
                        idx,
                      ) => (
                        <tr
                          key={idx}
                          className="border-b border-border/50 hover:bg-muted/50"
                        >
                          <td className="p-3 font-mono text-xs">
                            {stat.segment_key}
                          </td>
                          <td className="p-3 text-right">{stat.count}</td>
                          <td className="p-3 text-right font-medium">
                            {formatDuration(stat.avg_duration)}
                          </td>
                          <td className="p-3 text-right text-green-400">
                            {formatDuration(stat.min_duration)}
                          </td>
                          <td className="p-3 text-right text-red-400">
                            {formatDuration(stat.max_duration)}
                          </td>
                          <td className="p-3 text-right">
                            {formatDuration(
                              stat.max_duration - stat.min_duration,
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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
                <CardDescription>
                  Most frequently detected markers
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={markerStats}
                    layout="vertical"
                    margin={{ top: 8, right: 16, bottom: 16, left: 80 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(var(--border))"
                    />
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
                    <Bar
                      dataKey="count"
                      fill="hsl(var(--brand))"
                      radius={[0, 4, 4, 0]}
                    />
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
                    <div
                      key={idx}
                      onClick={() => router.push(`/runs/${run.id}`)}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-accent cursor-pointer transition-colors"
                    >
                      <div>
                        <div className="font-medium">Run #{run.id}</div>
                        <div className="text-sm text-muted-foreground">
                          {formatNumber(run.count)} detections •{" "}
                          {secondsToLabel(run.duration)}
                        </div>
                      </div>
                      <Badge variant="secondary" className="rounded-full">
                        {formatNumber(run.count)}
                      </Badge>
                    </div>
                  ))}
                  {runStats.length === 0 && (
                    <div className="text-muted-foreground text-center py-8">
                      No run data available
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="runs" className="space-y-4">
          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PlayCircle className="w-5 h-5" />
                All Runs
              </CardTitle>
              <CardDescription>Browse all recorded speedruns</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {runs.map((run) => (
                  <div
                    key={run.run_id}
                    onClick={() => router.push(`/runs/${run.run_id}`)}
                    className="rounded-xl border bg-card hover:bg-accent cursor-pointer transition-colors overflow-hidden"
                  >
                    {/* Preview Screenshot */}
                    {run.preview_screenshot && (
                      <div className="aspect-video w-full overflow-hidden bg-muted">
                        <img
                          src={`/api/screenshots/${
                            encodeURIComponent(run.preview_screenshot)
                          }`}
                          alt={`Run ${run.run_id} preview`}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    )}

                    {/* Run Info */}
                    <div className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-bold text-lg">
                            Run #{run.run_id}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {new Date(run.first_timestamp).toLocaleDateString()}
                          </p>
                        </div>
                        <Badge className="rounded-full">
                          {formatNumber(run.count)}
                        </Badge>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">
                            Duration:
                          </span>
                          <span className="font-medium">
                            {formatDuration(run.duration)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">
                            Detections:
                          </span>
                          <span className="font-medium">
                            {formatNumber(run.count)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">
                            Templates:
                          </span>
                          <span className="font-medium">
                            {run.templates.length}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {runs.length === 0 && (
                  <div className="col-span-full text-center text-muted-foreground py-8">
                    No runs found.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="screenshots" className="space-y-4">
          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImagesIcon className="w-5 h-5" />
                Screenshots Cache
              </CardTitle>
              <CardDescription>Recently captured screenshots</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {shots.map((f, idx) => (
                  <div
                    key={f.name}
                    onClick={() => {
                      setLightboxIndex(idx);
                      setLightboxOpen(true);
                    }}
                    className="group rounded-lg border bg-card focus:outline-none focus:ring-2 focus:ring-ring hover:bg-accent transition-colors cursor-pointer"
                  >
                    <div className="aspect-video w-full overflow-hidden rounded-t-lg bg-muted">
                      <img
                        src={`/api/screenshots/${encodeURIComponent(f.name)}`}
                        alt={f.name}
                        className="w-full h-full object-cover group-hover:scale-[1.05] transition-transform"
                        loading="lazy"
                      />
                    </div>
                    <div className="px-2 py-1.5 text-xs truncate text-muted-foreground">
                      {f.name}
                    </div>
                  </div>
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

      {/* Lightbox for screenshots */}
      {lightboxOpen && (
        <ImageLightbox
          images={shots.map((shot) => ({
            name: shot.name,
            url: `/api/screenshots/${encodeURIComponent(shot.name)}`,
            metadata: `Size: ${(shot.size / 1024).toFixed(2)} KB • Modified: ${
              new Date(shot.mtime).toLocaleString()
            }`,
          }))}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </main>
  );
}
