'use client';

import React, { useState } from 'react';
import { Product } from '@/types/zamzam';
import { useZamzamStore } from '@/store/useZamzamStore';
import { assetPath } from '@/data/seed';
import VariantPicker from './VariantPicker';

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const lang = useZamzamStore((state) => state.lang);
  const data = useZamzamStore((state) => state.data);
  const money = useZamzamStore((state) => state.money);
  const t = useZamzamStore((state) => state.t);
  const addToCart = useZamzamStore((state) => state.addToCart);

  const defaultSize = product.sizes?.[0] || 'One Size';
  const defaultColor = product.colors?.[0] || 'حسب المتاح';

  const [selectedSize, setSelectedSize] = useState<string>(defaultSize);
  const [selectedColor, setSelectedColor] = useState<string>(defaultColor);
  const [imgError, setImgError] = useState<boolean>(false);
  const [justAdded, setJustAdded] = useState<boolean>(false);

  const category = data.categories.find(
    (c) => Number(c.id) === Number(product.categoryId)
  );
  const categoryName = category ? category[lang] : 'Fashion';
  const title = product[lang] || product.ar;
  const isOutOfStock = product.stock <= 0;

  const handleAdd = () => {
    addToCart(product.id, selectedSize, selectedColor);
    setJustAdded(true);
    setTimeout(() => {
      setJustAdded(false);
    }, 1800);
  };

  return (
    <article className="group rounded-2xl bg-white border border-[#e8e3d9] overflow-hidden flex flex-col h-full shadow-xs hover:shadow-xl transition-all duration-500 hover:-translate-y-1">
      {/* Product Image Area */}
      <div className={`relative h-[280px] sm:h-[320px] bg-[#f7f3eb] overflow-hidden flex items-center justify-center ${product.tone || ''}`}>
        {product.image && !imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={assetPath(product.image)}
            alt={title}
            loading="lazy"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover object-top group-hover:scale-[1.06] transition-transform duration-700 ease-out"
          />
        ) : (
          <span className="text-6xl select-none group-hover:scale-110 transition-transform duration-500">
            {product.emoji || '👗'}
          </span>
        )}

        {/* Floating Category Pill */}
        <span className="absolute top-3.5 start-3.5 px-3 py-1 rounded-full text-[11px] font-bold bg-white/90 backdrop-blur-sm text-[#142b4a] shadow-xs">
          {categoryName}
        </span>

        {/* Low Stock Warning Badge */}
        {product.stock > 0 && product.stock <= 3 && (
          <span className="absolute top-3.5 end-3.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#b99664] text-white shadow-xs">
            {t('قطع محدودة', 'Few left')}
          </span>
        )}

        {/* Out of Stock Overlay */}
        {isOutOfStock && (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-xs flex items-center justify-center">
            <span className="px-4 py-1.5 rounded-full bg-[#142b4a] text-white text-xs font-bold shadow-md">
              {t('غير متوفر حالياً', 'Out of stock')}
            </span>
          </div>
        )}
      </div>

      {/* Product Information Body */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between gap-3 bg-white">
        <div>
          <h3 className="text-base font-bold text-[#142b4a] leading-snug line-clamp-2 min-h-[2.6em] group-hover:text-[#b99664] transition-colors duration-200">
            {title}
          </h3>
          <p className="text-xs text-[#77808b] line-clamp-2 min-h-[2.2em] leading-relaxed mt-1">
            {product.description || '\u00A0'}
          </p>

          <div className="flex items-center justify-between text-sm pt-3 border-t border-[#e8e3d9] mt-2">
            <span className="font-extrabold text-[#b99664] text-lg tracking-tight">
              {money(product.price)}
            </span>
            <span className="text-xs text-[#77808b]">
              {t('متاح', 'Stock')}: {product.stock}
            </span>
          </div>
        </div>

        {/* Collapsible details for Size & Color */}
        <details className="border border-[#e8e3d9] rounded-xl bg-[#faf7f2] overflow-hidden group/details transition-colors">
          <summary className="p-2.5 text-xs font-bold text-[#142b4a] flex items-center justify-between cursor-pointer select-none hover:bg-[#f2ece0] transition-colors">
            <span>{t('المقاس واللون', 'Select size & color')}</span>
            <span className="text-[#b99664] group-open/details:rotate-180 transition-transform duration-200 text-sm">
              ⌄
            </span>
          </summary>
          <div className="p-3 border-t border-[#e8dfd1] bg-white">
            <VariantPicker
              productId={product.id}
              sizes={product.sizes}
              colors={product.colors}
              selectedSize={selectedSize}
              selectedColor={selectedColor}
              onSelectSize={setSelectedSize}
              onSelectColor={setSelectedColor}
            />
          </div>
        </details>

        {/* Add to Cart Button */}
        <button
          type="button"
          disabled={isOutOfStock}
          onClick={handleAdd}
          className={`w-full py-3 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all duration-300 cursor-pointer shadow-xs active:scale-[0.98] ${
            justAdded
              ? 'bg-[#b99664] text-white shadow-md shadow-[#b99664]/30'
              : isOutOfStock
              ? 'bg-[#e8e3d9] text-[#77808b] cursor-not-allowed'
              : 'bg-[#142b4a] hover:bg-[#1e3a61] text-white hover:shadow-md'
          }`}
        >
          {justAdded
            ? `✓ ${t('تمت الإضافة للسلة', 'Added to bag!')}`
            : isOutOfStock
            ? t('غير متوفر حالياً', 'Out of stock')
            : t('أضيفي للسلة', 'Add to bag')}
        </button>
      </div>
    </article>
  );
}
