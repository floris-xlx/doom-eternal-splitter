import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export async function GET() {
  try {
    const filePrimary = path.join(process.cwd(), '..', '..', 'log.txt');
    const fileAlt = path.join(process.cwd(), '..', '..', '..', 'log.txt');
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
    const lines = content.split('\n').filter(line => line.trim());
    
    // Load matches.json to correlate log entries with screenshots
    const matchesFilePrimary = path.join(process.cwd(), '..', '..', 'data', 'matches.json');
    const matchesFileAlt = path.join(process.cwd(), '..', '..', '..', 'data', 'matches.json');
    const matchesFile = await fs
      .stat(matchesFilePrimary)
      .then(() => matchesFilePrimary)
      .catch(async () => {
        try {
          await fs.stat(matchesFileAlt);
          return matchesFileAlt;
        } catch {
          return matchesFilePrimary;
        }
      });
    
    let matchesData: any[] = [];
    try {
      const matchesContent = await fs.readFile(matchesFile, 'utf-8');
      matchesData = JSON.parse(matchesContent);
    } catch {
      matchesData = [];
    }
    
    // Parse log entries
    const entries = lines
      .map(line => {
        // Format: [2025-12-18 08:33:57 CEST] Match: checkpoint/1.png at (3462, 300) with 94.42%
        const match = line.match(/\[(.+?)\] (.+)/);
        if (!match) return null;
        
        const [, timestamp, message] = match;
        
        // Try to parse match details
        const matchDetails = message.match(/Match: (.+?) at \((\d+), (\d+)\) with ([\d.]+)%/);
        
        if (matchDetails) {
          // Try to find corresponding match in matches.json
          const template = matchDetails[1];
          const x = parseInt(matchDetails[2]);
          const y = parseInt(matchDetails[3]);
          
          // Find match by timestamp and coordinates (within a small window)
          const correspondingMatch = matchesData.find(m => {
            const timeDiff = Math.abs(new Date(m.time).getTime() - new Date(timestamp).getTime());
            const coordMatch = m.coordinates?.x === x && m.coordinates?.y === y;
            return coordMatch && timeDiff < 10000; // Within 10 seconds
          });
          
          return {
            timestamp,
            message,
            type: 'match' as const,
            details: {
              template: matchDetails[1],
              x: parseInt(matchDetails[2]),
              y: parseInt(matchDetails[3]),
              percentage: parseFloat(matchDetails[4]),
            },
            screenshot_path: correspondingMatch?.screenshot_path || null,
          };
        }
        
        return {
          timestamp,
          message,
          type: 'info' as const,
          details: null,
          screenshot_path: null,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
      .slice(-100); // Last 100 entries
    
    return NextResponse.json(entries);
  } catch (error) {
    console.error('Error reading collector logs:', error);
    return NextResponse.json([], { status: 200 });
  }
}
