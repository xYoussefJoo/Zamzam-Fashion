'use client';

import React, { useState } from 'react';
import { useZamzamStore } from '@/store/useZamzamStore';
import { useApi } from '@/lib/useApi';
import { ApiError, errorText } from '@/lib/api';
import { getProduct, pick, searchProducts, type ProductDetail } from '@/lib/shop';
import ProductCard from '@/components/shop/ProductCard';

export default function ProductDetailsView() {
  const slug = useZamzamStore((state) => state.selectedSlug);
  const go = useZamzamStore((state) => state.go);
  const t = useZamzamStore((state) => state.t);
  const { data: product, error, loading, reload } = useApi(() => getProduct(slug!), [slug], !!slug);

  if (!slug || (error instanceof ApiError && error.status === 404)) {
    return (
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6 py-20 text-center space-y-4 animate-scale-in">
        <span className="text-5xl block animate-float select-none">🔍</span>
        <h2 className="text-2xl font-serif font-bold text-[#142b4a]">{t('لم يتم العثور على المنتج المطلوب', 'Product not found')}</h2>
        <p className="text-xs sm:text-sm text-[#77808b] max-w-md mx-auto">
          {t('قد يكون هذا المنتج غير متاح حالياً أو تم تغيير رابطه.', 'This product may be unavailable or the link may have changed.')}
        </p>
        <div className="pt-2">
          <button
            type="button"
            onClick={() => go('shop')}
            className="px-7 py-3 rounded-full bg-[#142b4a] hover:bg-[#b99664] text-white text-xs sm:text-sm font-bold shadow-md transition-all cursor-pointer"
          >
            {t('العودة للمتجر ↗', 'Return to shop ↗')}
          </button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6 py-20 text-center space-y-4">
        <p className="text-sm font-bold text-[#a72f3e]">{errorText(error, t)}</p>
        <button type="button" onClick={reload} className="px-6 py-2.5 rounded-full bg-[#142b4a] text-white text-xs font-bold hover:bg-[#b99664] cursor-pointer">
          {t('إعادة المحاولة', 'Try again')}
        </button>
      </div>
    );
  }

  if (loading || !product) {
    return (
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6 py-12 grid grid-cols-1 lg:grid-cols-12 gap-8 animate-pulse" aria-busy="true">
        <div className="lg:col-span-6 rounded-3xl bg-[#f7f3eb] aspect-[3/4]" />
        <div className="lg:col-span-6 space-y-4 p-8">
          <div className="h-4 bg-[#f1ebe0] rounded w-1/4" />
          <div className="h-10 bg-[#f1ebe0] rounded w-3/4" />
          <div className="h-8 bg-[#f1ebe0] rounded w-1/3" />
          <div className="h-24 bg-[#f1ebe0] rounded" />
        </div>
      </div>
    );
  }

  // Keyed by product, so the size/color/photo choices start fresh for each product.
  return <Details key={product.id} product={product} />;
}

function Details({ product }: { product: ProductDetail }) {
  const lang = useZamzamStore((state) => state.lang);
  const go = useZamzamStore((state) => state.go);
  const setFilter = useZamzamStore((state) => state.setFilter);
  const money = useZamzamStore((state) => state.money);
  const addToCart = useZamzamStore((state) => state.addToCart);
  const t = useZamzamStore((state) => state.t);

  const variants = product.variants;
  const first = variants.find((v) => v.inStock) ?? variants[0];
  const [selectedSize, setSelectedSize] = useState<string>(first?.size ?? '');
  const [selectedColorId, setSelectedColorId] = useState<number | null>(first?.color.id ?? null);
  const [quantity, setQuantity] = useState<number>(1);
  const [photo, setPhoto] = useState(0);
  const [imgError, setImgError] = useState<boolean>(false);
  const [justAdded, setJustAdded] = useState<boolean>(false);

  const { data: related } = useApi(
    () => searchProducts({ category: product.category.slug, pageSize: 5 }),
    [product.category.slug],
  );
  const relatedProducts = (related?.items ?? []).filter((p) => p.id !== product.id).slice(0, 4);

  const categoryName = pick(lang, product.category.nameAr, product.category.nameEn);
  const title = pick(lang, product.nameAr, product.nameEn);
  const description = pick(lang, product.descriptionAr, product.descriptionEn);
  const sizes = [...new Set(variants.map((v) => v.size))];
  const colors = [...new Map(variants.map((v) => [v.color.id, v.color])).values()];
  const variant = variants.find((v) => v.size === selectedSize && v.color.id === selectedColorId);
  const canBuy = !!variant?.inStock;
  const maxAvailable = Math.min(10, variant?.stock ?? 10);
  const image = product.images[photo] ?? product.images[0];
  const isAvailable = (size: string, colorId: number) => variants.some((v) => v.size === size && v.color.id === colorId && v.inStock);

  // Picking a size keeps the color when that combination exists, otherwise moves to one that does.
  const chooseSize = (size: string) => {
    setSelectedSize(size);
    setQuantity(1);
    if (selectedColorId == null || !variants.some((v) => v.size === size && v.color.id === selectedColorId)) {
      const match = variants.find((v) => v.size === size && v.inStock) ?? variants.find((v) => v.size === size);
      if (match) setSelectedColorId(match.color.id);
    }
  };
  const chooseColor = (colorId: number) => {
    setSelectedColorId(colorId);
    setQuantity(1);
    if (!variants.some((v) => v.size === selectedSize && v.color.id === colorId)) {
      const match = variants.find((v) => v.color.id === colorId && v.inStock) ?? variants.find((v) => v.color.id === colorId);
      if (match) setSelectedSize(match.size);
    }
  };

  const handleAddToCart = () => {
    if (!variant || !canBuy) return;
    const ok = addToCart(
      {
        variantId: variant.id,
        productSlug: product.slug,
        nameAr: product.nameAr,
        nameEn: product.nameEn,
        size: variant.size,
        colorNameAr: variant.color.nameAr,
        colorNameEn: variant.color.nameEn,
        colorHex: variant.color.hex,
        price: variant.price,
        imageUrl: product.images[0] ? product.images[0].srcSet.split(', ')[0]?.split(' ')[0] || product.images[0].url : null,
        stock: variant.stock ?? null,
      },
      quantity,
    );
    if (ok) {
      setJustAdded(true);
      setTimeout(() => setJustAdded(false), 2000);
    }
  };

  return (
    <div className="max-w-[1240px] mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-12 animate-scale-in">
      {/* Breadcrumbs & Navigation */}
      <nav aria-label="Breadcrumb" className="flex items-center justify-between gap-4 pb-4 border-b border-[#e8dfd1] text-xs">
        <div className="flex items-center gap-2 text-[#77808b] flex-wrap">
          <button type="button" onClick={() => go('home')} className="hover:text-[#b99664] transition-colors cursor-pointer">
            {t('الرئيسية', 'Home')}
          </button>
          <span>/</span>
          <button
            type="button"
            onClick={() => {
              setFilter('all');
              go('shop');
            }}
            className="hover:text-[#b99664] transition-colors cursor-pointer"
          >
            {t('المجموعة', 'Collection')}
          </button>
          <span>/</span>
          <button
            type="button"
            onClick={() => {
              setFilter(product.category.slug);
              go('shop');
            }}
            className="hover:text-[#b99664] transition-colors cursor-pointer"
          >
            {categoryName}
          </button>
          <span>/</span>
          <span className="text-[#142b4a] font-bold truncate max-w-[200px]">{title}</span>
        </div>

        <button
          type="button"
          onClick={() => go('shop')}
          className="text-xs font-bold text-[#142b4a] hover:text-[#b99664] transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
        >
          <span>←</span>
          <span>{t('العودة للمتجر', 'Back to shop')}</span>
        </button>
      </nav>

      {/* 2-Column Product Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        {/* Image Showcase */}
        <div className="lg:col-span-6 space-y-4">
          <div className="relative rounded-3xl bg-[#f7f3eb] border border-[#e8dfd1] overflow-hidden aspect-[4/5] sm:aspect-[3/4] flex items-center justify-center shadow-xs group">
            {image && !imgError ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={image.url}
                srcSet={image.srcSet}
                sizes="(min-width: 1024px) 600px, 100vw"
                alt={pick(lang, image.altAr, image.altEn) || title}
                onError={() => setImgError(true)}
                className="w-full h-full object-cover object-top transition-transform duration-700 ease-out group-hover:scale-105"
              />
            ) : (
              <span className="text-8xl select-none group-hover:scale-110 transition-transform duration-500" aria-hidden="true">
                👗
              </span>
            )}

            <div className="absolute top-4 start-4 flex flex-col gap-2">
              <span className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-white/90 backdrop-blur-md text-[#142b4a] shadow-xs">
                {categoryName}
              </span>
              {variant?.inStock && variant.stock != null && variant.stock <= 3 && (
                <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-[#b99664] text-white shadow-xs">
                  {t('آخر قطع متوفرة', 'Few pieces left')}
                </span>
              )}
            </div>

            {!product.inStock && (
              <div className="absolute inset-0 bg-white/70 backdrop-blur-xs flex items-center justify-center">
                <span className="px-5 py-2 rounded-full bg-[#142b4a] text-white text-sm font-bold shadow-md">
                  {t('غير متوفر حالياً بالمخزون', 'Out of stock')}
                </span>
              </div>
            )}
          </div>

          {/* Thumbnails */}
          {product.images.length > 1 && (
            <div className="flex gap-3 overflow-x-auto pb-1" role="group" aria-label={t('صور المنتج', 'Product photos')}>
              {product.images.map((img, i) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => {
                    setPhoto(i);
                    setImgError(false);
                  }}
                  aria-label={t(`صورة ${i + 1}`, `Photo ${i + 1}`)}
                  aria-pressed={photo === i}
                  className={`w-20 h-24 shrink-0 rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                    photo === i ? 'border-[#b99664]' : 'border-transparent opacity-70 hover:opacity-100'
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.srcSet.split(', ')[0]?.split(' ')[0] || img.url} alt="" className="w-full h-full object-cover" loading="lazy" />
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-[#77808b] px-2">
            <span>✦ {t('صورة حقيقية للمنتج', 'Authentic product photo')}</span>
            <span>✦ {t('خامات مختارة بعناية', 'Handpicked fabrics')}</span>
          </div>
        </div>

        {/* Information, Variant Options & Actions */}
        <div className="lg:col-span-6 space-y-7 bg-white p-6 sm:p-8 rounded-3xl border border-[#e8dfd1] shadow-xs">
          <div className="space-y-2 border-b border-[#e8dfd1] pb-5">
            <span className="text-xs text-[#b99664] font-bold tracking-[0.25em] uppercase">{categoryName}</span>
            <h1 className="text-2xl sm:text-4xl font-serif font-bold text-[#142b4a] leading-tight">{title}</h1>

            <div className="flex items-center justify-between pt-2">
              <div className="text-2xl sm:text-3xl font-extrabold text-[#b99664] tracking-tight">
                {money(variant?.price ?? product.minPrice)}
              </div>
              <div className="text-xs">
                {!canBuy ? (
                  <span className="text-red-700 font-bold bg-red-50 px-3 py-1 rounded-full">{t('نفدت الكمية', 'Sold out')}</span>
                ) : (
                  <span className="text-emerald-800 font-bold bg-emerald-50 px-3 py-1 rounded-full">
                    ✓ {t('متوفر للطلب الفوري', 'In stock')}
                    {variant?.stock != null && ` — ${t(`متبقي ${variant.stock} فقط`, `only ${variant.stock} left`)}`}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2 text-sm text-[#5e605b] leading-relaxed">
            <p className="whitespace-pre-line">
              {description ||
                t(
                  'قطعة متميزة مصممة بعناية فائقة، تجمع بين الأناقة اليومية والراحة والانسيابية، لتمنحكِ مظهراً راقياً ومريحاً في كل وقت.',
                  'A thoughtfully curated piece offering effortless elegance, timeless silhouette, and everyday comfort with premium finishing.',
                )}
            </p>
          </div>

          {/* Sizing Selector */}
          <div className="space-y-3 pt-2 border-t border-[#e8dfd1]">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-[#142b4a] uppercase tracking-wide">{t('اختيار المقاس', 'CHOOSE SIZE')}:</span>
              <strong className="text-[#b99664] font-bold text-sm">{selectedSize}</strong>
            </div>
            <div className="flex flex-wrap gap-2.5" role="group" aria-label={t('المقاسات المتاحة', 'Available sizes')}>
              {sizes.map((size) => {
                const isSelected = selectedSize === size;
                const ok = selectedColorId == null || isAvailable(size, selectedColorId);
                return (
                  <button
                    key={size}
                    type="button"
                    onClick={() => chooseSize(size)}
                    aria-pressed={isSelected}
                    className={`min-w-[48px] h-[44px] px-3.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer flex items-center justify-center ${
                      isSelected
                        ? 'bg-[#142b4a] text-white shadow-md ring-2 ring-[#b99664] scale-[1.03]'
                        : 'bg-[#f7f3eb] text-[#142b4a] border border-[#e8dfd1] hover:border-[#b99664] hover:bg-[#e7dac5]'
                    } ${ok ? '' : 'opacity-40 line-through'}`}
                  >
                    {size}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Color Selector */}
          <div className="space-y-3 pt-2 border-t border-[#e8dfd1]">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-[#142b4a] uppercase tracking-wide">{t('اختيار اللون', 'CHOOSE COLOR')}:</span>
              <strong className="text-[#b99664] font-bold text-sm">
                {variant ? pick(lang, variant.color.nameAr, variant.color.nameEn) : ''}
              </strong>
            </div>
            <div className="flex flex-wrap gap-3.5 items-center" role="group" aria-label={t('الألوان المتاحة', 'Available colors')}>
              {colors.map((c) => {
                const name = pick(lang, c.nameAr, c.nameEn);
                const isSelected = selectedColorId === c.id;
                const ok = !selectedSize || isAvailable(selectedSize, c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => chooseColor(c.id)}
                    aria-pressed={isSelected}
                    className={`w-[40px] h-[40px] rounded-full flex items-center justify-center cursor-pointer transition-all duration-200 p-0.5 ${
                      isSelected ? 'ring-2 ring-[#142b4a] ring-offset-2 scale-110 shadow-md' : 'hover:scale-105 opacity-80 hover:opacity-100'
                    } ${ok ? '' : 'opacity-30'}`}
                    title={name}
                    aria-label={ok ? name : `${name} — ${t('غير متوفر بهذا المقاس', 'not available in this size')}`}
                  >
                    <span className="w-[30px] h-[30px] rounded-full block border border-black/10 shadow-inner" style={{ backgroundColor: c.hex }} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quantity Selector & Add to Cart Controls */}
          <div className="space-y-4 pt-2 border-t border-[#e8dfd1]">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              <div className="flex items-center justify-between border border-[#e8dfd1] rounded-2xl bg-[#faf7f2] p-1.5 shrink-0 max-w-[140px]">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1 || !canBuy}
                  className="w-10 h-10 rounded-xl bg-white text-[#142b4a] font-bold text-base hover:bg-[#e7dac5] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center transition-colors shadow-2xs"
                  aria-label={t('تقليل الكمية', 'Decrease quantity')}
                >
                  −
                </button>
                <span className="w-10 text-center font-bold text-sm text-[#142b4a] select-none" aria-live="polite">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.min(maxAvailable, q + 1))}
                  disabled={quantity >= maxAvailable || !canBuy}
                  className="w-10 h-10 rounded-xl bg-white text-[#142b4a] font-bold text-base hover:bg-[#e7dac5] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center transition-colors shadow-2xs"
                  aria-label={t('زيادة الكمية', 'Increase quantity')}
                >
                  +
                </button>
              </div>

              <button
                type="button"
                disabled={!canBuy}
                onClick={handleAddToCart}
                className={`flex-1 py-4 px-6 rounded-2xl text-sm font-bold transition-all duration-300 cursor-pointer shadow-md active:scale-[0.98] flex items-center justify-center gap-2 ${
                  justAdded
                    ? 'bg-[#b99664] text-white shadow-lg shadow-[#b99664]/30'
                    : !canBuy
                    ? 'bg-[#e8e3d9] text-[#77808b] cursor-not-allowed'
                    : 'bg-[#142b4a] hover:bg-[#1e3a61] text-white hover:shadow-lg'
                }`}
              >
                <span>🛍</span>
                <span>
                  {justAdded
                    ? `✓ ${t('تمت الإضافة للسلة بنجاح!', 'Added to your bag!')}`
                    : !canBuy
                    ? t('غير متوفر حالياً', 'Out of stock')
                    : `${t('أضيفي للسلة', 'Add to bag')} • ${money((variant?.price ?? 0) * quantity)}`}
                </span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => go('custom')}
              className="w-full py-3 px-4 rounded-xl border border-[#d6c2a7] bg-[#fbf8f3] hover:bg-[#e7dac5] text-[#142b4a] text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <span>
                {t('تريدين تفصيل هذا الموديل بمقاسات خاصة بكِ بالضبط؟ اضغطي هنا ↗', 'Want this style tailored to your bespoke measurements? Click here ↗')}
              </span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-[#e8dfd1] text-[11px] text-[#142b4a] font-bold">
            <div className="flex items-center gap-2 bg-[#fbf8f3] p-2.5 rounded-xl">
              <span>{t('شحن لجميع المحافظات', 'Fast Egypt delivery')}</span>
            </div>
            <div className="flex items-center gap-2 bg-[#fbf8f3] p-2.5 rounded-xl">
              <span>{t('تقفيل وخامات فاخرة', 'Expert craftsmanship')}</span>
            </div>
            <div className="flex items-center gap-2 bg-[#fbf8f3] p-2.5 rounded-xl">
              <span>{t('دفع عند الاستلام (COD)', 'Cash on delivery')}</span>
            </div>
          </div>
        </div>
      </div>

      {relatedProducts.length > 0 && (
        <section className="space-y-6 pt-12 border-t border-[#e8dfd1]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <span className="text-xs text-[#b99664] font-bold tracking-[0.2em] uppercase">RECOMMENDED</span>
              <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#142b4a] mt-0.5">{t('قطع مشابهة قد تعجبك', 'You may also like')}</h2>
            </div>
            <button
              type="button"
              onClick={() => {
                setFilter(product.category.slug);
                go('shop');
              }}
              className="text-xs font-bold text-[#142b4a] hover:text-[#b99664] transition-colors cursor-pointer"
            >
              {t('عرض كل المجموعة ↗', 'View all collection ↗')}
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {relatedProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
