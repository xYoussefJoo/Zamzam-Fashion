'use client';

import React, { useState } from 'react';
import { useZamzamStore } from '@/store/useZamzamStore';
import { useApi } from '@/lib/useApi';
import { ApiError, errorText } from '@/lib/api';
import { getAdminZones, saveZones, type AdminZone } from '@/lib/admin';
import { pick } from '@/lib/shop';

// #41–#42 — the 27 governorates: delivery fee, delivery days, and whether customers can choose it. One Save.
function AdminZonesEditor({ data, reload }: { data: AdminZone[]; reload: () => void }) {
  const lang = useZamzamStore((state) => state.lang);
  const t = useZamzamStore((state) => state.t);
  const showToast = useZamzamStore((state) => state.showToast);
  const [rows, setRows] = useState<AdminZone[]>(() => structuredClone(data));
  const [busy, setBusy] = useState(false);

  const set = (id: number, patch: Partial<AdminZone>) => setRows((list) => list.map((z) => (z.id === id ? { ...z, ...patch } : z)));
  const changed = data ? rows.filter((z) => JSON.stringify(z) !== JSON.stringify(data.find((d) => d.id === z.id))) : [];
  const invalid = rows.some((z) => z.fee < 0 || z.etaDaysMin < 0 || z.etaDaysMax < z.etaDaysMin);

  const save = async () => {
    setBusy(true);
    try {
      const saved = await saveZones(changed.map((z) => ({ id: z.id, fee: z.fee, etaDaysMin: z.etaDaysMin, etaDaysMax: z.etaDaysMax, isActive: z.isActive })));
      setRows(saved);
      reload();
      showToast(t('تم حفظ مناطق التوصيل', 'Delivery zones saved'), 'success');
    } catch (err) {
      showToast(err instanceof ApiError && err.problem.errors ? Object.values(err.problem.errors).flat().join(' ') : errorText(err, t), 'error');
    } finally {
      setBusy(false);
    }
  };

  if (!data) return <div className="h-96 rounded-2xl bg-[#f7f3eb] animate-pulse" />;

  const cell = 'border border-[#dedbd5] rounded-lg p-1.5 bg-white text-xs w-20';
  return (
    <section className="bg-white p-6 rounded-2xl border border-[#e9e4dc] shadow-2xs space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-[#79808b]">{t('رسوم التوصيل تُضاف لكل طلب حسب المحافظة. المحافظات غير المفعلة لا تظهر للعملاء.', 'The fee is added to each order by governorate. Inactive ones are hidden from customers.')}</p>
        <button type="button" disabled={busy || changed.length === 0 || invalid} onClick={() => void save()} className="px-6 py-2.5 rounded-xl bg-[#142b4a] text-white text-xs font-bold disabled:opacity-40 cursor-pointer">
          {busy ? '…' : t(`حفظ (${changed.length})`, `Save (${changed.length})`)}
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-[#77808b] uppercase border-b border-[#efe9df]">
            <tr>
              <th className="py-2 text-start">{t('المحافظة', 'Governorate')}</th>
              <th className="py-2 text-start">{t('الرسوم (ج.م)', 'Fee (EGP)')}</th>
              <th className="py-2 text-start">{t('أقل أيام', 'Min days')}</th>
              <th className="py-2 text-start">{t('أكثر أيام', 'Max days')}</th>
              <th className="py-2 text-start">{t('مفعلة', 'Active')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f1ece4]">
            {rows.map((z) => (
              <tr key={z.id} className={z.isActive ? '' : 'opacity-60'}>
                <td className="py-2 font-bold text-[#142b4a]">{pick(lang, z.nameAr, z.nameEn)}</td>
                <td className="py-2"><input type="number" min={0} step="0.5" value={z.fee} onChange={(e) => set(z.id, { fee: Number(e.target.value) })} className={cell} aria-label={t('الرسوم', 'Fee')} /></td>
                <td className="py-2"><input type="number" min={0} max={60} value={z.etaDaysMin} onChange={(e) => set(z.id, { etaDaysMin: Number(e.target.value) })} className={cell} aria-label={t('أقل أيام', 'Min days')} /></td>
                <td className="py-2">
                  <input type="number" min={0} max={60} value={z.etaDaysMax} onChange={(e) => set(z.id, { etaDaysMax: Number(e.target.value) })}
                    className={`${cell} ${z.etaDaysMax < z.etaDaysMin ? 'border-red-400' : ''}`} aria-label={t('أكثر أيام', 'Max days')} />
                </td>
                <td className="py-2"><input type="checkbox" checked={z.isActive} onChange={(e) => set(z.id, { isActive: e.target.checked })} className="accent-[#142b4a] w-4 h-4" aria-label={t('مفعلة', 'Active')} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function AdminZones() {
  const t = useZamzamStore((state) => state.t);
  const { data, error, reload, version } = useApi(getAdminZones, []);
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
  return <AdminZonesEditor key={version} data={data} reload={reload} />;
}
