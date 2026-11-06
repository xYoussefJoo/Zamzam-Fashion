'use client';

import React from 'react';
import { useZamzamStore } from '@/store/useZamzamStore';

export default function TopBanner() {
  const t = useZamzamStore((state) => state.t);

  return (
    <aside
      aria-label="Announcement"
      className="bg-[#142b4a] text-white text-[11px] sm:text-xs py-2 px-4 text-center font-medium tracking-wide flex items-center justify-center gap-2 border-b border-[#0f2138]"
    >
      <span className="text-[#b99664] text-xs">✦</span>
      <span className="opacity-95">
        {t(
          'توصيل لجميع المحافظات • تصميمات راقية تتفصل على مقاسك',
          'Delivery across Egypt • Refined everyday essentials & custom tailoring'
        )}
      </span>
      <span className="text-[#b99664] text-xs">✦</span>
    </aside>
  );
}
