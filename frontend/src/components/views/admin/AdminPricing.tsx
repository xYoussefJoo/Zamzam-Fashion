'use client';

import React, { useState } from 'react';
import { useZamzamStore } from '@/store/useZamzamStore';
import { useApi } from '@/lib/useApi';
import { ApiError, errorText } from '@/lib/api';
import { getAdminTailoringCatalog, getPriceRules, savePriceRules, type PriceRules } from '@/lib/admin';
import { adminSizes } from '@/lib/labels';
import { Button, Field, Modal, ui, useModalDirty } from '@/components/admin/ui';
import Select from '@/components/ui/Select';

// #45–#46 — the rules behind the instant price estimate. New estimates use them right away; existing orders keep theirs.
// Base price = the style's own price if it has one, otherwise its garment's price.
function AdminPricingEditor({ data, reload }: { data: PriceRules; reload: () => void }) {
  const t = useZamzamStore((state) => state.t);
  const money = useZamzamStore((state) => state.money);
  const showToast = useZamzamStore((state) => state.showToast);
  const catalog = useApi(getAdminTailoringCatalog, []);
  const [p, setP] = useState<PriceRules | null>(() => structuredClone(data));
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState<'garment' | 'style' | null>(null);

  if (!p) return <div className="h-96 rounded-2xl bg-[#f7f3eb] animate-pulse" />;

  const update = (patch: Partial<PriceRules>) => setP({ ...p, ...patch });
  const replace = <T,>(list: T[], i: number, item: T) => list.map((x, j) => (j === i ? item : x));
  const dirty = JSON.stringify(p) !== JSON.stringify(data);
  const negative = [...p.garmentBasePrices.map((x) => x.basePrice), ...p.styleBasePrices.map((x) => x.basePrice), ...p.fabrics.map((x) => x.extra),
    ...p.sizeExtras.map((x) => x.extra), ...p.extras.map((x) => x.price), p.liningPrice].some((n) => !(n >= 0));
  const garments = catalog.data?.garments ?? [];
  const styles = catalog.data?.styles ?? [];
  const fabrics = catalog.data?.fabrics ?? [];
  const unpriced = garments.filter((g) => !p.garmentBasePrices.some((x) => x.garment === g.key));

  const save = async () => {
    setBusy(true);
    try {
      const saved = await savePriceRules(p);
      setP(structuredClone(saved));
      reload();
      showToast(t('تم حفظ الأسعار', 'Prices saved'), 'success');
    } catch (err) {
      showToast(err instanceof ApiError && err.problem.errors ? Object.values(err.problem.errors).flat().join(' ') : errorText(err, t), 'error');
    } finally {
      setBusy(false);
    }
  };

  const num = 'border border-[#dedbd5] rounded-lg p-1.5 bg-white text-xs w-28';
  const sel = 'border border-[#dedbd5] rounded-lg p-1.5 bg-white text-xs flex-1 min-w-[120px]';
  const txt = 'border border-[#dedbd5] rounded-lg p-1.5 bg-white text-xs flex-1 min-w-[90px]';
  const box = 'bg-white p-6 rounded-2xl border border-[#e9e4dc] shadow-2xs space-y-3';
  const del = (onClick: () => void) => (
    <button type="button" onClick={onClick} aria-label={t('حذف', 'Remove')} className="px-2 py-1 rounded-lg border border-[#efc9c9] bg-[#fff7f7] text-[#a34c4c] text-xs font-bold cursor-pointer">✕</button>
  );
  const add = (label: [string, string], onClick: () => void) => (
    <button type="button" onClick={onClick} className="px-3 py-1.5 rounded-lg border border-[#cdbb9e] text-xs font-bold cursor-pointer">＋ {t(...label)}</button>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#fff8e9] border border-[#ead8b6] text-[#79613f] p-3.5 rounded-xl text-xs">
        <span>{t('السعر التقديري = سعر الموديل (أو سعر القطعة) + فرق القماش + البطانة + فرق المقاس الكبير + الإضافات.', 'Estimate = style price (or garment price) + fabric extra + lining + large-size extra + options.')}</span>
        <button type="button" disabled={busy || !dirty || negative} onClick={() => void save()} className="px-6 py-2.5 rounded-xl bg-[#142b4a] text-white text-xs font-bold disabled:opacity-40 cursor-pointer">
          {busy ? '…' : t('حفظ الأسعار', 'Save prices')}
        </button>
      </div>
      {unpriced.length > 0 && (
        <p className="text-xs font-bold text-[#a72f3e]">{t('قطع بدون سعر أساسي:', 'Garments without a base price:')} {unpriced.map((g) => g.nameEn || g.key).join(', ')}</p>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className={box}>
          <h3 className="text-base font-serif font-bold text-[#142b4a]">{t('السعر الأساسي لكل قطعة', 'Base price per garment')}</h3>
          {p.garmentBasePrices.map((g, i) => (
            <div key={i} className="flex flex-wrap gap-2 items-center">
              <Select value={g.garment} onChange={(e) => update({ garmentBasePrices: replace(p.garmentBasePrices, i, { ...g, garment: e.target.value }) })} className={sel} aria-label={t('القطعة', 'Garment')}>
                {!garments.some((x) => x.key === g.garment) && <option value={g.garment}>{g.garment}</option>}
                {garments.map((x) => <option key={x.key} value={x.key}>{x.nameEn || x.key}</option>)}
              </Select>
              <input type="number" min={0} step="0.01" value={g.basePrice} onChange={(e) => update({ garmentBasePrices: replace(p.garmentBasePrices, i, { ...g, basePrice: Number(e.target.value) }) })} className={num} aria-label={t('السعر', 'Price')} />
              {del(() => update({ garmentBasePrices: p.garmentBasePrices.filter((_, j) => j !== i) }))}
            </div>
          ))}
          {add(['قطعة', 'Garment'], () => setAdding('garment'))}
        </section>

        <section className={box}>
          <h3 className="text-base font-serif font-bold text-[#142b4a]">{t('سعر خاص لموديل (اختياري)', 'Own price for a style (optional)')}</h3>
          {p.styleBasePrices.map((s, i) => (
            <div key={i} className="flex flex-wrap gap-2 items-center">
              <Select value={s.styleId} onChange={(e) => update({ styleBasePrices: replace(p.styleBasePrices, i, { ...s, styleId: e.target.value }) })} className={sel} aria-label={t('الموديل', 'Style')}>
                {!styles.some((x) => x.id === s.styleId) && <option value={s.styleId}>{s.styleId}</option>}
                {styles.map((x) => <option key={x.id} value={x.id}>{x.nameEn || x.id}</option>)}
              </Select>
              <input type="number" min={0} step="0.01" value={s.basePrice} onChange={(e) => update({ styleBasePrices: replace(p.styleBasePrices, i, { ...s, basePrice: Number(e.target.value) }) })} className={num} aria-label={t('السعر', 'Price')} />
              {del(() => update({ styleBasePrices: p.styleBasePrices.filter((_, j) => j !== i) }))}
            </div>
          ))}
          {add(['موديل', 'Style'], () => setAdding('style'))}
        </section>

        <section className={box}>
          <h3 className="text-base font-serif font-bold text-[#142b4a]">{t('فرق سعر القماش', 'Fabric extra')}</h3>
          {p.fabrics.map((f, i) => (
            <div key={i} className="flex flex-wrap gap-2 items-center">
              <Select value={f.fabric} onChange={(e) => update({ fabrics: replace(p.fabrics, i, { ...f, fabric: e.target.value }) })} className={sel} aria-label={t('القماش', 'Fabric')}>
                {!fabrics.some((x) => x.key === f.fabric) && <option value={f.fabric}>{f.fabric}</option>}
                {fabrics.map((x) => <option key={x.key} value={x.key}>{x.nameEn || x.key}</option>)}
              </Select>
              <input type="number" min={0} step="0.01" value={f.extra} onChange={(e) => update({ fabrics: replace(p.fabrics, i, { ...f, extra: Number(e.target.value) }) })} className={num} aria-label={t('الفرق', 'Extra')} />
              {del(() => update({ fabrics: p.fabrics.filter((_, j) => j !== i) }))}
            </div>
          ))}
          {add(['قماش', 'Fabric'], () => update({ fabrics: [...p.fabrics, { fabric: fabrics.find((x) => !p.fabrics.some((y) => y.fabric === x.key))?.key ?? '', extra: 0 }] }))}
        </section>

        <section className={box}>
          <h3 className="text-base font-serif font-bold text-[#142b4a]">{t('البطانة والمقاسات الكبيرة', 'Lining & large sizes')}</h3>
          <label className="flex items-center gap-3 text-xs font-bold text-[#2d3540]">
            <span className="w-32">{t('سعر البطانة', 'Lining price')}</span>
            <input type="number" min={0} step="0.01" value={p.liningPrice} onChange={(e) => update({ liningPrice: Number(e.target.value) })} className={num} />
            <span className="text-[#77808a] font-normal">{money(p.liningPrice)}</span>
          </label>
          {p.sizeExtras.map((s, i) => (
            <div key={i} className="flex flex-wrap gap-2 items-center">
              <span className="text-xs font-bold w-32">{t('من مقاس', 'From size')}</span>
              <Select value={s.fromSize} onChange={(e) => update({ sizeExtras: replace(p.sizeExtras, i, { ...s, fromSize: e.target.value }) })} className={sel}>
                {adminSizes.map((x) => <option key={x}>{x}</option>)}
              </Select>
              <input type="number" min={0} step="0.01" value={s.extra} onChange={(e) => update({ sizeExtras: replace(p.sizeExtras, i, { ...s, extra: Number(e.target.value) }) })} className={num} aria-label={t('الفرق', 'Extra')} />
              {del(() => update({ sizeExtras: p.sizeExtras.filter((_, j) => j !== i) }))}
            </div>
          ))}
          {add(['فرق مقاس', 'Size extra'], () => update({ sizeExtras: [...p.sizeExtras, { fromSize: 'XL', extra: 0 }] }))}
        </section>
      </div>

      <section className={box}>
        <h3 className="text-base font-serif font-bold text-[#142b4a]">{t('الإضافات (تطريز، جيوب…)', 'Options (embroidery, pockets…)')}</h3>
        {p.extras.map((x, i) => (
          <div key={i} className="flex flex-wrap gap-2 items-center">
            <input value={x.key} dir="ltr" placeholder="key" onChange={(e) => update({ extras: replace(p.extras, i, { ...x, key: e.target.value.trim() }) })} className={txt} aria-label="key" />
            <input value={x.nameAr} placeholder={t('بالعربي', 'Arabic')} onChange={(e) => update({ extras: replace(p.extras, i, { ...x, nameAr: e.target.value }) })} className={txt} />
            <input value={x.nameEn} dir="ltr" placeholder="English" onChange={(e) => update({ extras: replace(p.extras, i, { ...x, nameEn: e.target.value }) })} className={txt} />
            <input type="number" min={0} step="0.01" value={x.price} onChange={(e) => update({ extras: replace(p.extras, i, { ...x, price: Number(e.target.value) }) })} className={num} aria-label={t('السعر', 'Price')} />
            {del(() => update({ extras: p.extras.filter((_, j) => j !== i) }))}
          </div>
        ))}
        {add(['إضافة', 'Option'], () => update({ extras: [...p.extras, { key: '', nameAr: '', nameEn: '', price: 0 }] }))}
      </section>
      <Modal open={adding !== null} title={adding === 'style' ? t('سعر خاص لموديل', 'Price for a style') : t('سعر أساسي لقطعة', 'Base price for a garment')} subtitle={t('يُحفظ مع باقي الأسعار عند الضغط على "حفظ الأسعار"', 'Saved with the other prices when you press "Save prices"')} onClose={() => setAdding(null)}>
        {adding !== null && (
          <AddPriceForm
            options={adding === 'garment'
              ? garments.filter((g) => !p.garmentBasePrices.some((x) => x.garment === g.key)).map((g) => ({ key: g.key, label: g.nameEn || g.key }))
              : styles.filter((x) => !p.styleBasePrices.some((y) => y.styleId === x.id)).map((x) => ({ key: x.id, label: x.nameEn || x.id }))}
            allowNewKey={adding === 'garment'}
            onAdd={(key, price) => {
              if (adding === 'garment') update({ garmentBasePrices: [...p.garmentBasePrices, { garment: key, basePrice: price }] });
              else update({ styleBasePrices: [...p.styleBasePrices, { styleId: key, basePrice: price }] });
              setAdding(null);
            }}
          />
        )}
      </Modal>
    </div>
  );
}

export default function AdminPricing() {
  const t = useZamzamStore((state) => state.t);
  const { data, error, reload, version } = useApi(getPriceRules, []);
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
  return <AdminPricingEditor key={version} data={data} reload={reload} />;
}

// Pop-up: pick a garment/style without a price (or type a new garment key) and give it a price.
function AddPriceForm({ options, allowNewKey, onAdd }: { options: { key: string; label: string }[]; allowNewKey: boolean; onAdd: (key: string, price: number) => void }) {
  const t = useZamzamStore((state) => state.t);
  const [key, setKey] = useState(options[0]?.key ?? '');
  const [newKey, setNewKey] = useState('');
  const [price, setPrice] = useState('');
  const modal = useModalDirty(!!(newKey || price));
  const chosen = newKey.trim() || key;
  const badKey = newKey && !/^[A-Za-z0-9_-]+$/.test(newKey.trim());
  const valid = !!chosen && !badKey && price !== '' && Number(price) >= 0;

  return (
    <form onSubmit={(e) => { e.preventDefault(); if (valid) onAdd(chosen, Number(price)); }} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <Field label={t('اختاري', 'Choose')} hint={options.length === 0 ? t('كل العناصر لها سعر بالفعل', 'Everything already has a price') : undefined}>
        <Select value={key} disabled={!!newKey || options.length === 0} onChange={(e) => setKey(e.target.value)} className={ui.input}>
          {options.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
        </Select>
      </Field>
      <Field label={`${t('السعر', 'Price')} *`}>
        <input type="number" min={0} step="0.01" required autoFocus value={price} onChange={(e) => setPrice(e.target.value)} className={ui.input} dir="ltr" />
      </Field>
      {allowNewKey && (
        <Field label={t('أو مفتاح قطعة جديدة (اختياري)', 'Or a new garment key (optional)')} hint={t('بالإنجليزية بدون مسافات، مثل wide_pants', 'English, no spaces, e.g. wide_pants')}
          error={badKey ? t('حروف إنجليزية وأرقام و _ - فقط', 'English letters, digits, _ and - only') : undefined} className="sm:col-span-2">
          <input dir="ltr" maxLength={50} value={newKey} onChange={(e) => setNewKey(e.target.value)} className={ui.input} />
        </Field>
      )}
      <div className="sm:col-span-2 flex justify-end gap-2 pt-2 border-t border-[#efe9df]">
        <Button variant="secondary" onClick={() => modal?.requestClose()}>{t('إلغاء', 'Cancel')}</Button>
        <Button type="submit" disabled={!valid}>{t('إضافة', 'Add')}</Button>
      </div>
    </form>
  );
}
