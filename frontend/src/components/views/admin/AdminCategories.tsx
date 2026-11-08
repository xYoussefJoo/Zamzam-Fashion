'use client';

import React, { useState, FormEvent } from 'react';
import { useZamzamStore } from '@/store/useZamzamStore';
import { useApi } from '@/lib/useApi';
import { ApiError, errorText, fieldError } from '@/lib/api';
import { createCategory, deleteCategory, getAdminCategories, updateCategory, type AdminCategory } from '@/lib/admin';
import { pick } from '@/lib/shop';

type Form = { id: number | null; nameAr: string; nameEn: string; parentId: string; slug: string; imageUrl: string; isVisible: boolean; sortOrder: number };
const empty: Form = { id: null, nameAr: '', nameEn: '', parentId: '', slug: '', imageUrl: '', isVisible: true, sortOrder: 0 };

// #17–#20 — two levels: main category → sub-category.
export default function AdminCategories() {
  const lang = useZamzamStore((state) => state.lang);
  const openProductEditor = useZamzamStore((state) => state.openProductEditor);
  const refreshCategories = useZamzamStore((state) => state.refreshCategories);
  const t = useZamzamStore((state) => state.t);
  const showToast = useZamzamStore((state) => state.showToast);
  const { data, error: loadError, reload } = useApi(getAdminCategories, []);

  const [form, setForm] = useState<Form>(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const all = (data ?? []).flatMap((c) => [c, ...c.children]);

  const done = (message: string) => {
    showToast(message, 'success');
    reload();
    void refreshCategories(); // the shop's menu
  };

  const body = (f: Form) => ({
    parentId: f.parentId ? Number(f.parentId) : null,
    nameAr: f.nameAr.trim(),
    nameEn: f.nameEn.trim() || f.nameAr.trim(),
    slug: f.slug.trim() || null,
    imageUrl: f.imageUrl.trim() || null,
    isVisible: f.isVisible,
    sortOrder: f.sortOrder,
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      if (form.id) await updateCategory(form.id, body(form));
      else await createCategory(body(form));
      done(form.id ? t('تم تحديث القسم', 'Category updated') : t('تم إنشاء القسم. أضيفي إليه منتجات الآن', 'Category created. Add products to it now'));
      setForm(empty);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const edit = (c: AdminCategory) =>
    setForm({ id: c.id, nameAr: c.nameAr, nameEn: c.nameEn, parentId: c.parentId ? String(c.parentId) : '', slug: c.slug, imageUrl: c.imageUrl ?? '', isVisible: c.isVisible, sortOrder: c.sortOrder });

  const toggle = async (c: AdminCategory) => {
    try {
      await updateCategory(c.id, { parentId: c.parentId, nameAr: c.nameAr, nameEn: c.nameEn, slug: c.slug, imageUrl: c.imageUrl, isVisible: !c.isVisible, sortOrder: c.sortOrder });
      done(c.isVisible ? t('تم إخفاء القسم من المتجر', 'Category hidden from the shop') : t('القسم ظاهر في المتجر', 'Category shown in the shop'));
    } catch (err) {
      showToast(errorText(err, t), 'error');
    }
  };

  const remove = async (c: AdminCategory) => {
    if (!window.confirm(t(`حذف قسم "${c.nameAr}"؟`, `Delete "${c.nameEn}"?`))) return;
    try {
      await deleteCategory(c.id);
      done(t('تم حذف القسم', 'Category deleted'));
    } catch (err) {
      showToast(
        err instanceof ApiError && err.code === 'IN_USE'
          ? t('القسم به منتجات أو أقسام فرعية. انقليها أولاً.', 'This category has products or sub-categories. Move them first.')
          : errorText(err, t),
        'error',
      );
    }
  };

  const input = 'border border-[#dedbd5] rounded-xl p-3 bg-white text-[#263548] text-sm focus:outline-none focus:ring-2 focus:ring-[#b99664]';
  const msg = (f: string) => {
    const m = fieldError(error, f);
    return m ? <small className="text-[11px] text-[#a72f3e]">{m}</small> : null;
  };

  return (
    <div className="space-y-6">
      <section className="bg-white p-6 sm:p-8 rounded-2xl border border-[#e9e4dc] shadow-2xs space-y-4">
        <div>
          <span className="text-[11px] font-bold tracking-widest text-[#9c7c54] uppercase">CATEGORIES</span>
          <h3 className="text-lg sm:text-xl font-serif font-bold text-[#142b4a] mt-0.5">
            {form.id ? t('تعديل القسم', 'Edit category') : t('إنشاء قسم جديد', 'Create a category')}
          </h3>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <label className="flex flex-col gap-1.5 text-xs font-bold text-[#2d3540]">
            <span>{t('اسم القسم بالعربي', 'Arabic name')} *</span>
            <input required maxLength={100} placeholder="مثال: بناطيل كتان" value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} className={input} />
            {msg('nameAr')}
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-bold text-[#2d3540]">
            <span>{t('الاسم بالإنجليزي', 'English name')} *</span>
            <input required maxLength={100} placeholder="Linen Pants" dir="ltr" value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} className={input} />
            {msg('nameEn')}
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-bold text-[#2d3540]">
            <span>{t('تابع لقسم (اختياري)', 'Parent category (optional)')}</span>
            <select value={form.parentId} onChange={(e) => setForm({ ...form, parentId: e.target.value })} className={input}>
              <option value="">{t('قسم رئيسي مستقل', 'Independent main category')}</option>
              {(data ?? []).filter((c) => c.id !== form.id).map((c) => (
                <option key={c.id} value={c.id}>{pick(lang, c.nameAr, c.nameEn)}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-bold text-[#2d3540]">
            <span>{t('الرابط المختصر (slug، اختياري)', 'Link name (slug, optional)')}</span>
            <input dir="ltr" maxLength={100} placeholder="linen-pants" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className={input} />
            {msg('slug')}
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-bold text-[#2d3540]">
            <span>{t('رابط صورة البطاقة (اختياري)', 'Tile image link (optional)')}</span>
            <input dir="ltr" type="url" placeholder="https://…" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} className={input} />
          </label>
          <div className="flex items-center gap-4">
            <label className="flex flex-col gap-1.5 text-xs font-bold text-[#2d3540] w-24">
              <span>{t('الترتيب', 'Order')}</span>
              <input type="number" min={0} max={999} value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) || 0 })} className={input} />
            </label>
            <label className="flex items-center gap-2 text-xs font-bold text-[#2d3540] cursor-pointer pt-5">
              <input type="checkbox" checked={form.isVisible} onChange={(e) => setForm({ ...form, isVisible: e.target.checked })} className="accent-[#142b4a] w-4 h-4" />
              <span>{t('ظاهر في المتجر', 'Shown in the shop')}</span>
            </label>
          </div>

          {error && !(error instanceof ApiError && error.problem.errors) ? (
            <p role="alert" className="sm:col-span-3 text-xs font-bold text-[#a72f3e]">
              {error instanceof ApiError && error.code === 'DUPLICATE' ? t('يوجد قسم بنفس الرابط المختصر', 'A category with this link name already exists') : errorText(error, t)}
            </p>
          ) : null}

          <div className="sm:col-span-3 pt-2 flex gap-2">
            <button type="submit" disabled={busy} className="px-6 py-2.5 rounded-xl bg-[#142b4a] hover:bg-[#1e3a61] disabled:opacity-60 text-white text-xs font-bold transition-colors cursor-pointer">
              {busy ? '…' : form.id ? t('حفظ التعديل', 'Save changes') : t('حفظ القسم', 'Save category')}
            </button>
            {form.id && (
              <button type="button" onClick={() => { setForm(empty); setError(undefined); }} className="px-6 py-2.5 rounded-xl border border-[#cdbb9e] bg-white text-xs font-bold text-[#142b4a] cursor-pointer">
                {t('إلغاء', 'Cancel')}
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="bg-white p-6 sm:p-8 rounded-2xl border border-[#e9e4dc] shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#e9e4dc]">
          <h3 className="text-lg font-serif font-bold text-[#142b4a]">{t('الأقسام الموجودة', 'Your categories')}</h3>
          <span className="text-xs px-2.5 py-1 rounded-full bg-[#f8f6f2] font-bold text-[#142b4a]">{all.length}</span>
        </div>

        {loadError ? (
          <div className="space-y-2">
            <p className="text-sm font-bold text-[#a72f3e]">{errorText(loadError, t)}</p>
            <button type="button" onClick={reload} className="px-4 py-2 rounded-lg bg-[#142b4a] text-white text-xs font-bold cursor-pointer">{t('إعادة المحاولة', 'Try again')}</button>
          </div>
        ) : !data ? (
          <div className="h-32 rounded-xl bg-[#f7f3eb] animate-pulse" />
        ) : (
          <div className="grid gap-2.5">
            {all.map((c) => (
              <div key={c.id} className={`border border-[#eae6df] rounded-xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#fcfaf7] transition-colors ${c.parentId ? 'sm:ms-8' : ''}`}>
                <div>
                  <b className="block text-sm sm:text-base font-bold text-[#142b4a]">
                    {c.parentId ? '↳ ' : ''}
                    {pick(lang, c.nameAr, c.nameEn)}
                    {!c.isVisible && <span className="ms-2 text-[10px] px-2 py-0.5 rounded-full bg-[#f1ece4] text-[#77808a] align-middle">{t('مخفي', 'Hidden')}</span>}
                  </b>
                  <small className="block text-xs text-[#858b91] mt-0.5">
                    {c.parentId ? t('قسم فرعي', 'Subcategory') : t('قسم رئيسي', 'Main category')} · {c.productCount} {t('منتج', 'products')} · <span dir="ltr">{c.slug}</span>
                  </small>
                </div>
                <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto">
                  <button type="button" className="px-3 py-1.5 rounded-lg border border-[#cdbb9e] bg-white hover:bg-[#f7f3eb] text-xs font-bold text-[#142b4a] cursor-pointer" onClick={() => openProductEditor(c.id)}>
                    ＋ {t('إضافة صنف', 'Add item')}
                  </button>
                  <button type="button" className="px-3 py-1.5 rounded-lg border border-[#cdbb9e] bg-white hover:bg-[#f7f3eb] text-xs font-bold text-[#142b4a] cursor-pointer" onClick={() => edit(c)}>
                    {t('تعديل', 'Edit')}
                  </button>
                  <button type="button" className="px-3 py-1.5 rounded-lg border border-[#cdbb9e] bg-white hover:bg-[#f7f3eb] text-xs font-bold text-[#142b4a] cursor-pointer" onClick={() => void toggle(c)}>
                    {c.isVisible ? t('إخفاء', 'Hide') : t('إظهار', 'Show')}
                  </button>
                  <button type="button" className="px-3 py-1.5 rounded-lg border border-[#efc9c9] bg-[#fff7f7] hover:bg-rose-100 text-xs font-bold text-[#a34c4c] cursor-pointer" onClick={() => void remove(c)}>
                    {t('حذف', 'Delete')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
