'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ContactStatus } from '@prisma/client';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { setContactStatusAction } from '@/app/(admin)/admin/actions';

const OPTIONS: Array<{ status: ContactStatus; label: string }> = [
  { status: ContactStatus.READ, label: 'Mark read' },
  { status: ContactStatus.RESPONDED, label: 'Mark responded' },
  { status: ContactStatus.ARCHIVED, label: 'Archive' },
  { status: ContactStatus.SPAM, label: 'Mark spam' },
];

export function ContactStatusButtons({ id, current }: { id: string; current: ContactStatus }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div className="flex flex-wrap gap-2">
      {OPTIONS.filter((option) => option.status !== current).map((option) => (
        <Button
          key={option.status}
          type="button"
          size="sm"
          variant="secondary"
          loading={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await setContactStatusAction(id, option.status);
              if (result.ok) {
                toast.success(result.message ?? 'Updated');
                router.refresh();
              } else {
                toast.error(result.message ?? 'That action could not be completed.');
              }
            })
          }
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
