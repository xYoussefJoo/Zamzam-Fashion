'use client';

import React, { useEffect } from 'react';
import { useZamzamStore } from '@/store/useZamzamStore';
import { useScrollReveal } from '@/hooks/useScrollReveal';
import type { InitialRoute } from '@/types/zamzam';
import TopBanner from '@/components/layout/TopBanner';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import Toast from '@/components/ui/Toast';
import dynamic from 'next/dynamic';
import HomeView from '@/components/views/HomeView';
import ShopView from '@/components/views/ShopView';
import ProductDetailsView from '@/components/views/ProductDetailsView';

// Home, shop and product pages ship with the first load; the rest (and the whole dashboard)
// download only when opened, so shoppers never pay for admin code.
const ViewLoading = () => <div className="max-w-6xl mx-auto my-10 px-4 h-96 rounded-2xl bg-[#f7f3eb] animate-pulse" aria-busy="true" />;
const CustomTailoringView = dynamic(() => import('@/components/views/CustomTailoringView'), { loading: ViewLoading });
const CartView = dynamic(() => import('@/components/views/CartView'), { loading: ViewLoading });
const OrdersView = dynamic(() => import('@/components/views/OrdersView'), { loading: ViewLoading });
const TrackOrderView = dynamic(() => import('@/components/views/TrackOrderView'), { loading: ViewLoading });
const AdminView = dynamic(() => import('@/components/views/admin/AdminView'), { loading: ViewLoading });

// The whole shop in one client app. Every address (/, /products/[slug], /track/[number], /admin/orders/[id])
// renders this shell; `route` says which screen to open first.
export default function AppShell({ route }: { route?: InitialRoute }) {
  const page = useZamzamStore((state) => state.page);
  const adminTab = useZamzamStore((state) => state.adminTab);
  const setAdminTab = useZamzamStore((state) => state.setAdminTab);
  const go = useZamzamStore((state) => state.go);
  const initialize = useZamzamStore((state) => state.initialize);

  useEffect(() => {
    initialize(route);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialize]);

  useScrollReveal([page]);

  // Escape walks back out of the admin screens.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // An open pop-up handles its own Esc (and asks first if there are unsaved changes).
      if (e.key === 'Escape' && page === 'admin' && !document.querySelector('dialog[open]')) {
        if (adminTab !== 'overview') {
          setAdminTab('overview');
        } else {
          go('home');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [page, adminTab, setAdminTab, go]);

  return (
    <div id="app">
      <TopBanner />
      <Navbar />

      <main>
        {page === 'home' && <HomeView />}
        {page === 'shop' && <ShopView />}
        {page === 'custom' && <CustomTailoringView />}
        {page === 'cart' && <CartView />}
        {page === 'orders' && <OrdersView />}
        {page === 'track' && <TrackOrderView />}
        {page === 'admin' && <AdminView />}
        {page === 'product' && <ProductDetailsView />}
      </main>

      {page !== 'admin' && <Footer />}
      <Toast />
    </div>
  );
}
