'use client';

import React from 'react';
import { useZamzamStore } from '@/store/useZamzamStore';
import { assetPath } from '@/lib/labels';

export default function Footer() {
  const site = useZamzamStore((state) => state.site);
  const lang = useZamzamStore((state) => state.lang);
  const t = useZamzamStore((state) => state.t);
  const contact = site?.contact;
  const social = site?.social;

  const validLink = (url: string | null | undefined, label: string) =>
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
                src={assetPath('assets/logo-footer-192.webp')}
                loading="lazy"
                alt="Zamzam Fashion"
                className="w-16 h-16 object-contain"
              />
              <div>
                <b className="text-xl font-bold tracking-tight block">Zamzam Fashion</b>
                <small className="text-[14px] tracking-widest text-[#b99664] font-semibold uppercase">
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
              {contact?.phone && (
                <div>
                  <a href={`tel:${contact.phone}`} className="hover:text-[#b99664] transition-colors">
                    {contact.phone}
                  </a>
                </div>
              )}
              {contact?.email && (
                <div>
                  <a href={`mailto:${contact.email}`} className="hover:text-[#b99664] transition-colors">
                    {contact.email}
                  </a>
                </div>
              )}
              {contact?.whatsApp && (
                <div>
                  {validLink(
                    `https://wa.me/${String(contact.whatsApp).replace(/\D/g, '')}`,
                    'WhatsApp'
                  )}
                </div>
              )}
              <p className="text-xs text-white/60 pt-1 leading-relaxed">
                {lang === 'ar' ? contact?.addressAr : contact?.addressEn}
              </p>
            </div>
          </div>

          {/* Social Links */}
          <div className="space-y-3">
            <b className="text-sm font-bold tracking-wider uppercase text-[#b99664] block">
              {t('تابعينا', 'Follow us')}
            </b>
            <div className="flex flex-col gap-2 text-sm">
              {validLink(social?.facebook, 'Facebook')}
              {validLink(social?.instagram, 'Instagram')}
              {validLink(social?.tikTok, 'TikTok')}
            </div>
          </div>
        </div>

        {/* Copyright & Powered By Bar */}
        <div className="pt-6 flex flex-col md:flex-row items-center justify-between gap-3 text-[13px] text-white/60 text-center">
          <span>{t('جميع الحقوق محفوظة © 2026 Kernel Panic', 'Copyright © 2026 Kernel Panic - All rights reserved.')}</span>

          <div className="flex items-center gap-2 flex-wrap justify-center">
            <span className="text-white/50 text-[13px]">{t('تصميم وتطوير بواسطة:', 'Powered by:')}</span>
            <a href="https://itkernelpanic.com/" target="_blank" rel="noopener noreferrer">
              <div className={`flex  ${lang === 'ar' ? 'flex-row-reverse' : 'flex-row'} items-center gap-1.5 font-bold bg-white px-3 py-1 rounded-full`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={assetPath('assets/kp-logo.png')}
                loading="lazy"
                alt="Kernel Panic"
                className="w-8 h-8 object-contain rounded-xs"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <span className='flex flex-col'>
              <span className='text-black font-bold text-sm leading-tight'>KERNEL <span className='text-[#0062FF]'>PANIC</span></span>
              <span className='text-gray-500 text-[11px] tracking-widest text-left w-full leading-tight'>IT TEAM</span>
              </span>
            </div>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
