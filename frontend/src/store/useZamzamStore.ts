import { create } from 'zustand';
import type { AdminTab, CartLine, InitialRoute, Language, PageId, ToastMessage } from '@/types/zamzam';
import { getCategories, getSiteSettings, trackingPath, type CategoryNode, type SiteContent } from '@/lib/shop';
import { me, logout as apiLogout, type User } from '@/lib/admin';

// UI state + the bag. Products, orders and settings live on the server and are loaded by each screen
// (src/lib/shop.ts, src/lib/admin.ts); only the site settings and the category tree are kept here,
// because the header, footer and menus on every page need them.
export interface ZamzamState {
  lang: Language;
  page: PageId;
  previousPage: PageId;
  filter: string; // category slug, or 'all'
  adminTab: AdminTab;
  adminProductFilter: string; // category id, or 'all'
  productModal: { id: number | null; categoryId: number | null } | null; // the product pop-up
  catalogVersion: number; // goes up when the product pop-up closes, so lists reload
  selectedSlug: string | null;
  tracking: { number: string; token: string } | null;
  adminOrderId: number | null;
  user: User | null;
  authChecked: boolean;
  site: SiteContent | null;
  categories: CategoryNode[];
  cart: CartLine[];
  toast: ToastMessage | null;
  isHydrated: boolean;

  initialize: (route?: InitialRoute) => void;
  toggleLang: () => void;
  setLang: (lang: Language) => void;
  t: (ar: string, en: string) => string;
  money: (amount: number | null | undefined) => string;
  go: (p: PageId) => void;
  openProduct: (slug: string) => void;
  openTracking: (number: string, token: string) => void;
  setFilter: (categorySlug: string) => void;
  setAdminTab: (tab: AdminTab) => void;
  setAdminProductFilter: (filter: string) => void;
  openProductEditor: (categoryId?: number | null) => void;
  editProduct: (id: number) => void;
  setProductModalId: (id: number) => void;
  closeProductModal: () => void;
  setAdminOrderId: (id: number | null) => void;

  checkSession: () => Promise<void>;
  setUser: (user: User | null) => void;
  logout: () => Promise<void>;

  refreshSite: () => Promise<void>;
  refreshCategories: () => Promise<void>;

  showToast: (message: string, type?: 'success' | 'error', options?: { showCartLink?: boolean }) => void;
  hideToast: () => void;

  addToCart: (line: Omit<CartLine, 'qty'>, qty?: number) => boolean;
  setCartQty: (variantId: number, qty: number) => void;
  removeFromCart: (variantId: number) => void;
  clearCart: () => void;
  getCartCount: () => number;
  getSubtotal: () => number;
}

const CART_KEY = 'zamzam_cart_v1';
const MAX_QTY = 10; // the API refuses more than 10 of one item per order

const saveCart = (cart: CartLine[]) => {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  } catch {
    // private window or full storage: the bag still works for this visit
  }
};

const loadCart = (): CartLine[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((l) => typeof l?.variantId === 'number' && l.qty > 0) : [];
  } catch {
    return [];
  }
};

const applyLanguage = (lang: Language) => {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.title = lang === 'ar' ? 'زمزم فاشون | أزياء وتفصيل' : 'Zamzam Fashion | Ready-to-wear & Tailoring';
};

// The address bar shows a real, shareable address for product and tracking pages, and #page for the rest.
const urlFor = (s: Pick<ZamzamState, 'page' | 'selectedSlug' | 'tracking' | 'adminOrderId'>) => {
  if (s.page === 'product' && s.selectedSlug) return `/products/${encodeURIComponent(s.selectedSlug)}`;
  if (s.page === 'track' && s.tracking) return trackingPath(s.tracking.number, s.tracking.token);
  if (s.page === 'admin' && s.adminOrderId) return `/admin/orders/${s.adminOrderId}`;
  if (s.page === 'home') return '/';
  return `/#${s.page}`;
};

let toastTimer: ReturnType<typeof setTimeout> | null = null;

export const useZamzamStore = create<ZamzamState>((set, get) => ({
  lang: 'ar',
  page: 'home',
  previousPage: 'home',
  filter: 'all',
  adminTab: 'overview',
  adminProductFilter: 'all',
  productModal: null,
  catalogVersion: 0,
  selectedSlug: null,
  tracking: null,
  adminOrderId: null,
  user: null,
  authChecked: false,
  site: null,
  categories: [],
  cart: [],
  toast: null,
  isHydrated: false,

  initialize: (route) => {
    if (typeof window === 'undefined') return;
    let lang: Language = 'ar';
    try {
      lang = localStorage.getItem('zamzam_lang') === 'en' ? 'en' : 'ar';
    } catch {}
    applyLanguage(lang);

    let page: PageId = 'home';
    let selectedSlug: string | null = null;
    let tracking: ZamzamState['tracking'] = null;
    let adminOrderId: number | null = null;
    if (route && route.page === 'product') {
      page = 'product';
      selectedSlug = route.slug;
    } else if (route && route.page === 'track') {
      page = 'track';
      tracking = { number: route.number, token: route.token };
    } else if (route && route.page === 'admin') {
      page = 'admin';
      adminOrderId = route.orderId ?? null;
    } else {
      const hash = window.location.hash.slice(1) as PageId;
      if (['home', 'shop', 'custom', 'orders', 'cart', 'admin'].includes(hash)) page = hash;
    }

    set({
      lang, page, selectedSlug, tracking, adminOrderId,
      adminTab: adminOrderId ? 'orders' : 'overview',
      cart: loadCart(),
      isHydrated: true,
    });
    void get().refreshSite();
    void get().refreshCategories();
  },

  toggleLang: () => get().setLang(get().lang === 'ar' ? 'en' : 'ar'),

  setLang: (lang) => {
    try {
      localStorage.setItem('zamzam_lang', lang);
    } catch {}
    applyLanguage(lang);
    set({ lang });
  },

  t: (ar, en) => (get().lang === 'ar' ? ar : en),

  money: (amount) => {
    const { lang } = get();
    const formatted = Number(amount || 0).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US', { maximumFractionDigits: 2 });
    return `${formatted} ${lang === 'ar' ? 'ج.م' : 'EGP'}`;
  },

  go: (p) => {
    const current = get().page;
    set({ previousPage: current !== p ? current : get().previousPage, page: p });
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', urlFor(get()));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  },

  openProduct: (slug) => {
    set({ selectedSlug: slug });
    get().go('product');
  },

  openTracking: (number, token) => {
    set({ tracking: { number, token } });
    get().go('track');
  },

  setFilter: (categorySlug) => set({ filter: categorySlug }),
  setAdminTab: (tab) => {
    set({ adminTab: tab, adminOrderId: tab === 'orders' ? get().adminOrderId : null });
    if (typeof window !== 'undefined' && get().page === 'admin') window.history.replaceState(null, '', urlFor(get()));
  },
  setAdminProductFilter: (filter) => set({ adminProductFilter: filter }),
  openProductEditor: (categoryId = null) => {
    const { adminProductFilter } = get();
    set({ productModal: { id: null, categoryId: categoryId ?? (adminProductFilter !== 'all' ? Number(adminProductFilter) : null) } });
  },
  editProduct: (id) => set({ productModal: { id, categoryId: null } }),
  setProductModalId: (id) => set((s) => ({ productModal: { id, categoryId: s.productModal?.categoryId ?? null } })),
  closeProductModal: () => set((s) => ({ productModal: null, catalogVersion: s.catalogVersion + 1 })),
  setAdminOrderId: (id) => {
    set({ adminOrderId: id });
    if (typeof window !== 'undefined' && get().page === 'admin') window.history.replaceState(null, '', urlFor(get()));
  },

  // The session is the httpOnly cookie; /api/auth/me says whether it is still valid.
  checkSession: async () => {
    try {
      set({ user: await me(), authChecked: true });
    } catch {
      set({ user: null, authChecked: true });
    }
  },

  setUser: (user) => set({ user, authChecked: true }),

  logout: async () => {
    try {
      await apiLogout();
    } catch {
      // already signed out on the server: nothing else to do
    }
    set({ user: null, adminTab: 'overview', adminOrderId: null });
    get().go('home');
  },

  refreshSite: async () => {
    try {
      set({ site: await getSiteSettings() });
    } catch {
      // the header and footer fall back to their built-in text
    }
  },

  refreshCategories: async () => {
    try {
      set({ categories: await getCategories() });
    } catch {
      // the shop still works without the category menu
    }
  },

  hideToast: () => {
    if (toastTimer) clearTimeout(toastTimer);
    set({ toast: null });
  },

  showToast: (message, type = 'success', options) => {
    if (toastTimer) clearTimeout(toastTimer);
    set({ toast: { id: String(Date.now()), message, type, showCartLink: options?.showCartLink } });
    toastTimer = setTimeout(() => set({ toast: null }), 4300);
  },

  addToCart: (line, qty = 1) => {
    const { cart, t, lang, showToast } = get();
    const existing = cart.find((x) => x.variantId === line.variantId);
    const wanted = (existing?.qty ?? 0) + Math.max(1, qty);
    const limit = Math.min(MAX_QTY, line.stock ?? MAX_QTY);
    if (wanted > limit) {
      showToast(t('الكمية المطلوبة غير متوفرة في المخزون', 'Quantity unavailable in stock'), 'error');
      return false;
    }
    const next = existing
      ? cart.map((x) => (x.variantId === line.variantId ? { ...x, ...line, qty: wanted } : x))
      : [...cart, { ...line, qty: wanted }];
    set({ cart: next });
    saveCart(next);

    const name = lang === 'ar' ? line.nameAr : line.nameEn;
    const color = lang === 'ar' ? line.colorNameAr : line.colorNameEn;
    const qtyText = qty > 1 ? ` (${qty})` : '';
    showToast(
      t(`تمت إضافة ${name}${qtyText} للسلة — ${line.size} / ${color}`, `${name}${qtyText} added to your bag — ${line.size} / ${color}`),
      'success',
      { showCartLink: true },
    );
    return true;
  },

  setCartQty: (variantId, qty) => {
    const next = get().cart.map((x) =>
      x.variantId === variantId ? { ...x, qty: Math.max(1, Math.min(qty, Math.min(MAX_QTY, x.stock ?? MAX_QTY))) } : x,
    );
    set({ cart: next });
    saveCart(next);
  },

  removeFromCart: (variantId) => {
    const next = get().cart.filter((x) => x.variantId !== variantId);
    set({ cart: next });
    saveCart(next);
  },

  clearCart: () => {
    set({ cart: [] });
    saveCart([]);
  },

  getCartCount: () => get().cart.reduce((s, x) => s + x.qty, 0),
  getSubtotal: () => get().cart.reduce((s, x) => s + x.price * x.qty, 0),
}));
