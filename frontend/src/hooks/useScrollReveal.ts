'use client';

import { useEffect } from 'react';

const SELECTOR = '.reveal-init, .reveal-left, .reveal-right, .reveal-scale';

/**
 * Adds .revealed to .reveal-init / .reveal-left / .reveal-right / .reveal-scale elements when they enter the viewport.
 * Elements that appear later (products arriving from the API, a new tab) are picked up too, through a
 * MutationObserver, so nothing stays invisible at opacity 0. With "reduce motion" on, everything shows at once.
 */
export function useScrollReveal(dependencies: unknown[] = []) {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const showAll = () => document.querySelectorAll(SELECTOR).forEach((el) => el.classList.add('revealed'));
    if (reduceMotion || !('IntersectionObserver' in window)) {
      showAll();
      const late = new MutationObserver(showAll);
      late.observe(document.body, { childList: true, subtree: true });
      return () => late.disconnect();
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px -40px 0px' },
    );

    const watch = (root: ParentNode) => {
      root.querySelectorAll(SELECTOR).forEach((el) => {
        if (el.classList.contains('revealed')) return;
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom > 0) el.classList.add('revealed');
        else observer.observe(el);
      });
    };

    watch(document);
    const added = new MutationObserver((mutations) => {
      for (const m of mutations) {
        m.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return;
          if (node.matches(SELECTOR)) watch(node.parentElement ?? document);
          else watch(node);
        });
      }
    });
    added.observe(document.body, { childList: true, subtree: true });

    return () => {
      added.disconnect();
      observer.disconnect();
    };
  }, dependencies); // eslint-disable-line react-hooks/exhaustive-deps
}
