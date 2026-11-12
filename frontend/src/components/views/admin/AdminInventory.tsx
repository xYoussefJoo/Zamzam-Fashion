'use client';

import React, { useEffect, useState, FormEvent } from 'react';
import { useZamzamStore } from '@/store/useZamzamStore';
import { useApi, usePage } from '@/lib/useApi';
import { ApiError, errorText } from '@/lib/api';
import {
  adjustStock, getAdminCategories, getInventory, getStockMovements,
  type InventoryRow, type StockReason,
} from '@/lib/admin';
import { pick } from '@/lib/shop';
import { Button, EmptyState, Field, LoadError, Modal, PageHeader, Skeleton, ui, useModalDirty } from '@/components/admin/ui';
import Select from '@/components/ui/Select';

const reasonLabels: Record<StockReason, [string, string]> = {
  Received: ['استلام بضاعة', 'Received'],
  Sold: ['بيع', 'Sold'],
  Returned: ['مرتجع', 'Returned'],
  Damaged: ['تالف', 'Damaged'],
  Correction: ['تصحيح جرد', 'Correction'],
};

// /admin/warehouse — where products are created and stock is managed: every size/colour with its quantity,
// changed with a reason, and each variant's history. Products is for listing and searching.
export default function AdminInventory() {
  const lang = useZamzamStore((state) => state.lang);
  const t = useZamzamStore((state) => state.t);
  const catalogVersion = useZamzamStore((state) => state.catalogVersion);
  const openProductEditor = useZamzamStore((state) => state.openProductEditor);
  const [lowOnly, setLowOnly] = useState(false);
  const [categoryId, setCategoryId] = useState('all');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setQ(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);
  const [page, setPage] = usePage(`${lowOnly}|${categoryId}|${q}`);
  const [history, setHistory] = useState<InventoryRow | null>(null);

  const categories = useApi(getAdminCategories, []);
  // The filters go to the server and combine with AND there.
  const { data, error, loading, reload } = useApi(
    () => getInventory({
      status: lowOnly ? 'attention' : undefined,
      q: q || undefined,
      categoryId: categoryId === 'all' ? undefined : Number(categoryId),
      page,
      pageSize: 25,
    }),
    [lowOnly, categoryId, q, page, catalogVersion],
  );

  const cards: [string, string, number | undefined, string][] = [
    ['المقاسات والألوان', 'Variants', data?.variants, 'text-[#142b4a]'],
    ['إجمالي القطع', 'Units in stock', data?.units, 'text-emerald-800'],
    ['مخزون منخفض', 'Low stock', data?.low, 'text-[#a27b4e]'],
    ['نفد', 'Sold out', data?.soldOut, 'text-[#a72f3e]'],
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="WAREHOUSE"
        title={t('المخزن', 'Warehouse')}
        description={t('أضيفي منتجات جديدة، وتابعي كل مقاس ولون مع كميته وسجل حركته.', 'Add new products, and follow every size and colour with its stock and history.')}
        action={<Button onClick={() => openProductEditor()}>＋ {t('منتج جديد', 'New product')}</Button>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(([ar, en, value, color]) => (
          <div key={en} className={`${ui.card} p-5 space-y-1`}>
            <span className="text-xs font-semibold text-[#77808a] uppercase block">{t(ar, en)}</span>
            <b className={`text-2xl sm:text-3xl font-serif font-bold ${color}`}>{value ?? '—'}</b>
          </div>
        ))}
      </div>

      <section className={`${ui.card} p-4 sm:p-5 space-y-4`}>
        <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_auto] gap-3 items-end">
          <Field label={t('ابحثي بالاسم أو SKU', 'Search name or SKU')}>
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} maxLength={100} placeholder={t('مثال: عباية أو ZF-1-M', 'e.g. abaya or ZF-1-M')} className={ui.input} />
          </Field>
          <Field label={t('القسم', 'Category')}>
            <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={ui.input} aria-label={t('القسم', 'Category')}>
              <option value="all">{t('كل الأقسام', 'All categories')}</option>
              {(categories.data ?? []).flatMap((c) => [c, ...c.children]).map((c) => (
                <option key={c.id} value={String(c.id)}>{pick(lang, c.nameAr, c.nameEn)}</option>
              ))}
            </Select>
          </Field>
          <label className="flex items-center gap-2 text-sm font-bold text-[#2d3540] cursor-pointer pb-3">
            <input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} className="accent-[#142b4a] w-4 h-4" />
            <span>{t('مخزون منخفض فقط', 'Low stock only')}</span>
          </label>
        </div>

        {error ? (
          <LoadError error={error} onRetry={reload} text={errorText(error, t)} />
        ) : !data ? (
          <Skeleton />
        ) : data.rows.items.length === 0 ? (
          <EmptyState title={t('لا توجد مقاسات بهذا الفلتر', 'No variants match these filters')} />
        ) : (
          <div className="overflow-x-auto -mx-1" aria-busy={loading}>
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="text-[#77808a] border-b border-[#efe9df]">
                  <th className="text-start font-bold py-3 px-2">{t('المنتج', 'Product')}</th>
                  <th className="text-start font-bold py-3 px-2">{t('المقاس', 'Size')}</th>
                  <th className="text-start font-bold py-3 px-2">{t('اللون', 'Colour')}</th>
                  <th className="text-start font-bold py-3 px-2">{t('الحالة', 'Status')}</th>
                  <th className="text-start font-bold py-3 px-2">{t('الكمية', 'Stock')}</th>
                  <th className="py-3 px-2"><span className="sr-only">{t('السجل', 'History')}</span></th>
                </tr>
              </thead>
              <tbody>
                {data.rows.items.map((row) => (
                  <StockRow key={`${row.variantId}-${row.version}`} row={row} lowAt={data.lowStockAtOrBelow} onSaved={reload} onHistory={() => setHistory(row)} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && data.rows.totalPages > 1 && (
          <div className="flex items-center justify-between gap-3 pt-2">
            <span className="text-xs text-[#77808a]">{t(`صفحة ${data.rows.page} من ${data.rows.totalPages}`, `Page ${data.rows.page} of ${data.rows.totalPages}`)}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{t('السابق', 'Previous')}</Button>
              <Button size="sm" variant="secondary" disabled={page >= data.rows.totalPages} onClick={() => setPage((p) => p + 1)}>{t('التالي', 'Next')}</Button>
            </div>
          </div>
        )}
      </section>

      <Modal
        open={history !== null}
        size="lg"
        title={t('سجل حركة المخزون', 'Stock history')}
        subtitle={history ? `${pick(lang, history.productNameAr, history.productNameEn)} · ${history.size} · ${pick(lang, history.color.nameAr, history.color.nameEn)}` : undefined}
        onClose={() => setHistory(null)}
      >
        {history && <StockHistory variantId={history.variantId} />}
      </Modal>
    </div>
  );
}

// One variant: − / quantity / + then Save, which asks for a reason. Keyed by version, so it restarts after each save.
function StockRow({ row, lowAt, onSaved, onHistory }: { row: InventoryRow; lowAt: number; onSaved: () => void; onHistory: () => void }) {
  const lang = useZamzamStore((state) => state.lang);
  const t = useZamzamStore((state) => state.t);
  const [stock, setStock] = useState(String(row.stock));
  const [confirming, setConfirming] = useState(false);
  const value = Number(stock);
  const valid = stock.trim() !== '' && Number.isInteger(value) && value >= 0 && value <= 100000;
  const change = valid ? value - row.stock : 0;

  const badge = row.stock <= 0
    ? ['bg-red-50 text-red-700', t('نفد', 'Sold out')]
    : row.stock <= lowAt ? ['bg-[#fff7e7] text-[#8a6d43]', t('منخفض', 'Low')] : ['bg-emerald-50 text-emerald-800', t('متوفر', 'In stock')];
  const step = (d: number) => setStock(String(Math.max(0, (valid ? value : row.stock) + d)));

  return (
    <tr className="border-b border-[#f3eee6] last:border-0 hover:bg-[#fcfaf7]">
      <td className="py-3 px-2">
        <b className="block text-[#142b4a]">{pick(lang, row.productNameAr, row.productNameEn)}</b>
        <span className="text-xs text-[#77808a] font-mono" dir="ltr">{row.sku}</span>
        {!row.productVisible && <span className="ms-2 text-xs px-2 py-0.5 rounded-full bg-[#f1ece4] text-[#666f7a]">{t('مخفي', 'Hidden')}</span>}
      </td>
      <td className="py-3 px-2 font-bold text-[#142b4a]" dir="ltr">{row.size}</td>
      <td className="py-3 px-2">
        <span className="inline-flex items-center gap-2">
          <span className="w-5 h-5 rounded-full border border-black/10" style={{ backgroundColor: row.color.hex }} aria-hidden="true" />
          {pick(lang, row.color.nameAr, row.color.nameEn)}
        </span>
      </td>
      <td className="py-3 px-2"><span className={`px-3 py-1 rounded-full text-xs font-bold ${badge[0]}`}>{badge[1]}</span></td>
      <td className="py-3 px-2">
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => step(-1)} aria-label={t('إنقاص', 'Decrease')} className="w-9 h-9 rounded-lg border border-[#dedbd5] text-[#142b4a] font-bold cursor-pointer hover:border-[#b99664]">−</button>
          <input
            type="number" inputMode="numeric" min={0} max={100000} step={1} value={stock}
            onChange={(e) => setStock(e.target.value)}
            aria-label={t('الكمية', 'Stock')}
            dir="ltr"
            className={`w-20 h-9 text-center rounded-lg border bg-white font-bold ${valid ? 'border-[#dedbd5]' : 'border-red-400'} focus:outline-none focus:ring-2 focus:ring-[#b99664]/50`}
          />
          <button type="button" onClick={() => step(1)} aria-label={t('زيادة', 'Increase')} className="w-9 h-9 rounded-lg border border-[#dedbd5] text-[#142b4a] font-bold cursor-pointer hover:border-[#b99664]">+</button>
          {change !== 0 && <Button size="sm" onClick={() => setConfirming(true)}>{t('حفظ', 'Save')}</Button>}
          {change !== 0 && <Button size="sm" variant="ghost" onClick={() => setStock(String(row.stock))}>{t('تراجع', 'Undo')}</Button>}
        </div>
      </td>
      <td className="py-3 px-2 text-end">
        <Button size="sm" variant="secondary" onClick={onHistory}>{t('السجل', 'History')}</Button>
        <Modal open={confirming} title={t('سبب تغيير الكمية', 'Reason for the change')} subtitle={`${row.sku} · ${row.stock} → ${valid ? value : row.stock}`} onClose={() => setConfirming(false)}>
          {confirming && <ReasonForm row={row} change={change} onDone={() => { setConfirming(false); onSaved(); }} />}
        </Modal>
      </td>
    </tr>
  );
}

// Asks why the stock changed (default Correction) and saves it. The server refuses going below 0 or a stale version.
function ReasonForm({ row, change, onDone }: { row: InventoryRow; change: number; onDone: () => void }) {
  const t = useZamzamStore((state) => state.t);
  const showToast = useZamzamStore((state) => state.showToast);
  const [reason, setReason] = useState<StockReason>('Correction');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const modal = useModalDirty(reason !== 'Correction' || note !== '');
  // Received/Returned only add stock, Damaged only removes it; Sold is written by orders.
  const reasons: StockReason[] = change > 0 ? ['Correction', 'Received', 'Returned'] : ['Correction', 'Damaged'];

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await adjustStock(row.variantId, { change, reason, note: note.trim() || null, version: row.version });
      showToast(t('تم تحديث الكمية', 'Stock updated'), 'success');
      onDone();
    } catch (err) {
      const code = err instanceof ApiError ? err.code : undefined;
      showToast(code === 'NEGATIVE_STOCK' ? t('الكمية لا يمكن أن تقل عن صفر', "Stock can't go below 0")
        : code === 'CONCURRENCY_CONFLICT' ? t('تغيّرت الكمية من مكان آخر؛ تم تحديث القائمة', 'This stock changed elsewhere; the list was refreshed')
        : errorText(err, t), 'error');
      if (code === 'CONCURRENCY_CONFLICT' || code === 'NEGATIVE_STOCK') onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} className="space-y-4">
      <p className={`text-2xl font-bold ${change > 0 ? 'text-emerald-800' : 'text-[#a72f3e]'}`} dir="ltr">{change > 0 ? `+${change}` : change}</p>
      <Field label={t('السبب', 'Reason')}>
        <Select value={reason} onChange={(e) => setReason(e.target.value as StockReason)} className={ui.input}>
          {reasons.map((r) => <option key={r} value={r}>{t(...reasonLabels[r])}</option>)}
        </Select>
      </Field>
      <Field label={t('ملاحظة (اختياري)', 'Note (optional)')}>
        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder={t('مثال: شحنة المورد', 'e.g. supplier delivery')} className={ui.input} />
      </Field>
      <div className="flex justify-end gap-2 pt-2 border-t border-[#efe9df]">
        <Button variant="secondary" onClick={() => modal?.requestClose()}>{t('إلغاء', 'Cancel')}</Button>
        <Button type="submit" busy={busy}>{t('حفظ', 'Save')}</Button>
      </div>
    </form>
  );
}

function StockHistory({ variantId }: { variantId: number }) {
  const lang = useZamzamStore((state) => state.lang);
  const t = useZamzamStore((state) => state.t);
  const { data, error, reload } = useApi(() => getStockMovements(variantId), [variantId]);
  const date = (iso: string) => new Date(iso).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' });

  if (error) return <LoadError error={error} onRetry={reload} text={errorText(error, t)} />;
  if (!data) return <Skeleton />;
  if (data.length === 0) return <EmptyState title={t('لا توجد حركات بعد', 'No movements yet')} />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-sm">
        <thead>
          <tr className="text-[#77808a] border-b border-[#efe9df]">
            <th className="text-start font-bold py-2 px-2">{t('التاريخ', 'Date')}</th>
            <th className="text-start font-bold py-2 px-2">{t('التغيير', 'Change')}</th>
            <th className="text-start font-bold py-2 px-2">{t('السبب', 'Reason')}</th>
            <th className="text-start font-bold py-2 px-2">{t('ملاحظة', 'Note')}</th>
            <th className="text-start font-bold py-2 px-2">{t('بواسطة', 'By')}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((m) => (
            <tr key={m.id} className="border-b border-[#f3eee6] last:border-0">
              <td className="py-2 px-2 whitespace-nowrap">{date(m.createdAt)}</td>
              <td className={`py-2 px-2 font-bold ${m.change > 0 ? 'text-emerald-800' : 'text-[#a72f3e]'}`} dir="ltr">{m.change > 0 ? `+${m.change}` : m.change}</td>
              <td className="py-2 px-2">{t(...reasonLabels[m.reason])}</td>
              <td className="py-2 px-2 text-[#5e605b]" dir="auto">{m.note ?? '—'}</td>
              <td className="py-2 px-2 text-[#5e605b]">{m.createdBy === 'Checkout' ? t('المتجر (طلب)', 'Shop (order)') : m.createdBy}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
