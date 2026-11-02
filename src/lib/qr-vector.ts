// QR code geometry → SVG / DXF. Shared by the browser (QR test page) and the
// server (exports). Sizes are in millimetres and EXCLUDE the quiet zone.

import QRCode from 'qrcode';

export type EcLevel = 'L' | 'M' | 'Q' | 'H';
export const EC_LEVELS: readonly EcLevel[] = ['L', 'M', 'Q', 'H'];
export const EC_DESCRIPTIONS: Record<EcLevel, string> = {
  L: '~7% damage recovery',
  M: '~15% damage recovery',
  Q: '~25% damage recovery',
  H: '~30% damage recovery',
};

/** Blank margin around the code, in modules. The QR standard requires 4. */
export const QUIET_ZONE = 4;

export interface QrMatrix {
  size: number; // modules per side
  version: number;
  ec: EcLevel;
  dark: (row: number, col: number) => boolean;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function isEcLevel(value: unknown): value is EcLevel {
  return typeof value === 'string' && (EC_LEVELS as readonly string[]).includes(value);
}

export function makeMatrix(text: string, ec: EcLevel): QrMatrix {
  const qr = QRCode.create(text, { errorCorrectionLevel: ec });
  const modules = qr.modules;
  return {
    size: modules.size,
    version: qr.version,
    ec,
    dark: (row, col) => Boolean(modules.get(row, col)),
  };
}

/** True when the text can use QR alphanumeric mode (uppercase only), which is denser. */
export function isAlphanumeric(text: string): boolean {
  return /^[0-9A-Z $%*+\-./:]*$/.test(text);
}

/**
 * Dark modules merged into rectangles: horizontal runs first, then identical
 * runs on consecutive rows are stacked. Far fewer shapes for the laser to hatch.
 */
export function toRects(m: QrMatrix): Rect[] {
  const rects: Rect[] = [];
  let open = new Map<string, Rect>();
  for (let row = 0; row < m.size; row++) {
    const next = new Map<string, Rect>();
    let col = 0;
    while (col < m.size) {
      if (!m.dark(row, col)) {
        col++;
        continue;
      }
      const start = col;
      while (col < m.size && m.dark(row, col)) col++;
      const key = `${start},${col - start}`;
      const prev = open.get(key);
      if (prev && prev.y + prev.h === row) {
        prev.h++;
        next.set(key, prev);
      } else {
        const rect = { x: start, y: row, w: col - start, h: 1 };
        rects.push(rect);
        next.set(key, rect);
      }
    }
    open = next;
  }
  return rects;
}

const round = (n: number, digits = 3) => Number(n.toFixed(digits));

/**
 * SVG with a 4-module quiet zone. With sizeMm the SVG has real-world dimensions
 * (prints at exact size when printed at 100%); `width` overrides the display size.
 */
export function qrSvg(m: QrMatrix, opts: { sizeMm?: number; width?: string; quiet?: number } = {}): string {
  const quiet = opts.quiet ?? QUIET_ZONE;
  const total = m.size + quiet * 2;
  const sizeMm = opts.sizeMm ?? m.size;
  const totalMm = (sizeMm / m.size) * total;
  const width = opts.width ?? `${round(totalMm)}mm`;
  const d = toRects(m)
    .map((r) => `M${r.x + quiet} ${r.y + quiet}h${r.w}v${r.h}h-${r.w}z`)
    .join('');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${width}" ` +
    `viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges">` +
    `<rect width="${total}" height="${total}" fill="#fff"/>` +
    `<path d="${d}" fill="#000"/></svg>`
  );
}

export interface DxfPlacement {
  matrix: QrMatrix;
  /** Bottom-left corner of the code itself (quiet zone not drawn), in mm. */
  x: number;
  y: number;
  sizeMm: number;
}

/**
 * AutoCAD R12 DXF (the most widely supported variant) in millimetres. Each dark
 * area is a closed POLYLINE rectangle on layer 0 — import it and apply a hatch
 * fill in BslCAD. The quiet zone is empty space: keep it clear on the part.
 */
export function qrDxf(items: DxfPlacement[]): string {
  const f = (n: number) => n.toFixed(4);
  const out: string[] = ['0', 'SECTION', '2', 'HEADER', '9', '$ACADVER', '1', 'AC1009', '0', 'ENDSEC'];
  out.push('0', 'SECTION', '2', 'ENTITIES');
  for (const item of items) {
    const mod = item.sizeMm / item.matrix.size;
    for (const r of toRects(item.matrix)) {
      const x0 = item.x + r.x * mod;
      const x1 = item.x + (r.x + r.w) * mod;
      const yTop = item.y + (item.matrix.size - r.y) * mod;
      const yBottom = item.y + (item.matrix.size - r.y - r.h) * mod;
      out.push('0', 'POLYLINE', '8', '0', '66', '1', '10', '0.0', '20', '0.0', '30', '0.0', '70', '1');
      for (const [x, y] of [
        [x0, yBottom],
        [x1, yBottom],
        [x1, yTop],
        [x0, yTop],
      ]) {
        out.push('0', 'VERTEX', '8', '0', '10', f(x), '20', f(y), '30', '0.0');
      }
      out.push('0', 'SEQEND', '8', '0');
    }
  }
  out.push('0', 'ENDSEC', '0', 'EOF');
  return out.join('\r\n') + '\r\n';
}

export type ModuleRating = { level: 'good' | 'risky' | 'bad'; label: string };

/** Rough phone-scanning guidance for a given module (dot) size on metal. */
export function rateModule(moduleMm: number): ModuleRating {
  if (moduleMm >= 0.3) return { level: 'good', label: 'Good' };
  if (moduleMm >= 0.2) return { level: 'risky', label: 'Test carefully' };
  return { level: 'bad', label: 'Too small for most phones' };
}
