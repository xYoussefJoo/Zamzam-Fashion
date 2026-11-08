'use client';

import React, { useEffect, useState } from 'react';
import { useZamzamStore } from '@/store/useZamzamStore';
import { useApi, usePage } from '@/lib/useApi';
import { errorText } from '@/lib/api';
import { deleteProduct, getAdminCategories, getAdminProduct, getAdminProducts, updateProduct, type AdminProductRow } from '@/lib/admin';
import { pick } from '@/lib/shop';

// #21, #24 (show/hide), #25 — the product table.
export default function AdminProducts() {
  const lang = useZamzamStore((state) => state.lang);
  const adminProductFilter = useZamzamStore((state) => state.adminProductFilter);
  const setAdminProductFilter = useZamzamStore((state) => state.setAdminProductFilter);
  const openProductEditor = useZamzamStore((state) => state.openProductEditor);
  const setEditingProductId = useZamzamStore((state) => state.setEditingProductId);
  const setAdminTab = useZamzamStore((state) => state.setAdminTab);
  const money = useZamzamStore((state) => state.money);
  const t = useZamzamStore((state) => state.t);
  const showToast = useZamzamStore((state) => state.showToast);

  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [lowStock, setLowStock] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setQ(search.trim().length >= 2 ? search.trim() : ''), 400);
    return () => clearTimeout(timer);
  }, [search]);
  const [page, setPage] = usePage(`${adminProductFilter}|${q}|${lowStock}`);

  const categories = useApi(getAdminCategories, []);
  const { data, error, loading, reload } = useApi(
    () => getAdminProducts({
      categoryId: adminProductFilter === 'all' ? undefined : Number(adminProductFilter),
      q: q || undefined,
      lowStock: lowStock || undefined,
      page,
      pageSize: 20,
    }),
    [adminProductFilter, q, lowStock, page],
  );

  const startEdit = (id: number) => {
    setEditingProductId(id);
    setAdminTab('editor');
  };

  const toggle = async (row: AdminProductRow) => {
    try {
      const p = await getAdminProduct(row.id);
      await updateProduct(p.id, {
        categoryId: p.categoryId, nameAr: p.nameAr, nameEn: p.nameEn, slug: p.slug,
        descriptionAr: p.descriptionAr, descriptionEn: p.descriptionEn, basePrice: p.basePrice, isVisible: !p.isVisible,
      });
      showToast(p.isVisible ? t('تم إخفاء المنتج من المتجر', 'Product hidden from the shop') : t('المنتج ظاهر في المتجر', 'Product shown in the shop'), 'success');
      reload();
    } catch (err) {
      showToast(errorText(err, t), 'error');
    }
  };

  const remove = async (row: AdminProductRow) => {
    if (!window.confirm(t(`حذف "${row.nameAr}"؟`, `Delete "${row.nameEn}"?`))) return;
    try {
      await deleteProduct(row.id);
      showToast(t('تم حذف المنتج', 'Product deleted'), 'success');
      reload();
    } catch (err) {
      showToast(errorText(err, t), 'error');
    }
  };

  const allCategories = (categories.data ?? []).flatMap((c) => [c, ...c.children]);

  return (
    <section className="bg-white p-6 sm:p-8 rounded-2xl border border-[#e9e4dc] shadow-2xs space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#e9e4dc]">
        <div>
          <span className="text-[11px] font-bold tracking-widest text-[#9c7c54] uppercase">PRODUCTS</span>
          <h3 className="text-lg sm:text-xl font-serif font-bold text-[#142b4a] mt-0.5">{t('المنتجات والموديلات', 'Products & styles')}</h3>
          <p className="text-xs text-[#79808b]">
            {t('كل قسم ممكن يحتوي على موديلات كتير. اختاري القسم علشان تشوفي الأصناف الموجودة فيه.', 'Each category can contain many styles. Filter to manage them.')}
          </p>
        </div>
        <button type="button" className="px-5 py-2.5 rounded-xl bg-[#142b4a] hover:bg-[#1e3a61] text-white text-xs font-bold transition-colors cursor-pointer self-start sm:self-auto" onClick={() => openProductEditor()}>
          ＋ {t('منتج جديد', 'New product')}
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1.5 text-xs font-bold text-[#2d3540] w-full sm:w-56">
          <span>{t('تصفية حسب القسم', 'Filter by category')}</span>
          <select value={adminProductFilter} onChange={(e) => setAdminProductFilter(e.target.value)}
            className="border border-[#dedbd5] rounded-xl p-2.5 bg-white text-[#263548] text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#b99664]">
            <option value="all">{t('كل الأقسام', 'All categories')}</option>
            {allCategories.map((c) => (
              <option key={c.id} value={c.id}>{c.parentId ? '↳ ' : ''}{pick(lang, c.nameAr, c.nameEn)}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-bold text-[#2d3540] w-full sm:w-56">
          <span>{t('بحث بالاسم أو SKU', 'Search name or SKU')}</span>
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)}
            className="border border-[#dedbd5] rounded-xl p-2.5 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-[#b99664]" />
        </label>
        <label className="flex items-center gap-2 text-xs font-bold text-[#2d3540] cursor-pointer pb-2.5">
          <input type="checkbox" checked={lowStock} onChange={(e) => setLowStock(e.target.checked)} className="accent-[#142b4a] w-4 h-4" />
          <span>{t('مخزون منخفض فقط', 'Low stock only')}</span>
        </label>
      </div>

      {error ? (
        <div className="space-y-2">
          <p className="text-sm font-bold text-[#a72f3e]">{errorText(error, t)}</p>
          <button type="button" onClick={reload} className="px-4 py-2 rounded-lg bg-[#142b4a] text-white text-xs font-bold cursor-pointer">{t('إعادة المحاولة', 'Try again')}</button>
        </div>
      ) : !data ? (
        <div className="h-40 rounded-xl bg-[#f7f3eb] animate-pulse" />
      ) : (
        <div className={`grid gap-3 ${loading ? 'opacity-60' : ''}`}>
          {data.items.length > 0 ? (
            data.items.map((p) => (
              <article key={p.id} className="border border-[#eae6df] rounded-xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#fcfaf7] transition-colors">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-16 h-20 rounded-lg bg-[#f1ece4] border border-[#e8dfd1] flex-shrink-0 overflow-hidden flex items-center justify-center">
                    {p.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.thumbnailUrl} alt="" loading="lazy" className="w-full h-full object-cover" />
                    ) : (
                      <span aria-hidden="true">👗</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <b className="block text-sm font-bold text-[#142b4a] truncate">
                      {pick(lang, p.nameAr, p.nameEn)}
                      {!p.isVisible && <span className="ms-2 text-[10px] px-2 py-0.5 rounded-full bg-[#f1ece4] text-[#77808a] align-middle">{t('مخفي', 'Hidden')}</span>}
                    </b>
                    <small className="block text-xs text-[#858b91] mt-0.5">
                      {pick(lang, p.categoryNameAr, p.categoryNameEn)} · <strong className="text-[#a27b4e]">{money(p.basePrice)}</strong>
                    </small>
                    <small className={`block text-[11px] mt-0.5 ${p.lowStock ? 'text-[#a72f3e] font-bold' : 'text-[#858b91]'}`}>
                      {t('المخزون', 'Stock')}: {p.totalStock} · {p.variantCount} {t('مقاس/لون', 'variants')}
                      {p.lowStock ? ` · ${t('منخفض', 'low')}` : ''}
                    </small>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
                  <button type="button" className="px-3 py-1.5 rounded-lg border border-[#cdbb9e] bg-white hover:bg-[#f7f3eb] text-xs font-bold text-[#142b4a] cursor-pointer" onClick={() => startEdit(p.id)}>
                    {t('تعديل', 'Edit')}
                  </button>
                  <button type="button" className="px-3 py-1.5 rounded-lg border border-[#cdbb9e] bg-white hover:bg-[#f7f3eb] text-xs font-bold text-[#142b4a] cursor-pointer" onClick={() => void toggle(p)}>
                    {p.isVisible ? t('إخفاء', 'Hide') : t('إظهار', 'Show')}
                  </button>
                  <button type="button" className="px-3 py-1.5 rounded-lg border border-[#efc9c9] bg-[#fff7f7] hover:bg-rose-100 text-xs font-bold text-[#a34c4c] cursor-pointer" onClick={() => void remove(p)}>
                    {t('حذف', 'Delete')}
                  </button>
                </div>
              </article>
            ))
          ) : (
            <div className="text-center py-12 text-[#77808b] text-xs">{t('لا توجد منتجات هنا بعد', 'No products here yet')}</div>
          )}

          {data.totalPages > 1 && (
            <nav className="flex items-center justify-center gap-3 pt-2">
              <button type="button" disabled={page <= 1} onClick={() => setPage((n) => n - 1)} className="px-4 py-1.5 rounded-lg border border-[#cdbb9e] text-xs font-bold disabled:opacity-40 cursor-pointer">{t('السابق', 'Previous')}</button>
              <span className="text-xs text-[#77808b]">{data.page} / {data.totalPages}</span>
              <button type="button" disabled={page >= data.totalPages} onClick={() => setPage((n) => n + 1)} className="px-4 py-1.5 rounded-lg border border-[#cdbb9e] text-xs font-bold disabled:opacity-40 cursor-pointer">{t('التالي', 'Next')}</button>
            </nav>
          )}
        </div>
      )}
    </section>
  );
}
