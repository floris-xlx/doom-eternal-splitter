"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Clock, ImageIcon, Target, TrendingUp, BarChart3, Zap } from "lucide-react";
import { formatDuration, formatTimeElapsed, formatNumber } from "@/lib/utils";
import { ImageLightbox } from "@/components/ImageLightbox";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ReTooltip,
  Cell,
  LineChart,
  Line,
  ReferenceLine,
  ComposedChart,
  Area,
} from "recharts";

type Match = {
  template: string;
  percentage: number;
  coordinates: { x: number; y: number };
  time: string;
  livesplit_current_time?: string | null;
  run_id?: number;
  marker?: string | null;
  image?: string;
  livesplit_seconds: number;
  time_elapsed: number;
  screenshot_filename?: string;
};

type RunData = {
  run_id: number;
  matches: Match[];
  count: number;
  start_time: number;
  end_time: number;
  duration: number;
};

type SegmentData = {
  segment_index: number;
  from_marker: string;
  to_marker: string;
  duration: number;
  avg_duration?: number;
  is_faster?: boolean;
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

export default function RunDetailPage() {
  const params = useParams();
  const router = useRouter();
  const runId = params?.runId as string;
  
  const [runData, setRunData] = useState<RunData | null>(null);
  const [segmentsData, setSegmentsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  useEffect(() => {
    if (!runId) return;

    Promise.all([
      fetch(`/api/runs/${runId}`).then((r) => {
        if (!r.ok) throw new Error("Run not found");
        return r.json();
      }),
      fetch("/api/segments").then((r) => r.json()),
    ])
      .then(([runDataResult, segmentsResult]) => {
        setRunData(runDataResult);
        setSegmentsData(segmentsResult);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [runId]);

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  // Calculate segments for this run (must be before conditional returns)
  const segments = useMemo<SegmentData[]>(() => {
    if (!runData || runData.matches.length < 2) return [];
    
    const segs: SegmentData[] = [];
    for (let i = 0; i < runData.matches.length - 1; i++) {
      const from = runData.matches[i];
      const to = runData.matches[i + 1];
      const duration = to.time_elapsed - from.time_elapsed;
      
      segs.push({
        segment_index: i,
        from_marker: from.marker || from.template,
        to_marker: to.marker || to.template,
        duration,
      });
    }
    
    // Add average comparison if segments data is available
    if (segmentsData?.segment_statistics) {
      segs.forEach(seg => {
        const key = `${seg.from_marker} → ${seg.to_marker}`;
        const stat = segmentsData.segment_statistics.find((s: any) => s.segment_key === key);
        if (stat) {
          seg.avg_duration = stat.avg_duration;
          seg.is_faster = seg.duration < stat.avg_duration;
        }
      });
    }
    
    return segs;
  }, [runData, segmentsData]);

  const segmentStats = useMemo(() => {
    if (segments.length === 0) return { avg: 0, fastest: 0, slowest: 0, total: 0 };
    const durations = segments.map(s => s.duration);
    return {
      avg: durations.reduce((a, b) => a + b, 0) / durations.length,
      fastest: Math.min(...durations),
      slowest: Math.max(...durations),
      total: durations.reduce((a, b) => a + b, 0),
    };
  }, [segments]);

  // These calculations need to be after hooks but can use optional chaining for safety
  const templates = runData ? Array.from(new Set(runData.matches.map((m) => m.template))) : [];
  const avgPercentage = runData && runData.matches.length > 0
    ? runData.matches.reduce((sum, m) => sum + m.percentage, 0) / runData.matches.length
    : 0;

  // Prepare lightbox images
  const lightboxImages = runData ? runData.matches.map((match, idx) => ({
    name: match.screenshot_filename || match.image || match.template,
    url: `/api/screenshots/${encodeURIComponent(match.screenshot_filename || match.image || match.template)}`,
    metadata: `${match.marker || match.template} • ${match.percentage.toFixed(2)}% • ${formatTimeElapsed(match.time_elapsed)} • ${match.livesplit_current_time}`,
  })) : [];

  if (loading) {
    return (
      <main className="p-6">
        <div className="text-center text-muted-foreground">Loading run data...</div>
      </main>
    );
  }

  if (error || !runData) {
    return (
      <main className="p-6">
        <div className="text-center text-destructive">
          {error || "Run not found"}
        </div>
        <div className="text-center mt-4">
          <button
            onClick={() => router.push("/")}
            className="text-primary hover:underline"
          >
            ← Back to Dashboard
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/")}
            className="p-2 rounded-lg hover:bg-accent transition-colors"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-primary">Run #{runId}</h1>
            <p className="text-muted-foreground mt-1">
              Detailed timeline and statistics
            </p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Detections</CardDescription>
            <CardTitle className="text-2xl">{formatNumber(runData.count)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Run Duration</CardDescription>
            <CardTitle className="text-2xl">{formatDuration(runData.duration)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Templates Used</CardDescription>
            <CardTitle className="text-2xl">{templates.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Avg Match %</CardDescription>
            <CardTitle className="text-2xl">{avgPercentage.toFixed(1)}%</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Segments</CardDescription>
            <CardTitle className="text-2xl">{segments.length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Segment Statistics */}
      {segments.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Avg Segment Time</CardDescription>
              <CardTitle className="text-xl">{formatDuration(segmentStats.avg)}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="bg-green-950/20 border-green-800">
            <CardHeader className="pb-3">
              <CardDescription className="text-green-300">Fastest Segment</CardDescription>
              <CardTitle className="text-xl text-green-200">{formatDuration(segmentStats.fastest)}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="bg-yellow-950/20 border-yellow-800">
            <CardHeader className="pb-3">
              <CardDescription className="text-yellow-300">Slowest Segment</CardDescription>
              <CardTitle className="text-xl text-yellow-200">{formatDuration(segmentStats.slowest)}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Segments Faster Than Avg</CardDescription>
              <CardTitle className="text-xl">
                {segments.filter(s => s.is_faster).length} / {segments.length}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* Segment Analysis Charts */}
      {segments.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Segment Times
              </CardTitle>
              <CardDescription>Time taken between each detection</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={segments.map((seg, idx) => ({
                    name: `${idx + 1}`,
                    duration: seg.duration,
                    avg: seg.avg_duration || null,
                    label: `${seg.from_marker.substring(0, 15)}...`,
                  }))}
                  margin={{ top: 8, right: 16, bottom: 16, left: 16 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: "hsl(var(--muted-foreground))" }}
                    stroke="hsl(var(--border))"
                    label={{ value: 'Segment #', position: 'insideBottom', offset: -5, fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis
                    tick={{ fill: "hsl(var(--muted-foreground))" }}
                    stroke="hsl(var(--border))"
                    label={{ value: 'Time (s)', angle: -90, position: 'insideLeft', fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <ReTooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const data = payload[0].payload;
                      return (
                        <div className="rounded-lg border bg-card p-3 text-sm shadow-lg">
                          <div className="font-medium mb-1">Segment {data.name}</div>
                          <div className="text-xs mb-1 text-muted-foreground">{data.label}</div>
                          <div className="space-y-1">
                            <div>Duration: {formatDuration(data.duration)}</div>
                            {data.avg && (
                              <div className="text-muted-foreground">
                                Avg: {formatDuration(data.avg)}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="duration" radius={[4, 4, 0, 0]}>
                    {segments.map((seg, idx) => (
                      <Cell
                        key={`cell-${idx}`}
                        fill={seg.is_faster ? "#22c55e" : seg.avg_duration ? "#ef4444" : palette[idx % palette.length]}
                      />
                    ))}
                  </Bar>
                  {segments.some(s => s.avg_duration) && (
                    <Line
                      type="monotone"
                      dataKey="avg"
                      stroke="#94a3b8"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={false}
                      name="Average"
                    />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Cumulative Progress
              </CardTitle>
              <CardDescription>Total time at each detection</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart
                  data={runData.matches.map((match, idx) => ({
                    index: idx + 1,
                    time: match.time_elapsed,
                    marker: (match.marker || match.template).substring(0, 20),
                  }))}
                  margin={{ top: 8, right: 16, bottom: 16, left: 16 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="index"
                    tick={{ fill: "hsl(var(--muted-foreground))" }}
                    stroke="hsl(var(--border))"
                    label={{ value: 'Detection #', position: 'insideBottom', offset: -5, fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis
                    tick={{ fill: "hsl(var(--muted-foreground))" }}
                    stroke="hsl(var(--border))"
                    label={{ value: 'Time (s)', angle: -90, position: 'insideLeft', fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <ReTooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const data = payload[0].payload;
                      return (
                        <div className="rounded-lg border bg-card p-3 text-sm shadow-lg">
                          <div className="font-medium mb-1">Detection {data.index}</div>
                          <div className="text-xs mb-1 text-muted-foreground">{data.marker}</div>
                          <div>Time: {formatDuration(data.time)}</div>
                        </div>
                      );
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="time"
                    fill="#3b82f6"
                    fillOpacity={0.2}
                    stroke="#3b82f6"
                    strokeWidth={2}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Screenshots Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5" />
            Screenshots Timeline
          </CardTitle>
          <CardDescription>
            Chronological view of all detections in this run
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {runData.matches.map((match, idx) => (
              <div
                key={idx}
                className="flex gap-4 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                onClick={() => openLightbox(idx)}
              >
                {/* Screenshot Thumbnail */}
                <div className="flex-shrink-0 w-32 h-20 rounded-lg overflow-hidden bg-muted">
                  <img
                    src={`/api/screenshots/${encodeURIComponent(
                      match.screenshot_filename || match.image || match.template
                    )}`}
                    alt={match.template}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>

                {/* Details */}
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="font-mono">
                        {formatTimeElapsed(match.time_elapsed)}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {match.livesplit_current_time}
                      </span>
                    </div>
                    <Badge
                      variant={match.percentage >= 95 ? "default" : "secondary"}
                      className={
                        match.percentage >= 95
                          ? "bg-green-600 hover:bg-green-700"
                          : ""
                      }
                    >
                      {match.percentage.toFixed(2)}%
                    </Badge>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Target className="w-4 h-4" />
                      <span>{match.marker || match.template}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <TrendingUp className="w-4 h-4" />
                      <span>
                        ({match.coordinates.x}, {match.coordinates.y})
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Lightbox */}
      {lightboxOpen && (
        <ImageLightbox
          images={lightboxImages}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </main>
  );
}
