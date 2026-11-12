'use client';

import React, { useEffect, useState, FormEvent } from 'react';
import { useZamzamStore } from '@/store/useZamzamStore';
import { adminTabsLabels, assetPath } from '@/lib/labels';
import { ApiError, errorText } from '@/lib/api';
import { login } from '@/lib/admin';
import type { AdminTab } from '@/types/zamzam';
import AdminOverview from './AdminOverview';
import AdminCategories from './AdminCategories';
import AdminProducts from './AdminProducts';
import AdminInventory from './AdminInventory';
import AdminProductEditor from './AdminProductEditor';
import AdminOrders from './AdminOrders';
import AdminSettings from './AdminSettings';
import AdminColors from './AdminColors';
import AdminZones from './AdminZones';
import AdminTailoringCatalog from './AdminTailoringCatalog';
import AdminPricing from './AdminPricing';
import AdminPassword from './AdminPassword';
import { ConfirmProvider, Modal } from '@/components/admin/ui';

export default function AdminView() {
  const user = useZamzamStore((state) => state.user);
  const authChecked = useZamzamStore((state) => state.authChecked);
  const checkSession = useZamzamStore((state) => state.checkSession);
  const setUser = useZamzamStore((state) => state.setUser);
  const logout = useZamzamStore((state) => state.logout);
  const adminTab = useZamzamStore((state) => state.adminTab);
  const setAdminTab = useZamzamStore((state) => state.setAdminTab);
  const productModal = useZamzamStore((state) => state.productModal);
  const closeProductModal = useZamzamStore((state) => state.closeProductModal);
  const go = useZamzamStore((state) => state.go);
  const t = useZamzamStore((state) => state.t);

  // The cookie may still be valid from an earlier visit; and any 401 later sends the owner back to the login.
  useEffect(() => {
    if (!authChecked) void checkSession();
    const signedOut = () => setUser(null);
    window.addEventListener('zamzam:signed-out', signedOut);
    return () => window.removeEventListener('zamzam:signed-out', signedOut);
  }, [authChecked, checkSession, setUser]);

  if (!authChecked) {
    return <div className="max-w-md mx-auto my-24 h-40 rounded-2xl bg-[#f7f3eb] animate-pulse" aria-busy="true" />;
  }
  if (!user) return <LoginForm />;

  // The first password from setup must be changed before anything else.
  const tab: AdminTab = user.mustChangePassword ? 'password' : adminTab;

  const adminBack = () => {
    if (tab !== 'overview') {
      setAdminTab('overview');
    } else {
      go('home');
    }
  };

  const groups: [string, string, AdminTab[]][] = [
    ['إدارة المتجر', 'STORE', ['overview', 'orders', 'products', 'warehouse', 'categories', 'colors']],
    ['التفصيل', 'TAILORING', ['tailoring', 'pricing']],
    ['الإعدادات', 'SETTINGS', ['zones', 'settings', 'password']],
  ];

  return (
    <ConfirmProvider>
    <div className="grid grid-cols-1 md:grid-cols-[250px_1fr] min-h-[calc(100vh-120px)] bg-[#f8f6f2]">
      <aside className="bg-[#1e3046] text-white p-6 flex flex-col justify-between border-b md:border-b-0 md:border-e border-white/10">
        <div className="space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-white/15">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={assetPath('assets/logo-mark-160.webp')} alt="Zamzam Fashion" className="w-12 h-12 object-contain" />
            <div>
              <strong className="block text-sm font-serif font-bold text-white">Zamzam Fashion</strong>
              <small className="text-[14px] tracking-wider text-[#d9c5a4] uppercase font-semibold">STORE MANAGEMENT</small>
            </div>
          </div>

          {groups.map(([ar, en, keys]) => (
            <div key={en} className="space-y-1">
              <div className="text-[14px] tracking-widest uppercase font-bold text-[#c1c9d1] px-3 pb-1">{t(ar, en)}</div>
              {keys.map((key) => {
                const isActive = tab === key;
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={user.mustChangePassword && key !== 'password'}
                    className={`w-full text-start flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-bold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                      isActive ? 'bg-[#c4a274] text-[#17283e]' : 'text-[#d7dfe7] hover:bg-white/10'
                    }`}
                    onClick={() => setAdminTab(key)}
                  >
                    <span className="w-2 h-2 rounded-full bg-current opacity-60" />
                    <span>{t(...adminTabsLabels[key])}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="pt-6 border-t border-white/15 space-y-2 mt-8 md:mt-0">
          <p className="px-2 text-xs text-[#c1c9d1] truncate" title={user.email}>{user.fullName || user.email}</p>
          <button type="button" className="w-full text-start text-xs text-[#d7dfe7] hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors cursor-pointer" onClick={() => go('home')}>
            ↗ {t('عرض المتجر', 'View storefront')}
          </button>
          <button type="button" className="w-full text-start text-xs text-rose-300 hover:text-rose-200 p-2 rounded-lg hover:bg-rose-950/40 transition-colors cursor-pointer" onClick={() => void logout()}>
            {t('خروج', 'Sign out')}
          </button>
        </div>
      </aside>

      <main className="p-6 sm:p-10 min-w-0 max-w-[1450px] w-full mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#e9e4dc]">
          <div>
            <span className="text-xs font-bold tracking-widest text-[#9c7c54] uppercase">ZAMZAM FASHION / ADMIN</span>
            <h2 className="text-2xl sm:text-3xl font-serif font-bold text-[#142b4a] mt-0.5">
              {t(...(adminTabsLabels[tab] || adminTabsLabels.overview))}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {!user.mustChangePassword && (
              <button type="button" className="px-4 py-2 rounded-lg border border-[#cdbb9e] bg-white hover:bg-[#f7f3eb] text-xs font-bold text-[#142b4a] transition-colors cursor-pointer" onClick={adminBack}>
                {t('رجوع', 'Back')}
              </button>
            )}
            <button type="button" className="px-4 py-2 rounded-lg bg-[#142b4a] hover:bg-[#1e3a61] text-xs font-bold text-white transition-colors cursor-pointer" onClick={() => go('home')}>
              ↗ {t('عرض المتجر', 'View store')}
            </button>
          </div>
        </div>

        {user.mustChangePassword && (
          <div className="bg-[#fff8e9] border border-[#ead8b6] text-[#79613f] p-3.5 rounded-xl text-xs">
            {t('هذه كلمة المرور الأولى. غيّريها الآن لحماية المتجر، ثم تفتح باقي الشاشات.', 'This is your first password. Change it now to protect the store; then the other screens open.')}
          </div>
        )}

        {tab === 'overview' && <AdminOverview />}
        {tab === 'categories' && <AdminCategories />}
        {tab === 'products' && <AdminProducts />}
        {tab === 'warehouse' && <AdminInventory />}
        {tab === 'orders' && <AdminOrders />}
        {tab === 'colors' && <AdminColors />}
        {tab === 'zones' && <AdminZones />}
        {tab === 'tailoring' && <AdminTailoringCatalog />}
        {tab === 'pricing' && <AdminPricing />}
        {tab === 'settings' && <AdminSettings />}
        {tab === 'password' && <AdminPassword />}
      </main>
    </div>

    {/* The product pop-up: opened from Products, Overview or a category's “＋ Add item”. */}
    <Modal
      open={!!productModal}
      size="xl"
      title={productModal?.id ? t('تعديل المنتج', 'Edit product') : t('منتج جديد', 'New product')}
      subtitle={t('البيانات، ثم المقاسات والمخزون، ثم الصور', 'Details, then sizes & stock, then photos')}
      onClose={closeProductModal}
    >
      <AdminProductEditor />
    </Modal>
    </ConfirmProvider>
  );
}

function LoginForm() {
  const t = useZamzamStore((state) => state.t);
  const setUser = useZamzamStore((state) => state.setUser);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      setUser(await login(email.trim(), password, remember));
      setPassword('');
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const message = () => {
    if (!(error instanceof ApiError)) return error ? errorText(error, t) : '';
    if (error.code === 'INVALID_CREDENTIALS') return t('البريد أو كلمة المرور غير صحيحة', 'Wrong email or password');
    if (error.code === 'LOCKED_OUT') {
      const minutes = Math.ceil(Number(error.problem.retryAfterSeconds ?? 900) / 60);
      return t(`تم إيقاف الدخول مؤقتًا بعد محاولات خاطئة. حاولي بعد ${minutes} دقيقة.`, `Too many wrong passwords. Try again in ${minutes} minutes.`);
    }
    return errorText(error, t);
  };

  const input = 'border border-[#cdbb9e] rounded-lg p-3 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#b99664]';
  return (
    <div className="max-w-md mx-auto my-16 px-4">
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-[#d6c2a7] shadow-md space-y-5">
        <div className="text-center space-y-1">
          <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#142b4a]">{t('دخول الإدارة', 'Admin sign in')}</h2>
          <p className="text-xs text-[#77808b]">Zamzam Fashion • Management Studio</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <label className="flex flex-col gap-1.5 text-xs sm:text-sm font-bold text-[#2d3540]">
            <span>{t('البريد الإلكتروني', 'Email')}</span>
            <input type="email" required autoComplete="username" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
          </label>
          <label className="flex flex-col gap-1.5 text-xs sm:text-sm font-bold text-[#2d3540]">
            <span>{t('كلمة المرور', 'Password')}</span>
            <input type="password" required autoComplete="current-password" dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} className={input} />
          </label>
          <label className="flex items-center gap-2 text-xs font-semibold text-[#2d3540] cursor-pointer">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="accent-[#142b4a] w-4 h-4" />
            <span>{t('تذكرني على هذا الجهاز', 'Keep me signed in on this device')}</span>
          </label>
          {error ? <p role="alert" className="text-xs font-bold text-[#a72f3e] bg-red-50 border border-red-200 rounded-lg p-2.5">{message()}</p> : null}
          <button type="submit" disabled={busy} className="w-full py-3 rounded-lg bg-[#142b4a] hover:bg-[#1e3a61] disabled:opacity-60 text-white text-xs sm:text-sm font-bold transition-colors cursor-pointer">
            {busy ? '…' : t('دخول', 'Sign in')}
          </button>
        </form>
      </div>
    </div>
  );
}
