'use client';

import React, { useState } from 'react';
import { useZamzamStore } from '@/store/useZamzamStore';
import { useApi } from '@/lib/useApi';
import { ApiError, errorText } from '@/lib/api';
import { getAdminTailoringCatalog, saveTailoringCatalog, type TailoringCatalogContent } from '@/lib/admin';

type Field = { key: string; nameAr: string; nameEn: string; required?: boolean };
type Groups = Record<string, Field[]>;

// #39–#40 — what the tailoring form offers: garments, styles, fabrics, fits and the measurement fields.
// Saved as one document; orders already placed keep their own copy of the fields.
function AdminTailoringCatalogEditor({ data, reload }: { data: TailoringCatalogContent; reload: () => void }) {
  const t = useZamzamStore((state) => state.t);
  const showToast = useZamzamStore((state) => state.showToast);
  const [c, setC] = useState<TailoringCatalogContent | null>(() => structuredClone(data));
  const [busy, setBusy] = useState(false);

  if (!c) return <div className="h-96 rounded-2xl bg-[#f7f3eb] animate-pulse" />;

  const groups = c.measurementGroups as unknown as Groups;
  const update = (patch: Partial<TailoringCatalogContent>) => setC({ ...c, ...patch });
  const dirty = JSON.stringify(c) !== JSON.stringify(data);

  const save = async () => {
    setBusy(true);
    try {
      const saved = await saveTailoringCatalog(c);
      setC(structuredClone(saved));
      reload();
      showToast(t('تم حفظ كتالوج التفصيل', 'Tailoring catalog saved'), 'success');
    } catch (err) {
      showToast(err instanceof ApiError && err.problem.errors ? Object.values(err.problem.errors).flat().join(' ') : errorText(err, t), 'error');
    } finally {
      setBusy(false);
    }
  };

  const input = 'border border-[#dedbd5] rounded-lg p-1.5 bg-white text-xs w-full min-w-[90px]';
  const box = 'bg-white p-6 rounded-2xl border border-[#e9e4dc] shadow-2xs space-y-3';
  const head = (ar: string, en: string, onAdd: () => void) => (
    <div className="flex items-center justify-between">
      <h3 className="text-base font-serif font-bold text-[#142b4a]">{t(ar, en)}</h3>
      <button type="button" onClick={onAdd} className="px-3 py-1.5 rounded-lg border border-[#cdbb9e] text-xs font-bold cursor-pointer">＋ {t('إضافة', 'Add')}</button>
    </div>
  );
  const remove = (onRemove: () => void) => (
    <button type="button" onClick={onRemove} aria-label={t('حذف', 'Remove')} className="px-2 py-1 rounded-lg border border-[#efc9c9] bg-[#fff7f7] text-[#a34c4c] text-[11px] font-bold cursor-pointer">✕</button>
  );
  const replace = <T,>(list: T[], i: number, item: T) => list.map((x, j) => (j === i ? item : x));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#fff8e9] border border-[#ead8b6] text-[#79613f] p-3.5 rounded-xl text-xs">
        <span>{t('لإضافة قطعة جديدة: أضيفي سعرها الأساسي في "أسعار التفصيل" أولاً، ثم أضيفيها هنا. المفاتيح (key) بالإنجليزية وبدون مسافات.',
          'To add a new garment: give it a base price in "Tailoring prices" first, then add it here. Keys are English, without spaces.')}</span>
        <button type="button" disabled={busy || !dirty} onClick={() => void save()} className="px-6 py-2.5 rounded-xl bg-[#142b4a] text-white text-xs font-bold disabled:opacity-40 cursor-pointer">
          {busy ? '…' : t('حفظ الكتالوج', 'Save catalog')}
        </button>
      </div>

      <section className={box}>
        {head('القطع', 'Garments', () => update({ garments: [...c.garments, { key: '', nameAr: '', nameEn: '', measurementGroups: ['common'], isActive: true }] }))}
        {c.garments.map((g, i) => (
          <div key={i} className="grid grid-cols-2 sm:grid-cols-[1fr_1fr_1fr_1.5fr_auto_auto] gap-2 items-center">
            <input value={g.key} dir="ltr" placeholder="key" onChange={(e) => update({ garments: replace(c.garments, i, { ...g, key: e.target.value.trim() }) })} className={input} aria-label="key" />
            <input value={g.nameAr} placeholder={t('بالعربي', 'Arabic')} onChange={(e) => update({ garments: replace(c.garments, i, { ...g, nameAr: e.target.value }) })} className={input} />
            <input value={g.nameEn} dir="ltr" placeholder="English" onChange={(e) => update({ garments: replace(c.garments, i, { ...g, nameEn: e.target.value }) })} className={input} />
            <input value={g.measurementGroups.join(', ')} dir="ltr" placeholder="common, sleeves, dress" title={t('مجموعات المقاسات مفصولة بفاصلة', 'Measurement groups, comma separated')}
              onChange={(e) => update({ garments: replace(c.garments, i, { ...g, measurementGroups: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) }) })} className={input} />
            <label className="flex items-center gap-1 text-[11px] font-bold"><input type="checkbox" checked={g.isActive} onChange={(e) => update({ garments: replace(c.garments, i, { ...g, isActive: e.target.checked }) })} className="accent-[#142b4a]" />{t('مفعل', 'Active')}</label>
            {remove(() => update({ garments: c.garments.filter((_, j) => j !== i) }))}
          </div>
        ))}
      </section>

      <section className={box}>
        {head('الموديلات المقترحة', 'Suggested styles', () => update({ styles: [...c.styles, { id: '', garment: c.garments[0]?.key ?? '', nameAr: '', nameEn: '', defaultFabric: c.fabrics[0]?.key ?? '', defaultFit: c.fits[0]?.key ?? '', imageUrl: null, isActive: true }] }))}
        {c.styles.map((s, i) => (
          <div key={i} className="grid grid-cols-2 sm:grid-cols-[1fr_1fr_1fr_1fr_1fr_1fr_1.3fr_auto_auto] gap-2 items-center">
            <input value={s.id} dir="ltr" placeholder="id" onChange={(e) => update({ styles: replace(c.styles, i, { ...s, id: e.target.value.trim() }) })} className={input} aria-label="id" />
            <select value={s.garment} onChange={(e) => update({ styles: replace(c.styles, i, { ...s, garment: e.target.value }) })} className={input} aria-label={t('القطعة', 'Garment')}>
              {c.garments.map((g) => <option key={g.key} value={g.key}>{g.nameEn || g.key}</option>)}
            </select>
            <input value={s.nameAr} placeholder={t('بالعربي', 'Arabic')} onChange={(e) => update({ styles: replace(c.styles, i, { ...s, nameAr: e.target.value }) })} className={input} />
            <input value={s.nameEn} dir="ltr" placeholder="English" onChange={(e) => update({ styles: replace(c.styles, i, { ...s, nameEn: e.target.value }) })} className={input} />
            <select value={s.defaultFabric} onChange={(e) => update({ styles: replace(c.styles, i, { ...s, defaultFabric: e.target.value }) })} className={input} aria-label={t('القماش', 'Fabric')}>
              {c.fabrics.map((f) => <option key={f.key} value={f.key}>{f.nameEn || f.key}</option>)}
            </select>
            <select value={s.defaultFit} onChange={(e) => update({ styles: replace(c.styles, i, { ...s, defaultFit: e.target.value }) })} className={input} aria-label={t('القصّة', 'Fit')}>
              {c.fits.map((f) => <option key={f.key} value={f.key}>{f.nameEn || f.key}</option>)}
            </select>
            <input value={s.imageUrl ?? ''} dir="ltr" type="url" placeholder="https://… (image)" onChange={(e) => update({ styles: replace(c.styles, i, { ...s, imageUrl: e.target.value || null }) })} className={input} />
            <label className="flex items-center gap-1 text-[11px] font-bold"><input type="checkbox" checked={s.isActive} onChange={(e) => update({ styles: replace(c.styles, i, { ...s, isActive: e.target.checked }) })} className="accent-[#142b4a]" />{t('مفعل', 'Active')}</label>
            {remove(() => update({ styles: c.styles.filter((_, j) => j !== i) }))}
          </div>
        ))}
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {(['fabrics', 'fits'] as const).map((kind) => (
          <section key={kind} className={box}>
            {head(kind === 'fabrics' ? 'الأقمشة' : 'القصّات', kind === 'fabrics' ? 'Fabrics' : 'Fits', () => update({ [kind]: [...c[kind], { key: '', nameAr: '', nameEn: '', isActive: true }] }))}
            {c[kind].map((f, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto_auto] gap-2 items-center">
                <input value={f.key} dir="ltr" placeholder="key" onChange={(e) => update({ [kind]: replace(c[kind], i, { ...f, key: e.target.value.trim() }) })} className={input} aria-label="key" />
                <input value={f.nameAr} placeholder={t('بالعربي', 'Arabic')} onChange={(e) => update({ [kind]: replace(c[kind], i, { ...f, nameAr: e.target.value }) })} className={input} />
                <input value={f.nameEn} dir="ltr" placeholder="English" onChange={(e) => update({ [kind]: replace(c[kind], i, { ...f, nameEn: e.target.value }) })} className={input} />
                <label className="flex items-center gap-1 text-[11px] font-bold"><input type="checkbox" checked={f.isActive} onChange={(e) => update({ [kind]: replace(c[kind], i, { ...f, isActive: e.target.checked }) })} className="accent-[#142b4a]" />{t('مفعل', 'Active')}</label>
                {remove(() => update({ [kind]: c[kind].filter((_, j) => j !== i) }))}
              </div>
            ))}
          </section>
        ))}
      </div>

      <section className={box}>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-serif font-bold text-[#142b4a]">{t('مجموعات المقاسات', 'Measurement groups')}</h3>
          <button type="button" className="px-3 py-1.5 rounded-lg border border-[#cdbb9e] text-xs font-bold cursor-pointer"
            onClick={() => {
              const name = window.prompt(t('اسم المجموعة (بالإنجليزية، مثل skirt)', 'Group key (English, e.g. skirt)'))?.trim();
              if (name && !groups[name]) update({ measurementGroups: { ...groups, [name]: [] } as unknown as TailoringCatalogContent['measurementGroups'] });
            }}>
            ＋ {t('مجموعة', 'Group')}
          </button>
        </div>
        {Object.entries(groups).map(([group, fields]) => {
          const setFields = (next: Field[]) => update({ measurementGroups: { ...groups, [group]: next } as unknown as TailoringCatalogContent['measurementGroups'] });
          return (
            <details key={group} className="border border-[#eae6df] rounded-xl">
              <summary className="p-3 font-bold text-sm text-[#142b4a] cursor-pointer flex justify-between">
                <span dir="ltr">{group}</span>
                <span className="text-xs text-[#77808a]">{fields.length} {t('حقل', 'fields')}</span>
              </summary>
              <div className="p-3 space-y-2">
                {fields.map((f, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto_auto] gap-2 items-center">
                    <input value={f.key} dir="ltr" placeholder="key" onChange={(e) => setFields(replace(fields, i, { ...f, key: e.target.value.trim() }))} className={input} aria-label="key" />
                    <input value={f.nameAr} placeholder={t('بالعربي', 'Arabic')} onChange={(e) => setFields(replace(fields, i, { ...f, nameAr: e.target.value }))} className={input} />
                    <input value={f.nameEn} dir="ltr" placeholder="English" onChange={(e) => setFields(replace(fields, i, { ...f, nameEn: e.target.value }))} className={input} />
                    <label className="flex items-center gap-1 text-[11px] font-bold"><input type="checkbox" checked={!!f.required} onChange={(e) => setFields(replace(fields, i, { ...f, required: e.target.checked }))} className="accent-[#142b4a]" />{t('إلزامي', 'Required')}</label>
                    {remove(() => setFields(fields.filter((_, j) => j !== i)))}
                  </div>
                ))}
                <button type="button" onClick={() => setFields([...fields, { key: '', nameAr: '', nameEn: '', required: false }])} className="px-3 py-1.5 rounded-lg border border-[#cdbb9e] text-xs font-bold cursor-pointer">＋ {t('حقل', 'Field')}</button>
              </div>
            </details>
          );
        })}
      </section>
    </div>
  );
}

export default function AdminTailoringCatalog() {
  const t = useZamzamStore((state) => state.t);
  const { data, error, reload, version } = useApi(getAdminTailoringCatalog, []);
  if (error) {
    return (
      <div className="bg-white p-6 rounded-2xl border border-[#e9e4dc] space-y-2">
        <p className="text-sm font-bold text-[#a72f3e]">{errorText(error, t)}</p>
        <button type="button" onClick={reload} className="px-4 py-2 rounded-lg bg-[#142b4a] text-white text-xs font-bold cursor-pointer">{t('إعادة المحاولة', 'Try again')}</button>
      </div>
    );
  }
  if (!data) return <div className="h-96 rounded-2xl bg-[#f7f3eb] animate-pulse" />;
  // A fresh editor for every saved/loaded copy, so it never keeps stale edits.
  return <AdminTailoringCatalogEditor key={version} data={data} reload={reload} />;
}
