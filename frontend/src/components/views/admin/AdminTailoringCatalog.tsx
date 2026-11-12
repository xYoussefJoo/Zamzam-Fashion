'use client';

import React, { useState } from 'react';
import { useZamzamStore } from '@/store/useZamzamStore';
import { useApi } from '@/lib/useApi';
import { ApiError, errorText } from '@/lib/api';
import { getAdminTailoringCatalog, saveTailoringCatalog, type TailoringCatalogContent } from '@/lib/admin';

import { Button, Field as FormField, Modal, ui, useModalDirty } from '@/components/admin/ui';
import Select from '@/components/ui/Select';

type Field = { key: string; nameAr: string; nameEn: string; required?: boolean };
type Groups = Record<string, Field[]>;
type AddKind = 'garments' | 'styles' | 'fabrics' | 'fits' | 'group' | { field: string };

// #39–#40 — what the tailoring form offers: garments, styles, fabrics, fits and the measurement fields.
// Saved as one document; orders already placed keep their own copy of the fields.
function AdminTailoringCatalogEditor({ data, reload }: { data: TailoringCatalogContent; reload: () => void }) {
  const t = useZamzamStore((state) => state.t);
  const showToast = useZamzamStore((state) => state.showToast);
  const [c, setC] = useState<TailoringCatalogContent | null>(() => structuredClone(data));
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState<AddKind | null>(null);

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
    <button type="button" onClick={onRemove} aria-label={t('حذف', 'Remove')} className="px-2 py-1 rounded-lg border border-[#efc9c9] bg-[#fff7f7] text-[#a34c4c] text-xs font-bold cursor-pointer">✕</button>
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
        {head('القطع', 'Garments', () => setAdding('garments'))}
        {c.garments.map((g, i) => (
          <div key={i} className="grid grid-cols-2 sm:grid-cols-[1fr_1fr_1fr_1.5fr_auto_auto] gap-2 items-center">
            <input value={g.key} dir="ltr" placeholder="key" onChange={(e) => update({ garments: replace(c.garments, i, { ...g, key: e.target.value.trim() }) })} className={input} aria-label="key" />
            <input value={g.nameAr} placeholder={t('بالعربي', 'Arabic')} onChange={(e) => update({ garments: replace(c.garments, i, { ...g, nameAr: e.target.value }) })} className={input} />
            <input value={g.nameEn} dir="ltr" placeholder="English" onChange={(e) => update({ garments: replace(c.garments, i, { ...g, nameEn: e.target.value }) })} className={input} />
            <input value={g.measurementGroups.join(', ')} dir="ltr" placeholder="common, sleeves, dress" title={t('مجموعات المقاسات مفصولة بفاصلة', 'Measurement groups, comma separated')}
              onChange={(e) => update({ garments: replace(c.garments, i, { ...g, measurementGroups: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) }) })} className={input} />
            <label className="flex items-center gap-1 text-xs font-bold"><input type="checkbox" checked={g.isActive} onChange={(e) => update({ garments: replace(c.garments, i, { ...g, isActive: e.target.checked }) })} className="accent-[#142b4a]" />{t('مفعل', 'Active')}</label>
            {remove(() => update({ garments: c.garments.filter((_, j) => j !== i) }))}
          </div>
        ))}
      </section>

      <section className={box}>
        {head('الموديلات المقترحة', 'Suggested styles', () => setAdding('styles'))}
        {c.styles.map((s, i) => (
          <div key={i} className="grid grid-cols-2 sm:grid-cols-[1fr_1fr_1fr_1fr_1fr_1fr_1.3fr_auto_auto] gap-2 items-center">
            <input value={s.id} dir="ltr" placeholder="id" onChange={(e) => update({ styles: replace(c.styles, i, { ...s, id: e.target.value.trim() }) })} className={input} aria-label="id" />
            <Select value={s.garment} onChange={(e) => update({ styles: replace(c.styles, i, { ...s, garment: e.target.value }) })} className={input} aria-label={t('القطعة', 'Garment')}>
              {c.garments.map((g) => <option key={g.key} value={g.key}>{g.nameEn || g.key}</option>)}
            </Select>
            <input value={s.nameAr} placeholder={t('بالعربي', 'Arabic')} onChange={(e) => update({ styles: replace(c.styles, i, { ...s, nameAr: e.target.value }) })} className={input} />
            <input value={s.nameEn} dir="ltr" placeholder="English" onChange={(e) => update({ styles: replace(c.styles, i, { ...s, nameEn: e.target.value }) })} className={input} />
            <Select value={s.defaultFabric} onChange={(e) => update({ styles: replace(c.styles, i, { ...s, defaultFabric: e.target.value }) })} className={input} aria-label={t('القماش', 'Fabric')}>
              {c.fabrics.map((f) => <option key={f.key} value={f.key}>{f.nameEn || f.key}</option>)}
            </Select>
            <Select value={s.defaultFit} onChange={(e) => update({ styles: replace(c.styles, i, { ...s, defaultFit: e.target.value }) })} className={input} aria-label={t('القصّة', 'Fit')}>
              {c.fits.map((f) => <option key={f.key} value={f.key}>{f.nameEn || f.key}</option>)}
            </Select>
            <input value={s.imageUrl ?? ''} dir="ltr" type="url" placeholder="https://… (image)" onChange={(e) => update({ styles: replace(c.styles, i, { ...s, imageUrl: e.target.value || null }) })} className={input} />
            <label className="flex items-center gap-1 text-xs font-bold"><input type="checkbox" checked={s.isActive} onChange={(e) => update({ styles: replace(c.styles, i, { ...s, isActive: e.target.checked }) })} className="accent-[#142b4a]" />{t('مفعل', 'Active')}</label>
            {remove(() => update({ styles: c.styles.filter((_, j) => j !== i) }))}
          </div>
        ))}
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {(['fabrics', 'fits'] as const).map((kind) => (
          <section key={kind} className={box}>
            {head(kind === 'fabrics' ? 'الأقمشة' : 'القصّات', kind === 'fabrics' ? 'Fabrics' : 'Fits', () => setAdding(kind))}
            {c[kind].map((f, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto_auto] gap-2 items-center">
                <input value={f.key} dir="ltr" placeholder="key" onChange={(e) => update({ [kind]: replace(c[kind], i, { ...f, key: e.target.value.trim() }) })} className={input} aria-label="key" />
                <input value={f.nameAr} placeholder={t('بالعربي', 'Arabic')} onChange={(e) => update({ [kind]: replace(c[kind], i, { ...f, nameAr: e.target.value }) })} className={input} />
                <input value={f.nameEn} dir="ltr" placeholder="English" onChange={(e) => update({ [kind]: replace(c[kind], i, { ...f, nameEn: e.target.value }) })} className={input} />
                <label className="flex items-center gap-1 text-xs font-bold"><input type="checkbox" checked={f.isActive} onChange={(e) => update({ [kind]: replace(c[kind], i, { ...f, isActive: e.target.checked }) })} className="accent-[#142b4a]" />{t('مفعل', 'Active')}</label>
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
            onClick={() => setAdding('group')}>
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
                    <label className="flex items-center gap-1 text-xs font-bold"><input type="checkbox" checked={!!f.required} onChange={(e) => setFields(replace(fields, i, { ...f, required: e.target.checked }))} className="accent-[#142b4a]" />{t('إلزامي', 'Required')}</label>
                    {remove(() => setFields(fields.filter((_, j) => j !== i)))}
                  </div>
                ))}
                <button type="button" onClick={() => setAdding({ field: group })} className="px-3 py-1.5 rounded-lg border border-[#cdbb9e] text-xs font-bold cursor-pointer">＋ {t('حقل', 'Field')}</button>
              </div>
            </details>
          );
        })}
      </section>

      <Modal open={adding !== null} title={t('إضافة للكتالوج', 'Add to the catalog')} subtitle={t('تُحفظ مع الكتالوج عند الضغط على "حفظ الكتالوج"', 'Saved with the catalog when you press "Save catalog"')} onClose={() => setAdding(null)}>
        {adding !== null && <AddItemForm kind={adding} catalog={c} onAdd={(patch) => { update(patch); setAdding(null); }} />}
      </Modal>
    </div>
  );
}

const KEY = /^[A-Za-z0-9_-]+$/;

// The pop-up form for one new catalog item; hands back the catalog change to apply.
function AddItemForm({ kind, catalog, onAdd }: { kind: AddKind; catalog: TailoringCatalogContent; onAdd: (patch: Partial<TailoringCatalogContent>) => void }) {
  const t = useZamzamStore((state) => state.t);
  const groups = catalog.measurementGroups as unknown as Groups;
  const [key, setKey] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [garment, setGarment] = useState(catalog.garments[0]?.key ?? '');
  const [fabric, setFabric] = useState(catalog.fabrics[0]?.key ?? '');
  const [fit, setFit] = useState(catalog.fits[0]?.key ?? '');
  const [imageUrl, setImageUrl] = useState('');
  const [itemGroups, setItemGroups] = useState<string[]>(['common']);
  const [required, setRequired] = useState(false);
  const modal = useModalDirty(!!(key || nameAr || nameEn));

  const isGroup = kind === 'group';
  const fieldGroup = typeof kind === 'object' ? kind.field : null;
  const taken = isGroup ? Object.keys(groups)
    : fieldGroup ? (groups[fieldGroup] ?? []).map((f) => f.key)
    : kind === 'styles' ? catalog.styles.map((s) => s.id)
    : catalog[kind as 'garments' | 'fabrics' | 'fits'].map((x) => x.key);
  const keyError = key && !KEY.test(key) ? t('حروف إنجليزية وأرقام و _ - فقط', 'English letters, digits, _ and - only')
    : taken.includes(key) ? t('هذا المفتاح مستخدم بالفعل', 'That key is already used') : undefined;
  const asGroups = (g: Groups) => g as unknown as TailoringCatalogContent['measurementGroups'];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (keyError || !key) return;
    if (isGroup) onAdd({ measurementGroups: asGroups({ ...groups, [key]: [] }) });
    else if (fieldGroup) onAdd({ measurementGroups: asGroups({ ...groups, [fieldGroup]: [...(groups[fieldGroup] ?? []), { key, nameAr, nameEn, required }] }) });
    else if (kind === 'garments') onAdd({ garments: [...catalog.garments, { key, nameAr, nameEn, measurementGroups: itemGroups, isActive: true }] });
    else if (kind === 'styles') onAdd({ styles: [...catalog.styles, { id: key, garment, nameAr, nameEn, defaultFabric: fabric, defaultFit: fit, imageUrl: imageUrl.trim() || null, isActive: true }] });
    else if (kind === 'fabrics' || kind === 'fits') onAdd({ [kind]: [...catalog[kind], { key, nameAr, nameEn, isActive: true }] });
  };

  const what = isGroup ? t('مجموعة مقاسات جديدة', 'New measurement group')
    : fieldGroup ? t(`حقل جديد في ${fieldGroup}`, `New field in ${fieldGroup}`)
    : kind === 'garments' ? t('قطعة جديدة', 'New garment')
    : kind === 'styles' ? t('موديل جديد', 'New style')
    : kind === 'fabrics' ? t('قماش جديد', 'New fabric') : t('قصّة جديدة', 'New fit');

  return (
    <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <p className="sm:col-span-2 text-sm font-bold text-[#142b4a]">{what}</p>
      <FormField label={`${kind === 'styles' ? 'ID' : t('المفتاح (key)', 'Key')} *`} hint={t('بالإنجليزية وبدون مسافات، مثل wide_pants', 'English, no spaces, e.g. wide_pants')} error={keyError}>
        <input required autoFocus dir="ltr" maxLength={50} value={key} onChange={(e) => setKey(e.target.value.trim())} className={ui.input} />
      </FormField>
      {!isGroup && (
        <>
          <FormField label={`${t('الاسم بالعربي', 'Arabic name')} *`}>
            <input required maxLength={100} value={nameAr} onChange={(e) => setNameAr(e.target.value)} className={ui.input} />
          </FormField>
          <FormField label={`${t('الاسم بالإنجليزي', 'English name')} *`}>
            <input required maxLength={100} dir="ltr" value={nameEn} onChange={(e) => setNameEn(e.target.value)} className={ui.input} />
          </FormField>
        </>
      )}
      {kind === 'garments' && (
        <div className="sm:col-span-2 space-y-2">
          <span className={ui.label}>{t('مجموعات المقاسات لهذه القطعة', 'Measurement groups for this garment')}</span>
          <div className="flex flex-wrap gap-2">
            {Object.keys(groups).map((g) => (
              <label key={g} dir="ltr" className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-[#f7f3eb] cursor-pointer">
                <input type="checkbox" className="accent-[#142b4a]" checked={itemGroups.includes(g)} onChange={() => setItemGroups((l) => (l.includes(g) ? l.filter((x) => x !== g) : [...l, g]))} />
                {g}
              </label>
            ))}
          </div>
          <p className={ui.hint}>{t('تذكري: أضيفي سعرًا أساسيًا لهذه القطعة في "أسعار التفصيل".', 'Remember: give this garment a base price in "Tailoring prices".')}</p>
        </div>
      )}
      {kind === 'styles' && (
        <>
          <FormField label={t('القطعة', 'Garment')}>
            <Select value={garment} onChange={(e) => setGarment(e.target.value)} className={ui.input}>
              {catalog.garments.map((g) => <option key={g.key} value={g.key}>{g.nameEn || g.key}</option>)}
            </Select>
          </FormField>
          <FormField label={t('القماش الافتراضي', 'Default fabric')}>
            <Select value={fabric} onChange={(e) => setFabric(e.target.value)} className={ui.input}>
              {catalog.fabrics.map((f) => <option key={f.key} value={f.key}>{f.nameEn || f.key}</option>)}
            </Select>
          </FormField>
          <FormField label={t('القصّة الافتراضية', 'Default fit')}>
            <Select value={fit} onChange={(e) => setFit(e.target.value)} className={ui.input}>
              {catalog.fits.map((f) => <option key={f.key} value={f.key}>{f.nameEn || f.key}</option>)}
            </Select>
          </FormField>
          <FormField label={t('رابط صورة (اختياري)', 'Image link (optional)')} className="sm:col-span-2">
            <input type="url" dir="ltr" placeholder="https://…" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className={ui.input} />
          </FormField>
        </>
      )}
      {fieldGroup && (
        <label className="flex items-center gap-2 text-sm font-bold text-[#2d3540] cursor-pointer">
          <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} className="accent-[#142b4a] w-4 h-4" />
          {t('حقل إلزامي', 'Required field')}
        </label>
      )}
      <div className="sm:col-span-2 flex justify-end gap-2 pt-2 border-t border-[#efe9df]">
        <Button variant="secondary" onClick={() => modal?.requestClose()}>{t('إلغاء', 'Cancel')}</Button>
        <Button type="submit" disabled={!!keyError || !key}>{t('إضافة', 'Add')}</Button>
      </div>
    </form>
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
