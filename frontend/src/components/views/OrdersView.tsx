'use client';

import React, { useState, FormEvent } from 'react';
import { useZamzamStore } from '@/store/useZamzamStore';
import { useApi } from '@/lib/useApi';
import { ApiError } from '@/lib/api';
import { savedOrders, statusLabel, trackOrder, type SavedOrder } from '@/lib/shop';
import TrackLookup from '@/components/views/TrackLookup';

// "My orders": the orders placed on this device (number + tracking token in local storage), each with its live status.
export default function OrdersView() {
  const t = useZamzamStore((state) => state.t);
  const go = useZamzamStore((state) => state.go);
  const openTracking = useZamzamStore((state) => state.openTracking);
  const [orders] = useState<SavedOrder[]>(() => savedOrders());
  const [link, setLink] = useState('');
  const [linkError, setLinkError] = useState(false);

  // Paste the link from the confirmation email: https://…/track/ZF-10234?t=…
  const openLink = (e: FormEvent) => {
    e.preventDefault();
    try {
      const url = new URL(link.trim(), window.location.origin);
      const match = url.pathname.match(/\/track\/([^/]+)/);
      const token = url.searchParams.get('t');
      if (match && token) {
        openTracking(decodeURIComponent(match[1]), token);
        return;
      }
    } catch {}
    setLinkError(true);
  };

  return (
    <section className="max-w-[1240px] mx-auto px-4 sm:px-6 py-12 space-y-8 animate-scale-in">
      <div className="pb-4 border-b border-[#e8dfd1]">
        <span className="text-xs text-[#b99664] font-bold tracking-[0.2em] uppercase">HISTORY</span>
        <h2 className="text-2xl sm:text-4xl font-serif font-bold text-[#142b4a] mt-1">{t('طلباتي', 'My orders')}</h2>
        <p className="text-xs sm:text-sm text-[#77808b] mt-0.5">
          {t('الطلبات التي أرسلتِها من هذا الجهاز، بحالتها الحالية', 'Orders placed from this device, with their current status')}
        </p>
      </div>

      <TrackLookup />

      <form onSubmit={openLink} className="bg-[#f7f3eb] rounded-2xl border border-[#e8dfd1] p-4 flex flex-col sm:flex-row gap-3 sm:items-center">
        <label htmlFor="track-link" className="text-xs font-bold text-[#142b4a] shrink-0">
          {t('لديكِ رابط تتبع من البريد؟', 'Have a tracking link from your email?')}
        </label>
        <input
          id="track-link"
          value={link}
          onChange={(e) => {
            setLink(e.target.value);
            setLinkError(false);
          }}
          dir="ltr"
          placeholder="https://…/track/ZF-10234?t=…"
          className="flex-1 border border-[#e8e3d9] rounded-xl px-3 py-2.5 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#b99664]"
        />
        <button type="submit" className="px-5 py-2.5 rounded-full bg-[#142b4a] hover:bg-[#b99664] text-white text-xs font-bold cursor-pointer">
          {t('فتح الطلب', 'Open order')}
        </button>
        {linkError && (
          <small role="alert" className="text-xs font-bold text-[#a72f3e]">
            {t('الرابط غير صحيح', "That link isn't a tracking link")}
          </small>
        )}
      </form>

      {orders.length > 0 ? (
        <div className="space-y-4">
          {orders.map((o) => (
            <OrderRow key={o.number} order={o} onOpen={() => openTracking(o.number, o.token)} />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-[#e8dfd1] p-16 text-center text-[#77808b] space-y-4 shadow-xs">
          <span className="text-5xl block animate-float select-none">📦</span>
          <h3 className="text-xl font-serif font-bold text-[#142b4a]">{t('لا توجد طلبات سابقة', 'No previous orders')}</h3>
          <p className="text-xs text-[#77808b] max-w-sm mx-auto">
            {t(
              'عند إتمام أي طلب لقطع جاهزة أو تفصيل خاص ستتمكنين من متابعة حالته وتفاصيله هنا.',
              'When you submit an order for ready-to-wear pieces or custom tailoring, you will see it here.',
            )}
          </p>
          <div className="pt-2">
            <button
              type="button"
              className="px-7 py-3 rounded-full bg-[#142b4a] hover:bg-[#b99664] text-white text-xs sm:text-sm font-bold shadow-md transition-all cursor-pointer"
              onClick={() => go('shop')}
            >
              {t('تصفحي المجموعة ↗', 'Explore collection ↗')}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function OrderRow({ order, onOpen }: { order: SavedOrder; onOpen: () => void }) {
  const t = useZamzamStore((state) => state.t);
  const money = useZamzamStore((state) => state.money);
  const lang = useZamzamStore((state) => state.lang);
  const { data, error, loading } = useApi(() => trackOrder(order.number, order.token), [order.number, order.token]);
  const isCustom = (data?.type ?? order.kind) === 'Custom';
  const gone = error instanceof ApiError && error.status === 404;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-start bg-white rounded-3xl border border-[#e8e3d9] p-6 sm:p-7 shadow-xs hover:shadow-md transition-all duration-300 space-y-3 cursor-pointer"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <b className="font-mono text-base sm:text-lg font-bold text-[#142b4a]" dir="ltr">{order.number}</b>
          <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${isCustom ? 'bg-[#e7dac5] text-[#7c5e30]' : 'bg-[#dce6f2] text-[#142b4a]'}`}>
            {isCustom ? t('تفصيل خاص', 'Custom') : t('جاهز', 'Ready')}
          </span>
        </div>
        <span className="inline-block px-3.5 py-1.5 rounded-full text-xs font-bold bg-[#f7f3eb] text-[#142b4a] border border-[#e8dfd1]">
          {data ? t(...statusLabel[data.status]) : loading ? '…' : gone ? t('غير متاح', 'Unavailable') : t('تعذر التحديث', "Couldn't refresh")}
        </span>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-[#e8dfd1] text-xs text-[#77808b]">
        <span>{new Date(data?.createdAt ?? order.createdAt).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB')}</span>
        <span className="text-base font-extrabold text-[#b99664]">
          {data && (isCustom ? money(data.tailoring?.quotedPrice ?? data.tailoring?.estimatedPrice) : money(data.total))}
        </span>
      </div>
    </button>
  );
}
