'use client';

import React, { useState } from 'react';
import { Product } from '@/types/zamzam';
import { useZamzamStore } from '@/store/useZamzamStore';
import { assetPath } from '@/data/seed';

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const lang = useZamzamStore((state) => state.lang);
  const data = useZamzamStore((state) => state.data);
  const money = useZamzamStore((state) => state.money);
  const t = useZamzamStore((state) => state.t);
  const openProduct = useZamzamStore((state) => state.openProduct);

  const [imgError, setImgError] = useState<boolean>(false);

  const category = data.categories.find(
    (c) => Number(c.id) === Number(product.categoryId)
  );
  const categoryName = category ? category[lang] : 'Fashion';
  const title = product[lang] || product.ar;
  const isOutOfStock = product.stock <= 0;

  const handleCardClick = () => {
    openProduct(product.id);
  };

  return (
    <article
      onClick={handleCardClick}
      className="group rounded-2xl bg-white border border-[#e8e3d9] overflow-hidden flex flex-col h-full shadow-xs hover:shadow-xl transition-all duration-500 hover:-translate-y-1.5 cursor-pointer"
    >
      {/* Product Image Area */}
      <div
        className={`relative h-[290px] sm:h-[330px] bg-[#f7f3eb] overflow-hidden flex items-center justify-center ${product.tone || ''}`}
      >
        {product.image && !imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={assetPath(product.image)}
            alt={title}
            loading="lazy"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover object-top group-hover:scale-[1.07] transition-transform duration-700 ease-out"
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

        {/* Hover Action Pill */}
        <div className="absolute inset-0 bg-[#142b4a]/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center pointer-events-none">
          <span className="px-5 py-2.5 rounded-full bg-white text-[#142b4a] text-xs font-bold shadow-lg transform translate-y-3 group-hover:translate-y-0 transition-transform duration-300 flex items-center gap-2">
            <span>{t('عرض التفاصيل والطلب', 'View details & order')}</span>
            <span className="text-sm">↗</span>
          </span>
        </div>

        {/* Out of Stock Overlay */}
        {isOutOfStock && (
          <div className="absolute inset-0 bg-white/75 backdrop-blur-xs flex items-center justify-center pointer-events-none">
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
        </div>

        {/* Price & Action Link */}
        <div className="flex items-center justify-between pt-3 border-t border-[#e8e3d9] mt-2">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-[#77808b] uppercase tracking-wider">
              {t('السعر', 'PRICE')}
            </span>
            <span className="font-extrabold text-[#b99664] text-lg tracking-tight">
              {money(product.price)}
            </span>
          </div>

          <span className="text-xs font-bold text-[#142b4a] group-hover:text-[#b99664] group-hover:translate-x-1 transition-all flex items-center gap-1">
            <span>{t('تفاصيل القطعة', 'View details')}</span>
            <span>↗</span>
          </span>
        </div>
      </div>
    </article>
  );
}
