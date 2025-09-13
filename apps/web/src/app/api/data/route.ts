import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export async function GET() {
  try {
    const file = path.join(process.cwd(), '..', '..', 'data', 'matches.json');
    const content = await fs.readFile(file, 'utf-8');
    const json = JSON.parse(content);
    return NextResponse.json(json);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}