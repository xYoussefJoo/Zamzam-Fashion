'use client';

// The dashboard's visual identity in one place: navy #142b4a, gold #b99664, cream #f7f3eb.
// Every admin screen builds from these pieces, so they all look and behave the same.
import React, { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import {Metadata} from "next";
import { useZamzamStore } from '@/store/useZamzamStore';

export const metadata: Metadata = {
  title: 'ZAMZAM FASHION',
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

// ---------- class tokens
export const ui = {
  card: 'bg-white rounded-2xl border border-[#e9e4dc] shadow-2xs',
  cardPad: 'p-6 sm:p-7',
  input: 'w-full border border-[#dedbd5] rounded-xl px-3 py-2.5 bg-white text-[#263548] text-sm focus:outline-none focus:ring-2 focus:ring-[#b99664] focus:border-[#b99664] transition-colors',
  inputSm: 'border border-[#dedbd5] rounded-lg px-2 py-1.5 bg-white text-[#263548] text-xs focus:outline-none focus:ring-2 focus:ring-[#b99664]',
  label: 'flex flex-col gap-1.5 text-xs font-bold text-[#2d3540]',
  hint: 'text-[11px] font-medium text-[#77808b]',
  error: 'text-[11px] font-semibold text-[#a72f3e]',
};

const buttonStyles = {
  primary: 'bg-[#142b4a] hover:bg-[#1e3a61] text-white shadow-sm',
  gold: 'bg-[#b99664] hover:bg-[#a6844f] text-white shadow-sm',
  secondary: 'bg-white hover:bg-[#f7f3eb] text-[#142b4a] border border-[#cdbb9e]',
  danger: 'bg-[#fff7f7] hover:bg-rose-100 text-[#a34c4c] border border-[#efc9c9]',
  dangerSolid: 'bg-[#a72f3e] hover:bg-[#8e2533] text-white',
  ghost: 'text-[#142b4a] hover:bg-[#f7f3eb]',
} as const;

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof buttonStyles;
  size?: 'sm' | 'md';
  busy?: boolean;
};

export function Button({ variant = 'primary', size = 'md', busy, disabled, className = '', children, type = 'button', ...rest }: ButtonProps) {
  const sizes = size === 'sm' ? 'px-3 py-1.5 text-[11px] rounded-lg' : 'px-5 py-2.5 text-xs rounded-xl';
  return (
    <button
      type={type}
      disabled={disabled || busy}
      className={`${sizes} ${buttonStyles[variant]} font-bold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b99664] ${className}`}
      {...rest}
    >
      {busy ? '…' : children}
    </button>
  );
}

export function Field({ label, hint, error, className = '', children }: { label: React.ReactNode; hint?: React.ReactNode; error?: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`${ui.label} ${className}`}>
      <span>{label}</span>
      {children}
      {hint && <small className={ui.hint}>{hint}</small>}
      {error && <small className={ui.error}>{error}</small>}
    </label>
  );
}

export function Card({ title, actions, className = '', children }: { title?: React.ReactNode; actions?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <section className={`${ui.card} ${ui.cardPad} space-y-4 ${className}`}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {title && <h3 className="text-base sm:text-lg font-serif font-bold text-[#142b4a]">{title}</h3>}
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

// The top of every list screen: what it is, one line of help, and its "＋ Add" button.
export function PageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className={`${ui.card} ${ui.cardPad} flex flex-col sm:flex-row sm:items-center justify-between gap-4`}>
      <div className="space-y-1">
        <span className="text-[11px] font-bold tracking-[0.2em] text-[#9c7c54] uppercase">{eyebrow}</span>
        <h3 className="text-lg sm:text-xl font-serif font-bold text-[#142b4a]">{title}</h3>
        {description && <p className="text-xs text-[#79808b] max-w-2xl">{description}</p>}
      </div>
      {action && <div className="shrink-0 self-start sm:self-auto">{action}</div>}
    </div>
  );
}

export function EmptyState({ icon = '✦', title, children }: { icon?: string; title: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="text-center py-14 space-y-3">
      <span className="text-4xl block text-[#b99664] select-none" aria-hidden="true">{icon}</span>
      <p className="text-sm font-bold text-[#142b4a]">{title}</p>
      {children}
    </div>
  );
}

export function LoadError({ error, onRetry, text }: { error: unknown; onRetry: () => void; text: string }) {
  const t = useZamzamStore((state) => state.t);
  if (!error) return null;
  return (
    <div className={`${ui.card} ${ui.cardPad} space-y-3`}>
      <p className="text-sm font-bold text-[#a72f3e]">{text}</p>
      <Button onClick={onRetry}>{t('إعادة المحاولة', 'Try again')}</Button>
    </div>
  );
}

export const Skeleton = ({ className = 'h-40' }: { className?: string }) => (
  <div className={`rounded-2xl bg-[#f1ebe0] animate-pulse ${className}`} aria-busy="true" />
);

// ---------- pop-up window (native <dialog>): the page behind darkens and blurs so the owner focuses on the form.
// Esc, ✕, a click outside or Cancel close it; with unsaved changes it asks first.
type ModalApi = { requestClose: () => void; setDirty: (dirty: boolean) => void };
const ModalContext = createContext<ModalApi | null>(null);

export const useModal = () => useContext(ModalContext);

/** For forms inside a Modal: keeps the window's "unsaved changes" flag in step with the form. */
export function useModalDirty(dirty: boolean) {
  const modal = useModal();
  useEffect(() => {
    modal?.setDirty(dirty);
    return () => modal?.setDirty(false);
  }, [dirty, modal]);
  return modal;
}

type ModalProps = { open: boolean; title: React.ReactNode; subtitle?: React.ReactNode; onClose: () => void; size?: 'md' | 'lg' | 'xl'; children: React.ReactNode };

export function Modal({ open, title, subtitle, onClose, size = 'md', children }: ModalProps) {
  const t = useZamzamStore((state) => state.t);
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const dirty = useRef(false);
  const close = useRef(onClose);
  const [asking, setAsking] = useState(false);

  useEffect(() => { close.current = onClose; }, [onClose]);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const api = useMemo<ModalApi>(() => ({
    requestClose: () => (dirty.current ? setAsking(true) : close.current()),
    setDirty: (value) => { dirty.current = value; },
  }), []);

  const width = size === 'xl' ? 'max-w-[1100px]' : size === 'lg' ? 'max-w-[820px]' : 'max-w-[560px]';
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={`zz-modal w-[calc(100%-2rem)] ${width} max-h-[calc(100dvh-2rem)] p-0 m-auto rounded-3xl bg-[#fbf8f3] shadow-2xl border border-[#e8dfd1] text-start overflow-hidden`}
      onCancel={(e) => { e.preventDefault(); api.requestClose(); }}
      onClick={(e) => { if (e.target === e.currentTarget) api.requestClose(); }}
    >
      <div className="flex flex-col max-h-[calc(100dvh-2rem)]">
        <header className="flex items-start justify-between gap-4 px-6 py-4 bg-[#142b4a] text-white border-b-2 border-[#b99664]">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-serif font-bold truncate">{title}</h2>
            {subtitle && <p className="text-[11px] text-[#d9c5a4] mt-0.5">{subtitle}</p>}
          </div>
          <button type="button" onClick={api.requestClose} aria-label={t('إغلاق', 'Close')}
            className="w-8 h-8 shrink-0 rounded-full bg-white/10 hover:bg-white/20 text-white text-sm cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b99664]">✕</button>
        </header>
        <div className="overflow-y-auto p-5 sm:p-6">
          <ModalContext.Provider value={api}>{open && children}</ModalContext.Provider>
        </div>
      </div>

      <ConfirmDialog
        open={asking}
        title={t('إغلاق بدون حفظ؟', 'Close without saving?')}
        message={t('التعديلات التي لم تُحفظ ستضيع.', 'Your unsaved changes will be lost.')}
        confirmLabel={t('إغلاق بدون حفظ', 'Close without saving')}
        danger
        onClose={() => setAsking(false)}
        onConfirm={() => { setAsking(false); close.current(); }}
      />
    </dialog>
  );
}

// ---------- "Are you sure?" before anything destructive.
type ConfirmProps = { open: boolean; title: string; message?: string; confirmLabel: string; danger?: boolean; onConfirm: () => void; onClose: () => void };

export function ConfirmDialog({ open, title, message, confirmLabel, danger, onConfirm, onClose }: ConfirmProps) {
  const t = useZamzamStore((state) => state.t);
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog ref={ref} aria-labelledby={titleId} onClose={onClose}
      className="zz-modal w-[calc(100%-2rem)] max-w-[420px] p-0 m-auto rounded-2xl bg-white shadow-2xl border border-[#e8dfd1] text-start">
      <div className="p-6 space-y-3">
        <h2 id={titleId} className="text-base font-serif font-bold text-[#142b4a]">{title}</h2>
        {message && <p className="text-sm text-[#5e605b] leading-relaxed">{message}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} autoFocus>{t('إلغاء', 'Cancel')}</Button>
          <Button variant={danger ? 'dangerSolid' : 'primary'} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </dialog>
  );
}

// ---------- await confirm({...}) from anywhere in the dashboard (replaces window.confirm).
type ConfirmOptions = { title: string; message?: string; confirmLabel: string; danger?: boolean };
const ConfirmContext = createContext<(options: ConfirmOptions) => Promise<boolean>>(async () => false);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [request, setRequest] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null);
  const confirm = useCallback((options: ConfirmOptions) => new Promise<boolean>((resolve) => setRequest({ ...options, resolve })), []);
  const finish = (ok: boolean) => {
    request?.resolve(ok);
    setRequest(null);
  };
  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmDialog
        open={!!request}
        title={request?.title ?? ''}
        message={request?.message}
        confirmLabel={request?.confirmLabel ?? ''}
        danger={request?.danger}
        onClose={() => finish(false)}
        onConfirm={() => finish(true)}
      />
    </ConfirmContext.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmContext);
