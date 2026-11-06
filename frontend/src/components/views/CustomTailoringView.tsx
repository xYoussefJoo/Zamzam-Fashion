'use client';

import React, { useState, ChangeEvent, FormEvent } from 'react';
import { useZamzamStore } from '@/store/useZamzamStore';
import {
  tailoringStyles,
  garmentKinds,
  measurementCatalog,
} from '@/data/seed';

export default function CustomTailoringView() {
  const t = useZamzamStore((state) => state.t);
  const addCustomOrder = useZamzamStore((state) => state.addCustomOrder);

  const [customer, setCustomer] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [kind, setKind] = useState('pants');
  const [fabric, setFabric] = useState('cotton');
  const [color, setColor] = useState('');
  const [fit, setFit] = useState('Regular');
  const [mode, setMode] = useState<'custom' | 'standard'>('custom');
  const [standardSize, setStandardSize] = useState('M');
  const [measurements, setMeasurements] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState('');
  const [imagePreview, setImagePreview] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const handleModelChange = (modelId: string) => {
    setSelectedModel(modelId);
    if (!modelId) return;
    const style = tailoringStyles.find((x) => x.id === modelId);
    if (style) {
      setKind(style.kind);
      setFabric(style.fabric);
      setFit(style.fit);
    }
  };

  const handlePhotoChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setImagePreview('');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      alert(t('الصورة أكبر من 2 ميجابايت', 'Image exceeds 2MB'));
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleMeasurementChange = (fieldKey: string, val: string) => {
    const num = parseFloat(val);
    setMeasurements((prev) => {
      const copy = { ...prev };
      if (!val || isNaN(num)) {
        delete copy[fieldKey];
      } else {
        copy[fieldKey] = num;
      }
      return copy;
    });
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    if (mode === 'custom') {
      for (const [, val] of Object.entries(measurements)) {
        if (val <= 0 || val > 300) {
          alert(t('راجعي قيم المقاسات', 'Check measurements'));
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      addCustomOrder({
        customer: customer.trim(),
        phone: phone.trim(),
        kind,
        model: selectedModel,
        fabric,
        color: color.trim(),
        fit,
        size: mode === 'standard' ? standardSize : '',
        measures: mode === 'custom' ? measurements : {},
        notes: notes.trim(),
        image: imagePreview,
      });
    } catch {
      alert(t('مساحة التخزين ممتلئة. جربي صورة أصغر.', 'Browser storage full. Try a smaller image.'));
    } finally {
      setSubmitting(false);
    }
  };

  const measurementSections = [
    { key: 'common', ar: 'المقاسات الأساسية للجسم', en: 'Essential body measurements' },
    ...(kind === 'pants'
      ? []
      : [{ key: 'sleeves', ar: 'مقاسات الأكمام', en: 'Sleeve measurements' }]),
    {
      key: kind,
      ar: garmentKinds.find((x) => x.id === kind)?.ar || 'القطعة',
      en: garmentKinds.find((x) => x.id === kind)?.en || 'Garment',
    },
  ];

  const inputClasses =
    'border border-[#e8e3d9] rounded-xl p-3 bg-white text-[#142b4a] text-sm focus:outline-none focus:ring-2 focus:ring-[#b99664] focus:border-[#b99664] transition-all';

  return (
    <section className="max-w-[1080px] mx-auto px-4 sm:px-6 py-12 space-y-8 animate-scale-in">
      {/* Intro Header */}
      <div className="space-y-1.5 pb-2 border-b border-[#e8dfd1]">
        <span className="text-xs text-[#b99664] font-bold tracking-[0.2em] uppercase">
          ZAMZAM / ATELIER
        </span>
        <h2 className="text-2xl sm:text-4xl font-serif font-bold text-[#142b4a]">
          {t('استوديو التفصيل الخاص', 'Made-to-measure studio')}
        </h2>
        <p className="text-xs sm:text-sm text-[#77808b]">
          {t(
            'اختاري الموديل، وحددي القماش والمقاسات المناسبة لنصنع لكِ قطعة حصرية.',
            'Select your design style, fabric, and sizing preferences for your tailored creation.'
          )}
        </p>
      </div>

      {/* Main Form */}
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-3xl border border-[#e8e3d9] p-6 sm:p-10 shadow-xs space-y-8"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <label className="flex flex-col gap-1.5 text-xs sm:text-sm font-bold text-[#2d3540]">
            <span>{t('الاسم بالكامل', 'Full name')} *</span>
            <input
              name="customer"
              required
              maxLength={100}
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
              className={inputClasses}
              placeholder={t('اكتبي اسمك هنا', 'Your name')}
            />
          </label>

          <label className="flex flex-col gap-1.5 text-xs sm:text-sm font-bold text-[#2d3540]">
            <span>{t('رقم الهاتف والواتساب', 'Phone / WhatsApp')} *</span>
            <input
              name="phone"
              type="tel"
              required
              pattern="[0-9+ ()-]{8,20}"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputClasses}
              placeholder="01xxxxxxxxx"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-xs sm:text-sm font-bold text-[#2d3540] sm:col-span-2">
            <span>{t('اختاري موديل من المقترحات', 'Choose a suggested style')}</span>
            <select
              name="model"
              value={selectedModel}
              onChange={(e) => handleModelChange(e.target.value)}
              className={inputClasses}
            >
              <option value="">{t('تصميم خاص من عندي (سأرفع صورة)', 'My own custom design (upload image)')}</option>
              {tailoringStyles.map((x) => (
                <option key={x.id} value={x.id}>
                  {t(x.ar, x.en)}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-xs sm:text-sm font-bold text-[#2d3540]">
            <span>{t('نوع القطعة', 'Garment type')} *</span>
            <select
              name="kind"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              className={inputClasses}
            >
              {garmentKinds.map((g) => (
                <option key={g.id} value={g.id}>
                  {t(g.ar, g.en)}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-xs sm:text-sm font-bold text-[#2d3540]">
            <span>{t('نوع القماش المفضل', 'Preferred fabric')} *</span>
            <select
              name="fabric"
              value={fabric}
              onChange={(e) => setFabric(e.target.value)}
              className={inputClasses}
            >
              <option value="cotton">{t('قطن ناعم', 'Soft Cotton')}</option>
              <option value="linen">{t('كتان فاخر', 'Pure Linen')}</option>
              <option value="crepe">{t('كريب خفيف', 'Light Crepe')}</option>
              <option value="satin">{t('ستان ناعم', 'Silky Satin')}</option>
              <option value="chiffon">{t('شيفون مبطن', 'Lined Chiffon')}</option>
              <option value="denim">{t('جينز', 'Denim')}</option>
              <option value="wool">{t('صوف ناعم', 'Wool')}</option>
              <option value="other">{t('حسب الاتفاق مع المصممة', 'To discuss with tailor')}</option>
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-xs sm:text-sm font-bold text-[#2d3540]">
            <span>{t('اللون المطلوب', 'Preferred color')} *</span>
            <input
              name="color"
              required
              value={color}
              onChange={(e) => setColor(e.target.value)}
              placeholder={t('مثال: بيج فاتح، كحلي...', 'e.g. Warm Beige, Classic Navy')}
              className={inputClasses}
            />
          </label>

          <label className="flex flex-col gap-1.5 text-xs sm:text-sm font-bold text-[#2d3540]">
            <span>{t('نوع القصة', 'Silhouette / Fit')}</span>
            <select
              name="fit"
              value={fit}
              onChange={(e) => setFit(e.target.value)}
              className={inputClasses}
            >
              <option value="Regular">{t('عادي مريح (Regular)', 'Regular')}</option>
              <option value="Relaxed">{t('واسع انسيابي (Relaxed)', 'Relaxed')}</option>
              <option value="Oversized">{t('أوفر سايز (Oversized)', 'Oversized')}</option>
              <option value="Slim">{t('محدد القوام (Slim)', 'Slim')}</option>
            </select>
          </label>

          {/* Sizing Method Switcher */}
          <div className="sm:col-span-2 space-y-2">
            <span className="text-xs sm:text-sm font-bold text-[#2d3540] block">
              {t('طريقة تحديد المقاس', 'Sizing method')}
            </span>
            <div className="grid grid-cols-2 gap-3 max-w-md">
              <button
                type="button"
                onClick={() => setMode('custom')}
                className={`py-3 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  mode === 'custom'
                    ? 'bg-[#142b4a] text-white shadow-sm'
                    : 'bg-[#f7f3eb] text-[#2d3540] hover:bg-[#e7dac5]'
                }`}
              >
                {t('مقاسات دقيقة بالسنتيمتر', 'Custom measurements (cm)')}
              </button>
              <button
                type="button"
                onClick={() => setMode('standard')}
                className={`py-3 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  mode === 'standard'
                    ? 'bg-[#142b4a] text-white shadow-sm'
                    : 'bg-[#f7f3eb] text-[#2d3540] hover:bg-[#e7dac5]'
                }`}
              >
                {t('مقاس جاهز قياسي', 'Standard size (S, M, L...)')}
              </button>
            </div>
          </div>
        </div>

        {/* Dynamic Measurements Section */}
        <div className="space-y-4 pt-4 border-t border-[#e8dfd1]">
          <div>
            <h3 className="text-lg sm:text-xl font-serif font-bold text-[#142b4a]">
              {t('تفاصيل المقاسات', 'Measurement details')}
            </h3>
            <p className="text-xs text-[#77808b] mt-0.5">
              {t(
                'املئي المقاسات التي تعرفينها بالسنتيمتر، وسيقوم فريقنا بمراجعتها والتأكيد معك.',
                'Provide known measurements in cm; our tailoring team will review them with you.'
              )}
            </p>
          </div>

          {mode === 'standard' ? (
            <div className="max-w-xs space-y-2">
              <label className="text-xs font-bold text-[#2d3540] block">
                {t('المقاس القياسي الجاهز', 'Standard ready size')}
              </label>
              <div className="flex flex-wrap gap-2">
                {['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Free Size'].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setStandardSize(v)}
                    className={`min-w-[44px] h-[40px] px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      standardSize === v
                        ? 'bg-[#142b4a] text-white ring-2 ring-[#b99664]'
                        : 'bg-[#f7f3eb] text-[#142b4a] border border-[#e8dfd1] hover:border-[#b99664]'
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {measurementSections.map((sec, i) => {
                const fields = measurementCatalog[sec.key] || [];
                if (!fields.length) return null;
                return (
                  <details
                    key={sec.key}
                    className="border border-[#e8dfd1] rounded-2xl bg-white overflow-hidden shadow-2xs group/sec"
                    open={i === 0}
                  >
                    <summary className="p-4 bg-[#faf7f2] hover:bg-[#f3ede1] font-bold text-sm sm:text-base text-[#142b4a] flex items-center justify-between cursor-pointer select-none transition-colors">
                      <span>{t(sec.ar, sec.en)}</span>
                      <span className="text-xs text-[#b99664] font-semibold flex items-center gap-1.5">
                        <span>{fields.length} {t('حقل', 'fields')}</span>
                        <span className="group-open/sec:rotate-180 transition-transform">⌄</span>
                      </span>
                    </summary>
                    <div className="p-4 sm:p-6 grid grid-cols-2 sm:grid-cols-3 gap-3.5 bg-white">
                      {fields.map((field) => (
                        <label
                          key={field.key}
                          className="flex flex-col gap-1 text-xs font-semibold text-[#2d3540]"
                        >
                          <span className="flex items-center justify-between">
                            <span className="truncate">{t(field.ar, field.en)}</span>
                            <small className="text-[#b99664] font-bold">cm</small>
                          </span>
                          <input
                            name={`m_${field.key}`}
                            type="number"
                            min="1"
                            max="300"
                            step="0.1"
                            inputMode="decimal"
                            placeholder="—"
                            value={measurements[field.key] || ''}
                            onChange={(e) =>
                              handleMeasurementChange(field.key, e.target.value)
                            }
                            className="border border-[#e8e3d9] rounded-lg p-2 text-xs bg-white text-[#142b4a] focus:ring-2 focus:ring-[#b99664] focus:outline-none transition-all"
                          />
                        </label>
                      ))}
                    </div>
                  </details>
                );
              })}
            </div>
          )}
        </div>

        {/* Reference Image Upload Area */}
        <div className="space-y-3 pt-4 border-t border-[#e8dfd1]">
          <span className="text-xs sm:text-sm font-bold text-[#2d3540] block">
            {t('صورة الموديل أو التصميم (اختياري، حتى 2 ميجابايت)', 'Reference design photo (optional, up to 2MB)')}
          </span>
          <div className="border-2 border-dashed border-[#cdbb9e] hover:border-[#b99664] bg-[#faf7f2] rounded-2xl p-6 text-center transition-colors">
            <input
              name="photo"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handlePhotoChange}
              className="text-xs text-[#77808b] file:me-3 file:py-2.5 file:px-5 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-[#142b4a] file:text-white hover:file:bg-[#b99664] cursor-pointer transition-colors"
            />
            {imagePreview && (
              <div className="mt-4 inline-block relative rounded-xl overflow-hidden border border-[#d6c2a7] shadow-md">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imagePreview}
                  alt="Design reference preview"
                  className="w-32 h-44 object-cover"
                />
                <button
                  type="button"
                  onClick={() => setImagePreview('')}
                  className="absolute top-1.5 end-1.5 w-6 h-6 rounded-full bg-[#142b4a] text-white text-xs flex items-center justify-center cursor-pointer hover:bg-red-700"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Tailoring Notes */}
        <div className="space-y-2 pt-2">
          <label className="flex flex-col gap-1.5 text-xs sm:text-sm font-bold text-[#2d3540]">
            <span>{t('ملاحظات إضافية للتفصيل', 'Tailoring special notes')}</span>
            <textarea
              name="notes"
              rows={3}
              maxLength={2000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t(
                'تعديل في الطول، فتحة الرقبة، نوع الأزرار، جيوب مخفية...',
                'Any adjustments for length, neckline, buttons, pockets, etc.'
              )}
              className="border border-[#e8e3d9] rounded-xl p-3.5 bg-white text-[#142b4a] text-sm focus:outline-none focus:ring-2 focus:ring-[#b99664] min-h-[85px] transition-all"
            />
          </label>
        </div>

        {/* Informational Notice */}
        <div className="bg-[#f7f3eb] border border-[#e8dfd1] text-[#70542d] p-4 rounded-xl text-xs leading-relaxed flex items-center gap-3">
          <span className="text-xl text-[#b99664]">✦</span>
          <span>
            {t(
              'طلب التفصيل هو طلب مبدئي للمراجعة والتسعير؛ سيتواصل معكِ فريقنا لتأكيد كل التفاصيل بدقة قبل البدء في التنفيذ.',
              'This is an initial request for review and quotation. Our tailoring studio will contact you to confirm all details before production.'
            )}
          </span>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full py-4 rounded-full bg-[#142b4a] hover:bg-[#b99664] text-white text-sm font-bold shadow-md hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] cursor-pointer transition-all duration-300"
        >
          {submitting
            ? t('جارٍ إرسال الطلب...', 'Submitting request...')
            : t('إرسال طلب التفصيل للمراجعة ↗', 'Submit tailoring request ↗')}
        </button>
      </form>
    </section>
  );
}
