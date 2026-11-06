import { create } from 'zustand';
import {
  Language,
  PageId,
  AdminTab,
  Category,
  Product,
  CartItem,
  ReadyOrder,
  CustomOrder,
  StoreSettings,
  StoreData,
  OrderStatus,
  ToastMessage,
} from '@/types/zamzam';
import {
  STORAGE_KEY,
  initialStoreData,
  initialProducts,
  initialCategories,
  initialSettings,
  DEMO_PASSCODE,
  colorEnglish,
} from '@/data/seed';

export interface ZamzamState {
  lang: Language;
  page: PageId;
  previousPage: PageId;
  filter: string;
  auth: boolean;
  adminTab: AdminTab;
  adminProductFilter: string;
  editingProductId: number | null;
  editorCategoryId: number | null;
  data: StoreData;
  toast: ToastMessage | null;
  isHydrated: boolean;

  // Actions
  initialize: () => void;
  toggleLang: () => void;
  setLang: (lang: Language) => void;
  t: (ar: string, en: string) => string;
  localizedColor: (color: string) => string;
  money: (amount: number) => string;
  go: (p: PageId) => void;
  setFilter: (categoryId: string) => void;
  setAdminTab: (tab: AdminTab) => void;
  setAdminProductFilter: (filter: string) => void;
  setEditingProductId: (id: number | null) => void;
  setEditorCategoryId: (id: number | null) => void;
  openProductEditor: (categoryId?: number | null) => void;
  login: (passcode: string) => boolean;
  logout: () => void;

  showToast: (message: string, type?: 'success' | 'error', options?: { showCartLink?: boolean }) => void;
  hideToast: () => void;

  addToCart: (productId: number, size: string, color: string) => boolean;
  removeFromCart: (productId: number, size: string, color: string) => void;
  checkout: (details: {
    customer: string;
    phone: string;
    governorate: string;
    city: string;
    address: string;
    notes?: string;
  }) => boolean;
  addCustomOrder: (customOrder: Omit<CustomOrder, 'id' | 'type' | 'date' | 'status' | 'total'>) => boolean;

  createCategory: (ar: string, en: string, parentId?: number | null) => boolean;
  deleteCategory: (id: number) => { success: boolean; error?: string };

  createProduct: (product: Omit<Product, 'id'>) => boolean;
  updateProduct: (id: number, product: Partial<Product>) => boolean;
  deleteProduct: (id: number) => void;
  toggleProductVisibility: (id: number) => void;

  updateOrderStatus: (id: number, status: OrderStatus) => void;
  updateSettings: (settingsUpdates: Partial<StoreSettings>) => void;

  isInCategory: (product: Product, categoryFilter: string) => boolean;

  // Computed helper getters
  getCartCount: () => number;
  getSubtotal: () => number;
  getDeliveryFee: () => number;
  getTotal: () => number;
}

const saveToLocalStorage = (newData: StoreData) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
  } catch (err) {
    console.error('Failed to save to localStorage:', err);
  }
};

let toastTimer: NodeJS.Timeout | null = null;

export const useZamzamStore = create<ZamzamState>((set, get) => ({
  lang: 'ar',
  page: 'home',
  previousPage: 'home',
  filter: 'all',
  auth: false,
  adminTab: 'overview',
  adminProductFilter: 'all',
  editingProductId: null,
  editorCategoryId: null,
  data: initialStoreData,
  toast: null,
  isHydrated: false,

  initialize: () => {
    if (typeof window === 'undefined') return;
    try {
      const storedLang = localStorage.getItem('zamzam_lang') as Language;
      const initialLang: Language = storedLang === 'en' ? 'en' : 'ar';

      document.documentElement.lang = initialLang;
      document.documentElement.dir = initialLang === 'ar' ? 'rtl' : 'ltr';
      document.title =
        initialLang === 'ar'
          ? 'زمزم فاشون | أزياء وتفصيل'
          : 'Zamzam Fashion | Ready-to-wear & Tailoring';

      let resolvedData: StoreData = structuredClone(initialStoreData);
      const storedRaw = localStorage.getItem(STORAGE_KEY);
      if (storedRaw) {
        try {
          const parsed = JSON.parse(storedRaw);
          resolvedData = {
            categories: Array.isArray(parsed.categories) ? parsed.categories : [...initialCategories],
            products: Array.isArray(parsed.products) ? parsed.products : [...initialProducts],
            orders: Array.isArray(parsed.orders) ? parsed.orders : [],
            cart: Array.isArray(parsed.cart) ? parsed.cart : [],
            settings: { ...initialSettings, ...(parsed.settings || {}) },
          };

          // Merge missing seed items (preserves user-created products and categories)
          for (const item of initialProducts) {
            if (!resolvedData.products.some((p) => p.id === item.id)) {
              resolvedData.products.push({ ...item });
            }
          }
          for (const item of initialCategories) {
            if (!resolvedData.categories.some((c) => c.id === item.id)) {
              resolvedData.categories.push({ ...item });
            }
          }
        } catch (e) {
          console.warn('Could not parse localStorage store:', e);
        }
      }

      let initialPage: PageId = 'home';
      if (window.location.hash === '#admin') {
        initialPage = 'admin';
      } else if (window.location.hash.startsWith('#')) {
        const hash = window.location.hash.slice(1) as PageId;
        if (['home', 'shop', 'custom', 'orders', 'cart', 'admin'].includes(hash)) {
          initialPage = hash;
        }
      }

      set({
        lang: initialLang,
        data: resolvedData,
        page: initialPage,
        isHydrated: true,
      });
    } catch (err) {
      console.warn('Store initialize error:', err);
      set({ isHydrated: true });
    }
  },

  toggleLang: () => {
    const nextLang: Language = get().lang === 'ar' ? 'en' : 'ar';
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('zamzam_lang', nextLang);
        document.documentElement.lang = nextLang;
        document.documentElement.dir = nextLang === 'ar' ? 'rtl' : 'ltr';
        document.title =
          nextLang === 'ar'
            ? 'زمزم فاشون | أزياء وتفصيل'
            : 'Zamzam Fashion | Ready-to-wear & Tailoring';
      } catch {}
    }
    set({ lang: nextLang });
  },

  setLang: (newLang: Language) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('zamzam_lang', newLang);
        document.documentElement.lang = newLang;
        document.documentElement.dir = newLang === 'ar' ? 'rtl' : 'ltr';
      } catch {}
    }
    set({ lang: newLang });
  },

  t: (ar: string, en: string) => {
    return get().lang === 'ar' ? ar : en;
  },

  localizedColor: (color: string) => {
    if (get().lang === 'en') {
      return colorEnglish[color] || color;
    }
    return color;
  },

  money: (amount: number) => {
    const { lang } = get();
    const formatted = Number(amount || 0).toLocaleString(
      lang === 'ar' ? 'ar-EG' : 'en-US'
    );
    return `${formatted} ${lang === 'ar' ? 'ج.م' : 'EGP'}`;
  },

  go: (p: PageId) => {
    const currentPage = get().page;
    set({
      previousPage: currentPage !== p ? currentPage : get().previousPage,
      page: p,
    });
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', p === 'admin' ? '#admin' : '#' + p);
      window.scrollTo(0, 0);
    }
  },

  setFilter: (categoryId: string) => {
    set({ filter: categoryId });
  },

  setAdminTab: (tab: AdminTab) => {
    set({ adminTab: tab });
  },

  setAdminProductFilter: (catId: string) => {
    set({ adminProductFilter: catId });
  },

  setEditingProductId: (id: number | null) => {
    set({ editingProductId: id });
  },

  setEditorCategoryId: (id: number | null) => {
    set({ editorCategoryId: id });
  },

  openProductEditor: (categoryId: number | null = null) => {
    const { adminProductFilter } = get();
    set({
      editingProductId: null,
      editorCategoryId:
        categoryId ?? (adminProductFilter !== 'all' ? Number(adminProductFilter) : null),
      adminTab: 'editor',
    });
  },

  login: (passcode: string) => {
    if (passcode === DEMO_PASSCODE) {
      set({ auth: true, page: 'admin' });
      return true;
    }
    return false;
  },

  logout: () => {
    set({ auth: false });
    get().go('home');
  },

  hideToast: () => {
    if (toastTimer) clearTimeout(toastTimer);
    set({ toast: null });
  },

  showToast: (message: string, type: 'success' | 'error' = 'success', options?: { showCartLink?: boolean }) => {
    if (toastTimer) clearTimeout(toastTimer);
    set({
      toast: {
        id: String(Date.now()),
        message,
        type,
        showCartLink: options?.showCartLink,
      },
    });
    toastTimer = setTimeout(() => {
      set({ toast: null });
    }, 4300);
  },

  isInCategory: (product: Product, categoryFilter: string): boolean => {
    if (categoryFilter === 'all') return true;
    let catId: number | undefined = Number(product.categoryId);
    const seen = new Set<number>();
    const categories = get().data.categories;
    while (catId && !seen.has(catId)) {
      if (String(catId) === String(categoryFilter)) return true;
      seen.add(catId);
      const parent = categories.find((c) => c.id === catId)?.parentId;
      catId = parent ? Number(parent) : undefined;
    }
    return false;
  },

  addToCart: (productId: number, size: string, color: string): boolean => {
    const { data, lang, localizedColor, t, showToast } = get();
    const p = data.products.find((x) => x.id === productId);
    if (!p || p.stock <= 0) return false;

    const effectiveSize = size || (p.sizes[0] ?? 'One Size');
    const effectiveColor = color || (p.colors[0] ?? 'حسب المتاح');

    const totalQtyInCart = data.cart
      .filter((x) => x.id === productId)
      .reduce((sum, item) => sum + item.qty, 0);

    if (totalQtyInCart >= p.stock) {
      showToast(t('الكمية غير متاحة', 'Quantity unavailable'), 'error');
      return false;
    }

    const existing = data.cart.find(
      (x) => x.id === productId && x.size === effectiveSize && x.color === effectiveColor
    );

    let newCart: CartItem[];
    if (existing) {
      newCart = data.cart.map((item) =>
        item === existing ? { ...item, qty: item.qty + 1 } : item
      );
    } else {
      newCart = [...data.cart, { id: productId, qty: 1, size: effectiveSize, color: effectiveColor }];
    }

    const updatedData = { ...data, cart: newCart };
    set({ data: updatedData });
    saveToLocalStorage(updatedData);

    const productName = lang === 'ar' ? p.ar : p.en;
    const colorLabel = localizedColor(effectiveColor);
    showToast(
      t(
        `تمت إضافة ${productName} للسلة — ${effectiveSize} / ${colorLabel}`,
        `${productName} added to your bag — ${effectiveSize} / ${colorLabel}`
      ),
      'success',
      { showCartLink: true }
    );
    return true;
  },

  removeFromCart: (productId: number, size: string, color: string) => {
    const { data } = get();
    const newCart = data.cart.filter(
      (x) => !(x.id === productId && (x.size || '') === size && (x.color || '') === color)
    );
    const updatedData = { ...data, cart: newCart };
    set({ data: updatedData });
    saveToLocalStorage(updatedData);
  },

  checkout: (details) => {
    const { data, t, go, showToast } = get();

    for (const item of data.cart) {
      const prod = data.products.find((p) => p.id === item.id);
      const totalOfProduct = data.cart
        .filter((x) => x.id === item.id)
        .reduce((acc, c) => acc + c.qty, 0);
      if (!prod || prod.stock < totalOfProduct) {
        showToast(t('بعض المنتجات غير متاحة', 'Some items are unavailable'), 'error');
        return false;
      }
    }

    const orderItems = data.cart.map((c) => {
      const prod = data.products.find((p) => p.id === c.id)!;
      return {
        id: prod.id,
        name: prod.ar,
        nameEn: prod.en,
        qty: c.qty,
        price: prod.price,
        size: c.size,
        color: c.color,
        categoryId: prod.categoryId,
      };
    });

    const subtotal = orderItems.reduce((acc, x) => acc + x.price * x.qty, 0);
    const deliveryFee = Number(data.settings.deliveryFee ?? 65);

    const newOrder: ReadyOrder = {
      id: Date.now() + Math.floor(Math.random() * 999),
      type: 'ready',
      customer: details.customer,
      phone: details.phone,
      governorate: details.governorate,
      city: details.city,
      address: details.address,
      notes: details.notes || '',
      paymentMethod: 'cod',
      paymentStatus: 'unpaid',
      deliveryFee,
      subtotal,
      items: orderItems,
      total: subtotal + deliveryFee,
      status: 'review',
      date: new Date().toISOString(),
    };

    const updatedData = {
      ...data,
      orders: [newOrder, ...data.orders],
      cart: [],
    };

    set({ data: updatedData });
    saveToLocalStorage(updatedData);

    go('orders');
    showToast(
      t(
        'تم تسجيل الطلب للمراجعة، ولم يتم تحصيل أي مبلغ',
        'Order submitted for review. No payment collected'
      ),
      'success'
    );
    return true;
  },

  addCustomOrder: (customOrder) => {
    const { data, t, go, showToast } = get();
    const newOrder: CustomOrder = {
      ...customOrder,
      id: Date.now() + Math.floor(Math.random() * 999),
      type: 'custom',
      status: 'review',
      date: new Date().toISOString(),
      total: null,
    };

    const updatedData = {
      ...data,
      orders: [newOrder, ...data.orders],
    };

    set({ data: updatedData });
    saveToLocalStorage(updatedData);

    go('orders');
    showToast(t('تم حفظ طلبك التجريبي', 'Demo request saved'), 'success');
    return true;
  },

  createCategory: (ar: string, en: string, parentId?: number | null) => {
    const { data, t, showToast } = get();
    const trimmedAr = ar.trim();
    if (!trimmedAr) return false;

    const newCat: Category = {
      id: Date.now() + Math.floor(Math.random() * 999),
      ar: trimmedAr,
      en: (en || trimmedAr).trim(),
      parentId: parentId || null,
    };

    const updatedData = {
      ...data,
      categories: [...data.categories, newCat],
    };

    set({
      data: updatedData,
      adminProductFilter: String(newCat.id),
      adminTab: 'categories',
    });
    saveToLocalStorage(updatedData);
    showToast(
      t('تم إنشاء القسم. اضغطي إضافة صنف بجواره', 'Category created. Use Add item beside it.'),
      'success'
    );
    return true;
  },

  deleteCategory: (id: number) => {
    const { data, t, showToast } = get();
    if (data.products.some((p) => p.categoryId === id) || data.categories.some((c) => c.parentId === id)) {
      return {
        success: false,
        error: t('القسم مرتبط بمنتجات', 'Category contains products'),
      };
    }

    const updatedData = {
      ...data,
      categories: data.categories.filter((c) => c.id !== id),
    };

    set({ data: updatedData });
    saveToLocalStorage(updatedData);
    showToast(t('تم حذف القسم', 'Category deleted'), 'success');
    return { success: true };
  },

  createProduct: (product) => {
    const { data, t, showToast } = get();
    const newProduct: Product = {
      ...product,
      id: Date.now() + Math.floor(Math.random() * 999),
      visible: true,
      emoji: product.emoji || '👗',
      tone: product.tone || '',
    };

    const updatedData = {
      ...data,
      products: [...data.products, newProduct],
    };

    set({
      data: updatedData,
      adminProductFilter: String(product.categoryId),
      adminTab: 'products',
      editingProductId: null,
    });
    saveToLocalStorage(updatedData);
    showToast(t('تمت إضافة المنتج للقسم المختار', 'Product added to the selected category'), 'success');
    return true;
  },

  updateProduct: (id: number, updates: Partial<Product>) => {
    const { data, t, showToast } = get();
    const updatedData = {
      ...data,
      products: data.products.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    };
    set({
      data: updatedData,
      adminTab: 'products',
      editingProductId: null,
    });
    saveToLocalStorage(updatedData);
    showToast(t('تم تحديث المنتج', 'Product updated'), 'success');
    return true;
  },

  deleteProduct: (id: number) => {
    const { data, t, showToast } = get();
    const updatedData = {
      ...data,
      products: data.products.filter((p) => p.id !== id),
      cart: data.cart.filter((c) => c.id !== id),
    };
    set({ data: updatedData });
    saveToLocalStorage(updatedData);
    showToast(t('تم حذف المنتج', 'Product deleted'), 'success');
  },

  toggleProductVisibility: (id: number) => {
    const { data } = get();
    const updatedData = {
      ...data,
      products: data.products.map((p) => (p.id === id ? { ...p, visible: !p.visible } : p)),
    };
    set({ data: updatedData });
    saveToLocalStorage(updatedData);
  },

  updateOrderStatus: (id: number, status: OrderStatus) => {
    const { data, t, showToast } = get();
    const updatedData = {
      ...data,
      orders: data.orders.map((o) => (o.id === id ? { ...o, status } : o)),
    };
    set({ data: updatedData });
    saveToLocalStorage(updatedData);
    showToast(t('تم تحديث حالة الطلب', 'Order status updated'), 'success');
  },

  updateSettings: (settingsUpdates: Partial<StoreSettings>) => {
    const { data, t, showToast } = get();
    const updatedData = {
      ...data,
      settings: { ...data.settings, ...settingsUpdates },
    };
    set({ data: updatedData });
    saveToLocalStorage(updatedData);
    showToast(t('تم حفظ محتوى الموقع', 'Site content saved'), 'success');
  },

  getCartCount: () => {
    return get().data.cart.reduce((s, x) => s + x.qty, 0);
  },

  getSubtotal: () => {
    const { data } = get();
    return data.cart.reduce((s, c) => {
      const prod = data.products.find((p) => p.id === c.id);
      return s + (prod?.price || 0) * c.qty;
    }, 0);
  },

  getDeliveryFee: () => {
    return Number(get().data.settings.deliveryFee ?? 65);
  },

  getTotal: () => {
    const sub = get().getSubtotal();
    return sub + (get().data.cart.length > 0 ? get().getDeliveryFee() : 0);
  },
}));

