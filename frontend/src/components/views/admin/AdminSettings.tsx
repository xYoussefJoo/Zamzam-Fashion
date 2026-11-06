'use client';

import React, { useState, FormEvent } from 'react';
import { useZamzamStore } from '@/store/useZamzamStore';

export default function AdminSettings() {
  const data = useZamzamStore((state) => state.data);
  const updateSettings = useZamzamStore((state) => state.updateSettings);
  const t = useZamzamStore((state) => state.t);
  const showToast = useZamzamStore((state) => state.showToast);

  const [bannerAr, setBannerAr] = useState(data.settings.bannerAr || '');
  const [bannerEn, setBannerEn] = useState(data.settings.bannerEn || '');
  const [deliveryFee, setDeliveryFee] = useState<string>(
    String(data.settings.deliveryFee ?? 65)
  );
  const [collectionAr, setCollectionAr] = useState(data.settings.collectionAr || '');
  const [collectionEn, setCollectionEn] = useState(data.settings.collectionEn || '');
  const [collectionEnabled, setCollectionEnabled] = useState(
    data.settings.collectionEnabled !== false
  );

  const [phone, setPhone] = useState(data.settings.phone || '');
  const [whatsapp, setWhatsapp] = useState(data.settings.whatsapp || '');
  const [email, setEmail] = useState(data.settings.email || '');
  const [addressAr, setAddressAr] = useState(data.settings.addressAr || '');
  const [addressEn, setAddressEn] = useState(data.settings.addressEn || '');
  const [facebook, setFacebook] = useState(data.settings.facebook || '');
  const [instagram, setInstagram] = useState(data.settings.instagram || '');
  const [tiktok, setTiktok] = useState(data.settings.tiktok || '');
  const [saved, setSaved] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    updateSettings({
      bannerAr,
      bannerEn,
      deliveryFee: Math.max(0, Number(deliveryFee) || 0),
      collectionAr,
      collectionEn,
      collectionEnabled,
      phone,
      whatsapp,
      email,
      addressAr,
      addressEn,
      facebook,
      instagram,
      tiktok,
    });
    setSaved(true);
    showToast(t('تم حفظ الإعدادات بنجاح', 'Settings saved successfully'), 'success');
    setTimeout(() => setSaved(false), 2200);
  };

  const inputClasses =
    'w-full border border-[#e8e3d9] rounded-xl px-4 py-3 text-sm bg-white text-[#2d3540] focus:ring-2 focus:ring-[#b99664] focus:border-[#b99664] outline-none transition-all placeholder:text-[#77808b]/60';

  const footerFields: [string, string, string, string, (v: string) => void][] = [
    ['phone', 'رقم الهاتف', 'Phone number', phone, setPhone],
    ['whatsapp', 'واتساب بكود الدولة', 'WhatsApp with country code', whatsapp, setWhatsapp],
    ['email', 'البريد الإلكتروني', 'Email address', email, setEmail],
    ['addressAr', 'العنوان بالعربي', 'Address (Arabic)', addressAr, setAddressAr],
    ['addressEn', 'العنوان بالإنجليزي', 'Address (English)', addressEn, setAddressEn],
    ['facebook', 'رابط فيسبوك HTTPS', 'Facebook HTTPS URL', facebook, setFacebook],
    ['instagram', 'رابط إنستجرام HTTPS', 'Instagram HTTPS URL', instagram, setInstagram],
    ['tiktok', 'رابط تيك توك HTTPS', 'TikTok HTTPS URL', tiktok, setTiktok],
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Hero Banner Section */}
      <div className="bg-white rounded-3xl border border-[#e8e3d9] shadow-xs overflow-hidden">
        <div className="p-6 border-b border-[#e8e3d9] bg-[#faf7f2]/50">
          <h3 className="text-base sm:text-lg font-serif font-bold text-[#142b4a]">
            {t('محتوى البانر الرئيسي', 'Hero banner content')}
          </h3>
          <p className="text-xs text-[#77808b] mt-0.5">
            {t('العناوين ورسوم الشحن التقديرية', 'Headlines & standard delivery rate')}
          </p>
        </div>
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#2d3540]">
              {t('عنوان عربي', 'Arabic headline')}
            </label>
            <input
              name="bannerAr"
              value={bannerAr}
              onChange={(e) => setBannerAr(e.target.value)}
              required
              className={inputClasses}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#2d3540]">
              English headline
            </label>
            <input
              name="bannerEn"
              value={bannerEn}
              onChange={(e) => setBannerEn(e.target.value)}
              required
              className={inputClasses}
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2 sm:max-w-xs">
            <label className="text-xs font-bold text-[#2d3540]">
              {t('رسوم التوصيل التقديرية (ج.م)', 'Estimated delivery fee (EGP)')}
            </label>
            <input
              name="deliveryFee"
              type="number"
              min="0"
              value={deliveryFee}
              onChange={(e) => setDeliveryFee(e.target.value)}
              required
              className={inputClasses}
            />
          </div>
        </div>
      </div>

      {/* New Collection Section */}
      <div className="bg-white rounded-3xl border border-[#e8e3d9] shadow-xs overflow-hidden">
        <div className="p-6 border-b border-[#e8e3d9] bg-[#faf7f2]/50">
          <h3 className="text-base sm:text-lg font-serif font-bold text-[#142b4a]">
            {t('الكولكشن الجديد', 'New collection banner')}
          </h3>
          <p className="text-xs text-[#77808b] mt-0.5">
            {t('إدارة القسم الترويجي للقطع الجديدة', 'Manage new arrivals highlight section')}
          </p>
        </div>
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#2d3540]">
              {t('عنوان الكولكشن بالعربي', 'Collection title (Arabic)')}
            </label>
            <input
              name="collectionAr"
              value={collectionAr}
              onChange={(e) => setCollectionAr(e.target.value)}
              className={inputClasses}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#2d3540]">
              {t('عنوان الكولكشن بالإنجليزي', 'Collection title (English)')}
            </label>
            <input
              name="collectionEn"
              value={collectionEn}
              onChange={(e) => setCollectionEn(e.target.value)}
              className={inputClasses}
            />
          </div>

          <div className="col-span-full pt-1">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="collectionEnabled"
                checked={collectionEnabled}
                onChange={(e) => setCollectionEnabled(e.target.checked)}
                className="w-4 h-4 rounded border-[#e8e3d9] accent-[#b99664] cursor-pointer"
              />
              <span className="text-sm font-bold text-[#142b4a]">
                {t('إظهار الكولكشن في الصفحة الرئيسية', 'Display new collection on home page')}
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Footer & Social Information */}
      <div className="bg-white rounded-3xl border border-[#e8e3d9] shadow-xs overflow-hidden">
        <div className="p-6 border-b border-[#e8e3d9] bg-[#faf7f2]/50">
          <h3 className="text-base sm:text-lg font-serif font-bold text-[#142b4a]">
            {t('معلومات الفوتر والتواصل', 'Footer & contact details')}
          </h3>
          <p className="text-xs text-[#77808b] mt-0.5">
            {t('وسائل التواصل والعناوين وروابط المنصات', 'Customer contact channels & social links')}
          </p>
        </div>
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {footerFields.map(([key, arLabel, enLabel, val, setter]) => (
            <div key={key} className="space-y-1.5">
              <label className="text-xs font-bold text-[#2d3540]">
                {t(arLabel, enLabel)}
              </label>
              <input
                name={key}
                value={val}
                onChange={(e) => setter(e.target.value)}
                className={inputClasses}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Action Button */}
      <div className="flex justify-end pt-2">
        <button
          type="submit"
          className={`px-8 py-3.5 rounded-full text-sm font-bold transition-all duration-300 cursor-pointer shadow-md active:scale-[0.98] ${
            saved
              ? 'bg-[#b99664] text-white shadow-lg shadow-[#b99664]/30'
              : 'bg-[#142b4a] hover:bg-[#1e3a61] text-white'
          }`}
        >
          {saved ? `✓ ${t('تم الحفظ بنجاح', 'Saved successfully!')}` : t('حفظ التعديلات', 'Save changes')}
        </button>
      </div>
    </form>
  );
}
