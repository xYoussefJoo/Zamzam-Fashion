import { api, call, type Schemas } from '@/lib/api';
import { postForm } from '@/lib/shop';

export type User = Schemas['UserResponse'];
export type AdminCategory = Schemas['AdminCategoryNode'];
export type AdminProductRow = Schemas['AdminProductRow'];
export type AdminProduct = Schemas['AdminProductDetail'];
export type AdminVariant = Schemas['AdminVariantDto'];
export type AdminColor = Schemas['AdminColorDto'];
export type AdminOrderRow = Schemas['AdminOrderRow'];
export type AdminOrder = Schemas['AdminOrderDetail'];
export type AdminZone = Schemas['AdminZoneDto'];
export type Dashboard = Schemas['DashboardDto'];
export type TailoringCatalogContent = Schemas['TailoringCatalogContent'];
export type PriceRules = Schemas['PriceRulesContent'];
export type SiteContent = Schemas['SiteContent'];
export type Image = Schemas['ImageDto'];
export type OrderStatus = Schemas['OrderStatus'];

// ---------- auth (#1–#4): the session is an httpOnly cookie, nothing is stored in the browser
export const login = (email: string, password: string, rememberMe = false) =>
  call(api.POST('/api/auth/login', { body: { email, password, rememberMe } }));
export const me = () => call(api.GET('/api/auth/me'));
export const logout = () => call(api.POST('/api/auth/logout'));
export const changePassword = (currentPassword: string, newPassword: string) =>
  call(api.POST('/api/auth/change-password', { body: { currentPassword, newPassword } }));

// ---------- dashboard (#47)
export const getDashboard = () => call(api.GET('/api/admin/dashboard'));

// ---------- categories (#17–#20)
export const getAdminCategories = () => call(api.GET('/api/admin/categories'));
export const createCategory = (body: Schemas['SaveCategoryCommand']) => call(api.POST('/api/admin/categories', { body }));
export const updateCategory = (id: number, body: Schemas['SaveCategoryCommand']) =>
  call(api.PUT('/api/admin/categories/{id}', { params: { path: { id } }, body }));
export const deleteCategory = (id: number) => call(api.DELETE('/api/admin/categories/{id}', { params: { path: { id } } }));

// ---------- products (#21–#25)
export type AdminProductQuery = {
  categoryId?: number; q?: string; isVisible?: boolean; lowStock?: boolean; sort?: string; page?: number; pageSize?: number;
  colorId?: number; size?: string; status?: 'all' | 'low' | 'out' | 'in'; // matched on the same size/colour
};
export const getAdminProducts = (query: AdminProductQuery) => call(api.GET('/api/admin/products', { params: { query } }));
export const getAdminProduct = (id: number) => call(api.GET('/api/admin/products/{id}', { params: { path: { id } } }));
export const createProduct = (body: Schemas['CreateProductCommand']) => call(api.POST('/api/admin/products', { body }));
export const updateProduct = (id: number, body: Schemas['UpdateProductCommand']) =>
  call(api.PUT('/api/admin/products/{id}', { params: { path: { id } }, body }));
export const deleteProduct = (id: number) => call(api.DELETE('/api/admin/products/{id}', { params: { path: { id } } }));

// ---------- variants (#26–#28): send the version you loaded; a stale one is refused with 409 CONCURRENCY_CONFLICT
export const addVariant = (productId: number, body: Schemas['NewVariant']) =>
  call(api.POST('/api/admin/products/{id}/variants', { params: { path: { id: productId } }, body }));
export const updateVariant = (id: number, body: Schemas['UpdateVariantCommand']) =>
  call(api.PUT('/api/admin/variants/{id}', { params: { path: { id } }, body }));
export const deleteVariant = (id: number) => call(api.DELETE('/api/admin/variants/{id}', { params: { path: { id } } }));

// ---------- photos (#29–#30): multipart file + alt text
export function uploadImage(productId: number, file: File, altAr?: string, altEn?: string) {
  const form = new FormData();
  form.append('file', file);
  if (altAr) form.append('altAr', altAr);
  if (altEn) form.append('altEn', altEn);
  return postForm<Image>(`/api/admin/products/${productId}/images`, form, { 'X-Requested-With': 'zamzam-admin' });
}
export const deleteImage = (id: number) => call(api.DELETE('/api/admin/images/{id}', { params: { path: { id } } }));

// ---------- colors (#31–#34)
export const getColors = () => call(api.GET('/api/admin/colors'));
export const createColor = (body: Schemas['SaveColorCommand']) => call(api.POST('/api/admin/colors', { body }));
export const updateColor = (id: number, body: Schemas['SaveColorCommand']) =>
  call(api.PUT('/api/admin/colors/{id}', { params: { path: { id } }, body }));
export const deleteColor = (id: number) => call(api.DELETE('/api/admin/colors/{id}', { params: { path: { id } } }));

// ---------- orders (#35–#38)
export type AdminOrderQuery = { status?: OrderStatus[]; type?: 'Ready' | 'Custom'; q?: string; from?: string; to?: string; page?: number; pageSize?: number };
export const getAdminOrders = (query: AdminOrderQuery) => call(api.GET('/api/admin/orders', { params: { query } }));
export const getAdminOrder = (id: number) => call(api.GET('/api/admin/orders/{id}', { params: { path: { id } } }));
export const changeOrderStatus = (id: number, to: OrderStatus, note: string | null) =>
  call(api.POST('/api/admin/orders/{id}/status', { params: { path: { id } }, body: { to, note } }));
export const sendQuote = (id: number, price: number, note: string | null, validDays: number) =>
  call(api.POST('/api/admin/orders/{id}/quote', { params: { path: { id } }, body: { price, note, validDays } }));

// ---------- delivery zones (#41–#42)
export const getAdminZones = () => call(api.GET('/api/admin/delivery-zones'));
export const saveZones = (zones: Schemas['ZoneUpdate'][]) => call(api.PUT('/api/admin/delivery-zones', { body: zones }));

// ---------- tailoring catalog + price rules (#39–#40, #45–#46)
export const getAdminTailoringCatalog = () => call(api.GET('/api/admin/tailoring/catalog'));
export const saveTailoringCatalog = (body: TailoringCatalogContent) => call(api.PUT('/api/admin/tailoring/catalog', { body }));
export const getPriceRules = () => call(api.GET('/api/admin/tailoring/pricing'));
export const savePriceRules = (body: PriceRules) => call(api.PUT('/api/admin/tailoring/pricing', { body }));

// ---------- site settings (#43–#44)
export const getAdminSiteSettings = () => call(api.GET('/api/admin/site-settings'));
export const saveSiteSettings = (body: SiteContent) => call(api.PUT('/api/admin/site-settings', { body }));

// Allowed next statuses (contract Appendix A); the server refuses anything else with 409.
export function nextStatuses(type: 'Ready' | 'Custom', status: OrderStatus): OrderStatus[] {
  const cancel: OrderStatus[] = ['PendingConfirmation', 'Confirmed', 'AwaitingQuote', 'QuoteSent', 'QuoteApproved'];
  const ready: Partial<Record<OrderStatus, OrderStatus[]>> = {
    PendingConfirmation: ['Confirmed'], Confirmed: ['Packing'], Packing: ['Shipped'], Shipped: ['Delivered'],
  };
  const custom: Partial<Record<OrderStatus, OrderStatus[]>> = {
    QuoteApproved: ['InProduction'], InProduction: ['QualityCheck'], QualityCheck: ['InProduction', 'Packing'],
    Packing: ['Shipped'], Shipped: ['Delivered'],
  };
  const next = [...((type === 'Ready' ? ready : custom)[status] ?? [])];
  if (cancel.includes(status)) next.push('Cancelled');
  return next;
}

// ---------- inventory tab: every size/colour with its stock; stock edits reuse updateVariant (send the row's version)
export type InventoryRow = Schemas['InventoryRow'];
export type InventoryQuery = { q?: string; status?: 'all' | 'low' | 'out' | 'in' | 'attention'; categoryId?: number; colorId?: number; size?: string; page?: number; pageSize?: number };
export const getInventory = (query: InventoryQuery) => call(api.GET('/api/admin/inventory', { params: { query } }));

// Stock is only changed here, always with a reason; every change is kept in the variant's history.
export type StockReason = Schemas['StockReason'];
export type StockMovement = Schemas['StockMovementDto'];
export const adjustStock = (variantId: number, body: Schemas['AdjustStockCommand']) =>
  call(api.POST('/api/admin/variants/{id}/stock', { params: { path: { id: variantId } }, body }));
export const getStockMovements = (variantId: number) =>
  call(api.GET('/api/admin/variants/{id}/movements', { params: { path: { id: variantId } } }));
