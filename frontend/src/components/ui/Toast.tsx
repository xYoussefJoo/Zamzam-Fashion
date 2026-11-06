'use client';

import React from 'react';
import { useZamzamStore } from '@/store/useZamzamStore';

export default function Toast() {
  const toast = useZamzamStore((state) => state.toast);
  const hideToast = useZamzamStore((state) => state.hideToast);
  const go = useZamzamStore((state) => state.go);
  const t = useZamzamStore((state) => state.t);

  if (!toast) return null;

  const isError = toast.type === 'error';

  return (
    <div
      className="fixed top-24 end-4 sm:end-6 z-50 max-w-sm w-full pointer-events-none animate-toast-enter"
      aria-live="polite"
      aria-atomic="true"
    >
      <div
        className={`pointer-events-auto flex items-center gap-3 p-3.5 sm:p-4 rounded-xl bg-[#f2e4d0] border border-[#c9ad84] border-s-4 shadow-xl text-[#142b4a] ${
          isError ? 'border-s-[#a34c3c]' : 'border-s-[#a98552]'
        }`}
        role="status"
      >
        <span
          className={`w-8 h-8 rounded-full flex items-center justify-center font-extrabold text-sm text-white flex-shrink-0 ${
            isError ? 'bg-[#a34c3c]' : 'bg-[#142b4a]'
          }`}
          aria-hidden="true"
        >
          {isError ? '!' : '✓'}
        </span>

        <div className="flex-1 min-w-0">
          <strong className="block text-xs font-bold text-[#142b4a]">
            {isError ? t('تنبيه', 'Notice') : t('تم بنجاح', 'Success')}
          </strong>
          <span className="block text-[11px] text-[#5d5b57] leading-relaxed break-words">
            {toast.message}
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {toast.showCartLink && (
            <button
              type="button"
              className="bg-[#142b4a] hover:bg-[#1f3d65] text-white text-[11px] font-bold px-2.5 py-1.5 rounded-md transition-colors cursor-pointer whitespace-nowrap"
              onClick={() => {
                hideToast();
                go('cart');
              }}
            >
              {t('عرض السلة', 'View cart')}
            </button>
          )}

          <button
            type="button"
            className="text-[#142b4a] hover:opacity-75 p-1 text-xl leading-none cursor-pointer"
            aria-label={t('إغلاق الإشعار', 'Dismiss notification')}
            onClick={hideToast}
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}
