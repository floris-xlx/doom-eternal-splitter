import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export async function GET() {
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
          return { name, size: stat.size, mtime: stat.mtimeMs };
        })
    );
    files.sort((a, b) => b.mtime - a.mtime);
    return NextResponse.json(files);
  } catch {
    return NextResponse.json([]);
  }
}


