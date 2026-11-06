'use client';

import React from 'react';
import { useZamzamStore } from '@/store/useZamzamStore';
import { colorHex } from '@/data/seed';

interface VariantPickerProps {
  productId: number;
  sizes: string[];
  colors: string[];
  selectedSize: string;
  selectedColor: string;
  onSelectSize: (size: string) => void;
  onSelectColor: (color: string) => void;
}

export default function VariantPicker({
  productId,
  sizes,
  colors,
  selectedSize,
  selectedColor,
  onSelectSize,
  onSelectColor,
}: VariantPickerProps) {
  const localizedColor = useZamzamStore((state) => state.localizedColor);
  const t = useZamzamStore((state) => state.t);

  const availableSizes = sizes && sizes.length > 0 ? sizes : ['One Size'];
  const availableColors = colors && colors.length > 0 ? colors : ['حسب المتاح'];

  return (
    <div className="space-y-3.5 pt-1 text-xs">
      {/* Size Picker */}
      <div>
        <div className="text-[11px] font-bold text-[#77808b] mb-2 uppercase tracking-wider flex items-center justify-between">
          <span>{t('المقاس', 'SIZE')}:</span>
          <strong id={`size-label-${productId}`} className="text-[#142b4a] font-bold">
            {selectedSize}
          </strong>
        </div>
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label={t('اختيار المقاس', 'Choose size')}
        >
          {availableSizes.map((v) => {
            const isSelected = selectedSize === v;
            return (
              <button
                key={v}
                type="button"
                className={`min-w-[40px] h-[38px] px-3 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer flex items-center justify-center ${
                  isSelected
                    ? 'bg-[#142b4a] text-white shadow-sm ring-2 ring-[#b99664] scale-[1.03]'
                    : 'bg-[#f7f3eb] text-[#142b4a] border border-[#e8dfd1] hover:border-[#b99664] hover:bg-[#e7dac5]'
                }`}
                aria-pressed={isSelected}
                onClick={() => onSelectSize(v)}
              >
                {v}
              </button>
            );
          })}
        </div>
      </div>

      {/* Color Picker */}
      <div>
        <div className="text-[11px] font-bold text-[#77808b] mb-2 uppercase tracking-wider flex items-center justify-between">
          <span>{t('اللون', 'COLOR')}:</span>
          <strong id={`color-label-${productId}`} className="text-[#142b4a] font-bold">
            {localizedColor(selectedColor)}
          </strong>
        </div>
        <div
          className="flex flex-wrap gap-3 items-center"
          role="group"
          aria-label={t('اختيار اللون', 'Choose color')}
        >
          {availableColors.map((v) => {
            const swatch = colorHex[v] || '#c5b7a3';
            const locCol = localizedColor(v);
            const isSelected = selectedColor === v;
            return (
              <button
                key={v}
                type="button"
                className={`w-[34px] h-[34px] rounded-full flex items-center justify-center cursor-pointer transition-all duration-200 p-0.5 ${
                  isSelected
                    ? 'ring-2 ring-[#142b4a] ring-offset-2 scale-110 shadow-sm'
                    : 'hover:scale-105 opacity-85 hover:opacity-100'
                }`}
                title={locCol}
                aria-label={locCol}
                aria-pressed={isSelected}
                onClick={() => onSelectColor(v)}
              >
                <span
                  className="w-[26px] h-[26px] rounded-full block border border-black/10 shadow-inner"
                  style={{ backgroundColor: swatch }}
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
