'use client';

import React, { useEffect, useMemo, useRef, useState, ChangeEvent, FormEvent } from 'react';
import { useZamzamStore } from '@/store/useZamzamStore';
import { useApi } from '@/lib/useApi';
import { ApiError, errorText, fieldError } from '@/lib/api';
import {
  getDeliveryZones, getEstimate, getTailoringCatalog, newKey, pick, placeTailoringRequest, rememberOrder,
  type Estimate, type TailoringCatalog,
} from '@/lib/shop';

const MAX_PHOTO = 5 * 1024 * 1024;

export default function CustomTailoringView() {
  const t = useZamzamStore((state) => state.t);
  const catalog = useApi(getTailoringCatalog, []);

  if (catalog.error) {
    return (
      <section className="max-w-[1080px] mx-auto px-4 py-20 text-center space-y-4">
        <p className="text-sm font-bold text-[#a72f3e]">{errorText(catalog.error, t)}</p>
        <button type="button" onClick={catalog.reload} className="px-6 py-2.5 rounded-full bg-[#142b4a] text-white text-xs font-bold cursor-pointer">
          {t('إعادة المحاولة', 'Try again')}
        </button>
      </section>
    );
  }
  if (!catalog.data) {
    return (
      <section className="max-w-[1080px] mx-auto px-4 sm:px-6 py-12 space-y-4 animate-pulse" aria-busy="true">
        <div className="h-10 bg-[#f1ebe0] rounded w-1/2" />
        <div className="h-[520px] bg-[#f7f3eb] rounded-3xl" />
      </section>
    );
  }
  return <TailoringForm catalog={catalog.data} />;
}

function TailoringForm({ catalog }: { catalog: TailoringCatalog }) {
  const lang = useZamzamStore((state) => state.lang);
  const t = useZamzamStore((state) => state.t);
  const money = useZamzamStore((state) => state.money);
  const showToast = useZamzamStore((state) => state.showToast);
  const openTracking = useZamzamStore((state) => state.openTracking);
  const zones = useApi(getDeliveryZones, []);

  const firstGarment = catalog.garments[0]?.key ?? '';
  const [customer, setCustomer] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [zoneId, setZoneId] = useState<number | ''>('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [styleId, setStyleId] = useState('');
  const [garment, setGarment] = useState(firstGarment);
  const [fabric, setFabric] = useState(catalog.fabrics[0]?.key ?? '');
  const [color, setColor] = useState('');
  const [fit, setFit] = useState(catalog.fits[0]?.key ?? '');
  const [mode, setMode] = useState<'Measurements' | 'StandardSize'>('Measurements');
  const [standardSize, setStandardSize] = useState(catalog.standardSizes.includes('M') ? 'M' : catalog.standardSizes[0] ?? '');
  const [measurements, setMeasurements] = useState<Record<string, number>>({});
  const [lining, setLining] = useState(false);
  const [extras, setExtras] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [photoError, setPhotoError] = useState('');
  const [terms, setTerms] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<unknown>();
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const keyRef = useRef<string | null>(null);

  const garmentInfo = catalog.garments.find((g) => g.key === garment);
  const styles = catalog.styles.filter((s) => s.garment === garment);
  const groups = useMemo(() => garmentInfo?.measurementGroups ?? [], [garmentInfo]);
  const fieldsByGroup = catalog.measurementGroups as Record<string, { key: string; nameAr: string; nameEn: string; required?: boolean }[]>;

  // Picking a style fills in its garment, fabric and fit.
  const chooseStyle = (id: string) => {
    setStyleId(id);
    const style = catalog.styles.find((s) => s.id === id);
    if (style) {
      setGarment(style.garment);
      if (catalog.fabrics.some((f) => f.key === style.defaultFabric)) setFabric(style.defaultFabric);
      if (catalog.fits.some((f) => f.key === style.defaultFit)) setFit(style.defaultFit);
    }
  };
  const chooseGarment = (key: string) => {
    setGarment(key);
    setStyleId('');
    setMeasurements({});
  };

  // Live price: asks the server (the same rules price the real request) once choices settle.
  useEffect(() => {
    if (!garment || !fabric || !fit || (mode === 'StandardSize' && !standardSize)) return;
    let current = true;
    const timer = setTimeout(() => {
      getEstimate({
        styleId: styleId || null, garment, fabric, fit, lining,
        sizingMode: mode, standardSize: mode === 'StandardSize' ? standardSize : null, extras,
      })
        .then((e) => { if (current) setEstimate(e); })
        .catch(() => { if (current) setEstimate(null); });
    }, 400);
    return () => { current = false; clearTimeout(timer); };
  }, [styleId, garment, fabric, fit, lining, mode, standardSize, extras]);

  const handlePhoto = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setPhotoError('');
    if (preview) URL.revokeObjectURL(preview);
    if (!file) { setPhoto(null); setPreview(''); return; }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setPhotoError(t('الصورة يجب أن تكون JPG أو PNG أو WebP', 'The photo must be JPG, PNG or WebP'));
      e.target.value = '';
      return;
    }
    if (file.size > MAX_PHOTO) {
      setPhotoError(t('الصورة أكبر من 5 ميجابايت', 'The photo is over 5 MB'));
      e.target.value = '';
      return;
    }
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
  };

  const setMeasurement = (key: string, val: string) => {
    const num = parseFloat(val);
    setMeasurements((prev) => {
      const copy = { ...prev };
      if (!val || isNaN(num)) delete copy[key];
      else copy[key] = num;
      return copy;
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (sending) return;
    if (mode === 'Measurements' && Object.keys(measurements).length === 0) {
      showToast(t('أدخلي مقاسًا واحدًا على الأقل أو اختاري مقاسًا جاهزًا', 'Enter at least one measurement or choose a standard size'), 'error');
      return;
    }
    keyRef.current ??= newKey();
    setSending(true);
    setError(undefined);
    try {
      const placed = await placeTailoringRequest(
        {
          customer: {
            name: customer.trim(), phone: phone.trim(), email: email.trim() || null,
            deliveryZoneId: zoneId || 0, city: city.trim(), address: address.trim(), notes: null,
          },
          styleId: styleId || null, garment, fabric, color: color.trim(), fit,
          sizingMode: mode,
          standardSize: mode === 'StandardSize' ? standardSize : null,
          measurements: mode === 'Measurements' ? measurements : null,
          lining, extras, notes: notes.trim() || null, acceptTerms: terms,
        },
        photo,
        keyRef.current,
      );
      keyRef.current = null;
      rememberOrder({ number: placed.number, token: placed.trackingToken, createdAt: new Date().toISOString(), kind: 'Custom' });
      showToast(t(`تم إرسال طلب التفصيل ${placed.number} للمراجعة`, `Tailoring request ${placed.number} sent for review`), 'success');
      openTracking(placed.number, placed.trackingToken);
    } catch (err) {
      setError(err);
      if (err instanceof ApiError && err.status !== 0) keyRef.current = null;
    } finally {
      setSending(false);
    }
  };

  const inputClasses =
    'border border-[#e8e3d9] rounded-xl p-3 bg-white text-[#142b4a] text-sm focus:outline-none focus:ring-2 focus:ring-[#b99664] focus:border-[#b99664] transition-all';
  const fieldMsg = (name: string) => {
    const msg = fieldError(error, name);
    return msg ? <small className="text-[11px] font-semibold text-[#a72f3e]">{msg}</small> : null;
  };
  const toggleExtra = (key: string) => setExtras((list) => (list.includes(key) ? list.filter((k) => k !== key) : [...list, key]));

  return (
    <section className="max-w-[1080px] mx-auto px-4 sm:px-6 py-12 space-y-8 animate-scale-in">
      <div className="space-y-1.5 pb-2 border-b border-[#e8dfd1]">
        <span className="text-xs text-[#b99664] font-bold tracking-[0.2em] uppercase">ZAMZAM / ATELIER</span>
        <h2 className="text-2xl sm:text-4xl font-serif font-bold text-[#142b4a]">{t('استوديو التفصيل الخاص', 'Made-to-measure studio')}</h2>
        <p className="text-xs sm:text-sm text-[#77808b]">
          {t('اختاري الموديل، وحددي القماش والمقاسات المناسبة لنصنع لكِ قطعة حصرية.', 'Select your design style, fabric, and sizing preferences for your tailored creation.')}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-[#e8e3d9] p-6 sm:p-10 shadow-xs space-y-8">
        {/* The piece */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <label className="flex flex-col gap-1.5 text-xs sm:text-sm font-bold text-[#2d3540]">
            <span>{t('نوع القطعة', 'Garment type')} *</span>
            <select value={garment} onChange={(e) => chooseGarment(e.target.value)} className={inputClasses}>
              {catalog.garments.map((g) => (
                <option key={g.key} value={g.key}>{pick(lang, g.nameAr, g.nameEn)}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-xs sm:text-sm font-bold text-[#2d3540]">
            <span>{t('اختاري موديل من المقترحات', 'Choose a suggested style')}</span>
            <select value={styleId} onChange={(e) => chooseStyle(e.target.value)} className={inputClasses}>
              <option value="">{t('تصميم خاص من عندي (سأرفع صورة)', 'My own custom design (upload image)')}</option>
              {styles.map((s) => (
                <option key={s.id} value={s.id}>{pick(lang, s.nameAr, s.nameEn)}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-xs sm:text-sm font-bold text-[#2d3540]">
            <span>{t('نوع القماش المفضل', 'Preferred fabric')} *</span>
            <select value={fabric} onChange={(e) => setFabric(e.target.value)} className={inputClasses}>
              {catalog.fabrics.map((f) => (
                <option key={f.key} value={f.key}>{pick(lang, f.nameAr, f.nameEn)}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-xs sm:text-sm font-bold text-[#2d3540]">
            <span>{t('نوع القصة', 'Silhouette / Fit')} *</span>
            <select value={fit} onChange={(e) => setFit(e.target.value)} className={inputClasses}>
              {catalog.fits.map((f) => (
                <option key={f.key} value={f.key}>{pick(lang, f.nameAr, f.nameEn)}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-xs sm:text-sm font-bold text-[#2d3540]">
            <span>{t('اللون المطلوب', 'Preferred color')} *</span>
            <input required maxLength={50} value={color} onChange={(e) => setColor(e.target.value)}
              placeholder={t('مثال: بيج فاتح، كحلي...', 'e.g. Warm Beige, Classic Navy')} className={inputClasses} />
            {fieldMsg('color')}
          </label>

          <div className="flex flex-col gap-2 text-xs sm:text-sm font-bold text-[#2d3540]">
            <span>{t('إضافات', 'Extras')}</span>
            <label className="flex items-center gap-2 font-semibold cursor-pointer">
              <input type="checkbox" checked={lining} onChange={(e) => setLining(e.target.checked)} className="accent-[#142b4a] w-4 h-4" />
              <span>{t('بطانة', 'Lining')} (+{money(catalog.liningPrice)})</span>
            </label>
            {catalog.extras.map((x) => (
              <label key={x.key} className="flex items-center gap-2 font-semibold cursor-pointer">
                <input type="checkbox" checked={extras.includes(x.key)} onChange={() => toggleExtra(x.key)} className="accent-[#142b4a] w-4 h-4" />
                <span>{pick(lang, x.nameAr, x.nameEn)} (+{money(x.price)})</span>
              </label>
            ))}
          </div>

          <div className="sm:col-span-2 space-y-2">
            <span className="text-xs sm:text-sm font-bold text-[#2d3540] block">{t('طريقة تحديد المقاس', 'Sizing method')}</span>
            <div className="grid grid-cols-2 gap-3 max-w-md">
              {(['Measurements', 'StandardSize'] as const).map((m) => (
                <button key={m} type="button" onClick={() => setMode(m)} aria-pressed={mode === m}
                  className={`py-3 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                    mode === m ? 'bg-[#142b4a] text-white shadow-sm' : 'bg-[#f7f3eb] text-[#2d3540] hover:bg-[#e7dac5]'
                  }`}>
                  {m === 'Measurements' ? t('مقاسات دقيقة بالسنتيمتر', 'Custom measurements (cm)') : t('مقاس جاهز قياسي', 'Standard size (S, M, L...)')}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Measurements */}
        <div className="space-y-4 pt-4 border-t border-[#e8dfd1]">
          <div>
            <h3 className="text-lg sm:text-xl font-serif font-bold text-[#142b4a]">{t('تفاصيل المقاسات', 'Measurement details')}</h3>
            <p className="text-xs text-[#77808b] mt-0.5">
              {t('املئي المقاسات التي تعرفينها بالسنتيمتر، وسيقوم فريقنا بمراجعتها والتأكيد معك.', 'Provide known measurements in cm; our tailoring team will review them with you.')}
            </p>
          </div>

          {mode === 'StandardSize' ? (
            <div className="flex flex-wrap gap-2" role="group" aria-label={t('المقاس القياسي', 'Standard size')}>
              {catalog.standardSizes.map((v) => (
                <button key={v} type="button" onClick={() => setStandardSize(v)} aria-pressed={standardSize === v}
                  className={`min-w-[44px] h-[40px] px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    standardSize === v ? 'bg-[#142b4a] text-white ring-2 ring-[#b99664]' : 'bg-[#f7f3eb] text-[#142b4a] border border-[#e8dfd1] hover:border-[#b99664]'
                  }`}>
                  {v}
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {groups.map((group, i) => {
                const fields = fieldsByGroup[group] ?? [];
                if (!fields.length) return null;
                return (
                  <details key={group} className="border border-[#e8dfd1] rounded-2xl bg-white overflow-hidden shadow-2xs group/sec" open={i === 0}>
                    <summary className="p-4 bg-[#faf7f2] hover:bg-[#f3ede1] font-bold text-sm sm:text-base text-[#142b4a] flex items-center justify-between cursor-pointer select-none transition-colors">
                      <span>{group === 'common' ? t('المقاسات الأساسية للجسم', 'Essential body measurements') : group === 'sleeves' ? t('مقاسات الأكمام', 'Sleeve measurements') : pick(lang, garmentInfo?.nameAr, garmentInfo?.nameEn)}</span>
                      <span className="text-xs text-[#b99664] font-semibold flex items-center gap-1.5">
                        <span>{fields.length} {t('حقل', 'fields')}</span>
                        <span className="group-open/sec:rotate-180 transition-transform">⌄</span>
                      </span>
                    </summary>
                    <div className="p-4 sm:p-6 grid grid-cols-2 sm:grid-cols-3 gap-3.5 bg-white">
                      {fields.map((field) => (
                        <label key={field.key} className="flex flex-col gap-1 text-xs font-semibold text-[#2d3540]">
                          <span className="flex items-center justify-between">
                            <span className="truncate">{pick(lang, field.nameAr, field.nameEn)}{field.required ? ' *' : ''}</span>
                            <small className="text-[#b99664] font-bold">cm</small>
                          </span>
                          <input type="number" min="1" max="300" step="0.1" inputMode="decimal" placeholder="—"
                            required={!!field.required} value={measurements[field.key] ?? ''}
                            onChange={(e) => setMeasurement(field.key, e.target.value)}
                            className="border border-[#e8e3d9] rounded-lg p-2 text-xs bg-white text-[#142b4a] focus:ring-2 focus:ring-[#b99664] focus:outline-none transition-all" />
                        </label>
                      ))}
                    </div>
                  </details>
                );
              })}
              {fieldMsg('measurements')}
            </div>
          )}
        </div>

        {/* Reference photo */}
        <div className="space-y-3 pt-4 border-t border-[#e8dfd1]">
          <span className="text-xs sm:text-sm font-bold text-[#2d3540] block">
            {t('صورة الموديل أو التصميم (اختياري، حتى 5 ميجابايت)', 'Reference design photo (optional, up to 5 MB)')}
          </span>
          <div className="border-2 border-dashed border-[#cdbb9e] hover:border-[#b99664] bg-[#faf7f2] rounded-2xl p-6 text-center transition-colors">
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handlePhoto} aria-label={t('رفع صورة', 'Upload photo')}
              className="text-xs text-[#77808b] file:me-3 file:py-2.5 file:px-5 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-[#142b4a] file:text-white hover:file:bg-[#b99664] cursor-pointer transition-colors" />
            {photoError && <p role="alert" className="mt-2 text-xs font-bold text-[#a72f3e]">{photoError}</p>}
            {preview && (
              <div className="mt-4 inline-block relative rounded-xl overflow-hidden border border-[#d6c2a7] shadow-md">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt={t('معاينة الصورة', 'Photo preview')} className="w-32 h-44 object-cover" />
                <button type="button" aria-label={t('إزالة الصورة', 'Remove photo')}
                  onClick={() => { URL.revokeObjectURL(preview); setPreview(''); setPhoto(null); }}
                  className="absolute top-1.5 end-1.5 w-6 h-6 rounded-full bg-[#142b4a] text-white text-xs flex items-center justify-center cursor-pointer hover:bg-red-700">
                  ✕
                </button>
              </div>
            )}
          </div>
        </div>

        <label className="flex flex-col gap-1.5 text-xs sm:text-sm font-bold text-[#2d3540]">
          <span>{t('ملاحظات إضافية للتفصيل', 'Tailoring special notes')}</span>
          <textarea rows={3} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder={t('تعديل في الطول، فتحة الرقبة، نوع الأزرار، جيوب مخفية...', 'Any adjustments for length, neckline, buttons, pockets, etc.')}
            className="border border-[#e8e3d9] rounded-xl p-3.5 bg-white text-[#142b4a] text-sm focus:outline-none focus:ring-2 focus:ring-[#b99664] min-h-[85px] transition-all" />
        </label>

        {/* Contact and delivery */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-4 border-t border-[#e8dfd1]">
          <h3 className="sm:col-span-2 text-lg font-serif font-bold text-[#142b4a]">{t('بيانات التواصل والتوصيل', 'Contact & delivery')}</h3>
          <label className="flex flex-col gap-1.5 text-xs sm:text-sm font-bold text-[#2d3540]">
            <span>{t('الاسم بالكامل', 'Full name')} *</span>
            <input required minLength={3} maxLength={100} autoComplete="name" value={customer} onChange={(e) => setCustomer(e.target.value)}
              className={inputClasses} placeholder={t('اكتبي اسمك هنا', 'Your name')} />
            {fieldMsg('customer.name')}
          </label>
          <label className="flex flex-col gap-1.5 text-xs sm:text-sm font-bold text-[#2d3540]">
            <span>{t('رقم الهاتف والواتساب', 'Phone / WhatsApp')} *</span>
            <input type="tel" required pattern="[0-9+ ()\-]{10,20}" autoComplete="tel" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)}
              className={inputClasses} placeholder="01xxxxxxxxx" />
            {fieldMsg('customer.phone')}
          </label>
          <label className="flex flex-col gap-1.5 text-xs sm:text-sm font-bold text-[#2d3540]">
            <span>{t('المحافظة', 'Governorate')} *</span>
            <select required value={zoneId} onChange={(e) => setZoneId(e.target.value ? Number(e.target.value) : '')} className={`${inputClasses} cursor-pointer`}>
              <option value="">{t('اختاري المحافظة', 'Choose governorate')}</option>
              {zones.data?.map((z) => (
                <option key={z.id} value={z.id}>{pick(lang, z.nameAr, z.nameEn)} — {money(z.fee)}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-xs sm:text-sm font-bold text-[#2d3540]">
            <span>{t('المدينة / المنطقة', 'City / district')} *</span>
            <input required minLength={2} maxLength={100} value={city} onChange={(e) => setCity(e.target.value)} className={inputClasses} />
            {fieldMsg('customer.city')}
          </label>
          <label className="flex flex-col gap-1.5 text-xs sm:text-sm font-bold text-[#2d3540] sm:col-span-2">
            <span>{t('العنوان بالتفصيل', 'Detailed address')} *</span>
            <textarea required minLength={10} maxLength={500} value={address} onChange={(e) => setAddress(e.target.value)} className={`${inputClasses} min-h-[70px]`} />
            {fieldMsg('customer.address')}
          </label>
          <label className="flex flex-col gap-1.5 text-xs sm:text-sm font-bold text-[#2d3540] sm:col-span-2">
            <span>{t('البريد الإلكتروني (اختياري)', 'Email (optional)')}</span>
            <input type="email" maxLength={254} autoComplete="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClasses} placeholder="name@example.com" />
            <small className="text-[11px] font-medium text-[#77808b]">
              {t('نرسل لكِ السعر النهائي ورابط الموافقة عليه', "We'll email you the final price and the link to approve it")}
            </small>
            {fieldMsg('customer.email')}
          </label>
        </div>

        {/* Live estimate */}
        <div className="bg-[#f7f3eb] border border-[#e8dfd1] rounded-2xl p-5 space-y-2" aria-live="polite">
          <div className="flex items-center justify-between">
            <b className="text-sm text-[#142b4a]">{t('السعر التقديري', 'Estimated price')}</b>
            <b className="text-2xl text-[#b99664]">{estimate ? money(estimate.estimatedPrice) : '…'}</b>
          </div>
          {estimate && (
            <ul className="text-xs text-[#5e605b] space-y-1">
              <li className="flex justify-between"><span>{t('السعر الأساسي', 'Base price')}</span><span>{money(estimate.basePrice)}</span></li>
              {estimate.items.map((item) => (
                <li key={item.key} className="flex justify-between"><span>{pick(lang, item.labelAr, item.labelEn)}</span><span>+{money(item.amount)}</span></li>
              ))}
            </ul>
          )}
          <p className="text-[11px] text-[#70542d]">{estimate ? pick(lang, estimate.noteAr, estimate.noteEn) : ''}</p>
        </div>

        <label className="flex items-start gap-3 text-xs text-[#2d3540] cursor-pointer leading-relaxed">
          <input type="checkbox" required checked={terms} onChange={(e) => setTerms(e.target.checked)} className="accent-[#142b4a] w-4 h-4 mt-0.5 shrink-0 cursor-pointer" />
          <span>
            {t(
              'أعلم أن طلب التفصيل يُراجع أولاً، وأن السعر النهائي يُرسل لي للموافقة عليه قبل البدء في التنفيذ.',
              'I understand the request is reviewed first and the final price is sent to me for approval before production starts.',
            )}
          </span>
        </label>

        {error ? (
          <p role="alert" className="text-xs font-bold text-[#a72f3e] bg-red-50 border border-red-200 rounded-xl p-3">
            {error instanceof ApiError && error.code === 'FILE_TOO_LARGE'
              ? t('الصورة كبيرة جدًا (الحد 5 ميجابايت)', 'The photo is too large (5 MB max)')
              : error instanceof ApiError && error.code === 'UNSUPPORTED_FILE_TYPE'
              ? t('الصورة غير صالحة، استخدمي JPG أو PNG أو WebP', 'That photo can’t be read. Use JPG, PNG or WebP')
              : errorText(error, t)}
          </p>
        ) : null}

        <button type="submit" disabled={sending}
          className="w-full py-4 rounded-full bg-[#142b4a] hover:bg-[#b99664] disabled:opacity-60 disabled:cursor-wait text-white text-sm font-bold shadow-md hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] cursor-pointer transition-all duration-300">
          {sending ? t('جارٍ إرسال الطلب...', 'Submitting request...') : t('إرسال طلب التفصيل للمراجعة ↗', 'Submit tailoring request ↗')}
        </button>
      </form>
    </section>
  );
}
