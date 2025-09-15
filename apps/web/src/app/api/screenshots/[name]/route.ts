import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export async function GET(
  _req: Request,
  ctx: { params: { name: string } }
) {
  try {
    const name = ctx.params.name;
    if (!/^[A-Za-z0-9_.-]+\.png$/i.test(name)) return new NextResponse('Bad Request', { status: 400 });
    const filePath = path.join(process.cwd(), '..', '..', 'screenshots_cache', name);
    const buf = await fs.readFile(filePath);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (e: any) {
    if (e && e.code === 'ENOENT') return new NextResponse('Not Found', { status: 404 });
    return new NextResponse('Server Error', { status: 500 });
  }
}


