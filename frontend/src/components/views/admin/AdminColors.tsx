'use client';

import React, { useState, FormEvent } from 'react';
import { useZamzamStore } from '@/store/useZamzamStore';
import { useApi } from '@/lib/useApi';
import { ApiError, errorText } from '@/lib/api';
import { createColor, deleteColor, getColors, updateColor, type AdminColor } from '@/lib/admin';
import { Button, EmptyState, Field, LoadError, Modal, PageHeader, Skeleton, ui, useConfirm, useModalDirty } from '@/components/admin/ui';

// #31–#34 — the colors products pick from (name in both languages + swatch). Add and Edit open a pop-up.
export default function AdminColors() {
  const t = useZamzamStore((state) => state.t);
  const showToast = useZamzamStore((state) => state.showToast);
  const confirm = useConfirm();
  const { data, error, reload } = useApi(getColors, []);
  const [editing, setEditing] = useState<AdminColor | 'new' | null>(null);

  const remove = async (c: AdminColor) => {
    if (!(await confirm({ title: t(`حذف لون "${c.nameAr}"؟`, `Delete "${c.nameEn}"?`), confirmLabel: t('حذف', 'Delete'), danger: true }))) return;
    try {
      await deleteColor(c.id);
      showToast(t('تم حذف اللون', 'Color deleted'), 'success');
      reload();
    } catch (err) {
      showToast(err instanceof ApiError && err.code === 'IN_USE' ? t('هذا اللون مستخدم في منتجات، احذفيه منها أولاً', 'Products still use this color; remove it from them first') : errorText(err, t), 'error');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="COLORS"
        title={t('الألوان', 'Colors')}
        description={t('الألوان التي تختارين منها عند إضافة مقاسات المنتجات.', 'The colors you pick from when adding product sizes.')}
        action={<Button onClick={() => setEditing('new')}>＋ {t('لون جديد', 'New color')}</Button>}
      />

      {error ? (
        <LoadError error={error} onRetry={reload} text={errorText(error, t)} />
      ) : !data ? (
        <Skeleton />
      ) : data.length === 0 ? (
        <section className={ui.card}><EmptyState title={t('لا توجد ألوان بعد', 'No colors yet')} /></section>
      ) : (
        <section className={`${ui.card} p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3`}>
          {data.map((c) => (
            <div key={c.id} className="border border-[#eae6df] rounded-xl p-3 flex items-center justify-between gap-3">
              <span className="flex items-center gap-3 min-w-0">
                <span className="w-10 h-10 rounded-full border border-black/10 shrink-0 shadow-inner" style={{ backgroundColor: c.hex }} />
                <span className="min-w-0">
                  <b className="block text-sm text-[#142b4a] truncate">{c.nameAr} · {c.nameEn}</b>
                  <small className="text-xs text-[#77808a]"><span dir="ltr" className="font-mono">{c.hex}</span> · {c.usageCount} {t('مقاس يستخدمه', 'variants')}</small>
                </span>
              </span>
              <span className="flex gap-1.5 shrink-0">
                <Button size="sm" variant="secondary" onClick={() => setEditing(c)}>{t('تعديل', 'Edit')}</Button>
                <Button size="sm" variant="danger" disabled={c.usageCount > 0} title={c.usageCount > 0 ? t('مستخدم في منتجات', 'In use') : undefined} onClick={() => void remove(c)}>{t('حذف', 'Delete')}</Button>
              </span>
            </div>
          ))}
        </section>
      )}

      <Modal open={editing !== null} title={editing === 'new' ? t('لون جديد', 'New color') : t('تعديل اللون', 'Edit color')} onClose={() => setEditing(null)}>
        {editing !== null && (
          <ColorForm
            color={editing === 'new' ? null : editing}
            onSaved={() => {
              setEditing(null);
              showToast(t('تم حفظ اللون', 'Color saved'), 'success');
              reload();
            }}
          />
        )}
      </Modal>
    </div>
  );
}

function ColorForm({ color, onSaved }: { color: AdminColor | null; onSaved: () => void }) {
  const t = useZamzamStore((state) => state.t);
  const initial = { nameAr: color?.nameAr ?? '', nameEn: color?.nameEn ?? '', hex: color?.hex ?? '#d6b995' };
  const [f, setF] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const modal = useModalDirty(JSON.stringify(f) !== JSON.stringify(initial));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      const body = { nameAr: f.nameAr.trim(), nameEn: f.nameEn.trim(), hex: f.hex };
      if (color) await updateColor(color.id, body);
      else await createColor(body);
      onSaved();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex items-center gap-4 p-4 rounded-2xl bg-white border border-[#efe9df]">
        <span className="w-16 h-16 rounded-full border border-black/10 shadow-inner shrink-0" style={{ backgroundColor: f.hex }} aria-hidden="true" />
        <div className="text-sm"><b className="block text-[#142b4a]">{f.nameAr || '—'} · {f.nameEn || '—'}</b><span className="font-mono text-xs text-[#77808a]" dir="ltr">{f.hex}</span></div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label={`${t('الاسم بالعربي', 'Arabic name')} *`}>
          <input required autoFocus maxLength={50} value={f.nameAr} onChange={(e) => setF({ ...f, nameAr: e.target.value })} className={ui.input} />
        </Field>
        <Field label={`${t('الاسم بالإنجليزي', 'English name')} *`}>
          <input required maxLength={50} dir="ltr" value={f.nameEn} onChange={(e) => setF({ ...f, nameEn: e.target.value })} className={ui.input} />
        </Field>
        <Field label={t('اللون', 'Swatch')} className="sm:col-span-2">
          <span className="flex items-center gap-2">
            <input type="color" value={f.hex} onChange={(e) => setF({ ...f, hex: e.target.value })} className="w-12 h-11 rounded-lg border border-[#dedbd5] cursor-pointer" aria-label={t('اختيار اللون', 'Pick color')} />
            <input value={f.hex} onChange={(e) => setF({ ...f, hex: e.target.value })} pattern="#[0-9a-fA-F]{6}" dir="ltr" className={`${ui.input} font-mono max-w-[140px]`} aria-label="Hex" />
          </span>
        </Field>
      </div>
      {error ? (
        <p role="alert" className={ui.error}>
          {error instanceof ApiError && error.code === 'DUPLICATE' ? t('يوجد لون بنفس الاسم', 'A color with that name exists') : errorText(error, t)}
        </p>
      ) : null}
      <div className="flex justify-end gap-2 pt-2 border-t border-[#efe9df]">
        <Button variant="secondary" onClick={() => modal?.requestClose()}>{t('إلغاء', 'Cancel')}</Button>
        <Button type="submit" busy={busy}>{color ? t('حفظ', 'Save') : t('إضافة اللون', 'Add color')}</Button>
      </div>
    </form>
  );
}
