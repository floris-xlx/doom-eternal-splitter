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
} from "recharts";

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

export default function HomePage() {
  const [data, setData] = useState<Match[]>([]);

  useEffect(() => {
    fetch("/api/data")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData([]));
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

  const liveStatus = useMemo(() => {
    return "unknown" as const;
  }, []);

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

  return (
    <main className="p-6 space-y-8">
      <section className="space-y-2">
        <div
          className={`inline-flex items-center gap-2 px-2 py-1 rounded-sm shadow-none ${
            liveConnected ?? false ? "text-brand" : "text-secondary"
          } bg-foreground/0`}
        >
          <LinkIcon className="w-4 h-4" />
          <span
            className={`${
              liveConnected ?? false ? "bg-brand" : "bg-hover"
            } w-2 h-2 rounded-full`}
          />
          <span>
            {liveConnected === null
              ? "LiveSplit: Unknown"
              : liveConnected
              ? "LiveSplit: Connected"
              : "LiveSplit: Disconnected"}
          </span>
        </div>
        <div className="inline-flex items-center gap-2 px-2 py-1 rounded-sm shadow-none text-secondary bg-foreground/0">
          <ClockIcon className="w-4 h-4" />
          <span>Avg interval between detections:</span>
          <span className="text-primary">
            {avgInterval == null ? "n/a" : secondsToLabel(avgInterval)}
          </span>
        </div>
      </section>
      <section className="space-y-2">
        <h2 className="text-xl font-semibold text-primary flex items-center gap-2">
          <MapIcon className="w-5 h-5" />
          Coordinate Heatmap by LiveSplit Time
        </h2>
        <div className="w-full rounded-sm bg-foreground/0">
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart margin={{ top: 8, right: 16, bottom: 16, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                type="number"
                dataKey="x"
                name="X"
                tick={{ className: "text-secondary" }}
              />
              <YAxis
                type="number"
                dataKey="y"
                name="Y"
                tick={{ className: "text-secondary" }}
              />
              <ReTooltip
                cursor={{ strokeDasharray: "3 3" }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null as any;
                  const p = payload[0].payload as any;
                  return (
                    <div className="rounded-sm bg-background text-foreground px-2 py-1 text-sm shadow-none">
                      <div>
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
                  return <circle cx={cx} cy={cy} r={3} fill={payload.color} />;
                }}
              />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold text-primary flex items-center gap-2">
          <ActivityIcon className="w-5 h-5" />
          Percentage vs LiveSplit Time
        </h2>
        <div className="w-full rounded-sm bg-foreground/0">
          <ResponsiveContainer width="100%" height={300}>
            <ReLineChart margin={{ top: 8, right: 16, bottom: 16, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                type="number"
                dataKey="live"
                tickFormatter={secondsToLabel}
                tick={{ className: "text-secondary" }}
              />
              <YAxis domain={[0, 100]} tick={{ className: "text-secondary" }} />
              <ReTooltip labelFormatter={(l) => secondsToLabel(Number(l))} />
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
                />
              ))}
              <ReferenceLine y={100} stroke="#16a34a" strokeDasharray="4 4" />
            </ReLineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold text-primary flex items-center gap-2">
          <BarChart3 className="w-5 h-5" />
          Detections per Real-Time Minute
        </h2>
        <div className="w-full rounded-sm bg-foreground/0">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={perRtMinute}
              margin={{ top: 8, right: 16, bottom: 16, left: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="minute"
                tick={{ className: "text-secondary" }}
                angle={-30}
                height={50}
                textAnchor="end"
              />
              <YAxis
                allowDecimals={false}
                tick={{ className: "text-secondary" }}
              />
              <ReTooltip />
              <Bar dataKey="count" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold text-primary flex items-center gap-2">
          <TimerIcon className="w-5 h-5" />
          Detections per LiveSplit Minute
        </h2>
        <div className="w-full rounded-sm bg-foreground/0">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={perLiveMinute}
              margin={{ top: 8, right: 16, bottom: 16, left: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                tick={{ className: "text-secondary" }}
                angle={-30}
                height={50}
                textAnchor="end"
              />
              <YAxis
                allowDecimals={false}
                tick={{ className: "text-secondary" }}
              />
              <ReTooltip />
              <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold text-primary flex items-center gap-2">
          <TrendingUpIcon className="w-5 h-5" />
          Cumulative Detections over LiveSplit
        </h2>
        <div className="w-full rounded-sm bg-foreground/0">
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart
              data={cumulativeLive}
              margin={{ top: 8, right: 16, bottom: 16, left: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="live"
                tickFormatter={secondsToLabel}
                tick={{ className: "text-secondary" }}
              />
              <YAxis
                allowDecimals={false}
                tick={{ className: "text-secondary" }}
              />
              <ReTooltip labelFormatter={(l) => secondsToLabel(Number(l))} />
              <Area
                type="monotone"
                dataKey="cum"
                stroke="#f97316"
                fill="#f97316"
                fillOpacity={0.2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>
    </main>
  );
}
