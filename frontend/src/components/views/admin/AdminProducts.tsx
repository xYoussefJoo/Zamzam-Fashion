'use client';

import React, { useEffect, useState } from 'react';
import { useZamzamStore } from '@/store/useZamzamStore';
import { useApi, usePage } from '@/lib/useApi';
import { ApiError, errorText } from '@/lib/api';
import { deleteProduct, getAdminCategories, getColors, getInventory, getAdminProduct, getAdminProducts, updateProduct, type AdminProductRow } from '@/lib/admin';
import { pick } from '@/lib/shop';
import { Button, Field, PageHeader, ui, useConfirm } from '@/components/admin/ui';
import Select from '@/components/ui/Select';

// #21, #24 (show/hide), #25 — the product table.
export default function AdminProducts() {
  const lang = useZamzamStore((state) => state.lang);
  const adminProductFilter = useZamzamStore((state) => state.adminProductFilter);
  const setAdminProductFilter = useZamzamStore((state) => state.setAdminProductFilter);
  const setAdminTab = useZamzamStore((state) => state.setAdminTab);
  const editProduct = useZamzamStore((state) => state.editProduct);
  const catalogVersion = useZamzamStore((state) => state.catalogVersion); // the pop-up closed: reload
  const confirm = useConfirm();
  const money = useZamzamStore((state) => state.money);
  const t = useZamzamStore((state) => state.t);
  const showToast = useZamzamStore((state) => state.showToast);

  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [colorId, setColorId] = useState('all');
  const [size, setSize] = useState('all');
  const [status, setStatus] = useState<'all' | 'low' | 'out' | 'in'>('all');
  useEffect(() => {
    const timer = setTimeout(() => setQ(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);
  const [page, setPage] = usePage(`${adminProductFilter}|${q}|${colorId}|${size}|${status}`);

  const categories = useApi(getAdminCategories, []);
  const colors = useApi(getColors, []);
  const sizes = useApi(() => getInventory({ pageSize: 1 }), []); // only for the list of sizes in use
  const { data, error, loading, reload } = useApi(
    () => getAdminProducts({
      categoryId: adminProductFilter === 'all' ? undefined : Number(adminProductFilter),
      q: q || undefined,
      colorId: colorId === 'all' ? undefined : Number(colorId),
      size: size === 'all' ? undefined : size,
      status: status === 'all' ? undefined : status,
      page,
      pageSize: 20,
    }),
    [adminProductFilter, q, colorId, size, status, page, catalogVersion],
  );

  const startEdit = (id: number) => editProduct(id);

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
      showToast(err instanceof ApiError && err.code === 'HAS_ORDERS'
        ? t('هذا المنتج له طلبات ولا يمكن حذفه. أخفيه بدلًا من ذلك.', "This product has orders and can't be deleted. Hide it instead.")
        : errorText(err, t), 'error');
    }
  };

  const remove = async (row: AdminProductRow) => {
    if (!(await confirm({
      title: t(`حذف "${row.nameAr}"؟`, `Delete "${row.nameEn}"?`),
      message: t('سيُحذف المنتج وكل صوره نهائيًا. المنتج الذي له طلبات لا يمكن حذفه؛ يمكنكِ إخفاؤه.', "The product and all its photos are deleted for good. A product with orders can't be deleted; you can hide it."),
      confirmLabel: t('حذف', 'Delete'), danger: true,
    }))) return;
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
    <section className="space-y-6">
      <PageHeader
        eyebrow="PRODUCTS"
        title={t('المنتجات والموديلات', 'Products & styles')}
        description={t('قائمة المنتجات والبحث فيها. لإضافة منتج جديد أو تغيير الكميات افتحي “المخزن”.', 'List and search your products. To add a new product or change stock, open “Warehouse”.')}
        action={<Button variant="secondary" onClick={() => setAdminTab('warehouse')}>{t('المخزن', 'Warehouse')} ↗</Button>}
      />

      {/* Every filter runs on the server and combines with AND; colour, size and status match the same size/colour. */}
      <section className={`${ui.card} p-4 sm:p-5 space-y-4`}>
        <div className="flex flex-wrap gap-2" role="group" aria-label={t('حالة المخزون', 'Stock status')}>
          {([['all', 'الكل', 'All'], ['low', 'منخفض', 'Low'], ['out', 'نفد', 'Sold out'], ['in', 'متوفر', 'In stock']] as const).map(([key, ar, en]) => (
            <button key={key} type="button" aria-pressed={status === key} onClick={() => setStatus(key)}
              className={`px-4 py-2 rounded-full text-sm font-bold border transition-colors cursor-pointer ${status === key ? 'bg-[#142b4a] text-white border-[#142b4a]' : 'bg-white text-[#142b4a] border-[#dedbd5] hover:border-[#b99664]'}`}>
              {t(ar, en)}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          <Field label={t('ابحثي بالاسم أو SKU', 'Search name or SKU')} className="sm:col-span-2">
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} maxLength={100} placeholder={t('مثال: عباية أو ZF-1-M', 'e.g. abaya or ZF-1-M')} className={ui.input} />
          </Field>
          <Field label={t('القسم', 'Category')}>
            <Select value={adminProductFilter} onChange={(e) => setAdminProductFilter(e.target.value)} className={ui.input} aria-label={t('القسم', 'Category')}>
              <option value="all">{t('كل الأقسام', 'All categories')}</option>
              {allCategories.map((c) => <option key={c.id} value={String(c.id)}>{pick(lang, c.nameAr, c.nameEn)}</option>)}
            </Select>
          </Field>
          <Field label={t('اللون', 'Colour')}>
            <Select value={colorId} onChange={(e) => setColorId(e.target.value)} className={ui.input} aria-label={t('اللون', 'Colour')}>
              <option value="all">{t('كل الألوان', 'All colours')}</option>
              {(colors.data ?? []).map((c) => (
                <option key={c.id} value={String(c.id)}>
                  <span className="inline-flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full border border-black/10 inline-block" style={{ backgroundColor: c.hex }} aria-hidden="true" />
                    {pick(lang, c.nameAr, c.nameEn)}
                  </span>
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('المقاس', 'Size')}>
            <Select value={size} onChange={(e) => setSize(e.target.value)} className={ui.input} aria-label={t('المقاس', 'Size')}>
              <option value="all">{t('كل المقاسات', 'All sizes')}</option>
              {(sizes.data?.sizes ?? []).map((sz) => <option key={sz} value={sz}>{sz}</option>)}
            </Select>
          </Field>
        </div>
      </section>

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
                      {!p.isVisible && <span className="ms-2 text-[14px] px-2 py-0.5 rounded-full bg-[#f1ece4] text-[#77808a] align-middle">{t('مخفي', 'Hidden')}</span>}
                    </b>
                    <small className="block text-xs text-[#858b91] mt-0.5">
                      {pick(lang, p.categoryNameAr, p.categoryNameEn)} · <strong className="text-[#a27b4e]">{money(p.basePrice)}</strong>
                    </small>
                    <small className={`block text-xs mt-0.5 ${p.lowVariants > 0 ? 'text-[#a72f3e] font-bold' : 'text-[#858b91]'}`}>
                      {t(`${p.totalStock} في المخزن · ${p.lowVariants} من ${p.variantCount} مقاس/لون منخفض`, `${p.totalStock} in stock · ${p.lowVariants} of ${p.variantCount} variants low`)}
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
