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

export async function GET(
  request: Request,
  { params }: { params: { runId: string } }
) {
  try {
    const runId = parseInt(params.runId, 10);
    
    if (isNaN(runId)) {
      return NextResponse.json({ error: 'Invalid run ID' }, { status: 400 });
    }
    
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
    const allMatches: Match[] = JSON.parse(content);
    
    // Get available screenshots
    const screenshots = await getScreenshots();
    
    // Filter matches for this run
    const runMatches = allMatches
      .filter(match => {
        const matchRunId = typeof match.run_id === 'number' ? match.run_id : -1;
        return matchRunId === runId;
      })
      .map(match => ({
        ...match,
        livesplit_seconds: parseLiveSplitSeconds(match.livesplit_current_time),
      }))
      .filter(match => match.livesplit_seconds !== null);
    
    if (runMatches.length === 0) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }
    
    // Sort by livesplit time
    runMatches.sort((a, b) => a.livesplit_seconds! - b.livesplit_seconds!);
    
    // Calculate time elapsed since first screenshot and find corresponding screenshot
    const firstTime = runMatches[0].livesplit_seconds!;
    const enriched = runMatches.map(match => {
      // Prioritize screenshot_path from JSON, then try timestamp matching, then fallback
      let screenshotName: string;
      if (match.screenshot_path) {
        screenshotName = match.screenshot_path;
      } else {
        const closestScreenshot = findClosestScreenshot(match.time, screenshots);
        screenshotName = closestScreenshot || match.image || match.template;
      }
      
      return {
        ...match,
        time_elapsed: match.livesplit_seconds! - firstTime,
        screenshot_filename: screenshotName,
      };
    });
    
    return NextResponse.json({
      run_id: runId,
      matches: enriched,
      count: enriched.length,
      start_time: enriched[0].livesplit_seconds,
      end_time: enriched[enriched.length - 1].livesplit_seconds,
      duration: enriched[enriched.length - 1].livesplit_seconds! - enriched[0].livesplit_seconds!,
    });
  } catch (error) {
    console.error('Error loading run:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
