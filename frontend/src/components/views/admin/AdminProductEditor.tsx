'use client';

import React, { useRef, useState, ChangeEvent, FormEvent } from 'react';
import { useZamzamStore } from '@/store/useZamzamStore';
import { useApi } from '@/lib/useApi';
import { ApiError, errorText, fieldError } from '@/lib/api';
import {
  addVariant, createProduct, deleteImage, deleteVariant, getAdminCategories, getAdminProduct, getColors,
  updateProduct, updateVariant, uploadImage, type AdminProduct, type AdminVariant,
} from '@/lib/admin';
import { adminSizes } from '@/lib/labels';
import { pick } from '@/lib/shop';
import { Button, ui, useConfirm, useModalDirty } from '@/components/admin/ui';
import Select from '@/components/ui/Select';

const MAX_PHOTO = 5 * 1024 * 1024;
const MAX_IMAGES = 10;

// #22–#30 — the product pop-up: details, its size × color variants (price each) and its photos.
// Stock is owned by the Warehouse tab: here it is shown read-only, and new variants start at 0.
// A new product saves its details first; the same pop-up then continues with stock and photos.
export default function AdminProductEditor() {
  const editingProductId = useZamzamStore((state) => state.productModal?.id ?? null);
  const t = useZamzamStore((state) => state.t);
  const product = useApi(() => getAdminProduct(editingProductId!), [editingProductId], !!editingProductId);

  if (editingProductId && product.error) {
    return (
      <section className="bg-white p-6 rounded-2xl border border-[#e9e4dc] space-y-2">
        <p className="text-sm font-bold text-[#a72f3e]">{errorText(product.error, t)}</p>
        <button type="button" onClick={product.reload} className="px-4 py-2 rounded-lg bg-[#142b4a] text-white text-xs font-bold cursor-pointer">{t('إعادة المحاولة', 'Try again')}</button>
      </section>
    );
  }
  if (editingProductId && !product.data) return <div className="h-96 rounded-2xl bg-[#f7f3eb] animate-pulse" />;

  return (
    <div className="space-y-6">
      <DetailsForm key={product.data?.id ?? 'new'} product={product.data} onSaved={product.reload} />
      {product.data && (
        <>
          <Variants product={product.data} onChanged={product.reload} />
          <Photos product={product.data} onChanged={product.reload} />
        </>
      )}
    </div>
  );
}

function DetailsForm({ product, onSaved }: { product?: AdminProduct; onSaved: () => void }) {
  const lang = useZamzamStore((state) => state.lang);
  const editorCategoryId = useZamzamStore((state) => state.productModal?.categoryId ?? null);
  const setProductModalId = useZamzamStore((state) => state.setProductModalId);
  const t = useZamzamStore((state) => state.t);
  const showToast = useZamzamStore((state) => state.showToast);
  const categories = useApi(getAdminCategories, []);
  const colors = useApi(getColors, []);

  const [categoryId, setCategoryId] = useState<number | ''>(product?.categoryId ?? editorCategoryId ?? '');
  const [nameAr, setNameAr] = useState(product?.nameAr ?? '');
  const [nameEn, setNameEn] = useState(product?.nameEn ?? '');
  const [slug, setSlug] = useState(product?.slug ?? '');
  const [descriptionAr, setDescriptionAr] = useState(product?.descriptionAr ?? '');
  const [descriptionEn, setDescriptionEn] = useState(product?.descriptionEn ?? '');
  const [basePrice, setBasePrice] = useState(product ? String(product.basePrice) : '');
  const [isVisible, setIsVisible] = useState(product?.isVisible ?? true);
  // New products only: the first variants, every ticked size × every ticked color.
  const [sizes, setSizes] = useState<string[]>(['S', 'M', 'L']);
  const [colorIds, setColorIds] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();

  const initialKey = useState(() => JSON.stringify([categoryId, nameAr, nameEn, slug, descriptionAr, descriptionEn, basePrice, isVisible]))[0];
  const modal = useModalDirty(JSON.stringify([categoryId, nameAr, nameEn, slug, descriptionAr, descriptionEn, basePrice, isVisible]) !== initialKey);
  const allCategories = (categories.data ?? []).flatMap((c) => [c, ...c.children]);
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!categoryId) {
      showToast(t('اختاري القسم', 'Choose a category'), 'error');
      return;
    }
    const body = {
      categoryId: Number(categoryId),
      nameAr: nameAr.trim(),
      nameEn: nameEn.trim() || nameAr.trim(),
      slug: slug.trim() || null,
      descriptionAr: descriptionAr.trim() || null,
      descriptionEn: descriptionEn.trim() || null,
      basePrice: Number(basePrice),
      isVisible,
    };
    setBusy(true);
    setError(undefined);
    try {
      if (product) {
        await updateProduct(product.id, body);
        showToast(t('تم تحديث المنتج', 'Product updated'), 'success');
        onSaved();
      } else {
        const created = await createProduct({
          ...body,
          variants: sizes.flatMap((size) => colorIds.map((colorId) => ({ size, colorId, priceOverride: null, sku: null }))),
        });
        showToast(t('تم إنشاء المنتج. أضيفي الصور الآن', 'Product created. Add its photos now'), 'success');
        setProductModalId(created.id); // the pop-up continues on the saved product: variants and photos
      }
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const input = ui.input;
  const msg = (f: string) => {
    const m = fieldError(error, f);
    return m ? <small className="text-xs text-[#a72f3e]">{m}</small> : null;
  };

  return (
    <section className={`${ui.card} p-5 sm:p-6 space-y-6`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <span className="text-xs font-bold tracking-widest text-[#9c7c54] uppercase">PRODUCT</span>
          <h3 className="text-lg sm:text-xl font-serif font-bold text-[#142b4a] mt-0.5">
            {product ? t('تعديل بيانات المنتج', 'Edit product details') : t('منتج جديد', 'New product')}
          </h3>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="flex flex-col gap-1.5 text-xs font-bold text-[#2d3540]">
          <span>{t('القسم', 'Category')} *</span>
          <Select required value={categoryId} onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : '')} className={input}>
            <option value="">{t('اختاري القسم', 'Choose a category')}</option>
            {allCategories.map((c) => (
              <option key={c.id} value={c.id}>{c.parentId ? '↳ ' : ''}{pick(lang, c.nameAr, c.nameEn)}</option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-bold text-[#2d3540]">
          <span>{t('السعر الأساسي (ج.م)', 'Base price (EGP)')} *</span>
          <input required type="number" min={1} step="0.01" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} className={input} />
          {msg('basePrice')}
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-bold text-[#2d3540]">
          <span>{t('الاسم بالعربي', 'Arabic name')} *</span>
          <input required maxLength={150} value={nameAr} onChange={(e) => setNameAr(e.target.value)} className={input} />
          {msg('nameAr')}
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-bold text-[#2d3540]">
          <span>{t('الاسم بالإنجليزي', 'English name')} *</span>
          <input required maxLength={150} dir="ltr" value={nameEn} onChange={(e) => setNameEn(e.target.value)} className={input} />
          {msg('nameEn')}
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-bold text-[#2d3540]">
          <span>{t('الوصف بالعربي', 'Arabic description')}</span>
          <textarea maxLength={4000} value={descriptionAr} onChange={(e) => setDescriptionAr(e.target.value)} className={`${input} min-h-[90px]`} />
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-bold text-[#2d3540]">
          <span>{t('الوصف بالإنجليزي', 'English description')}</span>
          <textarea maxLength={4000} dir="ltr" value={descriptionEn} onChange={(e) => setDescriptionEn(e.target.value)} className={`${input} min-h-[90px]`} />
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-bold text-[#2d3540]">
          <span>{t('الرابط المختصر (اختياري)', 'Link name (slug, optional)')}</span>
          <input dir="ltr" maxLength={150} placeholder="modest-abaya" value={slug} onChange={(e) => setSlug(e.target.value)} className={input} />
          {msg('slug')}
        </label>
        <label className="flex items-center gap-2 text-sm font-bold text-[#2d3540] cursor-pointer pt-6">
          <input type="checkbox" checked={isVisible} onChange={(e) => setIsVisible(e.target.checked)} className="accent-[#142b4a] w-4 h-4" />
          <span>{t('ظاهر في المتجر', 'Shown in the shop')}</span>
        </label>

        {!product && (
          <div className="sm:col-span-2 space-y-4 pt-4 border-t border-[#efe9df]">
            <p className="text-xs text-[#79808b]">
              {t('اختاري المقاسات والألوان: سيتم إنشاء كل مقاس بكل لون بنفس الكمية المبدئية، وتقدري تعدلي كل واحد بعد الحفظ.',
                'Tick sizes and colors: every size is created in every color with the starting stock; you can change each one after saving.')}
            </p>
            <div className="flex flex-wrap gap-2" role="group" aria-label={t('المقاسات', 'Sizes')}>
              {adminSizes.map((s) => (
                <button key={s} type="button" aria-pressed={sizes.includes(s)} onClick={() => setSizes(toggle(sizes, s))}
                  className={`min-w-[44px] h-[38px] px-3 rounded-lg text-xs font-bold cursor-pointer ${sizes.includes(s) ? 'bg-[#142b4a] text-white' : 'bg-[#f7f3eb] text-[#142b4a] border border-[#e8dfd1]'}`}>
                  {s}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2" role="group" aria-label={t('الألوان', 'Colors')}>
              {(colors.data ?? []).map((c) => (
                <button key={c.id} type="button" aria-pressed={colorIds.includes(c.id)} onClick={() => setColorIds(toggle(colorIds, c.id))}
                  className={`px-3 h-[38px] rounded-lg text-xs font-bold cursor-pointer inline-flex items-center gap-2 ${colorIds.includes(c.id) ? 'bg-[#142b4a] text-white' : 'bg-[#f7f3eb] text-[#142b4a] border border-[#e8dfd1]'}`}>
                  <span className="w-3.5 h-3.5 rounded-full border border-black/10" style={{ backgroundColor: c.hex }} />
                  {pick(lang, c.nameAr, c.nameEn)}
                </button>
              ))}
              {colors.data?.length === 0 && <small className="text-xs text-[#77808b]">{t('أضيفي ألوانًا من شاشة الألوان أولاً', 'Add colors in the Colors screen first')}</small>}
            </div>
            <p className="text-xs font-bold text-[#142b4a]">{t(`سيتم إنشاء ${sizes.length * colorIds.length} مقاس/لون`, `${sizes.length * colorIds.length} variants will be created`)}</p>
          </div>
        )}

        {error && !(error instanceof ApiError && error.problem.errors) ? (
          <p role="alert" className="sm:col-span-2 text-xs font-bold text-[#a72f3e]">
            {error instanceof ApiError && error.code === 'DUPLICATE' ? t('الرابط المختصر مستخدم لمنتج آخر', 'That link name is used by another product') : errorText(error, t)}
          </p>
        ) : null}

        <div className="sm:col-span-2">
          <div className="flex gap-2">
            <Button type="submit" busy={busy}>{product ? t('حفظ التعديلات', 'Save changes') : t('حفظ المنتج والمتابعة', 'Save and continue')}</Button>
            <Button variant="secondary" onClick={() => modal?.requestClose()}>{product ? t('إغلاق', 'Close') : t('إلغاء', 'Cancel')}</Button>
          </div>
        </div>
      </form>
    </section>
  );
}

function Variants({ product, onChanged }: { product: AdminProduct; onChanged: () => void }) {
  const lang = useZamzamStore((state) => state.lang);
  const t = useZamzamStore((state) => state.t);
  const showToast = useZamzamStore((state) => state.showToast);
  const colors = useApi(getColors, []);
  const [newSize, setNewSize] = useState('M');
  const [newColor, setNewColor] = useState<number | ''>('');
  const [newPrice, setNewPrice] = useState('');
  const [busy, setBusy] = useState(false);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (!newColor) return;
    setBusy(true);
    try {
      await addVariant(product.id, { size: newSize, colorId: Number(newColor), priceOverride: newPrice ? Number(newPrice) : null, sku: null });
      showToast(t('تمت إضافة المقاس/اللون', 'Variant added'), 'success');
      onChanged();
    } catch (err) {
      showToast(err instanceof ApiError && err.code === 'DUPLICATE' ? t('هذا المقاس بهذا اللون موجود بالفعل', 'That size in that color already exists') : errorText(err, t), 'error');
    } finally {
      setBusy(false);
    }
  };

  const select = 'border border-[#dedbd5] rounded-lg p-2 bg-white text-xs';
  return (
    <section className={`${ui.card} p-5 sm:p-6 space-y-4`}>
      <h3 className="text-lg font-serif font-bold text-[#142b4a]">{t('المقاسات والألوان', 'Sizes & colors')}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-[#77808b] uppercase border-b border-[#efe9df]">
            <tr>
              <th className="py-2 text-start">{t('المقاس', 'Size')}</th>
              <th className="py-2 text-start">{t('اللون', 'Color')}</th>
              <th className="py-2 text-start">SKU</th>
              <th className="py-2 text-start">{t('المخزون', 'Stock')}</th>
              <th className="py-2 text-start">{t('سعر خاص', 'Own price')}</th>
              <th />
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f1ece4]">
            {product.variants.map((v) => <VariantRow key={`${v.id}-${v.version}`} variant={v} basePrice={product.basePrice} onChanged={onChanged} />)}
          </tbody>
        </table>
        {product.variants.length === 0 && <p className="text-xs text-[#77808b] py-4">{t('لا توجد مقاسات بعد: المنتج لن يظهر للبيع قبل إضافتها.', 'No variants yet: the product can’t be bought until you add some.')}</p>}
      </div>

      <form onSubmit={add} className="flex flex-wrap items-end gap-3 pt-3 border-t border-[#efe9df]">
        <label className="flex flex-col gap-1 text-xs font-bold text-[#2d3540]">
          <span>{t('المقاس', 'Size')}</span>
          <Select value={newSize} onChange={(e) => setNewSize(e.target.value)} className={select}>{adminSizes.map((s) => <option key={s}>{s}</option>)}</Select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-bold text-[#2d3540]">
          <span>{t('اللون', 'Color')}</span>
          <Select required value={newColor} onChange={(e) => setNewColor(e.target.value ? Number(e.target.value) : '')} className={select}>
            <option value="">—</option>
            {(colors.data ?? []).map((c) => <option key={c.id} value={c.id}>{pick(lang, c.nameAr, c.nameEn)}</option>)}
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-bold text-[#2d3540] w-28">
          <span>{t('سعر خاص (اختياري)', 'Own price (optional)')}</span>
          <input type="number" min={1} step="0.01" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} className={select} />
        </label>
        <button type="submit" disabled={busy || !newColor} className="px-4 py-2 rounded-lg bg-[#142b4a] text-white text-xs font-bold disabled:opacity-50 cursor-pointer">＋ {t('إضافة', 'Add')}</button>
      </form>
    </section>
  );
}

function VariantRow({ variant, basePrice, onChanged }: { variant: AdminVariant; basePrice: number; onChanged: () => void }) {
  const lang = useZamzamStore((state) => state.lang);
  const t = useZamzamStore((state) => state.t);
  const money = useZamzamStore((state) => state.money);
  const showToast = useZamzamStore((state) => state.showToast);
  const [price, setPrice] = useState(variant.priceOverride != null ? String(variant.priceOverride) : '');
  const [busy, setBusy] = useState(false);
  const dirty = price !== (variant.priceOverride != null ? String(variant.priceOverride) : '');

  const save = async () => {
    setBusy(true);
    try {
      // The version from when this row was loaded: if someone changed it since, the server says so.
      await updateVariant(variant.id, { size: variant.size, colorId: variant.color.id, priceOverride: price ? Number(price) : null, version: variant.version });
      showToast(t('تم الحفظ', 'Saved'), 'success');
      onChanged();
    } catch (err) {
      showToast(err instanceof ApiError && err.code === 'CONCURRENCY_CONFLICT' ? t('تم تعديل هذا المقاس من مكان آخر، تم تحديث البيانات', 'Someone changed this variant meanwhile; reloaded') : errorText(err, t), 'error');
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const confirm = useConfirm();
  const remove = async () => {
    if (!(await confirm({ title: t('حذف هذا المقاس/اللون؟', 'Delete this variant?'), message: t(`${variant.size} · ${variant.sku}`, `${variant.size} · ${variant.sku}`), confirmLabel: t('حذف', 'Delete'), danger: true }))) return;
    try {
      await deleteVariant(variant.id);
      onChanged();
    } catch (err) {
      showToast(errorText(err, t), 'error');
    }
  };

  const cell = 'border border-[#dedbd5] rounded-lg p-1.5 bg-white text-xs w-20';
  return (
    <tr>
      <td className="py-2 font-bold text-[#142b4a]">{variant.size}</td>
      <td className="py-2">
        <span className="inline-flex items-center gap-1.5 text-xs">
          <span className="w-3 h-3 rounded-full border border-black/10" style={{ backgroundColor: variant.color.hex }} />
          {pick(lang, variant.color.nameAr, variant.color.nameEn)}
        </span>
      </td>
      <td className="py-2 font-mono text-xs text-[#77808a]" dir="ltr">{variant.sku}</td>
      <td className="py-2"><span className={`font-bold ${variant.stock <= 3 ? 'text-[#a72f3e]' : 'text-[#142b4a]'}`} title={t('تُعدَّل الكمية من المخزن', 'Stock is changed in the Warehouse')}>{variant.stock}</span></td>
      <td className="py-2"><input type="number" min={1} step="0.01" value={price} placeholder={money(basePrice)} onChange={(e) => setPrice(e.target.value)} className={`${cell} w-28`} aria-label={t('سعر خاص', 'Own price')} /></td>
      <td className="py-2 text-end whitespace-nowrap">
        <button type="button" disabled={!dirty || busy} onClick={() => void save()} className="px-3 py-1 rounded-lg bg-[#142b4a] text-white text-xs font-bold disabled:opacity-30 cursor-pointer">{t('حفظ', 'Save')}</button>
        <button type="button" onClick={() => void remove()} className="ms-1.5 px-3 py-1 rounded-lg border border-[#efc9c9] bg-[#fff7f7] text-[#a34c4c] text-xs font-bold cursor-pointer">{t('حذف', 'Delete')}</button>
      </td>
    </tr>
  );
}

function Photos({ product, onChanged }: { product: AdminProduct; onChanged: () => void }) {
  const lang = useZamzamStore((state) => state.lang);
  const t = useZamzamStore((state) => state.t);
  const showToast = useZamzamStore((state) => state.showToast);
  const fileRef = useRef<HTMLInputElement>(null);
  const [altAr, setAltAr] = useState('');
  const [altEn, setAltEn] = useState('');
  const [uploading, setUploading] = useState(0);
  const full = product.images.length >= MAX_IMAGES;

  const upload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).slice(0, MAX_IMAGES - product.images.length);
    e.target.value = '';
    for (const file of files) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > MAX_PHOTO) {
        showToast(t(`"${file.name}": يجب أن تكون JPG/PNG/WebP وحتى 5 ميجابايت`, `"${file.name}": must be JPG/PNG/WebP up to 5 MB`), 'error');
        continue;
      }
      setUploading((n) => n + 1);
      try {
        await uploadImage(product.id, file, altAr.trim() || undefined, altEn.trim() || undefined);
      } catch (err) {
        showToast(errorText(err, t), 'error');
      } finally {
        setUploading((n) => n - 1);
      }
    }
    onChanged();
  };

  const confirm = useConfirm();
  const remove = async (id: number) => {
    if (!(await confirm({ title: t('حذف هذه الصورة؟', 'Delete this photo?'), message: t('سيتم حذفها من المتجر نهائيًا.', 'It will be removed from the shop for good.'), confirmLabel: t('حذف', 'Delete'), danger: true }))) return;
    try {
      await deleteImage(id);
      onChanged();
    } catch (err) {
      showToast(errorText(err, t), 'error');
    }
  };

  return (
    <section className={`${ui.card} p-5 sm:p-6 space-y-4`}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-serif font-bold text-[#142b4a]">{t('صور المنتج', 'Product photos')}</h3>
        <span className="text-xs text-[#77808b]">{product.images.length} / {MAX_IMAGES}</span>
      </div>
      <p className="text-xs text-[#79808b]">{t('أول صورة هي الصورة الرئيسية في المتجر. JPG أو PNG أو WebP حتى 5 ميجابايت.', 'The first photo is the main one in the shop. JPG, PNG or WebP up to 5 MB.')}</p>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
        {product.images.map((img, i) => (
          <figure key={img.id} className="relative rounded-xl overflow-hidden border border-[#e8dfd1] bg-[#f7f3eb] aspect-[3/4]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.srcSet.split(', ')[0]?.split(' ')[0] || img.url} alt={pick(lang, img.altAr, img.altEn)} className="w-full h-full object-cover" />
            {i === 0 && <span className="absolute top-1.5 start-1.5 px-2 py-0.5 rounded-full bg-[#b99664] text-white text-[14px] font-bold">{t('رئيسية', 'Main')}</span>}
            <button type="button" onClick={() => void remove(img.id)} aria-label={t('حذف الصورة', 'Delete photo')}
              className="absolute top-1.5 end-1.5 w-7 h-7 rounded-full bg-[#142b4a]/85 text-white text-xs hover:bg-red-700 cursor-pointer">✕</button>
          </figure>
        ))}
        {uploading > 0 && Array.from({ length: uploading }).map((_, i) => <div key={i} className="rounded-xl bg-[#f1ebe0] aspect-[3/4] animate-pulse" />)}
      </div>

      {!full && (
        <div className="flex flex-wrap items-end gap-3 pt-3 border-t border-[#efe9df]">
          <label className="flex flex-col gap-1 text-xs font-bold text-[#2d3540]">
            <span>{t('وصف الصورة بالعربي (اختياري)', 'Arabic alt text (optional)')}</span>
            <input value={altAr} maxLength={150} onChange={(e) => setAltAr(e.target.value)} className="border border-[#dedbd5] rounded-lg p-2 text-xs" />
          </label>
          <label className="flex flex-col gap-1 text-xs font-bold text-[#2d3540]">
            <span>{t('وصف الصورة بالإنجليزي (اختياري)', 'English alt text (optional)')}</span>
            <input value={altEn} maxLength={150} dir="ltr" onChange={(e) => setAltEn(e.target.value)} className="border border-[#dedbd5] rounded-lg p-2 text-xs" />
          </label>
          <input ref={fileRef} type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={(e) => void upload(e)} className="hidden" />
          <button type="button" disabled={uploading > 0} onClick={() => fileRef.current?.click()} className="px-5 py-2.5 rounded-lg bg-[#142b4a] text-white text-xs font-bold disabled:opacity-60 cursor-pointer">
            {uploading > 0 ? t('جارٍ الرفع…', 'Uploading…') : `＋ ${t('رفع صور', 'Upload photos')}`}
          </button>
        </div>
      )}
    </section>
  );
}
