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

type Screenshot = {
  name: string;
  mtime: number;
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

async function getScreenshots(): Promise<Screenshot[]> {
  try {
    const primary = path.join(process.cwd(), '..', '..', 'screenshots_cache');
    const alt = path.join(process.cwd(), '..', '..', '..', 'screenshots_cache');
    const dir = await fs
      .stat(primary)
      .then(() => primary)
      .catch(async () => {
        try {
          await fs.stat(alt);
          return alt;
        } catch {
          return primary;
        }
      });
    const entries = await fs.readdir(dir);
    const files = await Promise.all(
      entries
        .filter((n) => n.toLowerCase().endsWith('.png'))
        .map(async (name) => {
          const stat = await fs.stat(path.join(dir, name));
          return { name, mtime: stat.mtimeMs };
        })
    );
    return files;
  } catch {
    return [];
  }
}

function findClosestScreenshot(matchTime: string, screenshots: Screenshot[]): string | null {
  if (!screenshots.length) return null;
  
  const matchTimestamp = new Date(matchTime).getTime();
  let closest = screenshots[0];
  let minDiff = Math.abs(matchTimestamp - closest.mtime);
  
  for (const screenshot of screenshots) {
    const diff = Math.abs(matchTimestamp - screenshot.mtime);
    if (diff < minDiff) {
      minDiff = diff;
      closest = screenshot;
    }
  }
  
  // Only return if within 5 seconds
  if (minDiff < 5000) {
    return closest.name;
  }
  
  return null;
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
    
    // Get available screenshots
    const screenshots = await getScreenshots();
    
    // Group matches by run_id
    const runMap = new Map<number, {
      run_id: number;
      count: number;
      start_time: number;
      end_time: number;
      duration: number;
      templates: Set<string>;
      first_timestamp: string;
      last_timestamp: string;
      first_match_time: string;
    }>();
    
    for (const match of matches) {
      const runId = typeof match.run_id === 'number' ? match.run_id : -1;
      const liveSeconds = parseLiveSplitSeconds(match.livesplit_current_time);
      
      if (liveSeconds === null) continue;
      
      if (!runMap.has(runId)) {
        runMap.set(runId, {
          run_id: runId,
          count: 0,
          start_time: liveSeconds,
          end_time: liveSeconds,
          duration: 0,
          templates: new Set(),
          first_timestamp: match.time,
          last_timestamp: match.time,
          first_match_time: match.time,
        });
      }
      
      const run = runMap.get(runId)!;
      run.count++;
      run.start_time = Math.min(run.start_time, liveSeconds);
      run.end_time = Math.max(run.end_time, liveSeconds);
      run.duration = run.end_time - run.start_time;
      run.templates.add(match.template);
      
      // Update timestamp ranges
      if (new Date(match.time) < new Date(run.first_timestamp)) {
        run.first_timestamp = match.time;
      }
      if (new Date(match.time) > new Date(run.last_timestamp)) {
        run.last_timestamp = match.time;
      }
    }
    
    // Convert to array and format
    const runs = Array.from(runMap.values())
      .map(run => {
        // Get the first match for this run to check if it has a screenshot_path
        const firstMatch = matches.find(m => {
          const matchRunId = typeof m.run_id === 'number' ? m.run_id : -1;
          return matchRunId === run.run_id;
        });
        
        let previewScreenshot: string | null = null;
        if (firstMatch?.screenshot_path) {
          previewScreenshot = firstMatch.screenshot_path;
        } else {
          previewScreenshot = findClosestScreenshot(run.first_match_time, screenshots);
        }
        
        return {
          run_id: run.run_id,
          count: run.count,
          start_time: run.start_time,
          end_time: run.end_time,
          duration: run.duration,
          templates: Array.from(run.templates),
          first_timestamp: run.first_timestamp,
          last_timestamp: run.last_timestamp,
          preview_screenshot: previewScreenshot,
        };
      })
      .sort((a, b) => b.run_id - a.run_id); // Most recent first
    
    return NextResponse.json(runs);
  } catch (error) {
    console.error('Error loading runs:', error);
    return NextResponse.json([], { status: 200 });
  }
}
