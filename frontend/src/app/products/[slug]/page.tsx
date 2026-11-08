import { Suspense } from 'react';
import AppShell from '@/components/AppShell';

// A product's shareable address. With Cache Components, params are runtime data, so they're read inside Suspense.
export default function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <Suspense fallback={null}>
      {params.then(({ slug }) => (
        <AppShell route={{ page: 'product', slug: decodeURIComponent(slug) }} />
      ))}
    </Suspense>
  );
}
