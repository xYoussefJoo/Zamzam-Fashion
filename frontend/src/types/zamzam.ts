// UI-only types. Everything the API sends or receives is typed in src/types/api.ts (generated, see npm run api:types).

export type Language = 'ar' | 'en';

export type PageId = 'home' | 'shop' | 'custom' | 'orders' | 'cart' | 'admin' | 'product' | 'track';

export type AdminTab =
  | 'overview'
  | 'categories'
  | 'products'
  | 'editor'
  | 'orders'
  | 'colors'
  | 'zones'
  | 'tailoring'
  | 'pricing'
  | 'settings'
  | 'password';

// Where the app opens: the plain shop page, or one of the addresses that emails and shares link to.
export type InitialRoute =
  | { page: 'home' }
  | { page: 'product'; slug: string }
  | { page: 'track'; number: string; token: string }
  | { page: 'admin'; orderId?: number };

// One line in the bag: a single variant (size + color) of a product, with what the bag needs to show it.
export interface CartLine {
  variantId: number;
  productSlug: string;
  nameAr: string;
  nameEn: string;
  size: string;
  colorNameAr: string;
  colorNameEn: string;
  colorHex: string;
  price: number;
  imageUrl: string | null;
  qty: number;
  // Pieces left when the shop said "only N left" (null = more than 5); checkout re-checks anyway.
  stock: number | null;
}

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error';
  showCartLink?: boolean;
}
