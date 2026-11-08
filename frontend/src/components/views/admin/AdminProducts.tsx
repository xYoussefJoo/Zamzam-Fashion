'use client';

import React from 'react';
import { useZamzamStore } from '@/store/useZamzamStore';
import { assetPath } from '@/data/seed';

export default function AdminProducts() {
  const data = useZamzamStore((state) => state.data);
  const lang = useZamzamStore((state) => state.lang);
  const adminProductFilter = useZamzamStore((state) => state.adminProductFilter);
  const setAdminProductFilter = useZamzamStore((state) => state.setAdminProductFilter);
  const openProductEditor = useZamzamStore((state) => state.openProductEditor);
  const setEditingProductId = useZamzamStore((state) => state.setEditingProductId);
  const setAdminTab = useZamzamStore((state) => state.setAdminTab);
  const toggleProductVisibility = useZamzamStore((state) => state.toggleProductVisibility);
  const deleteProduct = useZamzamStore((state) => state.deleteProduct);
  const isInCategory = useZamzamStore((state) => state.isInCategory);
  const money = useZamzamStore((state) => state.money);
  const t = useZamzamStore((state) => state.t);

  const cName = (c: { ar: string; en: string }) => (lang === 'ar' ? c.ar : c.en || c.ar);

  const startEdit = (id: number) => {
    setEditingProductId(id);
    setAdminTab('editor');
  };

  const handleDelete = (id: number) => {
    if (confirm(t('حذف المنتج؟', 'Delete product?'))) {
      deleteProduct(id);
    }
  };

  const filtered = data.products.filter((p) =>
    isInCategory(p, adminProductFilter)
  );

  return (
    <section className="bg-white p-6 sm:p-8 rounded-2xl border border-[#e9e4dc] shadow-2xs space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#e9e4dc]">
        <div>
          <span className="text-[11px] font-bold tracking-widest text-[#9c7c54] uppercase">
            02 / PRODUCTS
          </span>
          <h3 className="text-lg sm:text-xl font-serif font-bold text-[#142b4a] mt-0.5">
            {t('المنتجات والموديلات', 'Products & styles')}
          </h3>
          <p className="text-xs text-[#79808b]">
            {t(
              'كل قسم ممكن يحتوي على موديلات كتير. اختاري القسم علشان تشوفي الأصناف الموجودة فيه.',
              'Each category can contain many styles. Filter to manage them.'
            )}
          </p>
        </div>
        <button
          type="button"
          className="px-5 py-2.5 rounded-xl bg-[#142b4a] hover:bg-[#1e3a61] text-white text-xs font-bold transition-colors cursor-pointer self-start sm:self-auto"
          onClick={() => openProductEditor()}
        >
          ＋ {t('منتج جديد', 'New product')}
        </button>
      </div>

      {/* Filter */}
      <div className="max-w-xs">
        <label className="flex flex-col gap-1.5 text-xs font-bold text-[#2d3540]">
          <span>{t('تصفية حسب القسم', 'Filter by category')}</span>
          <select
            id="admin-category-filter"
            value={adminProductFilter}
            onChange={(e) => setAdminProductFilter(e.target.value)}
            className="border border-[#dedbd5] rounded-xl p-2.5 bg-white text-[#263548] text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#b99664]"
          >
            <option value="all">{t('كل الأقسام', 'All categories')}</option>
            {data.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {cName(c)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Products Rows */}
      <div className="grid gap-3">
        {filtered.length > 0 ? (
          filtered.map((p) => (
            <article
              key={p.id}
              className="border border-[#eae6df] rounded-xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#fcfaf7] transition-colors"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={assetPath(p.image || '')}
                  alt=""
                  loading="lazy"
                  className="w-16 h-20 object-cover rounded-lg bg-[#eee] border border-[#e8dfd1] flex-shrink-0"
                />
                <div className="min-w-0">
                  <b className="block text-sm font-bold text-[#142b4a] truncate">
                    {p[lang] || p.ar}
                  </b>
                  <small className="block text-xs text-[#858b91] mt-0.5">
                    {data.categories.find((c) => Number(c.id) === Number(p.categoryId))?.[lang] || '—'} ·{' '}
                    <strong className="text-[#a27b4e]">{money(p.price)}</strong> ·{' '}
                    {t('المخزون', 'Stock')}: {p.stock}
                  </small>
                  <small className="block text-[11px] text-[#858b91] mt-0.5">
                    {(p.sizes || []).join(' / ')} · {(p.colors || []).join('، ')}
                  </small>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-lg border border-[#cdbb9e] bg-white hover:bg-[#f7f3eb] text-xs font-bold text-[#142b4a] transition-colors cursor-pointer"
                  onClick={() => startEdit(p.id)}
                >
                  {t('تعديل', 'Edit')}
                </button>
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-lg border border-[#cdbb9e] bg-white hover:bg-[#f7f3eb] text-xs font-bold text-[#142b4a] transition-colors cursor-pointer"
                  onClick={() => toggleProductVisibility(p.id)}
                >
                  {p.visible ? t('إخفاء', 'Hide') : t('إظهار', 'Show')}
                </button>
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-lg border border-[#efc9c9] bg-[#fff7f7] hover:bg-rose-100 text-xs font-bold text-[#a34c4c] transition-colors cursor-pointer"
                  onClick={() => handleDelete(p.id)}
                >
                  {t('حذف', 'Delete')}
                </button>
              </div>
            </article>
          ))
        ) : (
          <div className="text-center py-12 text-[#77808b] text-xs">
            {t('مفيش منتجات في القسم ده لسه', 'No products in this category yet')}
          </div>
        )}
      </div>
    </section>
  );
}
