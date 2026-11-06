'use client';

import React, { useState, ChangeEvent, FormEvent } from 'react';
import { useZamzamStore } from '@/store/useZamzamStore';
import { adminSizes, adminColors, assetPath } from '@/data/seed';

export default function AdminProductEditor() {
  const data = useZamzamStore((state) => state.data);
  const lang = useZamzamStore((state) => state.lang);
  const editingProductId = useZamzamStore((state) => state.editingProductId);
  const editorCategoryId = useZamzamStore((state) => state.editorCategoryId);
  const setEditingProductId = useZamzamStore((state) => state.setEditingProductId);
  const setAdminTab = useZamzamStore((state) => state.setAdminTab);
  const createProduct = useZamzamStore((state) => state.createProduct);
  const updateProduct = useZamzamStore((state) => state.updateProduct);
  const t = useZamzamStore((state) => state.t);
  const showToast = useZamzamStore((state) => state.showToast);

  const p = data.products.find((x) => x.id === editingProductId);

  const [ar, setAr] = useState(p?.ar || '');
  const [en, setEn] = useState(p?.en || '');
  const [categoryId, setCategoryId] = useState<number>(
    p?.categoryId || editorCategoryId || (data.categories[0]?.id ?? 1)
  );
  const [price, setPrice] = useState<string>(p ? String(p.price) : '');
  const [stock, setStock] = useState<string>(p ? String(p.stock) : '');
  const [sizes, setSizes] = useState<string[]>(p?.sizes || ['S', 'M', 'L']);
  const [colors, setColors] = useState<string[]>(p?.colors || ['بيج', 'أسود']);
  const [description, setDescription] = useState(p?.description || '');
  const [imageUrl, setImageUrl] = useState(p?.image || '');
  const [imagePreview, setImagePreview] = useState(p?.image || 'assets/products/blouse-cream.jpg');

  const cName = (c: { ar: string; en: string }) => (lang === 'ar' ? c.ar : c.en || c.ar);

  const handleSizeToggle = (size: string) => {
    setSizes((prev) =>
      prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size]
    );
  };

  const handleColorToggle = (color: string) => {
    setColors((prev) =>
      prev.includes(color) ? prev.filter((c) => c !== color) : [...prev, color]
    );
  };

  const handleImageFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1500000) {
      alert(t('الصورة أكبر من 1.5 ميجابايت', 'Image exceeds 1.5 MB'));
      return;
    }

    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      alert(t('نوع الصورة غير مدعوم', 'Unsupported image type'));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const res = reader.result as string;
      setImagePreview(res);
      setImageUrl(res);
    };
    reader.readAsDataURL(file);
  };

  const handleCancel = () => {
    setEditingProductId(null);
    setAdminTab('products');
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    const priceNum = Number(price);
    const stockNum = Number(stock);

    if (!data.categories.some((c) => c.id === categoryId)) {
      showToast(t('اختاري قسمًا صحيحًا قبل الحفظ', 'Choose a valid category before saving'), 'error');
      return;
    }

    if (!Number.isFinite(priceNum) || priceNum <= 0 || !Number.isInteger(stockNum) || stockNum < 0) {
      showToast(t('راجعي السعر والمخزون', 'Check price and stock'), 'error');
      return;
    }

    if (!sizes.length || !colors.length) {
      showToast(t('اختاري المقاسات والألوان', 'Choose sizes and colors'), 'error');
      return;
    }

    const payload = {
      ar: ar.trim(),
      en: (en || ar).trim(),
      categoryId: Number(categoryId),
      price: priceNum,
      stock: stockNum,
      sizes,
      colors,
      description: description.trim(),
      image: imagePreview || imageUrl || 'assets/products/blouse-cream.jpg',
      emoji: p?.emoji || '👗',
      tone: p?.tone || '',
      visible: p ? p.visible : true,
    };

    if (p) {
      updateProduct(p.id, payload);
    } else {
      createProduct(payload);
    }
  };

  return (
    <section className="bg-white p-6 sm:p-8 rounded-2xl border border-[#e9e4dc] shadow-2xs space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#e9e4dc]">
        <div>
          <span className="text-[11px] font-bold tracking-widest text-[#9c7c54] uppercase">
            03 / PRODUCT EDITOR
          </span>
          <h3 className="text-lg sm:text-xl font-serif font-bold text-[#142b4a] mt-0.5">
            {p ? t('تعديل الموديل', 'Edit style') : t('إضافة موديل جديد', 'Add new style')}
          </h3>
          <p className="text-xs text-[#79808b]">
            {t(
              'اختاري البيانات والصور والمقاسات والألوان، وبعدها احفظي المنتج.',
              'Select details, images, sizes and colors, then save.'
            )}
          </p>
        </div>
        <button
          type="button"
          className="px-4 py-2 rounded-xl border border-[#cdbb9e] bg-white hover:bg-[#f7f3eb] text-xs font-bold text-[#142b4a] transition-colors cursor-pointer self-start sm:self-auto"
          onClick={handleCancel}
        >
          {t('العودة للمنتجات', 'Back to products')}
        </button>
      </div>

      <form id="product-editor" className="space-y-6" onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1.5 text-xs font-bold text-[#344255]">
            <span>{t('اسم المنتج بالعربي', 'Arabic product name')} *</span>
            <input
              name="ar"
              value={ar}
              onChange={(e) => setAr(e.target.value)}
              required
              className="border border-[#dedbd5] rounded-xl p-3 bg-white text-[#263548] text-sm focus:outline-none focus:ring-2 focus:ring-[#142b4a]"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-xs font-bold text-[#344255]">
            <span>{t('اسم المنتج بالإنجليزي', 'English product name')} *</span>
            <input
              name="en"
              value={en}
              onChange={(e) => setEn(e.target.value)}
              required
              className="border border-[#dedbd5] rounded-xl p-3 bg-white text-[#263548] text-sm focus:outline-none focus:ring-2 focus:ring-[#142b4a]"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-xs font-bold text-[#344255]">
            <span>{t('القسم', 'Category')} *</span>
            <select
              name="categoryId"
              value={categoryId}
              onChange={(e) => setCategoryId(Number(e.target.value))}
              required
              className="border border-[#dedbd5] rounded-xl p-3 bg-white text-[#263548] text-sm focus:outline-none focus:ring-2 focus:ring-[#142b4a]"
            >
              <option value="" disabled>
                {t('اختاري القسم الصحيح', 'Select a category')}
              </option>
              {data.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.parentId ? '↳ ' : ''}
                  {cName(c)}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5 text-xs font-bold text-[#344255]">
              <span>{t('السعر بالجنيه', 'Price EGP')} *</span>
              <input
                type="number"
                name="price"
                min="1"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
                className="border border-[#dedbd5] rounded-xl p-3 bg-white text-[#263548] text-sm focus:outline-none focus:ring-2 focus:ring-[#142b4a]"
              />
            </label>

            <label className="flex flex-col gap-1.5 text-xs font-bold text-[#344255]">
              <span>{t('الكمية بالمخزون', 'Stock quantity')} *</span>
              <input
                type="number"
                name="stock"
                min="0"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                required
                className="border border-[#dedbd5] rounded-xl p-3 bg-white text-[#263548] text-sm focus:outline-none focus:ring-2 focus:ring-[#142b4a]"
              />
            </label>
          </div>
        </div>

        {/* Sizes Choices */}
        <div className="space-y-2">
          <b className="block text-xs font-bold text-[#344255]">
            {t('المقاسات المتاحة', 'Available sizes')}
          </b>
          <p className="text-xs text-[#79808b]">
            {t('اضغطي على المقاسات اللي متوفرة في المنتج', 'Check every available size')}
          </p>
          <div className="flex flex-wrap gap-2 pt-1" role="group" aria-label="Sizes">
            {adminSizes.map((v) => {
              const checked = sizes.includes(v);
              return (
                <label
                  key={v}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer select-none ${
                    checked
                      ? 'bg-[#142b4a] text-white border-[#142b4a]'
                      : 'bg-white text-[#142b4a] border-[#c7b092] hover:bg-[#fff8ec]'
                  }`}
                >
                  <input
                    type="checkbox"
                    name="sizes"
                    value={v}
                    checked={checked}
                    onChange={() => handleSizeToggle(v)}
                    className="sr-only"
                  />
                  <span>{v}</span>
                  {checked && <span className="text-[10px]">✓</span>}
                </label>
              );
            })}
          </div>
        </div>

        {/* Colors Choices */}
        <div className="space-y-2">
          <b className="block text-xs font-bold text-[#344255]">
            {t('الألوان المتاحة', 'Available colors')}
          </b>
          <p className="text-xs text-[#79808b]">
            {t('اختاري الألوان بعلامة صح', 'Check the available colors')}
          </p>
          <div className="flex flex-wrap gap-2 pt-1" role="group" aria-label="Colors">
            {adminColors.map(([arColor, hex, enColor]) => {
              const checked = colors.includes(arColor);
              return (
                <label
                  key={arColor}
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer select-none ${
                    checked
                      ? 'bg-[#142b4a] text-white border-[#142b4a]'
                      : 'bg-white text-[#142b4a] border-[#c7b092] hover:bg-[#fff8ec]'
                  }`}
                >
                  <input
                    type="checkbox"
                    name="colors"
                    value={arColor}
                    checked={checked}
                    onChange={() => handleColorToggle(arColor)}
                    className="sr-only"
                  />
                  <span
                    className="w-3.5 h-3.5 rounded-full border border-black/20"
                    style={{ background: hex }}
                  />
                  <span>{lang === 'ar' ? arColor : enColor}</span>
                  {checked && <span className="text-[10px]">✓</span>}
                </label>
              );
            })}
          </div>
        </div>

        {/* Description */}
        <label className="flex flex-col gap-1.5 text-xs font-bold text-[#344255]">
          <span>{t('وصف المنتج والخامة والتفاصيل', 'Description, fabric and care')}</span>
          <textarea
            name="description"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t(
              'الخامة، القصة، تعليمات الغسيل...',
              'Fabric, fit, washing instructions...'
            )}
            className="border border-[#dedbd5] rounded-xl p-3 bg-white text-[#263548] text-sm focus:outline-none focus:ring-2 focus:ring-[#142b4a]"
          />
        </label>

        {/* Product Image */}
        <div className="p-4 sm:p-5 bg-[#faf8f4] border border-dashed border-[#d7c8b4] rounded-2xl space-y-3">
          <b className="block text-xs font-bold text-[#344255]">
            {t('صورة المنتج', 'Product image')}
          </b>
          <div className="flex flex-col sm:flex-row items-center gap-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              id="zf-image-preview"
              src={assetPath(imagePreview)}
              alt=""
              className="w-32 h-36 object-cover rounded-xl bg-[#ece6dc] border border-[#d6c2a7]"
            />
            <div className="space-y-3 flex-1 w-full">
              <label className="flex flex-col gap-1 text-xs font-bold text-[#344255]">
                <span>{t('رفع صورة من الجهاز', 'Upload image')}</span>
                <input
                  name="imageFile"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleImageFile}
                  className="text-xs text-stone-500 file:me-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#142b4a] file:text-white hover:file:bg-[#1e3a61] cursor-pointer"
                />
              </label>

              <label className="flex flex-col gap-1 text-xs font-bold text-[#344255]">
                <span>{t('أو رابط صورة HTTPS', 'Or HTTPS image URL')}</span>
                <input
                  name="imageUrl"
                  type="url"
                  placeholder="https://..."
                  value={imageUrl}
                  onChange={(e) => {
                    setImageUrl(e.target.value);
                    setImagePreview(e.target.value);
                  }}
                  className="border border-[#dedbd5] rounded-xl p-2.5 bg-white text-[#263548] text-xs focus:outline-none focus:ring-2 focus:ring-[#142b4a]"
                />
              </label>
              <small className="block text-[11px] text-[#7c8086]">
                {t(
                  'الصورة بتتحفظ محليًا في المتصفح للتجربة فقط، والأفضل أقل من 1.5 ميجابايت.',
                  'Images are stored in this browser for demo only. Keep under 1.5MB.'
                )}
              </small>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <button
            className="px-6 py-3 rounded-xl bg-[#142b4a] hover:bg-[#1e3a61] text-white text-xs font-bold transition-colors cursor-pointer shadow-sm"
            id="save-product-button"
            type="submit"
          >
            {p ? t('حفظ التعديلات', 'Save changes') : t('إضافة المنتج', 'Add product')}
          </button>
          <button
            className="px-5 py-3 rounded-xl border border-[#cdbb9e] bg-white hover:bg-[#f7f3eb] text-xs font-bold text-[#142b4a] transition-colors cursor-pointer"
            type="button"
            onClick={handleCancel}
          >
            {t('إلغاء', 'Cancel')}
          </button>
        </div>
      </form>
    </section>
  );
}
