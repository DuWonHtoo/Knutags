import type { NextRequest } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { env } from '@/lib/env';
import { normalizeTagId, tagUrl } from '@/lib/ids';
import { isEcLevel, makeMatrix, qrDxf, qrSvg } from '@/lib/qr-vector';
import { db } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/** Single-tag vector file, e.g. to engrave one replacement tag by hand. */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return new Response('Unauthorized', { status: 401 });
  const id = normalizeTagId((await context.params).id);
  if (!id) return new Response('Not found', { status: 404 });
  const { data } = await db().from('tags').select('id').eq('id', id).maybeSingle();
  if (!data) return new Response('Not found', { status: 404 });

  const sp = request.nextUrl.searchParams;
  const sizeParam = Number(sp.get('size'));
  const size = Number.isFinite(sizeParam) && sizeParam >= 3 && sizeParam <= 100 ? sizeParam : 10;
  const ecParam = sp.get('ec');
  const ec = isEcLevel(ecParam) ? ecParam : 'M';
  const matrix = makeMatrix(tagUrl(env.publicBaseUrl, id, env.qrUppercase), ec);
  const filename = `${id}-${size}mm-${ec}`;

  if (sp.get('format') === 'dxf') {
    return new Response(qrDxf([{ matrix, x: 0, y: 0, sizeMm: size }]), {
      headers: {
        'Content-Type': 'application/dxf',
        'Content-Disposition': `attachment; filename="${filename}.dxf"`,
        'Cache-Control': 'no-store',
      },
    });
  }
  return new Response(qrSvg(matrix, { sizeMm: size }), {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Content-Disposition': `attachment; filename="${filename}.svg"`,
      'Cache-Control': 'no-store',
    },
  });
}
