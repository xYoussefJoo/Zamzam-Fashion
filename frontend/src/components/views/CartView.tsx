'use client';

import React, { useState, FormEvent } from 'react';
import { useZamzamStore } from '@/store/useZamzamStore';
import { assetPath } from '@/data/seed';

export default function CartView() {
  const data = useZamzamStore((state) => state.data);
  const lang = useZamzamStore((state) => state.lang);
  const removeFromCart = useZamzamStore((state) => state.removeFromCart);
  const checkout = useZamzamStore((state) => state.checkout);
  const go = useZamzamStore((state) => state.go);
  const subtotal = useZamzamStore((state) => state.getSubtotal());
  const delivery = useZamzamStore((state) => state.getDeliveryFee());
  const total = useZamzamStore((state) => state.getTotal());
  const money = useZamzamStore((state) => state.money);
  const localizedColor = useZamzamStore((state) => state.localizedColor);
  const t = useZamzamStore((state) => state.t);
  const showToast = useZamzamStore((state) => state.showToast);

  const [customer, setCustomer] = useState('');
  const [phone, setPhone] = useState('');
  const [governorate, setGovernorate] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [confirm, setConfirm] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!confirm || paymentMethod !== 'cod') {
      showToast(
        t('يرجى تأكيد تفاصيل الطلب وطريقة الدفع', 'Please confirm order details and payment method'),
        'error'
      );
      return;
    }

    checkout({
      customer: customer.trim(),
      phone: phone.trim(),
      governorate: governorate.trim(),
      city: city.trim(),
      address: address.trim(),
      notes: notes.trim(),
    });
  };

  const inputClasses =
    'border border-[#e8e3d9] rounded-xl p-3 bg-white text-[#142b4a] text-sm focus:outline-none focus:ring-2 focus:ring-[#b99664] focus:border-[#b99664] transition-all';

  return (
    <section className="max-w-[1240px] mx-auto px-4 sm:px-6 py-12 space-y-8 animate-scale-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-[#e8dfd1] gap-4">
        <div>
          <span className="text-xs text-[#b99664] font-bold tracking-[0.2em] uppercase">
            SHOPPING BAG
          </span>
          <h2 className="text-2xl sm:text-4xl font-serif font-bold text-[#142b4a] mt-1">
            {t('حقيبة التسوق وإتمام الطلب', 'Your bag & checkout')}
          </h2>
          <p className="text-xs sm:text-sm text-[#77808b] mt-0.5">
            {t(
              'راجعي محتويات حقيبتك وبيانات التوصيل قبل إرسال الطلب للمتجر',
              'Review your selected pieces and delivery information'
            )}
          </p>
        </div>
        <button
          type="button"
          className="px-5 py-2.5 rounded-full border border-[#142b4a] bg-transparent hover:bg-[#142b4a] hover:text-white text-[#142b4a] text-xs font-bold transition-all duration-200 cursor-pointer self-start sm:self-auto"
          onClick={() => go('shop')}
        >
          {t('متابعة التسوق ↗', 'Continue shopping ↗')}
        </button>
      </div>

      {data.cart.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Main Items & Checkout Form */}
          <div className="lg:col-span-8 bg-white rounded-3xl border border-[#e8e3d9] p-6 sm:p-8 space-y-8 shadow-xs">
            {/* Cart Items List */}
            <div>
              <h3 className="text-lg font-serif font-bold text-[#142b4a] pb-4 border-b border-[#e8dfd1]">
                {t('القطع المختارة', 'Selected items')} ({data.cart.length})
              </h3>

              <div className="divide-y divide-[#e8dfd1]">
                {data.cart.map((c) => {
                  const p = data.products.find((x) => x.id === c.id);
                  if (!p) return null;
                  return (
                    <div
                      key={`${c.id}-${c.size}-${c.color}`}
                      className="py-4 first:pt-4 last:pb-2 flex items-center gap-4 group"
                    >
                      {/* Thumbnail */}
                      <div className="w-18 h-22 rounded-xl overflow-hidden bg-[#f7f3eb] border border-[#e8dfd1] shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={assetPath(p.image || '')}
                          alt=""
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>

                      {/* Details */}
                      <div className="flex-1 min-w-0 space-y-1">
                        <b className="block text-sm font-bold text-[#142b4a] truncate">
                          {p[lang] || p.ar}
                        </b>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-[#77808b]">
                          <span className="bg-[#f7f3eb] px-2 py-0.5 rounded text-[#142b4a] font-semibold">
                            {c.size || 'One Size'}
                          </span>
                          <span>·</span>
                          <span>{localizedColor(c.color || '')}</span>
                          <span>·</span>
                          <span className="font-bold text-[#b99664]">
                            {money(p.price)} × {c.qty}
                          </span>
                        </div>
                      </div>

                      {/* Remove Button */}
                      <button
                        type="button"
                        className="px-3 py-1.5 rounded-lg border border-[#e8e3d9] hover:border-red-400 hover:bg-red-50 hover:text-red-700 text-xs font-bold text-[#77808b] transition-colors cursor-pointer shrink-0"
                        onClick={() => removeFromCart(c.id, c.size, c.color)}
                      >
                        {t('حذف', 'Remove')}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Delivery Form */}
            <div>
              <h3 className="text-lg font-serif font-bold text-[#142b4a] pb-3 border-b border-[#e8dfd1]">
                {t('بيانات الاستلام والشحن', 'Delivery details')}
              </h3>

              <form
                id="checkout-form"
                className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4"
                onSubmit={handleSubmit}
              >
                <label className="flex flex-col gap-1.5 text-xs sm:text-sm font-bold text-[#2d3540]">
                  <span>{t('الاسم بالكامل', 'Full name')} *</span>
                  <input
                    name="customer"
                    required
                    minLength={3}
                    maxLength={100}
                    autoComplete="name"
                    value={customer}
                    onChange={(e) => setCustomer(e.target.value)}
                    className={inputClasses}
                    placeholder={t('اسم المستلم', 'Recipient name')}
                  />
                </label>

                <label className="flex flex-col gap-1.5 text-xs sm:text-sm font-bold text-[#2d3540]">
                  <span>{t('رقم الموبايل', 'Mobile number')} *</span>
                  <input
                    name="phone"
                    required
                    type="tel"
                    pattern="[0-9+ ()-]{8,20}"
                    autoComplete="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={inputClasses}
                    placeholder="01xxxxxxxxx"
                  />
                </label>

                <label className="flex flex-col gap-1.5 text-xs sm:text-sm font-bold text-[#2d3540]">
                  <span>{t('المحافظة', 'Governorate')} *</span>
                  <input
                    name="governorate"
                    required
                    maxLength={80}
                    value={governorate}
                    onChange={(e) => setGovernorate(e.target.value)}
                    className={inputClasses}
                    placeholder={t('مثال: القاهرة، الجيزة...', 'e.g. Cairo, Giza')}
                  />
                </label>

                <label className="flex flex-col gap-1.5 text-xs sm:text-sm font-bold text-[#2d3540]">
                  <span>{t('المدينة / المنطقة', 'City / district')} *</span>
                  <input
                    name="city"
                    required
                    maxLength={100}
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className={inputClasses}
                    placeholder={t('مثال: المعادي، مصر الجديدة...', 'e.g. Maadi, Heliopolis')}
                  />
                </label>

                <label className="flex flex-col gap-1.5 text-xs sm:text-sm font-bold text-[#2d3540] sm:col-span-2">
                  <span>
                    {t(
                      'العنوان بالتفصيل (الشارع، رقم العمارة، الدور، الشقة)',
                      'Detailed address (Street, Building, Floor, Apt)'
                    )} *
                  </span>
                  <textarea
                    name="address"
                    required
                    minLength={10}
                    maxLength={500}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className={`${inputClasses} min-h-[85px]`}
                    placeholder={t('اكتبي تفاصيل العنوان هنا بدقة...', 'Write detailed address here...')}
                  />
                </label>

                <label className="flex flex-col gap-1.5 text-xs sm:text-sm font-bold text-[#2d3540] sm:col-span-2">
                  <span>{t('ملاحظات للتوصيل (اختياري)', 'Delivery notes (optional)')}</span>
                  <textarea
                    name="notes"
                    maxLength={500}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className={`${inputClasses} min-h-[70px]`}
                    placeholder={t('أي ملاحظات لمندوب الشحن...', 'Notes for courier...')}
                  />
                </label>

                {/* Payment Method Selector */}
                <div className="sm:col-span-2 space-y-2 pt-2">
                  <span className="block text-xs sm:text-sm font-bold text-[#2d3540]">
                    {t('طريقة الدفع', 'Payment method')}
                  </span>
                  <div className="flex items-center gap-3 border border-[#b99664]/40 rounded-2xl p-4 bg-[#fbf8f2]">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="cod"
                      checked={paymentMethod === 'cod'}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      required
                      className="accent-[#142b4a] w-4 h-4 cursor-pointer"
                    />
                    <div>
                      <b className="block text-sm font-bold text-[#142b4a]">
                        {t('الدفع عند الاستلام', 'Cash on delivery')}
                      </b>
                      <small className="block text-xs text-[#77808b] mt-0.5">
                        {t(
                          'يتم الدفع نقداً عند استلام الطلب ومراجعته',
                          'Pay in cash upon inspection and delivery of your items'
                        )}
                      </small>
                    </div>
                  </div>
                </div>

                {/* Agreement Checkbox */}
                <label className="sm:col-span-2 flex items-start gap-3 text-xs text-[#2d3540] cursor-pointer pt-2 leading-relaxed">
                  <input
                    type="checkbox"
                    name="confirm"
                    checked={confirm}
                    onChange={(e) => setConfirm(e.target.checked)}
                    required
                    className="accent-[#142b4a] w-4 h-4 mt-0.5 shrink-0 cursor-pointer"
                  />
                  <span>
                    {t(
                      'أؤكد صحة بيانات الاستلام وأعلم أن فريق المتجر سيتواصل لتأكيد توفر القطع والتوصيل.',
                      'I confirm my delivery info and understand store staff will contact to confirm availability and dispatch.'
                    )}
                  </span>
                </label>

                {/* Submit Action */}
                <div className="sm:col-span-2 pt-2">
                  <button
                    type="submit"
                    className="w-full py-4 rounded-full bg-[#142b4a] hover:bg-[#b99664] text-white text-sm font-bold shadow-md hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] cursor-pointer transition-all duration-300"
                  >
                    {t('إرسال الطلب للمتجر', 'Submit order')} · {money(total)}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Sticky Order Summary Column */}
          <aside className="lg:col-span-4 bg-[#f7f3eb] rounded-3xl border border-[#e8dfd1] p-6 sm:p-7 space-y-4 lg:sticky lg:top-28 shadow-xs">
            <h3 className="text-lg font-serif font-bold text-[#142b4a] pb-3 border-b border-[#e8dfd1]">
              {t('ملخص الحساب', 'Order summary')}
            </h3>

            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between text-[#5e605b]">
                <span>{t('إجمالي المنتجات', 'Subtotal')}</span>
                <b className="text-[#142b4a] font-bold">{money(subtotal)}</b>
              </div>

              <div className="flex items-center justify-between text-[#5e605b]">
                <span>{t('رسوم التوصيل التقديرية', 'Estimated shipping')}</span>
                <b className="text-[#142b4a] font-bold">{money(delivery)}</b>
              </div>

              <div className="flex items-center justify-between text-base font-bold pt-3 border-t border-[#e8dfd1]">
                <strong className="text-[#142b4a]">{t('المجموع الكلي', 'Total')}</strong>
                <strong className="text-xl text-[#b99664]">{money(total)}</strong>
              </div>
            </div>

            <div className="pt-2 text-xs text-[#77808b] leading-relaxed border-t border-[#e8dfd1]/60">
              <p>
                {t(
                  '• رسوم الشحن تقديرية وقد تختلف قليلاً بحسب المنطقة الدقيقة.',
                  '• Delivery fees are estimated and confirmed before dispatch.'
                )}
              </p>
              <p className="mt-1">
                {t(
                  '• مدة التوصيل من يومين إلى 4 أيام عمل.',
                  '• Delivery takes 2-4 business days.'
                )}
              </p>
            </div>
          </aside>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-[#e8dfd1] p-16 text-center text-[#77808b] space-y-4 shadow-xs">
          <span className="text-5xl block animate-float select-none">🛍</span>
          <h3 className="text-xl font-serif font-bold text-[#142b4a]">
            {t('حقيبة التسوق فارغة', 'Your shopping bag is empty')}
          </h3>
          <p className="text-xs text-[#77808b] max-w-sm mx-auto">
            {t(
              'اكتشفي تشكيلتنا المتنوعة واختاري ما يناسبك من الإطلالات اليومية والتفصيل الخاص.',
              'Explore our curated collection and discover elevated essentials tailored for your wardrobe.'
            )}
          </p>
          <div className="pt-2">
            <button
              type="button"
              className="px-7 py-3 rounded-full bg-[#142b4a] hover:bg-[#b99664] text-white text-xs sm:text-sm font-bold shadow-md transition-all cursor-pointer"
              onClick={() => go('shop')}
            >
              {t('تصفحي المعروضات ↗', 'Start shopping ↗')}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
