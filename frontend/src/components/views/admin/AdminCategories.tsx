'use client';

import React, { useState, FormEvent } from 'react';
import { useZamzamStore } from '@/store/useZamzamStore';

export default function AdminCategories() {
  const data = useZamzamStore((state) => state.data);
  const lang = useZamzamStore((state) => state.lang);
  const createCategory = useZamzamStore((state) => state.createCategory);
  const deleteCategory = useZamzamStore((state) => state.deleteCategory);
  const openProductEditor = useZamzamStore((state) => state.openProductEditor);
  const t = useZamzamStore((state) => state.t);
  const showToast = useZamzamStore((state) => state.showToast);

  const [ar, setAr] = useState('');
  const [en, setEn] = useState('');
  const [parentId, setParentId] = useState('');

  const cName = (c: { ar: string; en: string }) => (lang === 'ar' ? c.ar : c.en || c.ar);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!ar.trim()) return;
    const ok = createCategory(
      ar.trim(),
      en.trim() || ar.trim(),
      parentId ? Number(parentId) : null
    );
    if (ok) {
      setAr('');
      setEn('');
      setParentId('');
    }
  };

  const handleDelete = (id: number) => {
    const res = deleteCategory(id);
    if (!res.success && res.error) {
      showToast(res.error, 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Create Category Panel */}
      <section className="bg-white p-6 sm:p-8 rounded-2xl border border-[#e9e4dc] shadow-2xs space-y-4">
        <div>
          <span className="text-[11px] font-bold tracking-widest text-[#9c7c54] uppercase">
            01 / CATEGORIES
          </span>
          <h3 className="text-lg sm:text-xl font-serif font-bold text-[#142b4a] mt-0.5">
            {t('إنشاء قسم جديد', 'Create a category')}
          </h3>
          <p className="text-xs text-[#79808b]">
            {t(
              'القسم بيتعمل لوحده الأول. بعد الحفظ تقدر تضيف جواه أصناف من صفحة المنتجات.',
              'Save the category first, then add products to it from the Products page.'
            )}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <label className="flex flex-col gap-1.5 text-xs font-bold text-[#2d3540]">
            <span>{t('اسم القسم بالعربي', 'Arabic name')} *</span>
            <input
              name="ar"
              placeholder="مثال: بناطيل كتان"
              required
              value={ar}
              onChange={(e) => setAr(e.target.value)}
              className="border border-[#dedbd5] rounded-xl p-3 bg-white text-[#263548] text-sm focus:outline-none focus:ring-2 focus:ring-[#142b4a]"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-xs font-bold text-[#2d3540]">
            <span>{t('الاسم بالإنجليزي', 'English name')} *</span>
            <input
              name="en"
              placeholder="Linen Pants"
              required
              value={en}
              onChange={(e) => setEn(e.target.value)}
              className="border border-[#dedbd5] rounded-xl p-3 bg-white text-[#263548] text-sm focus:outline-none focus:ring-2 focus:ring-[#142b4a]"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-xs font-bold text-[#2d3540]">
            <span>{t('تابع لقسم (اختياري)', 'Parent category (optional)')}</span>
            <select
              name="parentId"
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="border border-[#dedbd5] rounded-xl p-3 bg-white text-[#263548] text-sm focus:outline-none focus:ring-2 focus:ring-[#142b4a]"
            >
              <option value="">
                {t('قسم رئيسي مستقل', 'Independent main category')}
              </option>
              {data.categories
                .filter((c) => !c.parentId)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {cName(c)}
                  </option>
                ))}
            </select>
          </label>

          <div className="sm:col-span-3 pt-2">
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-[#142b4a] hover:bg-[#1e3a61] text-white text-xs font-bold transition-colors cursor-pointer"
            >
              {t('حفظ القسم', 'Save category')}
            </button>
          </div>
        </form>
      </section>

      {/* Categories List */}
      <section className="bg-white p-6 sm:p-8 rounded-2xl border border-[#e9e4dc] shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#e9e4dc]">
          <h3 className="text-lg font-serif font-bold text-[#142b4a]">
            {t('الأقسام الموجودة', 'Your categories')}
          </h3>
          <span className="text-xs px-2.5 py-1 rounded-full bg-[#f8f6f2] font-bold text-[#142b4a]">
            {data.categories.length}
          </span>
        </div>

        <div className="grid gap-2.5">
          {data.categories.map((c) => (
            <div
              key={c.id}
              className="border border-[#eae6df] rounded-xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#fcfaf7] transition-colors"
            >
              <div>
                <b className="block text-sm sm:text-base font-bold text-[#142b4a]">
                  {c.parentId ? '↳ ' : ''}
                  {cName(c)}
                </b>
                <small className="block text-xs text-[#858b91] mt-0.5">
                  {c.parentId
                    ? t('قسم فرعي', 'Subcategory')
                    : t('قسم رئيسي', 'Main category')}{' '}
                  ·{' '}
                  {data.products.filter((p) => p.categoryId === c.id).length}{' '}
                  {t('منتج', 'products')}
                </small>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-lg border border-[#cdbb9e] bg-white hover:bg-[#f7f3eb] text-xs font-bold text-[#142b4a] transition-colors cursor-pointer"
                  onClick={() => openProductEditor(c.id)}
                >
                  ＋ {t('إضافة صنف', 'Add item')}
                </button>
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-lg border border-[#efc9c9] bg-[#fff7f7] hover:bg-rose-100 text-xs font-bold text-[#a34c4c] transition-colors cursor-pointer"
                  onClick={() => handleDelete(c.id)}
                >
                  {t('حذف', 'Delete')}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
