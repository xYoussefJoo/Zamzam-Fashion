// Fixed UI text in both languages (not data: products, categories and settings come from the API).

export const navigationLabels: Record<string, [string, string]> = {
  home: ['الرئيسية', 'Home'],
  shop: ['تسوقي', 'Shop'],
  custom: ['تفصيل خاص', 'Custom tailoring'],
  orders: ['طلباتي', 'My orders'],
  cart: ['السلة', 'Cart'],
  admin: ['الإدارة', 'Admin'],
  product: ['تفاصيل المنتج', 'Product details'],
  track: ['تتبع الطلب', 'Track order'],
};

export const adminTabsLabels: Record<string, [string, string]> = {
  overview: ['نظرة عامة', 'Overview'],
  categories: ['الأقسام', 'Categories'],
  products: ['المنتجات', 'Products'],
  orders: ['الطلبات والتصنيع', 'Orders & production'],
  colors: ['الألوان', 'Colors'],
  zones: ['مناطق التوصيل', 'Delivery zones'],
  tailoring: ['كتالوج التفصيل', 'Tailoring catalog'],
  pricing: ['أسعار التفصيل', 'Tailoring prices'],
  settings: ['محتوى الموقع', 'Site content'],
  password: ['كلمة المرور', 'Password'],
};

export const adminSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', 'FreeSize'];

export const assetPath = (path?: string | null) => {
  if (!path) return '';
  if (path.startsWith('data:') || path.startsWith('http://') || path.startsWith('https://')) return path;
  return path.startsWith('/') ? path : `/${path}`;
};
