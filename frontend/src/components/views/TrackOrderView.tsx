'use client';

import React, { useEffect, useState } from 'react';
import { useZamzamStore } from '@/store/useZamzamStore';
import { useApi } from '@/lib/useApi';
import { ApiError, errorText } from '@/lib/api';
import TrackLookup from '@/components/views/TrackLookup';
import { approveQuote, pick, rejectQuote, rememberOrder, statusLabel, trackOrder, type PublicOrder } from '@/lib/shop';

// /track/[number]?t=… — the page every order and quote email links to. The token is the key; no login.
export default function TrackOrderView() {
  const tracking = useZamzamStore((state) => state.tracking);
  const t = useZamzamStore((state) => state.t);
  const number = tracking?.number ?? '';
  const token = tracking?.token ?? '';
  const { data, error, loading, reload } = useApi(() => trackOrder(number, token), [number, token], !!number && !!token);

  // Opening a tracking link on a new device adds the order to "My orders" there too.
  useEffect(() => {
    if (data) rememberOrder({ number: data.number, token, createdAt: data.createdAt, kind: data.type });
  }, [data, token]);

  if (!number || !token || (error instanceof ApiError && error.status === 404)) {
    return (
      <div className="max-w-[760px] mx-auto px-4 sm:px-6 py-20 text-center space-y-4 animate-scale-in">
        <span className="text-5xl block animate-float select-none">🔍</span>
        <h2 className="text-2xl font-serif font-bold text-[#142b4a]">{t('لم يتم العثور على الطلب', 'Order not found')}</h2>
        <p className="text-sm text-[#77808b]">
          {t('تأكدي من استخدام الرابط كما وصلكِ في الرسالة بالكامل.', 'Check that you opened the full link from your message.')}
        </p>
        <div className="text-start pt-4"><TrackLookup /></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-[760px] mx-auto px-4 py-20 text-center space-y-4">
        <p className="text-sm font-bold text-[#a72f3e]">{errorText(error, t)}</p>
        <button type="button" onClick={reload} className="px-6 py-2.5 rounded-full bg-[#142b4a] text-white text-xs font-bold cursor-pointer">
          {t('إعادة المحاولة', 'Try again')}
        </button>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="max-w-[860px] mx-auto px-4 sm:px-6 py-12 space-y-4 animate-pulse" aria-busy="true">
        <div className="h-10 bg-[#f1ebe0] rounded w-1/2" />
        <div className="h-40 bg-[#f7f3eb] rounded-3xl" />
        <div className="h-56 bg-[#f7f3eb] rounded-3xl" />
      </div>
    );
  }

  return <OrderDetails order={data} token={token} onChanged={reload} />;
}

// token is empty when the order was found by number + phone/email: the customer sees everything,
// but answering a price quote still needs the private link from the message.
export function OrderDetails({ order, token, onChanged }: { order: PublicOrder; token: string; onChanged: () => void }) {
  const lang = useZamzamStore((state) => state.lang);
  const t = useZamzamStore((state) => state.t);
  const money = useZamzamStore((state) => state.money);
  const go = useZamzamStore((state) => state.go);
  const showToast = useZamzamStore((state) => state.showToast);
  const [busy, setBusy] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<unknown>();

  const date = (iso: string) =>
    new Date(iso).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  const tailoring = order.tailoring;
  const waitingForMe = order.status === 'QuoteSent';

  const answer = async (approve: boolean) => {
    setBusy(true);
    setError(undefined);
    try {
      if (approve) await approveQuote(order.number, token);
      else await rejectQuote(order.number, token, reason.trim() || null);
      showToast(approve ? t('تمت الموافقة على السعر، سنبدأ التنفيذ', 'Price approved. We’ll start making it') : t('تم إلغاء الطلب', 'Order cancelled'), 'success');
      onChanged();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  const answerError = () => {
    if (!(error instanceof ApiError)) return error ? errorText(error, t) : '';
    if (error.code === 'QUOTE_EXPIRED') return t('انتهت صلاحية عرض السعر. تواصلي معنا لإرسال عرض جديد.', 'This price offer has expired. Contact us for a new one.');
    if (error.code === 'INVALID_STATUS_TRANSITION') return t('تم الرد على هذا العرض من قبل.', 'This offer was already answered.');
    return errorText(error, t);
  };

  return (
    <section className="max-w-[860px] mx-auto px-4 sm:px-6 py-12 space-y-6 animate-scale-in">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-4 border-b border-[#e8dfd1]">
        <div>
          <span className="text-xs text-[#b99664] font-bold tracking-[0.2em] uppercase">{t('تتبع الطلب', 'ORDER TRACKING')}</span>
          <h2 className="text-2xl sm:text-4xl font-serif font-bold text-[#142b4a] mt-1" dir="ltr">{order.number}</h2>
          <p className="text-xs text-[#77808b] mt-1">{date(order.createdAt)}</p>
        </div>
        <span className="self-start sm:self-auto px-4 py-2 rounded-full text-sm font-bold bg-[#142b4a] text-white">
          {t(...statusLabel[order.status])}
        </span>
      </div>

      {/* Quote waiting for the customer */}
      {tailoring && waitingForMe && (
        <div className="rounded-3xl border-2 border-[#b99664] bg-[#fbf8f2] p-6 space-y-4">
          <h3 className="text-lg font-serif font-bold text-[#142b4a]">{t('سعر التفصيل النهائي', 'Your final tailoring price')}</h3>
          <div className="flex flex-wrap items-baseline gap-3">
            <span className="text-3xl font-extrabold text-[#b99664]">{money(tailoring.quotedPrice)}</span>
            {tailoring.quotedPrice !== tailoring.estimatedPrice && (
              <span className="text-sm text-[#77808b] line-through">{money(tailoring.estimatedPrice)}</span>
            )}
          </div>
          {tailoring.quoteNote && <p className="text-sm text-[#2d3540] whitespace-pre-line">{tailoring.quoteNote}</p>}
          {tailoring.quoteValidUntil && (
            <p className="text-xs text-[#77808b]">{t(`العرض صالح حتى ${date(tailoring.quoteValidUntil)}`, `Valid until ${date(tailoring.quoteValidUntil)}`)}</p>
          )}

          {!token ? (
            <p className="text-sm font-bold text-[#8a6d43]">{t('للموافقة على السعر أو رفضه افتحي الرابط الذي وصلكِ في الرسالة.', 'To accept or decline this price, open the link from your message.')}</p>
          ) : declining ? (
            <div className="space-y-3">
              <label className="flex flex-col gap-1.5 text-xs font-bold text-[#2d3540]">
                <span>{t('سبب الرفض (اختياري)', 'Reason (optional)')}</span>
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300}
                  className="border border-[#e8e3d9] rounded-xl p-3 bg-white text-sm min-h-[70px] focus:outline-none focus:ring-2 focus:ring-[#b99664]" />
              </label>
              <div className="flex flex-wrap gap-3">
                <button type="button" disabled={busy} onClick={() => answer(false)}
                  className="px-6 py-3 rounded-full bg-[#a72f3e] hover:bg-[#8e2533] disabled:opacity-60 text-white text-sm font-bold cursor-pointer">
                  {t('تأكيد إلغاء الطلب', 'Confirm cancel order')}
                </button>
                <button type="button" disabled={busy} onClick={() => setDeclining(false)}
                  className="px-6 py-3 rounded-full border border-[#142b4a] text-[#142b4a] text-sm font-bold cursor-pointer">
                  {t('رجوع', 'Back')}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              <button type="button" disabled={busy} onClick={() => answer(true)}
                className="px-7 py-3 rounded-full bg-[#142b4a] hover:bg-[#b99664] disabled:opacity-60 text-white text-sm font-bold cursor-pointer">
                {busy ? '…' : t('موافقة على السعر', 'Approve price')}
              </button>
              <button type="button" disabled={busy} onClick={() => setDeclining(true)}
                className="px-7 py-3 rounded-full border border-[#a72f3e] text-[#a72f3e] hover:bg-red-50 text-sm font-bold cursor-pointer">
                {t('رفض', 'Decline')}
              </button>
            </div>
          )}
          {error ? <p role="alert" className="text-xs font-bold text-[#a72f3e]">{answerError()}</p> : null}
        </div>
      )}

      {/* Timeline */}
      <div className="bg-white rounded-3xl border border-[#e8e3d9] p-6 sm:p-7 shadow-xs">
        <h3 className="text-base font-bold text-[#142b4a] mb-4">{t('مراحل الطلب', 'Order progress')}</h3>
        <ol className="space-y-3">
          {order.timeline.map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className={`mt-1 w-3 h-3 rounded-full shrink-0 ${i === order.timeline.length - 1 ? 'bg-[#b99664]' : 'bg-[#142b4a]/40'}`} />
              <div className="flex-1 flex flex-wrap justify-between gap-2 text-sm">
                <b className="text-[#142b4a]">{t(...statusLabel[step.to])}</b>
                <span className="text-xs text-[#77808b]">{date(step.at)}</span>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* What was ordered */}
      <div className="bg-white rounded-3xl border border-[#e8e3d9] p-6 sm:p-7 shadow-xs space-y-4">
        {tailoring ? (
          <>
            <h3 className="text-base font-bold text-[#142b4a]">{t('تفاصيل التفصيل', 'Tailoring details')}</h3>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-xs text-[#77808b]">{t('القطعة', 'Garment')}</dt><dd className="font-bold text-[#142b4a]">{tailoring.garment}</dd></div>
              <div><dt className="text-xs text-[#77808b]">{t('القماش', 'Fabric')}</dt><dd className="font-bold text-[#142b4a]">{tailoring.fabric}</dd></div>
              <div><dt className="text-xs text-[#77808b]">{t('اللون', 'Color')}</dt><dd className="font-bold text-[#142b4a]">{tailoring.color}</dd></div>
              <div><dt className="text-xs text-[#77808b]">{t('القصّة', 'Fit')}</dt><dd className="font-bold text-[#142b4a]">{tailoring.fit}</dd></div>
            </dl>
            <div className="flex justify-between pt-3 border-t border-[#e8dfd1] text-sm">
              <span className="text-[#5e605b]">{tailoring.quotedPrice != null ? t('السعر المعتمد', 'Confirmed price') : t('السعر التقديري', 'Estimated price')}</span>
              <b className="text-[#b99664] text-lg">{money(tailoring.quotedPrice ?? tailoring.estimatedPrice)}</b>
            </div>
          </>
        ) : (
          <>
            <h3 className="text-base font-bold text-[#142b4a]">{t('القطع', 'Items')}</h3>
            <div className="divide-y divide-[#e8dfd1]">
              {order.lines.map((l) => (
                <div key={l.variantId} className="py-3 flex items-center gap-3">
                  <div className="w-14 h-16 rounded-lg overflow-hidden bg-[#f7f3eb] shrink-0 flex items-center justify-center">
                    {l.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={l.imageUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span aria-hidden="true">👗</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 text-sm">
                    <b className="block text-[#142b4a] truncate">{pick(lang, l.productNameAr, l.productNameEn)}</b>
                    <span className="text-xs text-[#77808b]">
                      {l.size} · {pick(lang, l.colorNameAr, l.colorNameEn)} · {money(l.unitPrice)} × {l.qty}
                    </span>
                  </div>
                  <b className="text-sm text-[#142b4a]">{money(l.lineTotal)}</b>
                </div>
              ))}
            </div>
            <div className="space-y-2 pt-3 border-t border-[#e8dfd1] text-sm">
              <div className="flex justify-between text-[#5e605b]"><span>{t('المنتجات', 'Subtotal')}</span><b className="text-[#142b4a]">{money(order.subtotal)}</b></div>
              <div className="flex justify-between text-[#5e605b]"><span>{t('التوصيل', 'Delivery')}</span><b className="text-[#142b4a]">{money(order.deliveryFee)}</b></div>
              <div className="flex justify-between font-bold"><span className="text-[#142b4a]">{t('الإجمالي', 'Total')}</span><b className="text-lg text-[#b99664]">{money(order.total)}</b></div>
            </div>
          </>
        )}
      </div>

      {/* Delivery and payment */}
      <div className="bg-[#f7f3eb] rounded-3xl border border-[#e8dfd1] p-6 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
        <div><span className="block text-xs text-[#77808b]">{t('الاسم', 'Name')}</span><b className="text-[#142b4a]">{order.customer.name}</b></div>
        <div><span className="block text-xs text-[#77808b]">{t('الموبايل', 'Phone')}</span><b className="text-[#142b4a]" dir="ltr">{order.customer.phone}</b></div>
        <div><span className="block text-xs text-[#77808b]">{t('المحافظة', 'Governorate')}</span><b className="text-[#142b4a]">{pick(lang, order.customer.zone.nameAr, order.customer.zone.nameEn)}</b></div>
        <div className="sm:col-span-3 text-xs text-[#77808b]">
          {t('الدفع عند الاستلام', 'Cash on delivery')} · {order.paymentStatus === 'Paid' ? t('تم الدفع', 'Paid') : t('لم يتم الدفع بعد', 'Not paid yet')}
        </div>
      </div>

      <div className="text-center">
        <button type="button" onClick={() => go('orders')} className="text-sm font-bold text-[#142b4a] hover:text-[#b99664] cursor-pointer">
          {t('← كل طلباتي', '← All my orders')}
        </button>
      </div>
    </section>
  );
}
