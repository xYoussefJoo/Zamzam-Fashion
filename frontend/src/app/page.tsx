'use client';

import React, { useEffect } from 'react';
import { useZamzamStore } from '@/store/useZamzamStore';
import { useScrollReveal } from '@/hooks/useScrollReveal';
import TopBanner from '@/components/layout/TopBanner';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import Toast from '@/components/ui/Toast';
import HomeView from '@/components/views/HomeView';
import ShopView from '@/components/views/ShopView';
import CustomTailoringView from '@/components/views/CustomTailoringView';
import CartView from '@/components/views/CartView';
import OrdersView from '@/components/views/OrdersView';
import AdminView from '@/components/views/admin/AdminView';
import ProductDetailsView from '@/components/views/ProductDetailsView';

export default function Home() {
  const page = useZamzamStore((state) => state.page);
  const adminTab = useZamzamStore((state) => state.adminTab);
  const setAdminTab = useZamzamStore((state) => state.setAdminTab);
  const setEditingProductId = useZamzamStore((state) => state.setEditingProductId);
  const go = useZamzamStore((state) => state.go);
  const initialize = useZamzamStore((state) => state.initialize);

  // Hydrate store on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Scroll reveal observer on route/page change
  useScrollReveal([page]);

  // Escape key handler for admin navigation (matches vanilla behavior)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && page === 'admin') {
        if (adminTab === 'editor') {
          setAdminTab('products');
          setEditingProductId(null);
        } else if (adminTab !== 'overview') {
          setAdminTab('overview');
        } else {
          go('home');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [page, adminTab, setAdminTab, setEditingProductId, go]);

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
        {page === 'admin' && <AdminView />}
        {page === 'product' && <ProductDetailsView />}
      </main>

      {page !== 'admin' && <Footer />}
      <Toast />
    </div>
  );
}
