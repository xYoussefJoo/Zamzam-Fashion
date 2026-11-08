import { Suspense } from 'react';
import AppShell from '@/components/AppShell';

// Order and quote emails link here: /track/ZF-10234?t=<tracking token>. No login needed; the token is the key.
export default function TrackPage({
  params,
  searchParams,
}: {
  params: Promise<{ number: string }>;
  searchParams: Promise<{ t?: string | string[] }>;
}) {
  return (
    <Suspense fallback={null}>
      {Promise.all([params, searchParams]).then(([{ number }, { t }]) => (
        <AppShell
          route={{ page: 'track', number: decodeURIComponent(number), token: (Array.isArray(t) ? t[0] : t) ?? '' }}
        />
      ))}
    </Suspense>
  );
}
