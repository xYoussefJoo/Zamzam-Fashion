'use client';

import React, { useEffect, useState, FormEvent } from 'react';
import { useZamzamStore } from '@/store/useZamzamStore';
import { useApi, usePage } from '@/lib/useApi';
import { ApiError, errorText } from '@/lib/api';
import {
  changeOrderStatus, getAdminOrder, getAdminOrders, nextStatuses, sendQuote,
  type AdminOrder, type OrderStatus,
} from '@/lib/admin';
import { pick, statusLabel } from '@/lib/shop';
import { Button, Modal, useConfirm, useModalDirty } from '@/components/admin/ui';
import Select from '@/components/ui/Select';

const ALL_STATUSES = Object.keys(statusLabel) as OrderStatus[];

// #35–#38 — the order board and one order's details (opened from the board, the dashboard or an email link).
export default function AdminOrders() {
  const adminOrderId = useZamzamStore((state) => state.adminOrderId);
  const setAdminOrderId = useZamzamStore((state) => state.setAdminOrderId);
  if (adminOrderId) return <OrderDetail id={adminOrderId} onBack={() => setAdminOrderId(null)} />;
  return <OrderBoard onOpen={setAdminOrderId} />;
}

function OrderBoard({ onOpen }: { onOpen: (id: number) => void }) {
  const lang = useZamzamStore((state) => state.lang);
  const money = useZamzamStore((state) => state.money);
  const t = useZamzamStore((state) => state.t);
  const [status, setStatus] = useState<OrderStatus | ''>('');
  const [type, setType] = useState<'' | 'Ready' | 'Custom'>('');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setQ(search.trim()), 400);
    return () => clearTimeout(timer);
  }, [search]);
  const [page, setPage] = usePage(`${status}|${type}|${q}`);

  const { data, error, loading, reload } = useApi(
    () => getAdminOrders({ status: status ? [status] : undefined, type: type || undefined, q: q || undefined, page, pageSize: 20 }),
    [status, type, q, page],
  );
  const select = 'text-xs font-bold border border-[#e8e3d9] rounded-xl px-3 py-2 bg-white text-[#142b4a] cursor-pointer focus:ring-2 focus:ring-[#b99664] outline-none';

  return (
    <section className="bg-white rounded-3xl border border-[#e8e3d9] shadow-xs overflow-hidden">
      <div className="p-6 sm:p-7 border-b border-[#e8e3d9] bg-[#faf7f2]/50 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-serif font-bold text-[#142b4a]">{t('سجل الطلبات', 'Order management')}</h3>
          <p className="text-xs text-[#77808b] mt-0.5">{data && t(`عدد النتائج: ${data.totalCount}`, `${data.totalCount} orders`)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select aria-label={t('الحالة', 'Status')} value={status} onChange={(e) => setStatus(e.target.value as OrderStatus | '')} className={select}>
            <option value="">{t('كل الحالات', 'All statuses')}</option>
            {ALL_STATUSES.map((s) => <option key={s} value={s}>{t(...statusLabel[s])}</option>)}
          </Select>
          <Select aria-label={t('النوع', 'Type')} value={type} onChange={(e) => setType(e.target.value as '' | 'Ready' | 'Custom')} className={select}>
            <option value="">{t('كل الأنواع', 'All types')}</option>
            <option value="Ready">{t('جاهز', 'Ready')}</option>
            <option value="Custom">{t('تفصيل خاص', 'Custom')}</option>
          </Select>
          <input type="search" aria-label={t('بحث', 'Search')} placeholder={t('رقم الطلب أو الهاتف أو الاسم', 'Number, phone or name')}
            value={search} onChange={(e) => setSearch(e.target.value)} className={`${select} cursor-text w-56`} />
        </div>
      </div>

      {error ? (
        <div className="p-6 space-y-2">
          <p className="text-sm font-bold text-[#a72f3e]">{errorText(error, t)}</p>
          <button type="button" onClick={reload} className="px-4 py-2 rounded-lg bg-[#142b4a] text-white text-xs font-bold cursor-pointer">{t('إعادة المحاولة', 'Try again')}</button>
        </div>
      ) : !data ? (
        <div className="m-6 h-40 rounded-xl bg-[#f7f3eb] animate-pulse" />
      ) : data.items.length > 0 ? (
        <div className={`overflow-x-auto ${loading ? 'opacity-60' : ''}`}>
          <table className="w-full text-sm text-start">
            <thead className="bg-[#f7f3eb] text-[#77808b] text-xs uppercase tracking-wider border-b border-[#e8dfd1]">
              <tr>
                <th className="px-5 py-3.5 text-start font-bold">{t('الكود', 'Code')}</th>
                <th className="px-5 py-3.5 text-start font-bold">{t('العميل', 'Customer')}</th>
                <th className="px-5 py-3.5 text-start font-bold">{t('النوع', 'Type')}</th>
                <th className="px-5 py-3.5 text-start font-bold">{t('الإجمالي', 'Total')}</th>
                <th className="px-5 py-3.5 text-start font-bold">{t('الحالة', 'Status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e8e3d9]">
              {data.items.map((o) => (
                <tr key={o.id} onClick={() => onOpen(o.id)} className="hover:bg-[#faf7f2] transition-colors duration-150 cursor-pointer">
                  <td className="px-5 py-4 font-mono text-sm text-[#142b4a] font-bold whitespace-nowrap" dir="ltr">
                    {o.number}
                    <div className="text-[14px] text-[#77808b] font-sans font-normal">{new Date(o.createdAt).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB')}</div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="font-bold text-[#142b4a]">{o.customerName}</div>
                    <div className="text-xs text-[#77808b] mt-0.5" dir="ltr">{o.phone}</div>
                    <div className="text-xs text-[#77808b]">{pick(lang, o.zoneNameAr, o.zoneNameEn)}</div>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${o.type === 'Custom' ? 'bg-[#e7dac5] text-[#7c5e30]' : 'bg-[#dce6f2] text-[#142b4a]'}`}>
                      {o.type === 'Custom' ? t('تفصيل خاص', 'Custom') : t('جاهز', 'Ready')}
                    </span>
                  </td>
                  <td className="px-5 py-4 font-extrabold text-[#b99664]">
                    {money(o.total)}
                    <div className={`text-xs font-bold ${o.paymentStatus === 'Paid' ? 'text-green-700' : 'text-amber-800'}`}>
                      {o.paymentStatus === 'Paid' ? t('مدفوع', 'Paid') : t('غير مدفوع', 'Unpaid')}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className="inline-block px-3 py-1.5 rounded-full text-xs font-bold bg-[#f7f3eb] text-[#142b4a] border border-[#e8dfd1]">{t(...statusLabel[o.status])}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.totalPages > 1 && (
            <nav className="flex items-center justify-center gap-3 p-4">
              <button type="button" disabled={page <= 1} onClick={() => setPage((n) => n - 1)} className="px-4 py-1.5 rounded-lg border border-[#cdbb9e] text-xs font-bold disabled:opacity-40 cursor-pointer">{t('السابق', 'Previous')}</button>
              <span className="text-xs text-[#77808b]">{data.page} / {data.totalPages}</span>
              <button type="button" disabled={page >= data.totalPages} onClick={() => setPage((n) => n + 1)} className="px-4 py-1.5 rounded-lg border border-[#cdbb9e] text-xs font-bold disabled:opacity-40 cursor-pointer">{t('التالي', 'Next')}</button>
            </nav>
          )}
        </div>
      ) : (
        <div className="py-20 text-center space-y-3">
          <span className="text-5xl block select-none">📋</span>
          <p className="text-base font-bold text-[#142b4a]">{t('لا توجد طلبات هنا', 'No orders here')}</p>
        </div>
      )}
    </section>
  );
}

function OrderDetail({ id, onBack }: { id: number; onBack: () => void }) {
  const lang = useZamzamStore((state) => state.lang);
  const money = useZamzamStore((state) => state.money);
  const t = useZamzamStore((state) => state.t);
  const showToast = useZamzamStore((state) => state.showToast);
  const { data: order, error, reload } = useApi(() => getAdminOrder(id), [id]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [lastLink, setLastLink] = useState<string | null>(null);
  const confirm = useConfirm();

  if (error) {
    return (
      <section className="bg-white rounded-2xl border border-[#e8e3d9] p-6 space-y-3">
        <p className="text-sm font-bold text-[#a72f3e]">
          {error instanceof ApiError && error.status === 404 ? t('الطلب غير موجود', 'Order not found') : errorText(error, t)}
        </p>
        <button type="button" onClick={onBack} className="px-4 py-2 rounded-lg border border-[#cdbb9e] text-xs font-bold cursor-pointer">{t('← كل الطلبات', '← All orders')}</button>
      </section>
    );
  }
  if (!order) return <div className="h-64 rounded-2xl bg-[#f7f3eb] animate-pulse" />;

  const move = async (to: OrderStatus) => {
    if (to === 'Cancelled' && !(await confirm({
      title: t('إلغاء هذا الطلب؟', 'Cancel this order?'),
      message: order.type === 'Ready' ? t('ستعود القطع للمخزون.', 'Its pieces go back to stock.') : undefined,
      confirmLabel: t('إلغاء الطلب', 'Cancel order'), danger: true,
    }))) return;
    setBusy(true);
    try {
      await changeOrderStatus(order.id, to, note.trim() || null);
      setNote('');
      showToast(t('تم تحديث حالة الطلب', 'Order status updated'), 'success');
      reload();
    } catch (err) {
      showToast(err instanceof ApiError && err.code === 'INVALID_STATUS_TRANSITION' ? t('هذه الخطوة غير مسموحة الآن، تم تحديث الطلب', 'That step isn’t allowed now; the order was refreshed') : errorText(err, t), 'error');
      reload();
    } finally {
      setBusy(false);
    }
  };

  const date = (iso: string) => new Date(iso).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  const tailoring = order.tailoring;
  const next = nextStatuses(order.type, order.status);
  const card = 'bg-white rounded-2xl border border-[#e8e3d9] p-6 shadow-2xs';

  return (
    <div className="space-y-5">
      <button type="button" onClick={onBack} className="text-xs font-bold text-[#142b4a] hover:text-[#b99664] cursor-pointer">{t('← كل الطلبات', '← All orders')}</button>

      <div className={`${card} flex flex-col sm:flex-row sm:items-center justify-between gap-3`}>
        <div>
          <h3 className="text-2xl font-serif font-bold text-[#142b4a]" dir="ltr">{order.number}</h3>
          <p className="text-xs text-[#77808b]">{date(order.createdAt)} · {order.type === 'Custom' ? t('تفصيل خاص', 'Custom') : t('جاهز', 'Ready')}</p>
        </div>
        <span className="self-start px-4 py-2 rounded-full text-sm font-bold bg-[#142b4a] text-white">{t(...statusLabel[order.status])}</span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 space-y-5">
          {/* What was ordered */}
          <section className={`${card} space-y-3`}>
            {tailoring ? (
              <>
                <h4 className="font-bold text-[#142b4a]">{t('مواصفات التفصيل', 'Tailoring spec')}</h4>
                <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  {([['القطعة', 'Garment', tailoring.garment], ['الموديل', 'Style', tailoring.styleId ?? '—'], ['القماش', 'Fabric', tailoring.fabric],
                    ['اللون', 'Color', tailoring.color], ['القصّة', 'Fit', tailoring.fit], ['بطانة', 'Lining', tailoring.hasLining ? t('نعم', 'Yes') : t('لا', 'No')],
                    ['المقاس', 'Size', tailoring.sizingMode === 'StandardSize' ? tailoring.standardSize ?? '' : t('مقاسات', 'Measurements')],
                    ['إضافات', 'Extras', tailoring.extras.join(', ') || '—']] as [string, string, string][]).map(([ar, en, v]) => (
                    <div key={en}><dt className="text-xs text-[#77808b]">{t(ar, en)}</dt><dd className="font-bold text-[#142b4a] break-words">{v}</dd></div>
                  ))}
                </dl>
                {Object.keys(tailoring.measurements).length > 0 && (
                  <div className="text-xs text-[#2d3540] bg-[#faf7f2] rounded-xl p-3 leading-relaxed" dir="ltr">
                    {Object.entries(tailoring.measurements).map(([k, v]) => `${k}: ${v} cm`).join(' • ')}
                  </div>
                )}
                {tailoring.notes && <p className="text-sm italic text-[#5e605b] bg-[#f7f3eb] p-3 rounded-xl whitespace-pre-line">“{tailoring.notes}”</p>}
                {tailoring.referenceImageUrl && (
                  <a href={tailoring.referenceImageUrl} target="_blank" rel="noopener noreferrer" className="inline-block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={tailoring.referenceImageUrl} alt={t('صورة التصميم', 'Reference photo')} className="w-40 h-52 object-cover rounded-xl border border-[#e8dfd1]" />
                    <span className="block text-xs text-[#77808b] mt-1">{t('الرابط صالح 10 دقائق', 'Link valid for 10 minutes')}</span>
                  </a>
                )}
                <div className="flex flex-wrap gap-6 pt-3 border-t border-[#e8dfd1] text-sm">
                  <span>{t('التقدير', 'Estimate')}: <b className="text-[#142b4a]">{money(tailoring.estimatedPrice)}</b></span>
                  {tailoring.quotedPrice != null && <span>{t('السعر المرسل', 'Quoted')}: <b className="text-[#b99664]">{money(tailoring.quotedPrice)}</b></span>}
                  {tailoring.quoteValidUntil && <span className="text-xs text-[#77808b]">{t('صالح حتى', 'Valid until')} {date(tailoring.quoteValidUntil)}</span>}
                </div>
              </>
            ) : (
              <>
                <h4 className="font-bold text-[#142b4a]">{t('القطع', 'Items')}</h4>
                <div className="divide-y divide-[#efe9df]">
                  {order.lines.map((l) => (
                    <div key={l.variantId} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0">
                        <b className="block text-[#142b4a] truncate">{pick(lang, l.productNameAr, l.productNameEn)}</b>
                        <span className="text-xs text-[#77808b]">{l.size} · {pick(lang, l.colorNameAr, l.colorNameEn)} · {money(l.unitPrice)} × {l.qty}</span>
                      </span>
                      <b className="text-[#142b4a] shrink-0">{money(l.lineTotal)}</b>
                    </div>
                  ))}
                </div>
                <div className="pt-3 border-t border-[#e8dfd1] text-sm space-y-1">
                  <div className="flex justify-between"><span>{t('المنتجات', 'Subtotal')}</span><b>{money(order.subtotal)}</b></div>
                  <div className="flex justify-between"><span>{t('التوصيل', 'Delivery')}</span><b>{money(order.deliveryFee)}</b></div>
                  <div className="flex justify-between text-base"><b>{t('الإجمالي', 'Total')}</b><b className="text-[#b99664]">{money(order.total)}</b></div>
                </div>
              </>
            )}
          </section>

          {/* History */}
          <section className={`${card} space-y-3`}>
            <h4 className="font-bold text-[#142b4a]">{t('سجل الحالات', 'Status history')}</h4>
            <ol className="space-y-2.5">
              {order.history.map((h, i) => (
                <li key={i} className="text-sm flex flex-wrap justify-between gap-2 border-b border-[#f1ece4] pb-2 last:border-0">
                  <span><b className="text-[#142b4a]">{t(...statusLabel[h.to])}</b>{h.note ? <span className="text-[#5e605b]"> — {h.note}</span> : null}</span>
                  <span className="text-xs text-[#77808b]">{date(h.at)}{h.changedBy ? ` · ${h.changedBy}` : ''}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <div className="space-y-5">
          {/* Customer */}
          <section className={`${card} space-y-2 text-sm`}>
            <h4 className="font-bold text-[#142b4a]">{t('العميل', 'Customer')}</h4>
            <p className="font-bold text-[#142b4a]">{order.customer.name}</p>
            <a href={`tel:${order.customer.phone}`} className="block text-[#b99664] font-bold" dir="ltr">{order.customer.phone}</a>
            {order.customer.email && <p className="text-xs text-[#5e605b] break-all" dir="ltr">{order.customer.email}</p>}
            <p className="text-xs text-[#5e605b]">{pick(lang, order.zone.nameAr, order.zone.nameEn)} · {order.customer.city}</p>
            <p className="text-xs text-[#5e605b] whitespace-pre-line">{order.customer.address}</p>
            {order.customer.notes && <p className="text-xs italic text-[#77808b]">“{order.customer.notes}”</p>}
            <p className="text-xs pt-2 border-t border-[#f1ece4]">
              {t('الدفع عند الاستلام', 'Cash on delivery')} · <b className={order.paymentStatus === 'Paid' ? 'text-green-700' : 'text-amber-800'}>{order.paymentStatus === 'Paid' ? t('مدفوع', 'Paid') : t('غير مدفوع', 'Unpaid')}</b>
            </p>
          </section>

          {/* Quote (custom orders waiting for a price) */}
          {tailoring && (order.status === 'AwaitingQuote' || order.status === 'QuoteSent') && (
            <section className={`${card} space-y-3 border-2 border-[#b99664]`}>
              <h4 className="font-bold text-[#142b4a]">{t('السعر النهائي', 'Final price')}</h4>
              <p className="text-xs text-[#77808b]">{order.status === 'QuoteSent' ? t('أُرسل سعر وبانتظار رد العميلة. يمكنك تعديله.', 'A price was sent; waiting for the customer. You can change it.') : t('أكدي السعر أو عدليه وأرسليه للعميلة.', 'Confirm the price or change it and send it to the customer.')}</p>
              <Button variant="gold" className="w-full" onClick={() => setQuoteOpen(true)}>{order.status === 'QuoteSent' ? t('تعديل السعر', 'Change price') : t('إرسال السعر', 'Send price')}</Button>
            </section>
          )}
          {lastLink && (
            <section className={`${card} space-y-2`}>
              <h4 className="font-bold text-[#142b4a] text-sm">{t('رابط موافقة العميلة', 'Customer approval link')}</h4>
              <p className="text-xs text-[#5e605b] break-all font-mono select-all" dir="ltr">{lastLink}</p>
              <Button size="sm" variant="secondary" onClick={() => void navigator.clipboard?.writeText(lastLink).then(() => showToast(t('تم النسخ', 'Copied'), 'success'), () => {})}>{t('نسخ لإرساله واتساب', 'Copy to send on WhatsApp')}</Button>
            </section>
          )}

          {/* Next step */}
          {next.length > 0 && (
            <section className={`${card} space-y-3`}>
              <h4 className="font-bold text-[#142b4a]">{t('الخطوة التالية', 'Next step')}</h4>
              <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder={t('ملاحظة (اختياري)', 'Note (optional)')}
                className="w-full border border-[#e8e3d9] rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#b99664]" />
              <div className="flex flex-wrap gap-2">
                {next.map((s) => (
                  <button key={s} type="button" disabled={busy} onClick={() => void move(s)}
                    className={`px-4 py-2 rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50 ${s === 'Cancelled' ? 'border border-[#efc9c9] bg-[#fff7f7] text-[#a34c4c] hover:bg-rose-100' : 'bg-[#142b4a] text-white hover:bg-[#1e3a61]'}`}>
                    {s === 'Cancelled' ? t('إلغاء الطلب', 'Cancel order') : `→ ${t(...statusLabel[s])}`}
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      <Modal open={quoteOpen} title={t('السعر النهائي للتفصيل', 'Final tailoring price')} subtitle={order.number} onClose={() => setQuoteOpen(false)}>
        <QuoteForm order={order} onSent={(link) => { setQuoteOpen(false); setLastLink(link); reload(); }} />
      </Modal>
    </div>
  );
}

function QuoteForm({ order, onSent }: { order: AdminOrder; onSent: (customerLink: string | null) => void }) {
  const t = useZamzamStore((state) => state.t);
  const money = useZamzamStore((state) => state.money);
  const showToast = useZamzamStore((state) => state.showToast);
  const tailoring = order.tailoring!;
  const [price, setPrice] = useState(String(tailoring.quotedPrice ?? tailoring.estimatedPrice));
  const [note, setNote] = useState(tailoring.quoteNote ?? '');
  const [days, setDays] = useState(7);
  const [busy, setBusy] = useState(false);
  const initialPrice = String(tailoring.quotedPrice ?? tailoring.estimatedPrice);
  const modal = useModalDirty(price !== initialPrice || note !== (tailoring.quoteNote ?? '') || days !== 7);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const result = await sendQuote(order.id, Number(price), note.trim() || null, days);
      showToast(
        result.order.status === 'QuoteApproved'
          ? t('نفس السعر التقديري: تم اعتماده مباشرة', 'Same as the estimate: approved right away')
          : t('تم إرسال السعر للعميلة للموافقة', 'Price sent to the customer for approval'),
        'success',
      );
      onSent(result.customerLink);
    } catch (err) {
      showToast(errorText(err, t), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-xs text-[#77808b]">
        {t(`التقدير ${money(tailoring.estimatedPrice)}. نفس السعر = اعتماد مباشر؛ سعر مختلف = يُرسل للعميلة للموافقة.`,
          `Estimate ${money(tailoring.estimatedPrice)}. Same price = approved now; a different price is sent to the customer to approve.`)}
      </p>
      <label className="flex flex-col gap-1 text-xs font-bold text-[#2d3540]">
        <span>{t('السعر النهائي (ج.م)', 'Final price (EGP)')}</span>
        <input type="number" required min={1} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className="border border-[#e8e3d9] rounded-xl p-2.5 text-sm bg-white" />
      </label>
      <label className="flex flex-col gap-1 text-xs font-bold text-[#2d3540]">
        <span>{t('ملاحظة للعميلة (اختياري)', 'Note to the customer (optional)')}</span>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} className="border border-[#e8e3d9] rounded-xl p-2.5 text-sm bg-white min-h-[60px]" />
      </label>
      <label className="flex flex-col gap-1 text-xs font-bold text-[#2d3540] w-32">
        <span>{t('صالح لمدة (أيام)', 'Valid for (days)')}</span>
        <input type="number" required min={1} max={30} value={days} onChange={(e) => setDays(Number(e.target.value) || 7)} className="border border-[#e8e3d9] rounded-xl p-2.5 text-sm bg-white" />
      </label>
      <div className="flex justify-end gap-2 pt-2 border-t border-[#efe9df]">
        <Button variant="secondary" onClick={() => modal?.requestClose()}>{t('إلغاء', 'Cancel')}</Button>
        <Button type="submit" variant="gold" busy={busy}>{t('إرسال السعر', 'Send price')}</Button>
      </div>
    </form>
  );
}
