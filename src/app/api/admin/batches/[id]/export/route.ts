import type { NextRequest } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { toCsv } from '@/lib/csv';
import { env } from '@/lib/env';
import { slugify } from '@/lib/format';
import { tagUrl } from '@/lib/ids';
import { isUuid } from '@/lib/params';
import { isEcLevel, makeMatrix, qrDxf, type DxfPlacement } from '@/lib/qr-vector';
import { db } from '@/lib/supabase';
import { fetchBatchTags } from '@/lib/tags';

export const dynamic = 'force-dynamic';

const MAX_DXF_CODES = 60; // keeps files well below Vercel's 4.5 MB response limit

function num(value: string | null, fallback: number, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || value === null || value === '') return fallback;
  return Math.min(max, Math.max(min, n));
}

function file(body: string, filename: string, type: string): Response {
  return new Response(body, {
    headers: {
      'Content-Type': type,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return new Response('Unauthorized', { status: 401 });
  const { id } = await context.params;
  if (!isUuid(id)) return new Response('Not found', { status: 404 });

  const { data: batch } = await db().from('batches').select('id,label').eq('id', id).maybeSingle();
  if (!batch) return new Response('Not found', { status: 404 });

  const tags = await fetchBatchTags(id);
  const base = env.publicBaseUrl;
  const upper = env.qrUppercase;
  const name = slugify((batch as { label: string }).label);
  const sp = request.nextUrl.searchParams;
  const format = sp.get('format') ?? 'csv';

  switch (format) {
    case 'csv':
      return file(toCsv([['id', 'url'], ...tags.map((t) => [t.id, tagUrl(base, t.id, upper)])]), `${name}.csv`, 'text/csv; charset=utf-8');
    case 'csv-noheader':
      return file(toCsv(tags.map((t) => [t.id, tagUrl(base, t.id, upper)])), `${name}-noheader.csv`, 'text/csv; charset=utf-8');
    case 'txt-urls':
      return file(tags.map((t) => tagUrl(base, t.id, upper)).join('\r\n') + '\r\n', `${name}-urls.txt`, 'text/plain; charset=utf-8');
    case 'txt-ids':
      return file(tags.map((t) => t.id).join('\r\n') + '\r\n', `${name}-ids.txt`, 'text/plain; charset=utf-8');
    case 'dxf': {
      const size = num(sp.get('size'), 10, 3, 50);
      const ecParam = sp.get('ec');
      const ec = isEcLevel(ecParam) ? ecParam : 'M';
      const cols = Math.round(num(sp.get('cols'), 5, 1, 50));
      const pitchX = num(sp.get('pitchx'), size + 10, size, 1000);
      const pitchY = num(sp.get('pitchy'), size + 10, size, 1000);
      const start = Math.round(num(sp.get('start'), 1, 1, tags.length || 1));
      const count = Math.round(num(sp.get('count'), 25, 1, MAX_DXF_CODES));

      const selected = tags.filter((t) => t.batch_seq >= start).slice(0, count);
      if (selected.length === 0) return new Response('No tags in that range.', { status: 400 });
      const rows = Math.ceil(selected.length / cols);
      const placements: DxfPlacement[] = selected.map((t, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        return {
          matrix: makeMatrix(tagUrl(base, t.id, upper), ec),
          x: col * pitchX,
          y: (rows - 1 - row) * pitchY, // first row at the top
          sizeMm: size,
        };
      });
      const first = selected[0].batch_seq;
      const last = selected[selected.length - 1].batch_seq;
      return file(qrDxf(placements), `${name}-${first}-${last}-${size}mm-${ec}.dxf`, 'application/dxf');
    }
    default:
      return new Response('Unknown format', { status: 400 });
  }
}
