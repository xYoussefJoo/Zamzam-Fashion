'use client';

import React, { useState, useEffect } from 'react';
import { useZamzamStore } from '@/store/useZamzamStore';
import { PageId } from '@/types/zamzam';
import { navigationLabels, assetPath } from '@/lib/labels';
import { FaShoppingCart } from "react-icons/fa";


export default function Navbar() {
  const page = useZamzamStore((state) => state.page);
  const go = useZamzamStore((state) => state.go);
  const lang = useZamzamStore((state) => state.lang);
  const toggleLang = useZamzamStore((state) => state.toggleLang);
  const cartCount = useZamzamStore((state) => state.getCartCount());
  const t = useZamzamStore((state) => state.t);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 15);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const mainLinks: PageId[] = ['home', 'shop', 'custom', 'orders'];

  const handleNavClick = (p: PageId) => {
    go(p);
    setMobileMenuOpen(false);
  };

  return (
    <header
      className={`sticky top-0 z-40 transition-all duration-300 ${
        scrolled
          ? 'bg-white/95 backdrop-blur-md shadow-sm border-b border-[#e8dfd1]/80'
          : 'bg-[#fffaf3] border-b border-[#e8dfd1]'
      }`}
    >
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6 flex items-center justify-between min-h-[78px] gap-4">
        {/* Brand Logo & Name */}
        <button
          type="button"
          onClick={() => handleNavClick('home')}
          className="flex items-center gap-2 sm:gap-3 min-w-0 text-start group cursor-pointer focus:outline-none"
        >
          {!logoError ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={assetPath('assets/logo-mark-160.webp')}
              alt="Zamzam Fashion"
              className="w-11 h-11 sm:w-15 sm:h-15 shrink-0 object-contain transition-transform duration-300 group-hover:scale-105"
              onError={() => setLogoError(true)}
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-[#142b4a] text-[#b99664] flex items-center justify-center font-serif text-2xl font-bold italic shadow-sm group-hover:scale-105 transition-transform duration-300">
              Z
            </div>
          )}

          <div className="flex flex-col">
            <b className="text-[15px] sm:text-lg font-bold tracking-tight whitespace-nowrap leading-tight text-[#142b4a] group-hover:text-[#b99664] transition-colors duration-200">
              Zamzam Fashion
            </b>
            <small className="hidden sm:block text-[11px] tracking-[0.18em] whitespace-nowrap leading-tight text-[#8a6d43] font-semibold uppercase">
              MADE FOR YOUR STYLE
            </small>
          </div>
        </button>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-7 text-[15px] font-bold">
          {mainLinks.map((key) => {
            const isActive = page === key;
            const [arText, enText] = navigationLabels[key] || [key, key];
            return (
              <button
                key={key}
                type="button"
                onClick={() => handleNavClick(key)}
                className={`relative py-2 transition-colors duration-200 cursor-pointer group ${
                  isActive
                    ? 'text-[#142b4a]'
                    : 'text-[#2d3540] hover:text-[#b99664]'
                }`}
              >
                {t(arText, enText)}
                <span
                  className={`absolute bottom-0 start-0 h-0.5 bg-[#b99664] transition-all duration-300 ${
                    isActive ? 'w-full' : 'w-0 group-hover:w-full'
                  }`}
                />
              </button>
            );
          })}
        </nav>

        {/* Actions (Lang Switcher, Cart Button, Mobile Hamburger) */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={toggleLang}
            className="px-3 py-1.5 rounded-lg border border-[#cdbb9e] text-xs sm:text-sm font-bold text-[#142b4a] hover:bg-[#e7dac5] hover:border-[#b99664] transition-all duration-200 cursor-pointer"
          >
            {lang === 'ar' ? 'EN' : 'عربي'}
          </button>

          <button
            type="button"
            onClick={() => handleNavClick('cart')}
            aria-label={t('السلة', 'Cart')}
            className="relative flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#142b4a] text-white hover:bg-[#1e3a61] font-bold text-xs sm:text-sm cursor-pointer shadow-sm transition-all duration-200 hover:shadow-md active:scale-[0.97]"
          >
            <span className="text-[#b99664] text-m"><FaShoppingCart /></span>
            <span className="hidden sm:inline">{t('السلة', 'Cart')}</span>
            {cartCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-[#b99664] text-white text-[14px] font-bold flex items-center justify-center animate-pulse-gold">
                {cartCount}
              </span>
            )}
          </button>

          {/* Mobile Menu Toggle Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-[#142b4a] rounded-lg hover:bg-[#f7f3eb] cursor-pointer transition-colors"
            aria-label="Toggle Navigation Menu"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {mobileMenuOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      <div
        className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${
          mobileMenuOpen ? 'max-h-80 opacity-100 border-t border-[#e8dfd1]' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="bg-[#fbf8f3] px-4 py-3 space-y-1.5">
          {mainLinks.map((key) => {
            const isActive = page === key;
            const [arText, enText] = navigationLabels[key] || [key, key];
            return (
              <button
                key={key}
                type="button"
                onClick={() => handleNavClick(key)}
                className={`w-full text-start px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'bg-[#142b4a] text-white'
                    : 'text-[#2d3540] hover:bg-[#e7dac5]'
                }`}
              >
                {t(arText, enText)}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}
