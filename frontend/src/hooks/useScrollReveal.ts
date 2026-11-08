'use client';

import { useEffect } from 'react';

/**
 * Observes elements with .reveal-init, .reveal-left, .reveal-right, .reveal-scale
 * and adds .revealed when they enter the viewport.
 * Triggers animations only when elements come into the screen.
 */
export function useScrollReveal(dependencies: unknown[] = []) {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let observer: IntersectionObserver | null = null;

    const setupObserver = () => {
      const elements = document.querySelectorAll(
        '.reveal-init, .reveal-left, .reveal-right, .reveal-scale'
      );

      if (elements.length === 0) return;

      if (!('IntersectionObserver' in window)) {
        elements.forEach((el) => el.classList.add('revealed'));
        return;
      }

      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('revealed');
              observer?.unobserve(entry.target);
            }
          });
        },
        {
          threshold: 0.08,
          rootMargin: '0px 0px -40px 0px',
        }
      );

      elements.forEach((el) => {
        // If element is already in the viewport upon mount/navigation, reveal it immediately
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom > 0) {
          el.classList.add('revealed');
        } else {
          observer?.observe(el);
        }
      });
    };

    // Small delay to ensure child DOM elements have rendered
    const timer = setTimeout(setupObserver, 60);

    return () => {
      clearTimeout(timer);
      if (observer) {
        observer.disconnect();
      }
    };
  }, dependencies); // eslint-disable-line react-hooks/exhaustive-deps
}

