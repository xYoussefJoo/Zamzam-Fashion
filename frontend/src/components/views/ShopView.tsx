'use client';

import React, { useEffect, useState } from 'react';
import { useZamzamStore } from '@/store/useZamzamStore';
import { useApi, usePage } from '@/lib/useApi';
import { errorText } from '@/lib/api';
import { pick, searchProducts, type ProductQuery } from '@/lib/shop';
import ProductCard from '@/components/shop/ProductCard';
import Select from '@/components/ui/Select';

const PAGE_SIZE = 12;
type Sort = NonNullable<ProductQuery['sort']>;

export default function ShopView() {
  const lang = useZamzamStore((state) => state.lang);
  const categories = useZamzamStore((state) => state.categories);
  const filter = useZamzamStore((state) => state.filter);
  const setFilter = useZamzamStore((state) => state.setFilter);
  const t = useZamzamStore((state) => state.t);

  const [sort, setSort] = useState<Sort>('newest');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');

  // Search waits until typing pauses (and needs 2+ letters, like the API).
  useEffect(() => {
    const timer = setTimeout(() => setQ(search.trim().length >= 2 ? search.trim() : ''), 400);
    return () => clearTimeout(timer);
  }, [search]);
  const [page, setPage] = usePage(`${filter}|${sort}|${q}`);

  const { data, error, loading, reload } = useApi(
    () => searchProducts({ category: filter === 'all' ? undefined : filter, q: q || undefined, sort, page, pageSize: PAGE_SIZE }),
    [filter, sort, page, q],
  );
  const products = data?.items ?? [];

  // A main category first, then its sub-categories (shown with ↳), like the menu.
  const pills = categories.flatMap((c) => [c, ...c.children.map((child) => ({ ...child, isChild: true }))]) as
    (typeof categories[number] & { isChild?: boolean })[];

  const pill = (active: boolean) =>
    `px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold transition-all duration-300 cursor-pointer ${
      active
        ? 'bg-[#142b4a] text-white shadow-md shadow-[#142b4a]/20 scale-[1.02]'
        : 'bg-white text-[#2d3540] border border-[#e8dfd1] hover:border-[#b99664] hover:bg-[#f7f3eb]'
    }`;

  return (
    <section className="max-w-[1240px] mx-auto px-4 sm:px-6 py-12 space-y-8 animate-scale-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-[#e8dfd1] reveal-init">
        <div>
          <span className="text-xs text-[#b99664] font-bold tracking-[0.2em] uppercase">COLLECTION</span>
          <h2 className="text-2xl sm:text-4xl font-serif font-bold text-[#142b4a] mt-1">
            {t('المجموعة الكاملة', 'The complete collection')}
          </h2>
          <p className="text-xs sm:text-sm text-[#77808b] mt-1 min-h-[1.25rem]">
            {data &&
              t(
                `تصفحي ${data.totalCount} قطعة مختارة ومتاحة للطلب الفوري`,
                `Browsing ${data.totalCount} curated pieces available for immediate order`,
              )}
          </p>
        </div>

        {/* Search + sort */}
        <div className="flex flex-col sm:flex-row gap-2.5 sm:items-center">
          <label className="sr-only" htmlFor="shop-search">{t('بحث', 'Search')}</label>
          <input
            id="shop-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('ابحثي عن قطعة…', 'Search pieces…')}
            className="w-full sm:w-56 px-4 py-2.5 rounded-full bg-white border border-[#e8dfd1] text-sm focus:outline-none focus:border-[#b99664]"
          />
          <label className="sr-only" htmlFor="shop-sort">{t('الترتيب', 'Sort')}</label>
          <Select
            id="shop-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="px-4 py-2.5 rounded-full bg-white border border-[#e8dfd1] text-sm font-bold text-[#142b4a] focus:outline-none focus:border-[#b99664] cursor-pointer"
          >
            <option value="newest">{t('الأحدث', 'Newest')}</option>
            <option value="price_asc">{t('السعر: من الأقل', 'Price: low to high')}</option>
            <option value="price_desc">{t('السعر: من الأعلى', 'Price: high to low')}</option>
            <option value="name">{t('الاسم', 'Name')}</option>
          </Select>
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex flex-wrap items-center gap-2.5 reveal-init delay-100">
        <button type="button" className={pill(filter === 'all')} onClick={() => setFilter('all')}>
          {t('الكل', 'All pieces')}
        </button>
        {pills.map((c) => (
          <button key={c.id} type="button" className={pill(filter === c.slug)} onClick={() => setFilter(c.slug)}>
            {c.isChild ? '↳ ' : ''}
            {pick(lang, c.nameAr, c.nameEn)}
          </button>
        ))}
      </div>

      {/* Product Grid */}
      {error ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-[#e8dfd1] p-10 space-y-4">
          <p className="text-sm font-bold text-[#a72f3e]">{errorText(error, t)}</p>
          <button
            type="button"
            className="px-6 py-2.5 rounded-full bg-[#142b4a] text-white text-xs font-bold hover:bg-[#b99664] transition-colors cursor-pointer"
            onClick={reload}
          >
            {t('إعادة المحاولة', 'Try again')}
          </button>
        </div>
      ) : loading && !data ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-2" aria-busy="true">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-white border border-[#e8e3d9] overflow-hidden animate-pulse">
              <div className="h-[290px] sm:h-[330px] bg-[#f7f3eb]" />
              <div className="p-5 space-y-3">
                <div className="h-4 bg-[#f1ebe0] rounded w-3/4" />
                <div className="h-4 bg-[#f1ebe0] rounded w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : products.length > 0 ? (
        <>
          <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-2 transition-opacity ${loading ? 'opacity-60' : ''}`}>
            {products.map((p, i) => (
              <div key={p.id} className={`reveal-init delay-${((i % 4) + 1) * 100}`}>
                <ProductCard product={p} />
              </div>
            ))}
          </div>

          {data && data.totalPages > 1 && (
            <nav className="flex items-center justify-center gap-3 pt-4" aria-label={t('الصفحات', 'Pages')}>
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => p - 1)}
                className="px-5 py-2 rounded-full bg-white border border-[#e8dfd1] text-xs font-bold text-[#142b4a] hover:border-[#b99664] disabled:opacity-40 cursor-pointer disabled:cursor-default"
              >
                {t('السابق', 'Previous')}
              </button>
              <span className="text-xs font-bold text-[#77808b]">
                {t(`صفحة ${data.page} من ${data.totalPages}`, `Page ${data.page} of ${data.totalPages}`)}
              </span>
              <button
                type="button"
                disabled={page >= data.totalPages || loading}
                onClick={() => setPage((p) => p + 1)}
                className="px-5 py-2 rounded-full bg-white border border-[#e8dfd1] text-xs font-bold text-[#142b4a] hover:border-[#b99664] disabled:opacity-40 cursor-pointer disabled:cursor-default"
              >
                {t('التالي', 'Next')}
              </button>
            </nav>
          )}
        </>
      ) : (
        <div className="text-center py-20 bg-white rounded-3xl border border-[#e8dfd1] p-10 space-y-4">
          <span className="text-5xl block animate-float select-none">👗</span>
          <h3 className="text-lg font-bold text-[#142b4a]">
            {q
              ? t('لا توجد نتائج لهذا البحث', 'No results for this search')
              : t('لا توجد قطع متاحة حالياً في هذا القسم', 'No pieces currently available in this category')}
          </h3>
          <p className="text-xs text-[#77808b] max-w-sm mx-auto">
            {t('جربي اختيار قسم آخر أو تصفح كل المعروضات.', 'Try selecting another category or view all pieces.')}
          </p>
          <button
            type="button"
            className="px-6 py-2.5 rounded-full bg-[#142b4a] text-white text-xs font-bold hover:bg-[#b99664] transition-colors cursor-pointer"
            onClick={() => {
              setSearch('');
              setFilter('all');
            }}
          >
            {t('عرض جميع المنتجات', 'View all products')}
          </button>
        </div>
      )}
    </section>
  );
}
