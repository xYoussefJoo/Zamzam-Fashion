'use client';

import React from 'react';
import { useZamzamStore } from '@/store/useZamzamStore';
import { useScrollReveal } from '@/hooks/useScrollReveal';
import { assetPath } from '@/data/seed';
import ProductCard from '@/components/shop/ProductCard';

export default function HomeView() {
  const data = useZamzamStore((state) => state.data);
  const lang = useZamzamStore((state) => state.lang);
  const go = useZamzamStore((state) => state.go);
  const setFilter = useZamzamStore((state) => state.setFilter);
  const t = useZamzamStore((state) => state.t);

  // Activates animations when elements enter the screen on scroll
  useScrollReveal();

  const cats = [
    { id: 1, img: 'assets/products/pants-beige.jpg' },
    { id: 2, img: 'assets/products/blouse-cream.jpg' },
    { id: 3, img: 'assets/modest-abaya-editorial.jpg' },
    { id: 4, img: 'assets/products/set-beige.jpg' },
  ];

  const handleCategoryClick = (categoryId: number) => {
    setFilter(String(categoryId));
    go('shop');
  };

  const visibleProducts = data.products.filter((p) => p.visible);
  const featured = visibleProducts.slice(0, 4);
  const newArrivals = visibleProducts.slice(-3).reverse();

  return (
    <main className="overflow-hidden">
      {/* ══════════════════════ EDITORIAL HERO ══════════════════════ */}
      <section className="relative grid grid-cols-1 lg:grid-cols-2 min-h-[560px] lg:min-h-[640px] bg-gradient-to-br from-[#f7f3eb] via-[#ede4d4] to-[#e2cfb3] overflow-hidden">
        {/* Copy Column */}
        <div className="relative z-10 p-8 sm:p-14 lg:p-20 flex flex-col items-start justify-center text-start">
          <span className="text-xs text-[#b99664] font-bold tracking-[0.25em] uppercase reveal-init">
            ZAMZAM FASHION / THE NEW EDIT
          </span>

          <h1 className="text-4xl sm:text-5xl lg:text-[4.2rem] font-serif font-bold text-[#142b4a] leading-[1.12] my-4 reveal-init delay-100">
            {t('ستايل يشبهك.', 'Made to feel like you.')}
          </h1>

          <p className="text-sm sm:text-base text-[#5e605b] leading-relaxed max-w-lg mb-8 reveal-init delay-200">
            {t(
              'تصميمات أنيقة لكل يوم، وقطع تتفصل على مقاسك بالضبط بخامات راقية ولمسات تجمع بين الراحة والجمال.',
              'Elevated everyday essentials and custom-tailored pieces, thoughtfully crafted with premium fabrics and timeless silhouettes.'
            )}
          </p>

          <div className="flex flex-wrap items-center gap-3.5 reveal-init delay-300">
            <button
              type="button"
              className="px-7 py-3.5 rounded-full bg-[#142b4a] hover:bg-[#1e3a61] text-white text-sm font-bold shadow-md hover:shadow-lg cursor-pointer transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] inline-flex items-center gap-2"
              onClick={() => {
                setFilter('all');
                go('shop');
              }}
            >
              <span>{t('اكتشفي المجموعة', 'Explore collection')}</span>
              <span className="text-base">↗</span>
            </button>
            <button
              type="button"
              className="px-7 py-3.5 rounded-full border-2 border-[#142b4a] bg-transparent hover:bg-[#142b4a] hover:text-white text-[#142b4a] text-sm font-bold cursor-pointer transition-all duration-300 active:scale-[0.98]"
              onClick={() => go('custom')}
            >
              {t('تفصيل خاص', 'Made to measure')}
            </button>
          </div>

          {/* Trust Badges */}
          <div className="mt-10 sm:mt-14 flex flex-wrap items-center gap-5 sm:gap-7 reveal-init delay-400">
            {[
              { ar: 'تصميم أصيل', en: 'Original design' },
              { ar: 'خامات فاخرة', en: 'Premium fabrics' },
              { ar: 'تفصيل دقيق', en: 'Expert tailoring' },
            ].map((badge) => (
              <div
                key={badge.en}
                className="flex items-center gap-2 text-xs text-[#77808b] font-semibold"
              >
                <span className="text-[#b99664] text-xs">✦</span>
                <span>{t(badge.ar, badge.en)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Photo Column */}
        <div className="relative min-h-[380px] lg:min-h-full overflow-hidden bg-[#d5b995] group reveal-right delay-200">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={assetPath('assets/modest-abaya-editorial.jpg')}
            alt="Women's fashion editorial"
            className="w-full h-full object-cover object-[center_34%] group-hover:scale-[1.04] transition-transform duration-1000 ease-out"
          />
          {/* Subtle gradient vignette */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#142b4a]/45 via-transparent to-transparent pointer-events-none" />

          {/* Floating glass badge */}
          <span className="absolute bottom-6 end-6 bg-white/85 backdrop-blur-md px-4 py-2 text-[10px] sm:text-xs tracking-widest font-bold text-[#142b4a] rounded-full shadow-sm">
            THE EVERYDAY COLLECTION — 2026
          </span>

          {/* Floating decorative ring */}
          <div className="absolute top-8 start-8 w-24 h-24 rounded-full border-2 border-[#b99664]/40 animate-float pointer-events-none hidden sm:block" />
        </div>
      </section>

      {/* ══════════════════════ CURATED CATEGORIES ══════════════════════ */}
      <section className="max-w-[1240px] mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10 reveal-init">
          <div>
            <span className="text-xs text-[#b99664] font-bold tracking-[0.25em] uppercase">
              CURATED FOR YOU
            </span>
            <h2 className="text-2xl sm:text-4xl font-serif font-bold text-[#142b4a] mt-1.5">
              {t('تسوقي على ذوقك', 'Find your style')}
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-[#77808b]">
            {t('قطع مختارة بعناية تناسب يومك', 'Considered pieces for your everyday wardrobe')}
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
          {data.categories.map((c, i) => {
            const tileImg =
              cats.find((x) => x.id === c.id)?.img ||
              'assets/products/blouse-cream.jpg';
            return (
              <button
                key={c.id}
                type="button"
                className={`relative h-[260px] sm:h-[350px] rounded-2xl overflow-hidden bg-[#e0ceb6] group cursor-pointer text-start shadow-sm hover:shadow-2xl transition-all duration-500 hover:-translate-y-1.5 border border-[#e8dfd1] reveal-init delay-${(i + 1) * 100}`}
                onClick={() => handleCategoryClick(c.id)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={assetPath(tileImg)}
                  alt={c[lang]}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
                />
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#142b4a]/90 via-[#142b4a]/25 to-transparent" />
                {/* Gold hover glow */}
                <div className="absolute inset-0 bg-[#b99664]/15 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                <div className="absolute bottom-0 start-0 end-0 p-5">
                  <span className="text-white text-base sm:text-lg font-bold flex items-end justify-between w-full">
                    <span>{c[lang]}</span>
                    <span className="text-[#b99664] text-xl group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform duration-300">
                      ↗
                    </span>
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* ══════════════════════ NEW COLLECTION BANNER ══════════════════════ */}
      {data.settings.collectionEnabled !== false && (
        <section className="max-w-[1240px] mx-auto px-4 sm:px-6 pb-16">
          <div className="relative overflow-hidden rounded-3xl bg-[#142b4a] p-8 sm:p-14 shadow-xl reveal-init">
            {/* Subtle background dots pattern */}
            <div
              className="absolute inset-0 opacity-10 pointer-events-none"
              style={{
                backgroundImage: 'radial-gradient(circle, #b99664 1px, transparent 1px)',
                backgroundSize: '24px 24px',
              }}
            />

            <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12 items-center">
              <div className="flex flex-col justify-center items-start text-start space-y-4 reveal-left delay-100">
                <span className="text-xs text-[#b99664] font-bold tracking-[0.25em] uppercase">
                  NEW ARRIVALS
                </span>
                <h2 className="text-2xl sm:text-4xl lg:text-5xl font-serif font-bold text-white leading-tight">
                  {lang === 'ar'
                    ? data.settings.collectionAr
                    : data.settings.collectionEn}
                </h2>
                <p className="text-sm text-white/75 leading-relaxed max-w-md">
                  {t(
                    'اكتشفي أحدث القطع المضافة لمجموعتنا المميزة بتفاصيل راقية وخامات ناعمة صُممت لتمنحك إطلالة متجددة ومريحة.',
                    'Explore our newest designs with refined craftsmanship, premium fabrics, and elevated everyday luxury.'
                  )}
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    className="px-7 py-3.5 rounded-full bg-[#b99664] hover:bg-[#c9a97a] text-white text-xs sm:text-sm font-bold transition-all duration-300 cursor-pointer shadow-lg hover:shadow-[#b99664]/40 hover:scale-[1.02] active:scale-[0.98] inline-flex items-center gap-2"
                    onClick={() => {
                      setFilter('all');
                      go('shop');
                    }}
                  >
                    <span>{t('تسوقي الجديد', 'Shop new arrivals')}</span>
                    <span>↗</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 sm:gap-4 items-center">
                {newArrivals.map((p, i) => (
                  <div
                    key={p.id}
                    className={`aspect-[3/4] rounded-2xl overflow-hidden bg-[#243d61] border border-white/10 shadow-md hover:shadow-2xl transition-all duration-300 hover:-translate-y-1.5 reveal-scale delay-${(i + 2) * 100}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={assetPath(p.image)}
                      alt={p[lang]}
                      loading="lazy"
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ══════════════════════ THE ZAMZAM EDIT ══════════════════════ */}
      <section className="max-w-[1240px] mx-auto px-4 sm:px-6 py-12 pb-20">
        <div className="flex items-center justify-between gap-4 mb-10 reveal-init">
          <div>
            <span className="text-xs text-[#b99664] font-bold tracking-[0.25em] uppercase">
              THE EDIT
            </span>
            <h2 className="text-2xl sm:text-4xl font-serif font-bold text-[#142b4a] mt-1.5">
              {t('مختارات زمزم', 'The Zamzam edit')}
            </h2>
          </div>
          <button
            type="button"
            className="text-sm font-bold text-[#142b4a] hover:text-[#b99664] transition-colors cursor-pointer group inline-flex items-center gap-1.5"
            onClick={() => {
              setFilter('all');
              go('shop');
            }}
          >
            <span className="border-b border-current pb-0.5">{t('كل المنتجات', 'View all pieces')}</span>
            <span className="group-hover:translate-x-1 transition-transform duration-200">↗</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {featured.map((p, i) => (
            <div
              key={p.id}
              className={`reveal-init delay-${(i + 1) * 100}`}
            >
              <ProductCard product={p} />
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════ TAILOR STUDIO BANNER ══════════════════════ */}
      <section className="max-w-[1240px] mx-auto px-4 sm:px-6 pb-20">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#e7dac5] via-[#dfcdb1] to-[#cfb895] p-8 sm:p-14 flex flex-col md:flex-row items-center justify-between gap-8 border border-[#d6c2a7] shadow-lg reveal-init">
          {/* Subtle geometric circles */}
          <div className="absolute -end-10 -top-10 w-56 h-56 rounded-full bg-[#142b4a]/6 pointer-events-none" />
          <div className="absolute -start-6 -bottom-6 w-40 h-40 rounded-full bg-[#b99664]/15 pointer-events-none" />

          <div className="relative z-10 text-start space-y-4 max-w-xl reveal-left delay-100">
            <span className="text-xs text-[#7c5e30] font-bold tracking-[0.25em] uppercase">
              DESIGNED BY YOU
            </span>
            <h2 className="text-2xl sm:text-4xl font-serif font-bold text-[#142b4a] leading-tight">
              {t('تفصيل على مقاسك، بذوقك.', 'Your vision. Our craftsmanship.')}
            </h2>
            <p className="text-sm text-[#524430] leading-relaxed">
              {t(
                'ارفعي صورة الموديل، اختاري القماش واللون، وحددي مقاساتك بدقة لنصنع لكِ قطعة استثنائية تناسبك تماماً.',
                'Share your design inspiration, select your favored fabric and color, and provide your measurements for a bespoke creation.'
              )}
            </p>
            <div className="pt-2">
              <button
                type="button"
                className="px-7 py-3.5 rounded-full bg-[#142b4a] hover:bg-[#1e3a61] text-white text-xs sm:text-sm font-bold transition-all duration-300 cursor-pointer shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] inline-flex items-center gap-2"
                onClick={() => go('custom')}
              >
                <span>{t('ابدئي تصميمك', 'Create your piece')}</span>
                <span>↗</span>
              </button>
            </div>
          </div>

          <div className="relative z-10 hidden md:flex items-center justify-center animate-float reveal-right delay-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={assetPath('assets/logo-transparent.png')}
              alt="Zamzam Fashion"
              className="w-48 h-48 lg:w-56 lg:h-56 object-contain drop-shadow-md"
            />
          </div>
        </div>
      </section>
    </main>
  );
}
