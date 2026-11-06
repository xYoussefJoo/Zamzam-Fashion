'use client';

import React from 'react';
import { useZamzamStore } from '@/store/useZamzamStore';
import { statusNames } from '@/data/seed';
import { OrderStatus } from '@/types/zamzam';

export default function AdminOrders() {
  const data = useZamzamStore((state) => state.data);
  const updateOrderStatus = useZamzamStore((state) => state.updateOrderStatus);
  const money = useZamzamStore((state) => state.money);
  const t = useZamzamStore((state) => state.t);

  return (
    <section className="bg-white rounded-3xl border border-[#e8e3d9] shadow-xs overflow-hidden">
      {/* Card Header */}
      <div className="p-6 sm:p-7 border-b border-[#e8e3d9] bg-[#faf7f2]/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-xl font-serif font-bold text-[#142b4a]">
            {t('سجل الطلبات', 'Order management')}
          </h3>
          <p className="text-xs text-[#77808b] mt-0.5">
            {t(
              `إجمالي الطلبات المسجلة: ${data.orders.length}`,
              `Total recorded orders: ${data.orders.length}`
            )}
          </p>
        </div>
      </div>

      {data.orders.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-start">
            <thead className="bg-[#f7f3eb] text-[#77808b] text-[11px] uppercase tracking-wider border-b border-[#e8dfd1]">
              <tr>
                <th className="px-5 py-3.5 text-start font-bold">#</th>
                <th className="px-5 py-3.5 text-start font-bold">{t('العميل', 'Customer')}</th>
                <th className="px-5 py-3.5 text-start font-bold">{t('النوع', 'Type')}</th>
                <th className="px-5 py-3.5 text-start font-bold">{t('التفاصيل', 'Details')}</th>
                <th className="px-5 py-3.5 text-start font-bold">{t('الحالة', 'Status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e8e3d9]">
              {data.orders.map((o) => (
                <tr key={o.id} className="hover:bg-[#faf7f2] transition-colors duration-150">
                  <td className="px-5 py-4 font-mono text-xs text-[#77808b] font-bold">
                    #{o.id}
                  </td>
                  <td className="px-5 py-4">
                    <div className="font-bold text-[#142b4a]">{o.customer}</div>
                    <div className="text-xs text-[#77808b] mt-0.5">{o.phone}</div>
                    {o.type === 'ready' && (
                      <div className="text-xs text-[#77808b]">
                        {[o.governorate, o.city].filter(Boolean).join(' / ')}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                        o.type === 'custom'
                          ? 'bg-[#e7dac5] text-[#7c5e30]'
                          : 'bg-[#dce6f2] text-[#142b4a]'
                      }`}
                    >
                      {o.type === 'custom' ? t('تفصيل خاص', 'Custom') : t('جاهز', 'Ready')}
                    </span>
                  </td>
                  <td className="px-5 py-4 max-w-[320px]">
                    {o.type === 'custom' ? (
                      <div className="text-xs text-[#2d3540] space-y-1">
                        <div className="font-bold text-[#142b4a]">
                          {o.fabric} / {o.color}
                        </div>
                        <div className="text-[#77808b] leading-relaxed">
                          {Object.entries(o.measures || {})
                            .map(([k, v]) => `${k}: ${v} cm`)
                            .join(' • ')}
                        </div>
                        {o.image && (
                          <div className="pt-1">
                            <a
                              href={o.image}
                              download="reference.png"
                              className="text-xs text-[#b99664] hover:underline font-bold inline-flex items-center gap-1"
                            >
                              <span>📥 {t('تحميل صورة التصميم', 'Download reference')}</span>
                            </a>
                          </div>
                        )}
                        {o.notes && (
                          <div className="text-[#77808b] italic bg-[#f7f3eb] p-2 rounded-lg mt-1">
                            &ldquo;{o.notes}&rdquo;
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-[#2d3540] space-y-1">
                        <div className="font-medium">
                          {o.items.map((x) => `${x.name} × ${x.qty}`).join('، ')}
                        </div>
                        <div className="font-extrabold text-[#b99664] text-sm">
                          {money(o.total)}
                        </div>
                        <div className="text-[#77808b]">
                          {o.paymentMethod === 'cod'
                            ? t('الدفع عند الاستلام', 'Cash on delivery')
                            : t('طريقة غير محددة', 'Unspecified')}{' '}
                          ·{' '}
                          <span
                            className={
                              o.paymentStatus === 'paid'
                                ? 'text-green-700 font-bold'
                                : 'text-amber-800 font-bold'
                            }
                          >
                            {o.paymentStatus === 'paid'
                              ? t('مدفوع', 'Paid')
                              : t('غير مدفوع', 'Unpaid')}
                          </span>
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <select
                      value={o.status}
                      onChange={(e) =>
                        updateOrderStatus(o.id, e.target.value as OrderStatus)
                      }
                      className="text-xs font-bold border border-[#e8e3d9] rounded-xl px-3 py-2 bg-white text-[#142b4a] cursor-pointer hover:border-[#b99664] focus:ring-2 focus:ring-[#b99664] outline-none transition-all shadow-2xs"
                    >
                      {(
                        Object.entries(statusNames) as [
                          OrderStatus,
                          [string, string]
                        ][]
                      ).map(([k, v]) => (
                        <option key={k} value={k}>
                          {t(...v)}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="py-20 text-center space-y-3">
          <span className="text-5xl block select-none">📋</span>
          <p className="text-base font-bold text-[#142b4a]">
            {t('لا توجد طلبات مسجلة بعد', 'No orders recorded yet')}
          </p>
          <p className="text-xs text-[#77808b]">
            {t('ستظهر هنا جميع الطلبات بمجرد إتمامها من قبل الزبائن.', 'Customer orders will appear here automatically.')}
          </p>
        </div>
      )}
    </section>
  );
}
