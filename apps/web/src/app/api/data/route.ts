import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

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
    const json = JSON.parse(content);
    return NextResponse.json(json);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}