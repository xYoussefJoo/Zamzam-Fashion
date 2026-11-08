'use client';

import React from 'react';
import { useZamzamStore } from '@/store/useZamzamStore';
import { useScrollReveal } from '@/hooks/useScrollReveal';
import ProductCard from '@/components/shop/ProductCard';

export default function ShopView() {
  const data = useZamzamStore((state) => state.data);
  const lang = useZamzamStore((state) => state.lang);
  const filter = useZamzamStore((state) => state.filter);
  const setFilter = useZamzamStore((state) => state.setFilter);
  const isInCategory = useZamzamStore((state) => state.isInCategory);
  const t = useZamzamStore((state) => state.t);

  const filteredProducts = data.products.filter(
    (p) => p.visible && p.stock > 0 && isInCategory(p, filter)
  );

  // Trigger scroll-reveal whenever category filter changes
  useScrollReveal([filter, filteredProducts.length]);

  return (
    <section className="max-w-[1240px] mx-auto px-4 sm:px-6 py-12 space-y-8 animate-scale-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-[#e8dfd1] reveal-init">
        <div>
          <span className="text-xs text-[#b99664] font-bold tracking-[0.2em] uppercase">
            COLLECTION
          </span>
          <h2 className="text-2xl sm:text-4xl font-serif font-bold text-[#142b4a] mt-1">
            {t('المجموعة الكاملة', 'The complete collection')}
          </h2>
          <p className="text-xs sm:text-sm text-[#77808b] mt-1">
            {t(
              `تصفحي ${filteredProducts.length} قطعة مختارة ومتاحة للطلب الفوري`,
              `Browsing ${filteredProducts.length} curated pieces available for immediate order`
            )}
          </p>
        </div>
      </div>

      {/* Modern Category Filter Pills */}
      <div className="flex flex-wrap items-center gap-2.5 reveal-init delay-100">
        <button
          type="button"
          className={`px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold transition-all duration-300 cursor-pointer ${
            filter === 'all'
              ? 'bg-[#142b4a] text-white shadow-md shadow-[#142b4a]/20 scale-[1.02]'
              : 'bg-white text-[#2d3540] border border-[#e8dfd1] hover:border-[#b99664] hover:bg-[#f7f3eb]'
          }`}
          onClick={() => setFilter('all')}
        >
          {t('الكل', 'All pieces')}
        </button>

        {data.categories.map((c) => {
          const isActive = String(filter) === String(c.id);
          return (
            <button
              key={c.id}
              type="button"
              className={`px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold transition-all duration-300 cursor-pointer ${
                isActive
                  ? 'bg-[#142b4a] text-white shadow-md shadow-[#142b4a]/20 scale-[1.02]'
                  : 'bg-white text-[#2d3540] border border-[#e8dfd1] hover:border-[#b99664] hover:bg-[#f7f3eb]'
              }`}
              onClick={() => setFilter(String(c.id))}
            >
              {c.parentId ? '↳ ' : ''}
              {c[lang]}
            </button>
          );
        })}
      </div>

      {/* Product Grid */}
      {filteredProducts.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-2">
          {filteredProducts.map((p, i) => (
            <div
              key={p.id}
              className={`reveal-init delay-${((i % 4) + 1) * 100}`}
            >
              <ProductCard product={p} />
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-white rounded-3xl border border-[#e8dfd1] p-10 space-y-4 reveal-init">
          <span className="text-5xl block animate-float select-none">👗</span>
          <h3 className="text-lg font-bold text-[#142b4a]">
            {t('لا توجد قطع متاحة حالياً في هذا القسم', 'No pieces currently available in this category')}
          </h3>
          <p className="text-xs text-[#77808b] max-w-sm mx-auto">
            {t('جربي اختيار قسم آخر أو تصفح كل المعروضات.', 'Try selecting another category or view all pieces.')}
          </p>
          <button
            type="button"
            className="px-6 py-2.5 rounded-full bg-[#142b4a] text-white text-xs font-bold hover:bg-[#b99664] transition-colors cursor-pointer"
            onClick={() => setFilter('all')}
          >
            {t('عرض جميع المنتجات', 'View all products')}
          </button>
        </div>
      )}
    </section>
  );
}
