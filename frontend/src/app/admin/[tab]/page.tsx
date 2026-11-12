import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import AppShell from '@/components/AppShell';
import type { AdminTab } from '@/types/zamzam';

const tabs: AdminTab[] = ['categories', 'products', 'warehouse', 'orders', 'colors', 'zones', 'tailoring', 'pricing', 'settings', 'password'];

export const metadata = { title: 'لوحة التحكم | زمزم فاشن', robots: { index: false, follow: false } };

// Every dashboard tab has its own address (/admin/products, /admin/warehouse, ...), so it can be bookmarked or opened in a new tab.
export default function AdminTabPage({ params }: { params: Promise<{ tab: string }> }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f7f3eb] animate-pulse" />}>
      {params.then(({ tab }) => {
        if (!tabs.includes(tab as AdminTab)) notFound();
        return <AppShell route={{ page: 'admin', tab: tab as AdminTab }} />;
      })}
    </Suspense>
  );
}
