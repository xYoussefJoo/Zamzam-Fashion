'use client';

import React, { useState, FormEvent } from 'react';
import { useZamzamStore } from '@/store/useZamzamStore';
import { adminTabsLabels, RELEASE_NAME, assetPath } from '@/data/seed';
import { AdminTab } from '@/types/zamzam';
import AdminOverview from './AdminOverview';
import AdminCategories from './AdminCategories';
import AdminProducts from './AdminProducts';
import AdminProductEditor from './AdminProductEditor';
import AdminOrders from './AdminOrders';
import AdminSettings from './AdminSettings';

export default function AdminView() {
  const auth = useZamzamStore((state) => state.auth);
  const login = useZamzamStore((state) => state.login);
  const logout = useZamzamStore((state) => state.logout);
  const adminTab = useZamzamStore((state) => state.adminTab);
  const setAdminTab = useZamzamStore((state) => state.setAdminTab);
  const setEditingProductId = useZamzamStore((state) => state.setEditingProductId);
  const go = useZamzamStore((state) => state.go);
  const t = useZamzamStore((state) => state.t);

  const [passcode, setPasscode] = useState('');

  const handleLogin = (e: FormEvent) => {
    e.preventDefault();
    if (login(passcode)) {
      setPasscode('');
    } else {
      alert(t('الرمز غير صحيح', 'Invalid code'));
    }
  };

  const adminBack = () => {
    if (adminTab === 'editor') {
      setAdminTab('products');
      setEditingProductId(null);
    } else if (adminTab !== 'overview') {
      setAdminTab('overview');
    } else {
      go('home');
    }
  };

  const tabs: [AdminTab, string, string][] = [
    ['overview', 'نظرة عامة', 'Overview'],
    ['categories', 'الأقسام', 'Categories'],
    ['products', 'المنتجات', 'Products'],
    ['orders', 'الطلبات', 'Orders'],
    ['settings', 'الإعدادات', 'Settings'],
  ];

  if (!auth) {
    return (
      <div className="max-w-md mx-auto my-16 px-4">
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-[#d6c2a7] shadow-md space-y-5">
          <div className="text-center space-y-1">
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#142b4a]">
              {t('دخول الإدارة التجريبي', 'Demo admin access')}
            </h2>
            <p className="text-xs text-[#77808b]">
              Zamzam Fashion • Management Studio
            </p>
          </div>

          <div className="bg-[#fff7e7] border border-[#f1dcae] text-[#70542d] p-3 rounded-lg text-xs leading-relaxed">
            {t(
              'للمعاينة فقط: كلمة المرور داخل المتصفح وليست نظام حماية حقيقي. لا تستخدم بيانات عملاء حقيقية.',
              'Demo only: browser-side password is NOT real security. Do not use real customer data.'
            )}
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <label className="flex flex-col gap-1.5 text-xs sm:text-sm font-bold text-[#2d3540]">
              <span>{t('رمز المعاينة', 'Demo passcode')}</span>
              <input
                type="password"
                name="pass"
                required
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                className="border border-[#cdbb9e] rounded-lg p-3 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#b99664]"
              />
            </label>

            <button
              type="submit"
              className="w-full py-3 rounded-lg bg-[#142b4a] hover:bg-[#1e3a61] text-white text-xs sm:text-sm font-bold transition-colors cursor-pointer"
            >
              {t('دخول', 'Enter')}
            </button>
          </form>

          <p className="text-xs text-center text-[#77808b]">
            Demo code: <code className="bg-[#f7f3eb] px-1.5 py-0.5 rounded font-mono font-bold text-[#142b4a]">zamzam-demo</code>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-[250px_1fr] min-h-[calc(100vh-120px)] bg-[#f8f6f2]">
      {/* Sidebar */}
      <aside className="bg-[#1e3046] text-white p-6 flex flex-col justify-between border-b md:border-b-0 md:border-e border-white/10">
        <div className="space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-white/15">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={assetPath('assets/logo-transparent.png')}
              alt="Zamzam Fashion"
              className="w-12 h-12 object-contain"
            />
            <div>
              <strong className="block text-sm font-serif font-bold text-white">
                Zamzam Fashion
              </strong>
              <small className="text-[9px] tracking-wider text-[#d9c5a4] uppercase font-semibold">
                STORE MANAGEMENT
              </small>
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-[10px] tracking-widest uppercase font-bold text-[#c1c9d1] px-3 pb-1">
              {t('إدارة المتجر', 'STORE MANAGEMENT')}
            </div>

            {tabs.map(([key, arLabel, enLabel]) => {
              const isActive =
                adminTab === key || (adminTab === 'editor' && key === 'products');
              return (
                <button
                  key={key}
                  type="button"
                  className={`w-full text-start flex items-center gap-2.5 px-3.5 py-3 rounded-xl text-sm font-bold transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-[#c4a274] text-[#17283e]'
                      : 'text-[#d7dfe7] hover:bg-white/10'
                  }`}
                  onClick={() => {
                    setAdminTab(key);
                    setEditingProductId(null);
                  }}
                >
                  <span className="w-2 h-2 rounded-full bg-current opacity-60" />
                  <span>{t(arLabel, enLabel)}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="pt-6 border-t border-white/15 space-y-2 mt-8 md:mt-0">
          <button
            type="button"
            className="w-full text-start text-xs text-[#d7dfe7] hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors cursor-pointer flex items-center justify-between"
            onClick={() => go('home')}
          >
            <span>↗ {t('عرض المتجر', 'View storefront')}</span>
          </button>
          <button
            type="button"
            className="w-full text-start text-xs text-rose-300 hover:text-rose-200 p-2 rounded-lg hover:bg-rose-950/40 transition-colors cursor-pointer"
            onClick={logout}
          >
            {t('خروج', 'Sign out')}
          </button>
        </div>
      </aside>

      {/* Main Admin Area */}
      <main className="p-6 sm:p-10 min-w-0 max-w-[1450px] w-full mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#e9e4dc]">
          <div>
            <span className="text-xs font-bold tracking-widest text-[#9c7c54] uppercase">
              ZAMZAM FASHION / {RELEASE_NAME}
            </span>
            <h2 className="text-2xl sm:text-3xl font-serif font-bold text-[#142b4a] mt-0.5">
              {adminTab === 'editor'
                ? t('بيانات المنتج', 'Product editor')
                : t(...(adminTabsLabels[adminTab] || adminTabsLabels.overview))}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="px-4 py-2 rounded-lg border border-[#cdbb9e] bg-white hover:bg-[#f7f3eb] text-xs font-bold text-[#142b4a] transition-colors cursor-pointer"
              onClick={adminBack}
            >
              {t('رجوع', 'Back')}
            </button>
            <button
              type="button"
              className="px-4 py-2 rounded-lg bg-[#142b4a] hover:bg-[#1e3a61] text-xs font-bold text-white transition-colors cursor-pointer"
              onClick={() => go('home')}
            >
              ↗ {t('عرض المتجر', 'View store')}
            </button>
          </div>
        </div>

        <div className="bg-[#fff8e9] border border-[#ead8b6] text-[#79613f] p-3.5 rounded-xl text-xs">
          {t(
            'نسخة تجريبية: البيانات محفوظة على هذا المتصفح فقط، ولا توجد صلاحيات إنتاجية أو قاعدة بيانات متصلة.',
            'Demo: data is stored only in this browser; no production authorization or database connection.'
          )}
        </div>

        {adminTab === 'overview' && <AdminOverview />}
        {adminTab === 'categories' && <AdminCategories />}
        {adminTab === 'products' && <AdminProducts />}
        {adminTab === 'editor' && <AdminProductEditor />}
        {adminTab === 'orders' && <AdminOrders />}
        {adminTab === 'settings' && <AdminSettings />}
      </main>
    </div>
  );
}
