'use client';

import React from 'react';
import { useZamzamStore } from '@/store/useZamzamStore';
import { assetPath } from '@/data/seed';

export default function Footer() {
  const data = useZamzamStore((state) => state.data);
  const lang = useZamzamStore((state) => state.lang);
  const t = useZamzamStore((state) => state.t);
  const q = data.settings;

  const validLink = (url: string, label: string) =>
    url && /^https:\/\//i.test(url) ? (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-white/75 hover:text-[#b99664] transition-colors duration-200"
      >
        <span className="text-[#b99664] text-xs">↗</span>
        <span>{label}</span>
      </a>
    ) : null;

  return (
    <footer className="bg-[#142b4a] text-white mt-16 relative">
      {/* Decorative top gold accent line */}
      <div className="h-1 bg-gradient-to-r from-transparent via-[#b99664] to-transparent opacity-80" />

      <div className="max-w-[1240px] mx-auto px-4 sm:px-6 py-14">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 pb-10 border-b border-white/10">
          {/* Brand Column */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={assetPath('assets/logo.png')}
                alt="Zamzam Fashion"
                className="w-16 h-16 object-contain"
              />
              <div>
                <b className="text-xl font-bold tracking-tight block">Zamzam Fashion</b>
                <small className="text-[10px] tracking-widest text-[#b99664] font-semibold uppercase">
                  MADE FOR YOUR STYLE
                </small>
              </div>
            </div>
            <p className="text-sm text-white/70 leading-relaxed max-w-sm">
              {t(
                'أناقة تُصنع على مقاسك — تصميمات يومية مريحة وتفصيل خاص بعناية فائقة.',
                'Elevated everyday fashion and made-to-measure tailoring, crafted with care for you.'
              )}
            </p>
          </div>

          {/* Contact Column */}
          <div className="space-y-3">
            <b className="text-sm font-bold tracking-wider uppercase text-[#b99664] block">
              {t('تواصلي معنا', 'Contact us')}
            </b>
            <div className="flex flex-col gap-2 text-sm text-white/80">
              {q.phone && (
                <div>
                  <a href={`tel:${q.phone}`} className="hover:text-[#b99664] transition-colors">
                    {q.phone}
                  </a>
                </div>
              )}
              {q.email && (
                <div>
                  <a href={`mailto:${q.email}`} className="hover:text-[#b99664] transition-colors">
                    {q.email}
                  </a>
                </div>
              )}
              {q.whatsapp && (
                <div>
                  {validLink(
                    `https://wa.me/${String(q.whatsapp).replace(/\D/g, '')}`,
                    'WhatsApp'
                  )}
                </div>
              )}
              <p className="text-xs text-white/60 pt-1 leading-relaxed">
                {lang === 'ar' ? q.addressAr : q.addressEn}
              </p>
            </div>
          </div>

          {/* Social Links */}
          <div className="space-y-3">
            <b className="text-sm font-bold tracking-wider uppercase text-[#b99664] block">
              {t('تابعينا', 'Follow us')}
            </b>
            <div className="flex flex-col gap-2 text-sm">
              {validLink(q.facebook, 'Facebook')}
              {validLink(q.instagram, 'Instagram')}
              {validLink(q.tiktok, 'TikTok')}
            </div>
          </div>
        </div>

        {/* Copyright & Powered By Bar */}
        <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-white/60">
          <span>{t('جميع الحقوق محفوظة © 2026 Kernel Panic', 'Copyright © 2026 Kernel Panic - All rights reserved.')}</span>

          <div className="flex items-center gap-2">
            <span className="text-white/50">{t('تصميم وتطوير بواسطة:', 'Powered by:')}</span>
            <a href="https://itkernelpanic.com/" target="_blank">
              <div className={`flex  ${lang === 'ar' ? 'flex-row-reverse' : 'flex-row'} items-center gap-1.5 font-bold bg-white px-4 py-1 rounded-full`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={assetPath('assets/kp-logo.png')}
                alt="Kernel Panic"
                className="w-12 h-12 object-contain rounded-xs"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <span className='flex flex-col'>
              <span className='text-black font-bold text-lg'>KERNEL <span className='text-[#0062FF]'>PANIC</span></span>
              <span className='text-gray-400 text-xs tracking-widest text-left w-full'>IT TEAM</span>
              </span>
            </div>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
