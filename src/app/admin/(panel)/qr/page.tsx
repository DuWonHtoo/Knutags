import { QrTester } from '@/components/QrTester';
import { Card, PageHeader } from '@/components/ui';
import { requireAdmin } from '@/lib/auth';
import { env } from '@/lib/env';
import { tagUrl } from '@/lib/ids';
import { db } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'QR test' };

export default async function QrPage() {
  await requireAdmin();
  // Use a real tag so the printed test codes open a real page when scanned.
  const { data } = await db()
    .from('tags')
    .select('id')
    .eq('status', 'assigned')
    .order('assigned_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const sampleId = (data as { id: string } | null)?.id ?? 'K7M3QX9';

  return (
    <>
      <PageHeader
        title="QR preview & test"
        subtitle="Compare sizes and error-correction levels before engraving. Click a code to select it."
      />
      <Card>
        <QrTester defaultText={tagUrl(env.publicBaseUrl, sampleId, false)} uppercaseDefault={env.qrUppercase} />
      </Card>
      <Card title="How to choose" className="mt-6 print:hidden">
        <ul className="list-disc space-y-2 pl-5 text-sm text-slate-600">
          <li>
            <strong>Module</strong> = one black or white square. Phones need roughly ≥ 0.25–0.3 mm per module on metal; 0.2 mm
            only works with good phones held very close.
          </li>
          <li>
            Higher error correction (Q, H) survives scratches but needs more modules → smaller modules at the same size. For
            steel, <strong>M</strong> is usually the best balance; use <strong>Q</strong> for parts that get scratched.
          </li>
          <li>A shorter domain and the uppercase option both reduce the number of modules.</li>
          <li>Always engrave one test piece per size and scan it with both an iPhone and an Android phone.</li>
        </ul>
      </Card>
    </>
  );
}
