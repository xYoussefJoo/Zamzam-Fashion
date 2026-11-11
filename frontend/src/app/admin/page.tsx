import { Suspense } from 'react';
import AppShell from '@/components/AppShell';
export const metadata = {
    title: 'لوحة التحكم | زمزم فاشن',
        robots: {
        index: false,
        follow: false,
        },
};
export default function AdminPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-[#f7f3eb] animate-pulse" />}>
            <AppShell route={{ page: 'admin' }} />
        </Suspense>
    );
}