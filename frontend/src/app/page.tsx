import type { Metadata } from 'next';
import AppShell from '@/components/AppShell';

export const metadata: Metadata = { alternates: { canonical: '/' } };

export default function Home() {
  return <AppShell />;
}
