import { Suspense } from 'react';
import AppShell from '@/components/AppShell';

// The owner's new-order emails link here; it opens the admin panel on that order (after login if needed).
export default function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={null}>
      {params.then(({ id }) => {
        const orderId = Number(id);
        return <AppShell route={{ page: 'admin', orderId: Number.isInteger(orderId) && orderId > 0 ? orderId : undefined }} />;
      })}
    </Suspense>
  );
}
