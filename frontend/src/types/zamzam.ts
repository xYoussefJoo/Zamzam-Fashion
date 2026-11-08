export type Language = 'ar' | 'en';

export type PageId = 'home' | 'shop' | 'custom' | 'orders' | 'cart' | 'admin' | 'product';

export type AdminTab = 'overview' | 'categories' | 'products' | 'editor' | 'orders' | 'settings';

export interface Category {
  id: number;
  ar: string;
  en: string;
  parentId?: number | null;
}

export interface Product {
  id: number;
  ar: string;
  en: string;
  categoryId: number;
  price: number;
  stock: number;
  sizes: string[];
  colors: string[];
  image?: string;
  visible: boolean;
  emoji?: string;
  tone?: string;
  description?: string;
}

export interface CartItem {
  id: number;
  qty: number;
  size: string;
  color: string;
}

export interface OrderItem {
  id: number;
  name: string;
  nameEn: string;
  qty: number;
  price: number;
  size: string;
  color: string;
  categoryId: number;
}

export type OrderStatus =
  | 'review'
  | 'quoted'
  | 'approved'
  | 'production'
  | 'quality'
  | 'shipping'
  | 'done'
  | 'cancelled';

export interface BaseOrder {
  id: number;
  customer: string;
  phone: string;
  status: OrderStatus;
  date: string;
}

export interface ReadyOrder extends BaseOrder {
  type: 'ready';
  governorate: string;
  city: string;
  address: string;
  notes?: string;
  paymentMethod: 'cod';
  paymentStatus: 'unpaid' | 'paid';
  deliveryFee: number;
  subtotal: number;
  items: OrderItem[];
  total: number;
}

export interface CustomOrder extends BaseOrder {
  type: 'custom';
  kind: string;
  model: string;
  fabric: string;
  color: string;
  fit: string;
  size: string;
  measures: Record<string, number>;
  notes?: string;
  image?: string;
  total: null | number;
}

export type Order = ReadyOrder | CustomOrder;

export interface StoreSettings {
  bannerAr: string;
  bannerEn: string;
  featured?: boolean;
  deliveryFee: number;
  collectionAr: string;
  collectionEn: string;
  collectionEnabled: boolean;
  phone: string;
  whatsapp: string;
  email: string;
  addressAr: string;
  addressEn: string;
  facebook: string;
  instagram: string;
  tiktok: string;
}

export interface StoreData {
  categories: Category[];
  products: Product[];
  orders: Order[];
  cart: CartItem[];
  settings: StoreSettings;
}

export interface TailoringStyle {
  id: string;
  kind: string;
  ar: string;
  en: string;
  fabric: string;
  fit: string;
}

export interface GarmentKind {
  id: string;
  ar: string;
  en: string;
}

export interface MeasurementField {
  key: string;
  ar: string;
  en: string;
}

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error';
  showCartLink?: boolean;
}
