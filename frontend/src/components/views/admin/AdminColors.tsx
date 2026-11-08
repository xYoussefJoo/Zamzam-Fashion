'use client';

import React, { useState, FormEvent } from 'react';
import { useZamzamStore } from '@/store/useZamzamStore';
import { useApi } from '@/lib/useApi';
import { ApiError, errorText } from '@/lib/api';
import { createColor, deleteColor, getColors, updateColor, type AdminColor } from '@/lib/admin';

// #31–#34 — the color list products pick from (name in both languages + the swatch color).
export default function AdminColors() {
  const t = useZamzamStore((state) => state.t);
  const showToast = useZamzamStore((state) => state.showToast);
  const { data, error, reload } = useApi(getColors, []);
  const [editing, setEditing] = useState<number | null>(null);
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [hex, setHex] = useState('#d6b995');
  const [busy, setBusy] = useState(false);

  const reset = () => { setEditing(null); setNameAr(''); setNameEn(''); setHex('#d6b995'); };
  const edit = (c: AdminColor) => { setEditing(c.id); setNameAr(c.nameAr); setNameEn(c.nameEn); setHex(c.hex); };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = { nameAr: nameAr.trim(), nameEn: nameEn.trim(), hex };
      if (editing) await updateColor(editing, body);
      else await createColor(body);
      showToast(editing ? t('تم تحديث اللون', 'Color updated') : t('تمت إضافة اللون', 'Color added'), 'success');
      reset();
      reload();
    } catch (err) {
      showToast(err instanceof ApiError && err.code === 'DUPLICATE' ? t('يوجد لون بنفس الاسم', 'A color with that name exists') : errorText(err, t), 'error');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (c: AdminColor) => {
    if (!window.confirm(t(`حذف لون "${c.nameAr}"؟`, `Delete "${c.nameEn}"?`))) return;
    try {
      await deleteColor(c.id);
      reload();
    } catch (err) {
      showToast(err instanceof ApiError && err.code === 'IN_USE' ? t('هذا اللون مستخدم في منتجات، احذفيه منها أولاً', 'Products still use this color; remove it from them first') : errorText(err, t), 'error');
    }
  };

  const input = 'border border-[#dedbd5] rounded-xl p-2.5 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#b99664]';
  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="bg-white p-6 rounded-2xl border border-[#e9e4dc] shadow-2xs flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1.5 text-xs font-bold text-[#2d3540]">
          <span>{t('الاسم بالعربي', 'Arabic name')} *</span>
          <input required maxLength={50} value={nameAr} onChange={(e) => setNameAr(e.target.value)} className={input} />
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-bold text-[#2d3540]">
          <span>{t('الاسم بالإنجليزي', 'English name')} *</span>
          <input required maxLength={50} dir="ltr" value={nameEn} onChange={(e) => setNameEn(e.target.value)} className={input} />
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-bold text-[#2d3540]">
          <span>{t('اللون', 'Swatch')}</span>
          <span className="flex items-center gap-2">
            <input type="color" value={hex} onChange={(e) => setHex(e.target.value)} className="w-11 h-11 rounded-lg border border-[#dedbd5] cursor-pointer" aria-label={t('اختيار اللون', 'Pick color')} />
            <input value={hex} onChange={(e) => setHex(e.target.value)} pattern="#[0-9a-fA-F]{6}" dir="ltr" className={`${input} w-28 font-mono`} aria-label="Hex" />
          </span>
        </label>
        <button type="submit" disabled={busy} className="px-6 py-2.5 rounded-xl bg-[#142b4a] text-white text-xs font-bold disabled:opacity-60 cursor-pointer">
          {editing ? t('حفظ', 'Save') : `＋ ${t('إضافة لون', 'Add color')}`}
        </button>
        {editing && <button type="button" onClick={reset} className="px-4 py-2.5 rounded-xl border border-[#cdbb9e] text-xs font-bold cursor-pointer">{t('إلغاء', 'Cancel')}</button>}
      </form>

      <section className="bg-white p-6 rounded-2xl border border-[#e9e4dc] shadow-2xs">
        {error ? (
          <div className="space-y-2">
            <p className="text-sm font-bold text-[#a72f3e]">{errorText(error, t)}</p>
            <button type="button" onClick={reload} className="px-4 py-2 rounded-lg bg-[#142b4a] text-white text-xs font-bold cursor-pointer">{t('إعادة المحاولة', 'Try again')}</button>
          </div>
        ) : !data ? (
          <div className="h-32 rounded-xl bg-[#f7f3eb] animate-pulse" />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.map((c) => (
              <div key={c.id} className="border border-[#eae6df] rounded-xl p-3 flex items-center justify-between gap-3">
                <span className="flex items-center gap-3 min-w-0">
                  <span className="w-9 h-9 rounded-full border border-black/10 shrink-0" style={{ backgroundColor: c.hex }} />
                  <span className="min-w-0">
                    <b className="block text-sm text-[#142b4a] truncate">{c.nameAr} · {c.nameEn}</b>
                    <small className="text-[11px] text-[#77808a]">{c.usageCount} {t('مقاس/لون يستخدمه', 'variants use it')}</small>
                  </span>
                </span>
                <span className="flex gap-1.5 shrink-0">
                  <button type="button" onClick={() => edit(c)} className="px-2.5 py-1 rounded-lg border border-[#cdbb9e] text-[11px] font-bold cursor-pointer">{t('تعديل', 'Edit')}</button>
                  <button type="button" onClick={() => void remove(c)} disabled={c.usageCount > 0} title={c.usageCount > 0 ? t('مستخدم في منتجات', 'In use') : undefined}
                    className="px-2.5 py-1 rounded-lg border border-[#efc9c9] bg-[#fff7f7] text-[#a34c4c] text-[11px] font-bold disabled:opacity-40 cursor-pointer">{t('حذف', 'Delete')}</button>
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
