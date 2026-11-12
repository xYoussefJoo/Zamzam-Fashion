'use client';

import React, { useState, FormEvent } from 'react';
import { useZamzamStore } from '@/store/useZamzamStore';
import { ApiError, errorText } from '@/lib/api';
import { changePassword, me } from '@/lib/admin';

// #4 — at least 10 characters; very common passwords are refused by the server.
export default function AdminPassword() {
  const t = useZamzamStore((state) => state.t);
  const setUser = useZamzamStore((state) => state.setUser);
  const showToast = useZamzamStore((state) => state.showToast);
  const setAdminTab = useZamzamStore((state) => state.setAdminTab);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const mismatch = repeat.length > 0 && next !== repeat;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (mismatch) return;
    setBusy(true);
    setError(undefined);
    try {
      await changePassword(current, next);
      setUser(await me());
      setCurrent(''); setNext(''); setRepeat('');
      showToast(t('تم تغيير كلمة المرور', 'Password changed'), 'success');
      setAdminTab('overview');
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const message = () => {
    if (error instanceof ApiError && error.code === 'VALIDATION_FAILED') {
      const all = Object.values(error.problem.errors ?? {}).flat();
      return all.length ? all.join(' ') : error.message;
    }
    return errorText(error, t);
  };

  const input = 'border border-[#cdbb9e] rounded-lg p-3 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#b99664]';
  return (
    <form onSubmit={submit} className="max-w-md bg-white p-6 rounded-2xl border border-[#e9e4dc] space-y-4">
      <label className="flex flex-col gap-1.5 text-xs font-bold text-[#2d3540]">
        <span>{t('كلمة المرور الحالية', 'Current password')}</span>
        <input type="password" required autoComplete="current-password" dir="ltr" value={current} onChange={(e) => setCurrent(e.target.value)} className={input} />
      </label>
      <label className="flex flex-col gap-1.5 text-xs font-bold text-[#2d3540]">
        <span>{t('كلمة المرور الجديدة (10 أحرف على الأقل)', 'New password (10+ characters)')}</span>
        <input type="password" required minLength={10} autoComplete="new-password" dir="ltr" value={next} onChange={(e) => setNext(e.target.value)} className={input} />
      </label>
      <label className="flex flex-col gap-1.5 text-xs font-bold text-[#2d3540]">
        <span>{t('أعيدي كتابة كلمة المرور الجديدة', 'Repeat the new password')}</span>
        <input type="password" required minLength={10} autoComplete="new-password" dir="ltr" value={repeat} onChange={(e) => setRepeat(e.target.value)} className={input} />
        {mismatch && <small className="text-xs text-[#a72f3e]">{t('غير متطابقة', "Doesn't match")}</small>}
      </label>
      {error ? <p role="alert" className="text-xs font-bold text-[#a72f3e]">{message()}</p> : null}
      <button type="submit" disabled={busy || mismatch} className="px-6 py-3 rounded-lg bg-[#142b4a] hover:bg-[#1e3a61] disabled:opacity-60 text-white text-xs font-bold cursor-pointer">
        {busy ? '…' : t('تغيير كلمة المرور', 'Change password')}
      </button>
    </form>
  );
}
