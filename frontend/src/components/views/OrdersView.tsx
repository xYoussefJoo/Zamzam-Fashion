'use client';

import React from 'react';
import { useZamzamStore } from '@/store/useZamzamStore';
import { statusNames } from '@/data/seed';

export default function OrdersView() {
  const data = useZamzamStore((state) => state.data);
  const money = useZamzamStore((state) => state.money);
  const t = useZamzamStore((state) => state.t);
  const go = useZamzamStore((state) => state.go);

  return (
    <section className="max-w-[1240px] mx-auto px-4 sm:px-6 py-12 space-y-8 animate-scale-in">
      <div className="pb-4 border-b border-[#e8dfd1]">
        <span className="text-xs text-[#b99664] font-bold tracking-[0.2em] uppercase">
          HISTORY
        </span>
        <h2 className="text-2xl sm:text-4xl font-serif font-bold text-[#142b4a] mt-1">
          {t('سجل الطلبات على هذا الجهاز', 'Orders on this device')}
        </h2>
        <p className="text-xs sm:text-sm text-[#77808b] mt-0.5">
          {t(
            'جميع الطلبات المسجلة محلياً في متصفحك',
            'All orders recorded locally in your browser'
          )}
        </p>
      </div>

      {data.orders.length > 0 ? (
        <div className="space-y-4">
          {data.orders.map((o) => (
            <div
              key={o.id}
              className="bg-white rounded-3xl border border-[#e8e3d9] p-6 sm:p-7 shadow-xs hover:shadow-md transition-all duration-300 space-y-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <b className="font-mono text-base sm:text-lg font-bold text-[#142b4a]">
                    #{o.id}
                  </b>
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                      o.type === 'custom'
                        ? 'bg-[#e7dac5] text-[#7c5e30]'
                        : 'bg-[#dce6f2] text-[#142b4a]'
                    }`}
                  >
                    {o.type === 'custom' ? t('تفصيل خاص', 'Custom') : t('جاهز', 'Ready')}
                  </span>
                </div>

                <span className="inline-block px-3.5 py-1.5 rounded-full text-xs font-bold bg-[#f7f3eb] text-[#142b4a] border border-[#e8dfd1]">
                  {t(...(statusNames[o.status] || statusNames.review))}
                </span>
              </div>

              <div className="text-xs sm:text-sm text-[#2d3540] flex flex-wrap items-center gap-2">
                <strong>{o.customer}</strong>
                <span>•</span>
                <span className="text-[#77808b]">{new Date(o.date).toLocaleDateString()}</span>
                {o.phone && (
                  <>
                    <span>•</span>
                    <span className="text-[#77808b]">{o.phone}</span>
                  </>
                )}
              </div>

              {o.type === 'custom' ? (
                <div className="text-xs text-[#77808b] bg-[#faf7f2] p-3 rounded-xl border border-[#e8dfd1]/60">
                  <span>
                    {o.fabric} / {o.color} • {Object.keys(o.measures || {}).length}{' '}
                    {t('مقاسات مسجلة', 'measurements recorded')}
                  </span>
                  {o.notes && <p className="mt-1 italic text-[#2d3540]">&ldquo;{o.notes}&rdquo;</p>}
                </div>
              ) : (
                <div className="flex items-center justify-between pt-2 border-t border-[#e8dfd1]">
                  <span className="text-xs text-[#77808b]">
                    {o.items.map((x) => `${x.name} × ${x.qty}`).join('، ')}
                  </span>
                  <span className="text-base font-extrabold text-[#b99664]">
                    {money(o.total)}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-[#e8dfd1] p-16 text-center text-[#77808b] space-y-4 shadow-xs">
          <span className="text-5xl block animate-float select-none">📦</span>
          <h3 className="text-xl font-serif font-bold text-[#142b4a]">
            {t('لا توجد طلبات سابقة', 'No previous orders')}
          </h3>
          <p className="text-xs text-[#77808b] max-w-sm mx-auto">
            {t(
              'عند إتمام أي طلب لقطع جاهزة أو تفصيل خاص ستتمكنين من متابعة حالته وتفاصيله هنا.',
              'When you submit an order for ready-to-wear pieces or custom tailoring, you will see it here.'
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
