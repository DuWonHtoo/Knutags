'use client';

import { useMemo, useState } from 'react';
import {
  EC_DESCRIPTIONS,
  EC_LEVELS,
  QUIET_ZONE,
  isAlphanumeric,
  makeMatrix,
  qrDxf,
  qrSvg,
  rateModule,
  type EcLevel,
  type QrMatrix,
} from '@/lib/qr-vector';
import { btnPrimary, btnSecondary, inputClass, labelClass, td, th } from './ui';

const SIZES_MM = [5, 7, 10] as const;

const RATING_STYLES = {
  good: 'bg-emerald-50 text-emerald-700 ring-emerald-300',
  risky: 'bg-amber-50 text-amber-800 ring-amber-300',
  bad: 'bg-red-50 text-red-700 ring-red-300',
} as const;

function download(filename: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function QrTester({ defaultText, uppercaseDefault }: { defaultText: string; uppercaseDefault: boolean }) {
  const [text, setText] = useState(defaultText);
  const [uppercase, setUppercase] = useState(uppercaseDefault);
  const [selected, setSelected] = useState<{ ec: EcLevel; size: number }>({ ec: 'M', size: 10 });

  const encoded = uppercase ? text.toUpperCase() : text;
  const matrices = useMemo(() => {
    const out = new Map<EcLevel, QrMatrix | null>();
    for (const ec of EC_LEVELS) {
      try {
        out.set(ec, encoded ? makeMatrix(encoded, ec) : null);
      } catch {
        out.set(ec, null);
      }
    }
    return out;
  }, [encoded]);

  const current = matrices.get(selected.ec) ?? null;
  const fileBase = `qr-${selected.size}mm-${selected.ec}`;

  return (
    <div className="space-y-6">
      <div className="space-y-3 print:hidden">
        <div>
          <label htmlFor="qr-text" className={labelClass}>
            Content (URL engraved in the tag)
          </label>
          <input id="qr-text" value={text} onChange={(e) => setText(e.target.value)} className={`${inputClass} font-mono`} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={uppercase}
            onChange={(e) => setUppercase(e.target.checked)}
            className="h-4 w-4 accent-knu-blue"
          />
          Uppercase URL (smaller code; compare the module counts below)
        </label>
        <p className="text-xs text-slate-500">
          Encoding: {isAlphanumeric(encoded) ? 'alphanumeric (compact)' : 'byte (lowercase letters present)'} ·{' '}
          {encoded.length} characters · every code below includes a {QUIET_ZONE}-module quiet zone.
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className={th}>Error correction</th>
              {SIZES_MM.map((size) => (
                <th key={size} className={`${th} text-center`}>
                  {size} mm
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {EC_LEVELS.map((ec) => {
              const m = matrices.get(ec);
              return (
                <tr key={ec}>
                  <td className={`${td} align-top`}>
                    <div className="font-semibold">{ec}</div>
                    <div className="text-xs text-slate-500">{EC_DESCRIPTIONS[ec]}</div>
                    {m ? (
                      <div className="mt-1 text-xs text-slate-500">
                        Version {m.version} · {m.size}×{m.size} modules
                      </div>
                    ) : (
                      <div className="mt-1 text-xs text-red-700">Text too long for a QR code</div>
                    )}
                  </td>
                  {SIZES_MM.map((size) => {
                    if (!m) return <td key={size} className={td} />;
                    const moduleMm = size / m.size;
                    const rating = rateModule(moduleMm);
                    const isSelected = selected.ec === ec && selected.size === size;
                    return (
                      <td key={size} className={`${td} text-center align-top`}>
                        <button
                          type="button"
                          onClick={() => setSelected({ ec, size })}
                          className={`inline-flex flex-col items-center gap-1 rounded-lg p-2 ${
                            isSelected ? 'bg-slate-100 ring-2 ring-knu-blue' : 'hover:bg-slate-50'
                          }`}
                          aria-label={`Select ${size} mm, level ${ec}`}
                        >
                          {/* True physical size when printed at 100% scale */}
                          <span dangerouslySetInnerHTML={{ __html: qrSvg(m, { sizeMm: size }) }} />
                          <span className="text-xs tabular-nums text-slate-600">{moduleMm.toFixed(3)} mm/module</span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${RATING_STYLES[rating.level]}`}
                          >
                            {rating.label}
                          </span>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {current ? (
        <div className="grid gap-6 sm:grid-cols-[auto_1fr] sm:items-start">
          <div
            className="mx-auto w-56 rounded-xl bg-white p-2 ring-1 ring-slate-200"
            dangerouslySetInnerHTML={{ __html: qrSvg(current, { width: '100%' }) }}
          />
          <div className="space-y-3 text-sm">
            <p>
              <strong>
                Selected: {selected.size} mm, level {selected.ec}
              </strong>
              <br />
              Version {current.version}, {current.size}×{current.size} modules, {(selected.size / current.size).toFixed(3)} mm per
              module. With quiet zone the clear area is{' '}
              {((selected.size / current.size) * (current.size + QUIET_ZONE * 2)).toFixed(2)} mm square.
            </p>
            <div className="flex flex-wrap gap-2 print:hidden">
              <button
                type="button"
                className={btnSecondary}
                onClick={() => download(`${fileBase}.svg`, qrSvg(current, { sizeMm: selected.size }), 'image/svg+xml')}
              >
                Download SVG
              </button>
              <button
                type="button"
                className={btnSecondary}
                onClick={() =>
                  download(`${fileBase}.dxf`, qrDxf([{ matrix: current, x: 0, y: 0, sizeMm: selected.size }]), 'application/dxf')
                }
              >
                Download DXF
              </button>
              <button type="button" className={btnPrimary} onClick={() => window.print()}>
                Print test sheet
              </button>
            </div>
            <p className="text-xs text-slate-500 print:hidden">
              Print at 100% scale (&quot;Actual size&quot;, not &quot;Fit to page&quot;) and try each code with an iPhone and
              an Android phone. Paper is easier to read than steel, so treat anything that is hard on paper as too small.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
