'use client';

import React, { useState } from 'react';
import { useZamzamStore } from '@/store/useZamzamStore';
import { assetPath, colorHex } from '@/data/seed';
import ProductCard from '@/components/shop/ProductCard';

export default function ProductDetailsView() {
  const selectedProductId = useZamzamStore((state) => state.selectedProductId);
  const data = useZamzamStore((state) => state.data);
  const lang = useZamzamStore((state) => state.lang);
  const go = useZamzamStore((state) => state.go);
  const setFilter = useZamzamStore((state) => state.setFilter);
  const money = useZamzamStore((state) => state.money);
  const localizedColor = useZamzamStore((state) => state.localizedColor);
  const addToCart = useZamzamStore((state) => state.addToCart);
  const t = useZamzamStore((state) => state.t);

  const product = data.products.find((p) => p.id === selectedProductId);

  const defaultSize = product?.sizes?.[0] || 'One Size';
  const defaultColor = product?.colors?.[0] || 'حسب المتاح';

  const [selectedSize, setSelectedSize] = useState<string>(defaultSize);
  const [selectedColor, setSelectedColor] = useState<string>(defaultColor);
  const [quantity, setQuantity] = useState<number>(1);
  const [imgError, setImgError] = useState<boolean>(false);
  const [justAdded, setJustAdded] = useState<boolean>(false);

  // If product is not found, show not-found screen
  if (!product) {
    return (
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6 py-20 text-center space-y-4 animate-scale-in">
        <span className="text-5xl block animate-float select-none">🔍</span>
        <h2 className="text-2xl font-serif font-bold text-[#142b4a]">
          {t('لم يتم العثور على المنتج المطلوب', 'Product not found')}
        </h2>
        <p className="text-xs sm:text-sm text-[#77808b] max-w-md mx-auto">
          {t(
            'قد يكون هذا المنتج غير متاح حالياً أو تم تغيير رابطه.',
            'This product may be unavailable or the link may have changed.'
          )}
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

  const category = data.categories.find(
    (c) => Number(c.id) === Number(product.categoryId)
  );
  const categoryName = category ? category[lang] : 'Fashion';
  const title = product[lang] || product.ar;
  const isOutOfStock = product.stock <= 0;
  const maxAvailable = Math.max(1, product.stock);

  // Related products from same category or collection
  const relatedProducts = data.products
    .filter((p) => p.visible && p.id !== product.id && (p.categoryId === product.categoryId || p.visible))
    .slice(0, 4);

  const handleAddToCart = () => {
    if (isOutOfStock) return;
    const ok = addToCart(product.id, selectedSize, selectedColor, quantity);
    if (ok) {
      setJustAdded(true);
      setTimeout(() => setJustAdded(false), 2000);
    }
  };

  const handleQuantityChange = (delta: number) => {
    setQuantity((prev) => Math.min(maxAvailable, Math.max(1, prev + delta)));
  };

  return (
    <div className="max-w-[1240px] mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-12 animate-scale-in">
      {/* Breadcrumbs & Navigation */}
      <nav aria-label="Breadcrumb" className="flex items-center justify-between gap-4 pb-4 border-b border-[#e8dfd1] text-xs">
        <div className="flex items-center gap-2 text-[#77808b] flex-wrap">
          <button
            type="button"
            onClick={() => go('home')}
            className="hover:text-[#b99664] transition-colors cursor-pointer"
          >
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
              setFilter(String(product.categoryId));
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
        {/* Left Column: Image Showcase */}
        <div className="lg:col-span-6 space-y-4">
          <div className="relative rounded-3xl bg-[#f7f3eb] border border-[#e8dfd1] overflow-hidden aspect-[4/5] sm:aspect-[3/4] flex items-center justify-center shadow-xs group">
            {product.image && !imgError ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={assetPath(product.image)}
                alt={title}
                onError={() => setImgError(true)}
                className="w-full h-full object-cover object-top transition-transform duration-700 ease-out group-hover:scale-105"
              />
            ) : (
              <span className="text-8xl select-none group-hover:scale-110 transition-transform duration-500">
                {product.emoji || '👗'}
              </span>
            )}

            {/* Badges on image */}
            <div className="absolute top-4 start-4 flex flex-col gap-2">
              <span className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-white/90 backdrop-blur-md text-[#142b4a] shadow-xs">
                {categoryName}
              </span>
              {product.stock > 0 && product.stock <= 3 && (
                <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-[#b99664] text-white shadow-xs">
                  {t('آخر قطع متوفرة', 'Few pieces left')}
                </span>
              )}
            </div>

            {isOutOfStock && (
              <div className="absolute inset-0 bg-white/70 backdrop-blur-xs flex items-center justify-center">
                <span className="px-5 py-2 rounded-full bg-[#142b4a] text-white text-sm font-bold shadow-md">
                  {t('غير متوفر حالياً بالمخزون', 'Out of stock')}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-[#77808b] px-2">
            <span>✦ {t('صورة حقيقية للمنتج', 'Authentic product photo')}</span>
            <span>✦ {t('خامات مختارة بعناية', 'Handpicked fabrics')}</span>
          </div>
        </div>

        {/* Right Column: Information, Variant Options & Actions */}
        <div className="lg:col-span-6 space-y-7 bg-white p-6 sm:p-8 rounded-3xl border border-[#e8dfd1] shadow-xs">
          {/* Header */}
          <div className="space-y-2 border-b border-[#e8dfd1] pb-5">
            <span className="text-xs text-[#b99664] font-bold tracking-[0.25em] uppercase">
              {categoryName}
            </span>
            <h1 className="text-2xl sm:text-4xl font-serif font-bold text-[#142b4a] leading-tight">
              {title}
            </h1>

            <div className="flex items-center justify-between pt-2">
              <div className="text-2xl sm:text-3xl font-extrabold text-[#b99664] tracking-tight">
                {money(product.price)}
              </div>
              <div className="text-xs">
                {isOutOfStock ? (
                  <span className="text-red-700 font-bold bg-red-50 px-3 py-1 rounded-full">
                    {t('نفدت الكمية', 'Sold out')}
                  </span>
                ) : (
                  <span className="text-emerald-800 font-bold bg-emerald-50 px-3 py-1 rounded-full">
                    ✓ {t('متوفر للطلب الفوري', 'In stock')} ({product.stock})
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2 text-sm text-[#5e605b] leading-relaxed">
            <p>
              {product.description ||
                t(
                  'قطعة متميزة مصممة بعناية فائقة، تجمع بين الأناقة اليومية والراحة والانسيابية، لتمنحكِ مظهراً راقياً ومريحاً في كل وقت.',
                  'A thoughtfully curated piece offering effortless elegance, timeless silhouette, and everyday comfort with premium finishing.'
                )}
            </p>
          </div>

          {/* Sizing Selector */}
          <div className="space-y-3 pt-2 border-t border-[#e8dfd1]">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-[#142b4a] uppercase tracking-wide">
                {t('اختيار المقاس', 'CHOOSE SIZE')}:
              </span>
              <strong className="text-[#b99664] font-bold text-sm">{selectedSize}</strong>
            </div>

            <div className="flex flex-wrap gap-2.5" role="group" aria-label={t('المقاسات المتاحة', 'Available sizes')}>
              {(product.sizes && product.sizes.length > 0 ? product.sizes : ['One Size']).map((size) => {
                const isSelected = selectedSize === size;
                return (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setSelectedSize(size)}
                    className={`min-w-[48px] h-[44px] px-3.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer flex items-center justify-center ${
                      isSelected
                        ? 'bg-[#142b4a] text-white shadow-md ring-2 ring-[#b99664] scale-[1.03]'
                        : 'bg-[#f7f3eb] text-[#142b4a] border border-[#e8dfd1] hover:border-[#b99664] hover:bg-[#e7dac5]'
                    }`}
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
              <span className="font-bold text-[#142b4a] uppercase tracking-wide">
                {t('اختيار اللون', 'CHOOSE COLOR')}:
              </span>
              <strong className="text-[#b99664] font-bold text-sm">{localizedColor(selectedColor)}</strong>
            </div>

            <div className="flex flex-wrap gap-3.5 items-center" role="group" aria-label={t('الألوان المتاحة', 'Available colors')}>
              {(product.colors && product.colors.length > 0 ? product.colors : ['حسب المتاح']).map((color) => {
                const swatch = colorHex[color] || '#c5b7a3';
                const locCol = localizedColor(color);
                const isSelected = selectedColor === color;
                return (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setSelectedColor(color)}
                    className={`w-[40px] h-[40px] rounded-full flex items-center justify-center cursor-pointer transition-all duration-200 p-0.5 ${
                      isSelected
                        ? 'ring-2 ring-[#142b4a] ring-offset-2 scale-110 shadow-md'
                        : 'hover:scale-105 opacity-80 hover:opacity-100'
                    }`}
                    title={locCol}
                    aria-label={locCol}
                  >
                    <span
                      className="w-[30px] h-[30px] rounded-full block border border-black/10 shadow-inner"
                      style={{ backgroundColor: swatch }}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quantity Selector & Add to Cart Controls */}
          <div className="space-y-4 pt-2 border-t border-[#e8dfd1]">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              {/* Quantity Counter */}
              <div className="flex items-center justify-between border border-[#e8dfd1] rounded-2xl bg-[#faf7f2] p-1.5 shrink-0 max-w-[140px]">
                <button
                  type="button"
                  onClick={() => handleQuantityChange(-1)}
                  disabled={quantity <= 1 || isOutOfStock}
                  className="w-10 h-10 rounded-xl bg-white text-[#142b4a] font-bold text-base hover:bg-[#e7dac5] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center transition-colors shadow-2xs"
                  aria-label="Decrease quantity"
                >
                  −
                </button>
                <span className="w-10 text-center font-bold text-sm text-[#142b4a] select-none">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => handleQuantityChange(1)}
                  disabled={quantity >= maxAvailable || isOutOfStock}
                  className="w-10 h-10 rounded-xl bg-white text-[#142b4a] font-bold text-base hover:bg-[#e7dac5] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center transition-colors shadow-2xs"
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>

              {/* Primary Add to Cart Button */}
              <button
                type="button"
                disabled={isOutOfStock}
                onClick={handleAddToCart}
                className={`flex-1 py-4 px-6 rounded-2xl text-sm font-bold transition-all duration-300 cursor-pointer shadow-md active:scale-[0.98] flex items-center justify-center gap-2 ${
                  justAdded
                    ? 'bg-[#b99664] text-white shadow-lg shadow-[#b99664]/30'
                    : isOutOfStock
                    ? 'bg-[#e8e3d9] text-[#77808b] cursor-not-allowed'
                    : 'bg-[#142b4a] hover:bg-[#1e3a61] text-white hover:shadow-lg'
                }`}
              >
                <span>🛍</span>
                <span>
                  {justAdded
                    ? `✓ ${t('تمت الإضافة للسلة بنجاح!', 'Added to your bag!')}`
                    : isOutOfStock
                    ? t('غير متوفر حالياً', 'Out of stock')
                    : `${t('أضيفي للسلة', 'Add to bag')} • ${money(product.price * quantity)}`}
                </span>
              </button>
            </div>

            {/* Custom Tailoring Option Link */}
            <button
              type="button"
              onClick={() => go('custom')}
              className="w-full py-3 px-4 rounded-xl border border-[#d6c2a7] bg-[#fbf8f3] hover:bg-[#e7dac5] text-[#142b4a] text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <span>
                {t(
                  'تريدين تفصيل هذا الموديل بمقاسات خاصة بكِ بالضبط؟ اضغطي هنا ↗',
                  'Want this style tailored to your bespoke measurements? Click here ↗'
                )}
              </span>
            </button>
          </div>

          {/* Trust Guarantees */}
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

      {/* Related Products Section */}
      {relatedProducts.length > 0 && (
        <section className="space-y-6 pt-12 border-t border-[#e8dfd1]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <span className="text-xs text-[#b99664] font-bold tracking-[0.2em] uppercase">
                RECOMMENDED
              </span>
              <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#142b4a] mt-0.5">
                {t('قطع مشابهة قد تعجبك', 'You may also like')}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => {
                setFilter('all');
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

