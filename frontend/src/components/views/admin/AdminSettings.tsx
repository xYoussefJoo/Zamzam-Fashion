'use client';

import React, { useState, FormEvent } from 'react';
import { useZamzamStore } from '@/store/useZamzamStore';
import { useApi } from '@/lib/useApi';
import { ApiError, errorText } from '@/lib/api';
import { getAdminSiteSettings, saveSiteSettings, type SiteContent } from '@/lib/admin';

// #43–#44 — the editable home page content, contacts and social links (delivery fees live in Delivery zones).
export default function AdminSettings() {
  const t = useZamzamStore((state) => state.t);
  const { data, error, reload } = useApi(getAdminSiteSettings, []);
  if (error) {
    return (
      <div className="bg-white p-6 rounded-2xl border border-[#e9e4dc] space-y-2">
        <p className="text-sm font-bold text-[#a72f3e]">{errorText(error, t)}</p>
        <button type="button" onClick={reload} className="px-4 py-2 rounded-lg bg-[#142b4a] text-white text-xs font-bold cursor-pointer">{t('إعادة المحاولة', 'Try again')}</button>
      </div>
    );
  }
  if (!data) return <div className="h-96 rounded-2xl bg-[#f7f3eb] animate-pulse" />;
  return <SettingsForm initial={data} />;
}

const clean = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

function SettingsForm({ initial }: { initial: SiteContent }) {
  const t = useZamzamStore((state) => state.t);
  const showToast = useZamzamStore((state) => state.showToast);
  const refreshSite = useZamzamStore((state) => state.refreshSite);
  const [s, setS] = useState<SiteContent>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();

  const set = <K extends keyof SiteContent>(key: K, value: SiteContent[K]) => setS((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      const saved = await saveSiteSettings({
        announcementAr: s.announcementAr.trim(),
        announcementEn: s.announcementEn.trim(),
        hero: { titleAr: s.hero.titleAr.trim(), titleEn: s.hero.titleEn.trim(), subtitleAr: s.hero.subtitleAr.trim(), subtitleEn: s.hero.subtitleEn.trim(), imageUrl: clean(s.hero.imageUrl) },
        collection: { enabled: s.collection.enabled, titleAr: s.collection.titleAr.trim(), titleEn: s.collection.titleEn.trim() },
        contact: {
          phone: clean(s.contact.phone), whatsApp: clean(s.contact.whatsApp), email: clean(s.contact.email),
          addressAr: clean(s.contact.addressAr), addressEn: clean(s.contact.addressEn),
        },
        social: { facebook: clean(s.social.facebook), instagram: clean(s.social.instagram), tikTok: clean(s.social.tikTok) },
      });
      setS(saved);
      void refreshSite(); // the banner, hero and footer update right away
      showToast(t('تم حفظ محتوى الموقع', 'Site content saved'), 'success');
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const input = 'w-full border border-[#dedbd5] rounded-xl p-3 bg-white text-[#263548] text-sm focus:outline-none focus:ring-2 focus:ring-[#b99664]';
  const box = 'bg-white p-6 sm:p-8 rounded-2xl border border-[#e9e4dc] shadow-2xs space-y-4';
  const field = (label: [string, string], value: string | null | undefined, onChange: (v: string) => void, opts: { ltr?: boolean; type?: string; max?: number; area?: boolean } = {}) => (
    <label className="flex flex-col gap-1.5 text-xs font-bold text-[#2d3540]">
      <span>{t(...label)}</span>
      {opts.area ? (
        <textarea value={value ?? ''} maxLength={opts.max ?? 500} onChange={(e) => onChange(e.target.value)} className={`${input} min-h-[70px]`} dir={opts.ltr ? 'ltr' : undefined} />
      ) : (
        <input type={opts.type ?? 'text'} value={value ?? ''} maxLength={opts.max ?? 200} onChange={(e) => onChange(e.target.value)} className={input} dir={opts.ltr ? 'ltr' : undefined} />
      )}
    </label>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className={box}>
        <h3 className="text-base sm:text-lg font-serif font-bold text-[#142b4a]">{t('شريط الإعلان', 'Announcement bar')}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {field(['النص بالعربي', 'Arabic text'], s.announcementAr, (v) => set('announcementAr', v))}
          {field(['النص بالإنجليزي', 'English text'], s.announcementEn, (v) => set('announcementEn', v), { ltr: true })}
        </div>
      </section>

      <section className={box}>
        <h3 className="text-base sm:text-lg font-serif font-bold text-[#142b4a]">{t('الواجهة الرئيسية', 'Home hero')}</h3>
        <p className="text-xs text-[#79808b]">{t('اتركي الحقل فارغًا لاستخدام النص الافتراضي.', 'Leave a field empty to keep the built-in text.')}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {field(['العنوان بالعربي', 'Title (Arabic)'], s.hero.titleAr, (v) => set('hero', { ...s.hero, titleAr: v }))}
          {field(['العنوان بالإنجليزي', 'Title (English)'], s.hero.titleEn, (v) => set('hero', { ...s.hero, titleEn: v }), { ltr: true })}
          {field(['الوصف بالعربي', 'Subtitle (Arabic)'], s.hero.subtitleAr, (v) => set('hero', { ...s.hero, subtitleAr: v }), { area: true })}
          {field(['الوصف بالإنجليزي', 'Subtitle (English)'], s.hero.subtitleEn, (v) => set('hero', { ...s.hero, subtitleEn: v }), { area: true, ltr: true })}
          <div className="sm:col-span-2">
            {field(['رابط صورة الواجهة (اختياري)', 'Hero image link (optional)'], s.hero.imageUrl, (v) => set('hero', { ...s.hero, imageUrl: v }), { ltr: true, type: 'url', max: 500 })}
          </div>
        </div>
      </section>

      <section className={box}>
        <h3 className="text-base sm:text-lg font-serif font-bold text-[#142b4a]">{t('الكولكشن الجديد', 'New collection banner')}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {field(['العنوان بالعربي', 'Title (Arabic)'], s.collection.titleAr, (v) => set('collection', { ...s.collection, titleAr: v }))}
          {field(['العنوان بالإنجليزي', 'Title (English)'], s.collection.titleEn, (v) => set('collection', { ...s.collection, titleEn: v }), { ltr: true })}
        </div>
        <label className="flex items-center gap-3 cursor-pointer text-sm font-bold text-[#2d3540]">
          <input type="checkbox" checked={s.collection.enabled} onChange={(e) => set('collection', { ...s.collection, enabled: e.target.checked })} className="accent-[#142b4a] w-4 h-4" />
          <span>{t('إظهار القسم في الرئيسية', 'Show it on the home page')}</span>
        </label>
      </section>

      <section className={box}>
        <h3 className="text-base sm:text-lg font-serif font-bold text-[#142b4a]">{t('بيانات التواصل والروابط', 'Contacts & social links')}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {field(['رقم الهاتف', 'Phone number'], s.contact.phone, (v) => set('contact', { ...s.contact, phone: v }), { ltr: true, type: 'tel', max: 30 })}
          {field(['واتساب بكود الدولة (أرقام فقط، مثل 201012345678)', 'WhatsApp with country code (digits, e.g. 201012345678)'], s.contact.whatsApp, (v) => set('contact', { ...s.contact, whatsApp: v }), { ltr: true, max: 20 })}
          {field(['البريد الإلكتروني', 'Email address'], s.contact.email, (v) => set('contact', { ...s.contact, email: v }), { ltr: true, type: 'email', max: 254 })}
          <span />
          {field(['العنوان بالعربي', 'Address (Arabic)'], s.contact.addressAr, (v) => set('contact', { ...s.contact, addressAr: v }), { area: true })}
          {field(['العنوان بالإنجليزي', 'Address (English)'], s.contact.addressEn, (v) => set('contact', { ...s.contact, addressEn: v }), { area: true, ltr: true })}
          {field(['فيسبوك (يبدأ بـ https://)', 'Facebook (starts with https://)'], s.social.facebook, (v) => set('social', { ...s.social, facebook: v }), { ltr: true, type: 'url', max: 500 })}
          {field(['إنستجرام (يبدأ بـ https://)', 'Instagram (starts with https://)'], s.social.instagram, (v) => set('social', { ...s.social, instagram: v }), { ltr: true, type: 'url', max: 500 })}
          {field(['تيك توك (يبدأ بـ https://)', 'TikTok (starts with https://)'], s.social.tikTok, (v) => set('social', { ...s.social, tikTok: v }), { ltr: true, type: 'url', max: 500 })}
        </div>
      </section>

      {error ? (
        <p role="alert" className="text-xs font-bold text-[#a72f3e] bg-red-50 border border-red-200 rounded-xl p-3">
          {error instanceof ApiError && error.problem.errors ? Object.values(error.problem.errors).flat().join(' ') : errorText(error, t)}
        </p>
      ) : null}

      <button type="submit" disabled={busy} className="px-8 py-3 rounded-xl bg-[#142b4a] hover:bg-[#1e3a61] disabled:opacity-60 text-white text-sm font-bold transition-colors cursor-pointer">
        {busy ? '…' : t('حفظ الإعدادات', 'Save settings')}
      </button>
    </form>
  );
}
