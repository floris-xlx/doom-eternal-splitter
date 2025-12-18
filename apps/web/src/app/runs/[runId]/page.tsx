"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Clock, ImageIcon, Target, TrendingUp } from "lucide-react";
import { formatDuration, formatTimeElapsed, formatNumber } from "@/lib/utils";
import { ImageLightbox } from "@/components/ImageLightbox";

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

export default function RunDetailPage() {
  const params = useParams();
  const router = useRouter();
  const runId = params?.runId as string;
  
  const [runData, setRunData] = useState<RunData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  useEffect(() => {
    if (!runId) return;

    fetch(`/api/runs/${runId}`)
      .then((r) => {
        if (!r.ok) throw new Error("Run not found");
        return r.json();
      })
      .then((data) => {
        setRunData(data);
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

  const templates = Array.from(new Set(runData.matches.map((m) => m.template)));
  const avgPercentage =
    runData.matches.reduce((sum, m) => sum + m.percentage, 0) / runData.matches.length;

  // Prepare lightbox images
  const lightboxImages = runData.matches.map((match, idx) => ({
    name: match.screenshot_filename || match.image || match.template,
    url: `/api/screenshots/${encodeURIComponent(match.screenshot_filename || match.image || match.template)}`,
    metadata: `${match.marker || match.template} • ${match.percentage.toFixed(2)}% • ${formatTimeElapsed(match.time_elapsed)} • ${match.livesplit_current_time}`,
  }));

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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Detections</CardDescription>
            <CardTitle className="text-2xl">{formatNumber(runData.count)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Duration</CardDescription>
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
      </div>

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
