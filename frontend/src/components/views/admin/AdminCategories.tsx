'use client';

import React, { useState, FormEvent } from 'react';
import { useZamzamStore } from '@/store/useZamzamStore';
import { useApi } from '@/lib/useApi';
import { ApiError, errorText, fieldError } from '@/lib/api';
import { createCategory, deleteCategory, getAdminCategories, updateCategory, type AdminCategory } from '@/lib/admin';
import { pick } from '@/lib/shop';
import { Button, EmptyState, Field, LoadError, Modal, PageHeader, Skeleton, ui, useConfirm, useModalDirty } from '@/components/admin/ui';
import Select from '@/components/ui/Select';

// #17–#20 — two levels: main category → sub-category. Add and Edit open a pop-up.
export default function AdminCategories() {
  const lang = useZamzamStore((state) => state.lang);
  const openProductEditor = useZamzamStore((state) => state.openProductEditor);
  const refreshCategories = useZamzamStore((state) => state.refreshCategories);
  const t = useZamzamStore((state) => state.t);
  const showToast = useZamzamStore((state) => state.showToast);
  const confirm = useConfirm();
  const { data, error, reload } = useApi(getAdminCategories, []);
  const [editing, setEditing] = useState<AdminCategory | 'new' | null>(null);
  const all = (data ?? []).flatMap((c) => [c, ...c.children]);

  const changed = (message: string) => {
    showToast(message, 'success');
    reload();
    void refreshCategories(); // the shop's menu
  };

  const toggle = async (c: AdminCategory) => {
    try {
      await updateCategory(c.id, { parentId: c.parentId, nameAr: c.nameAr, nameEn: c.nameEn, slug: c.slug, imageUrl: c.imageUrl, isVisible: !c.isVisible, sortOrder: c.sortOrder });
      changed(c.isVisible ? t('تم إخفاء القسم من المتجر', 'Category hidden from the shop') : t('القسم ظاهر في المتجر', 'Category shown in the shop'));
    } catch (err) {
      showToast(errorText(err, t), 'error');
    }
  };

  const remove = async (c: AdminCategory) => {
    const ok = await confirm({
      title: t(`حذف قسم "${c.nameAr}"؟`, `Delete "${c.nameEn}"?`),
      message: t('القسم يجب أن يكون فارغًا من المنتجات والأقسام الفرعية.', 'The category must have no products or sub-categories.'),
      confirmLabel: t('حذف', 'Delete'),
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteCategory(c.id);
      changed(t('تم حذف القسم', 'Category deleted'));
    } catch (err) {
      showToast(err instanceof ApiError && err.code === 'IN_USE'
        ? t('القسم به منتجات أو أقسام فرعية. انقليها أولاً.', 'This category has products or sub-categories. Move them first.')
        : errorText(err, t), 'error');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="CATEGORIES"
        title={t('الأقسام', 'Categories')}
        description={t('قسم رئيسي ثم أقسام فرعية. أضيفي القسم أولاً ثم أضيفي إليه المنتجات.', 'A main category, then sub-categories. Create the category first, then add products to it.')}
        action={<Button onClick={() => setEditing('new')}>＋ {t('قسم جديد', 'New category')}</Button>}
      />

      {error ? (
        <LoadError error={error} onRetry={reload} text={errorText(error, t)} />
      ) : !data ? (
        <Skeleton />
      ) : all.length === 0 ? (
        <section className={ui.card}><EmptyState title={t('لا توجد أقسام بعد', 'No categories yet')} /></section>
      ) : (
        <section className={`${ui.card} p-4 sm:p-5 grid gap-2.5`}>
          {all.map((c) => (
            <div key={c.id} className={`border border-[#eae6df] rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#fcfaf7] transition-colors ${c.parentId ? 'border-s-4 border-s-[#d9c5a4] bg-[#fdfbf8]' : ''}`}>
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-xl bg-[#f1ece4] overflow-hidden shrink-0 flex items-center justify-center">
                  {c.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.imageUrl} alt="" className="w-full h-full object-cover" />
                  ) : <span className="text-[#b99664]" aria-hidden="true">✦</span>}
                </div>
                <div className="min-w-0">
                  <b className="block text-sm font-bold text-[#142b4a] truncate">
                    {pick(lang, c.nameAr, c.nameEn)}
                    {!c.isVisible && <span className="ms-2 text-[14px] px-2 py-0.5 rounded-full bg-[#f1ece4] text-[#77808a] align-middle">{t('مخفي', 'Hidden')}</span>}
                  </b>
                  <small className="block text-xs text-[#858b91] mt-0.5">
                    {c.parentId
                      ? <span className="inline-block px-2 py-0.5 rounded-full bg-[#f3eadb] text-[#8a6d43] font-bold">{t('قسم فرعي من', 'Sub-category of')} {pick(lang, all.find((x) => x.id === c.parentId)?.nameAr ?? '', all.find((x) => x.id === c.parentId)?.nameEn ?? '')}</span>
                      : t('قسم رئيسي', 'Main category')} · {c.productCount} {t('منتج', 'products')} · <span dir="ltr">{c.slug}</span>
                  </small>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 self-end sm:self-auto">
                <Button size="sm" variant="secondary" onClick={() => openProductEditor(c.id)}>＋ {t('إضافة صنف', 'Add item')}</Button>
                <Button size="sm" variant="secondary" onClick={() => setEditing(c)}>{t('تعديل', 'Edit')}</Button>
                <Button size="sm" variant="secondary" onClick={() => void toggle(c)}>{c.isVisible ? t('إخفاء', 'Hide') : t('إظهار', 'Show')}</Button>
                <Button size="sm" variant="danger" onClick={() => void remove(c)}>{t('حذف', 'Delete')}</Button>
              </div>
            </div>
          ))}
        </section>
      )}

      <Modal
        open={editing !== null}
        title={editing === 'new' ? t('قسم جديد', 'New category') : t('تعديل القسم', 'Edit category')}
        onClose={() => setEditing(null)}
      >
        {editing !== null && (
          <CategoryForm
            category={editing === 'new' ? null : editing}
            parents={(data ?? []).filter((c) => editing === 'new' || c.id !== editing.id)}
            onSaved={(message) => { setEditing(null); changed(message); }}
          />
        )}
      </Modal>
    </div>
  );
}

function CategoryForm({ category, parents, onSaved }: { category: AdminCategory | null; parents: AdminCategory[]; onSaved: (message: string) => void }) {
  const lang = useZamzamStore((state) => state.lang);
  const t = useZamzamStore((state) => state.t);
  const initial = {
    nameAr: category?.nameAr ?? '', nameEn: category?.nameEn ?? '', parentId: category?.parentId ? String(category.parentId) : '',
    slug: category?.slug ?? '', imageUrl: category?.imageUrl ?? '', isVisible: category?.isVisible ?? true, sortOrder: category?.sortOrder ?? 0,
  };
  const [f, setF] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const modal = useModalDirty(JSON.stringify(f) !== JSON.stringify(initial));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    const body = {
      parentId: f.parentId ? Number(f.parentId) : null, nameAr: f.nameAr.trim(), nameEn: f.nameEn.trim() || f.nameAr.trim(),
      slug: f.slug.trim() || null, imageUrl: f.imageUrl.trim() || null, isVisible: f.isVisible, sortOrder: f.sortOrder,
    };
    try {
      if (category) await updateCategory(category.id, body);
      else await createCategory(body);
      onSaved(category ? t('تم تحديث القسم', 'Category updated') : t('تم إنشاء القسم. أضيفي إليه منتجات الآن', 'Category created. Add products to it now'));
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <Field label={`${t('الاسم بالعربي', 'Arabic name')} *`} error={fieldError(error, 'nameAr')}>
        <input required maxLength={100} autoFocus placeholder="مثال: بناطيل كتان" value={f.nameAr} onChange={(e) => setF({ ...f, nameAr: e.target.value })} className={ui.input} />
      </Field>
      <Field label={`${t('الاسم بالإنجليزي', 'English name')} *`} error={fieldError(error, 'nameEn')}>
        <input required maxLength={100} dir="ltr" placeholder="Linen Pants" value={f.nameEn} onChange={(e) => setF({ ...f, nameEn: e.target.value })} className={ui.input} />
      </Field>
      <Field label={t('تابع لقسم', 'Parent category')}>
        <Select value={f.parentId} onChange={(e) => setF({ ...f, parentId: e.target.value })} className={ui.input}>
          <option value="">{t('قسم رئيسي مستقل', 'Independent main category')}</option>
          {parents.map((c) => <option key={c.id} value={c.id}>{pick(lang, c.nameAr, c.nameEn)}</option>)}
        </Select>
      </Field>
      <Field label={t('الرابط المختصر (اختياري)', 'Link name (optional)')} hint={t('يُنشأ تلقائيًا من الاسم الإنجليزي', 'Made from the English name if empty')} error={fieldError(error, 'slug')}>
        <input dir="ltr" maxLength={100} placeholder="linen-pants" value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value })} className={ui.input} />
      </Field>
      <Field label={t('رابط صورة البطاقة (اختياري)', 'Tile image link (optional)')} className="sm:col-span-2">
        <input dir="ltr" type="url" placeholder="https://…" value={f.imageUrl} onChange={(e) => setF({ ...f, imageUrl: e.target.value })} className={ui.input} />
      </Field>
      <Field label={t('الترتيب في القائمة', 'Order in the menu')}>
        <input type="number" min={0} max={999} value={f.sortOrder} onChange={(e) => setF({ ...f, sortOrder: Number(e.target.value) || 0 })} className={ui.input} />
      </Field>
      <label className="flex items-center gap-2 text-sm font-bold text-[#2d3540] cursor-pointer sm:pt-6">
        <input type="checkbox" checked={f.isVisible} onChange={(e) => setF({ ...f, isVisible: e.target.checked })} className="accent-[#142b4a] w-4 h-4" />
        <span>{t('ظاهر في المتجر', 'Shown in the shop')}</span>
      </label>

      {error && !(error instanceof ApiError && error.problem.errors) ? (
        <p role="alert" className={`sm:col-span-2 ${ui.error}`}>
          {error instanceof ApiError && error.code === 'DUPLICATE' ? t('يوجد قسم بنفس الرابط المختصر', 'A category with this link name already exists') : errorText(error, t)}
        </p>
      ) : null}

      <div className="sm:col-span-2 flex justify-end gap-2 pt-2 border-t border-[#efe9df]">
        <Button variant="secondary" onClick={() => modal?.requestClose()}>{t('إلغاء', 'Cancel')}</Button>
        <Button type="submit" busy={busy}>{category ? t('حفظ التعديل', 'Save changes') : t('حفظ القسم', 'Save category')}</Button>
      </div>
    </form>
  );
}
