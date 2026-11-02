import { PersonForm } from '@/components/PersonForm';
import { Card, PageHeader } from '@/components/ui';
import { createPersonAction } from '@/lib/actions/people';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'New person' };

export default async function NewPersonPage() {
  await requireAdmin();
  return (
    <>
      <PageHeader
        title="New person"
        subtitle="Creates a profile without a tag. Tip: scanning a blank tag lets you create and assign in one step."
      />
      <Card className="max-w-2xl">
        <PersonForm action={createPersonAction} submitLabel="Create person" />
      </Card>
    </>
  );
}
