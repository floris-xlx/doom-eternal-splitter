import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

type Match = {
  template: string;
  percentage: number;
  coordinates: { x: number; y: number };
  time: string;
  livesplit_current_time?: string | null;
  run_id?: number;
  marker?: string | null;
  image?: string;
  screenshot_path?: string;
};

type RunSegment = {
  segment_index: number;
  from_marker: string;
  to_marker: string;
  duration: number;
  from_time: number;
  to_time: number;
};

type Detection = {
  marker: string;
  time: number;
  template: string;
};

type SegmentStat = {
  segment_key: string;
  count: number;
  avg_duration: number;
  min_duration: number;
  max_duration: number;
  durations: Array<{ run_id: number; duration: number }>;
};

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

export async function GET() {
  try {
    const filePrimary = path.join(process.cwd(), '..', '..', 'data', 'matches.json');
    const fileAlt = path.join(process.cwd(), '..', '..', '..', 'data', 'matches.json');
    const file = await fs
      .stat(filePrimary)
      .then(() => filePrimary)
      .catch(async () => {
        try {
          await fs.stat(fileAlt);
          return fileAlt;
        } catch {
          return filePrimary;
        }
      });
    
    const content = await fs.readFile(file, 'utf-8');
    const matches: Match[] = JSON.parse(content);
    
    // Group matches by run_id and calculate segments
    const runSegments = new Map<number, RunSegment[]>();
    const runData = new Map<number, Detection[]>();
    
    // First, organize matches by run
    for (const match of matches) {
      const runId = typeof match.run_id === 'number' ? match.run_id : -1;
      const liveSeconds = parseLiveSplitSeconds(match.livesplit_current_time);
      
      if (liveSeconds === null) continue;
      
      if (!runData.has(runId)) {
        runData.set(runId, []);
      }
      
      runData.get(runId)!.push({
        marker: match.marker || match.template,
        time: liveSeconds,
        template: match.template,
      });
    }
    
    // Calculate segments for each run
    for (const [runId, detections] of runData.entries()) {
      // Sort by time
      detections.sort((a, b) => a.time - b.time);
      
      const segments: RunSegment[] = [];
      for (let i = 0; i < detections.length - 1; i++) {
        segments.push({
          segment_index: i,
          from_marker: detections[i].marker,
          to_marker: detections[i + 1].marker,
          duration: detections[i + 1].time - detections[i].time,
          from_time: detections[i].time,
          to_time: detections[i + 1].time,
        });
      }
      
      runSegments.set(runId, segments);
    }
    
    // Calculate segment statistics across all runs
    const segmentStats = new Map<string, SegmentStat>();
    
    for (const [runId, segments] of runSegments.entries()) {
      for (const segment of segments) {
        const key = `${segment.from_marker} → ${segment.to_marker}`;
        
        if (!segmentStats.has(key)) {
          segmentStats.set(key, {
            segment_key: key,
            count: 0,
            avg_duration: 0,
            min_duration: Infinity,
            max_duration: -Infinity,
            durations: [],
          });
        }
        
        const stat = segmentStats.get(key)!;
        stat.count++;
        stat.durations.push({ run_id: runId, duration: segment.duration });
        stat.min_duration = Math.min(stat.min_duration, segment.duration);
        stat.max_duration = Math.max(stat.max_duration, segment.duration);
      }
    }
    
    // Calculate averages
    for (const stat of segmentStats.values()) {
      const sum = stat.durations.reduce((acc, d) => acc + d.duration, 0);
      stat.avg_duration = sum / stat.count;
    }
    
    // Convert to response format
    const runs = Array.from(runSegments.entries())
      .map(([run_id, segments]) => ({
        run_id,
        segments,
        total_duration: segments.reduce((sum, s) => sum + s.duration, 0),
        detection_count: segments.length + 1, // +1 because segments are between detections
      }))
      .sort((a, b) => b.run_id - a.run_id);
    
    const stats = Array.from(segmentStats.values())
      .sort((a, b) => b.count - a.count);
    
    return NextResponse.json({
      runs,
      segment_statistics: stats,
    });
  } catch (error) {
    console.error('Error loading segments:', error);
    return NextResponse.json({ runs: [], segment_statistics: [] }, { status: 200 });
  }
}
