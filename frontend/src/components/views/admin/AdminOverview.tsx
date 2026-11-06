'use client';

import React from 'react';
import { useZamzamStore } from '@/store/useZamzamStore';
import { assetPath } from '@/data/seed';

export default function AdminOverview() {
  const data = useZamzamStore((state) => state.data);
  const lang = useZamzamStore((state) => state.lang);
  const money = useZamzamStore((state) => state.money);
  const setAdminTab = useZamzamStore((state) => state.setAdminTab);
  const openProductEditor = useZamzamStore((state) => state.openProductEditor);
  const go = useZamzamStore((state) => state.go);
  const t = useZamzamStore((state) => state.t);

  const totalProducts = data.products.length;
  const totalCategories = data.categories.length;
  const totalOrders = data.orders.length;
  const visibleProducts = data.products.filter((x) => x.visible).length;
  const latestProducts = data.products.slice(-4).reverse();

  return (
    <div className="space-y-6">
      {/* Stat grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-[#e9e4dc] shadow-2xs space-y-1">
          <span className="text-xs font-semibold text-[#77808a] uppercase block">
            {t('المنتجات', 'Products')}
          </span>
          <b className="text-2xl sm:text-3xl font-serif font-bold text-[#142b4a]">
            {totalProducts}
          </b>
        </div>
        <div className="p-5 rounded-2xl bg-white border border-[#e9e4dc] shadow-2xs space-y-1">
          <span className="text-xs font-semibold text-[#77808a] uppercase block">
            {t('الأقسام', 'Categories')}
          </span>
          <b className="text-2xl sm:text-3xl font-serif font-bold text-[#142b4a]">
            {totalCategories}
          </b>
        </div>
        <div className="p-5 rounded-2xl bg-white border border-[#e9e4dc] shadow-2xs space-y-1">
          <span className="text-xs font-semibold text-[#77808a] uppercase block">
            {t('الطلبات', 'Orders')}
          </span>
          <b className="text-2xl sm:text-3xl font-serif font-bold text-[#a27b4e]">
            {totalOrders}
          </b>
        </div>
        <div className="p-5 rounded-2xl bg-white border border-[#e9e4dc] shadow-2xs space-y-1">
          <span className="text-xs font-semibold text-[#77808a] uppercase block">
            {t('منتجات ظاهرة', 'Visible products')}
          </span>
          <b className="text-2xl sm:text-3xl font-serif font-bold text-emerald-800">
            {visibleProducts}
          </b>
        </div>
      </div>

      {/* Overview Action Panel */}
      <section className="bg-white p-6 sm:p-8 rounded-2xl border border-[#e9e4dc] shadow-2xs space-y-3">
        <h3 className="text-lg sm:text-xl font-serif font-bold text-[#142b4a]">
          {t('إدارة متجرك من مكان واحد', 'Your store, one workspace')}
        </h3>
        <p className="text-xs sm:text-sm text-[#79808b] leading-relaxed max-w-2xl">
          {t(
            'أنشئي القسم أولًا، وبعدها أضيفي أي عدد من الموديلات إليه. اختاري المقاسات والألوان بعلامة صح، وأضيفي الصور والتفاصيل لكل موديل.',
            'Create a category, then add unlimited styles. Choose sizes and colors, upload photos, and manage every item.'
          )}
        </p>
        <div className="flex flex-wrap items-center gap-2.5 pt-2">
          <button
            type="button"
            className="px-4 py-2.5 rounded-lg bg-[#142b4a] hover:bg-[#1e3a61] text-white text-xs font-bold transition-colors cursor-pointer"
            onClick={() => setAdminTab('categories')}
          >
            ＋ {t('إنشاء قسم', 'Create category')}
          </button>
          <button
            type="button"
            className="px-4 py-2.5 rounded-lg border border-[#cdbb9e] bg-white hover:bg-[#f7f3eb] text-xs font-bold text-[#142b4a] transition-colors cursor-pointer"
            onClick={() => openProductEditor()}
          >
            ＋ {t('إضافة منتج', 'Add product')}
          </button>
          <button
            type="button"
            className="px-4 py-2.5 rounded-lg border border-[#cdbb9e] bg-white hover:bg-[#f7f3eb] text-xs font-bold text-[#142b4a] transition-colors cursor-pointer"
            onClick={() => go('shop')}
          >
            {t('معاينة المتجر', 'Preview shop')} ↗
          </button>
        </div>
      </section>

      {/* Latest Products */}
      <section className="bg-white p-6 sm:p-8 rounded-2xl border border-[#e9e4dc] shadow-2xs space-y-4">
        <h3 className="text-lg font-serif font-bold text-[#142b4a]">
          {t('أحدث المنتجات', 'Latest products')}
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {latestProducts.map((p) => (
            <div
              key={p.id}
              className="rounded-xl border border-[#e9e4dc] overflow-hidden p-2.5 bg-[#fbf8f3] space-y-1.5"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={assetPath(p.image || '')}
                alt=""
                className="w-full h-32 object-cover rounded-lg bg-[#eee]"
              />
              <b className="block text-xs font-bold text-[#142b4a] truncate">
                {p[lang] || p.ar}
              </b>
              <span className="block text-xs font-extrabold text-[#a27b4e]">
                {money(p.price)}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
