'use client';

import React from 'react';
import { useZamzamStore } from '@/store/useZamzamStore';

export default function TopBanner() {
  const t = useZamzamStore((state) => state.t);
  const site = useZamzamStore((state) => state.site);

  // The owner edits this line in Admin → Site content; until it loads (or if it's empty) the built-in text shows.
  const text = t(
    site?.announcementAr || 'توصيل لجميع المحافظات • تصميمات راقية تتفصل على مقاسك',
    site?.announcementEn || 'Delivery across Egypt • Refined everyday essentials & custom tailoring',
  );

  return (
    <aside
      aria-label="Announcement"
      className="bg-[#142b4a] text-white text-xs sm:text-xs py-2 px-4 text-center font-medium tracking-wide flex items-center justify-center gap-2 border-b border-[#0f2138]"
    >
      <span className="text-[#b99664] text-xs">✦</span>
      <span className="opacity-95">{text}</span>
      <span className="text-[#b99664] text-xs">✦</span>
    </aside>
  );
}
