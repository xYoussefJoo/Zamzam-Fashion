import type { Metadata } from 'next';
import { Suspense } from 'react';
import AppShell from '@/components/AppShell';

type Params = { params: Promise<{ slug: string }> };

// Share previews (WhatsApp, Facebook) show the product's own name and first photo.
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const canonical = `/products/${slug}`;
  try {
    const res = await fetch(`${process.env.API_URL ?? 'http://localhost:5055'}/api/products/${encodeURIComponent(decodeURIComponent(slug))}`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return { alternates: { canonical } };
    const p: { nameAr: string; nameEn: string; descriptionAr: string | null; images: { url: string }[] } = await res.json();
    const title = `${p.nameAr} | ${p.nameEn} | Zamzam Fashion`;
    const description = p.descriptionAr ?? undefined;
    const images = p.images[0] ? [{ url: p.images[0].url }] : undefined;
    return { title, description, alternates: { canonical }, openGraph: { title, description, url: canonical, images }, twitter: { title, description, images } };
  } catch {
    return { alternates: { canonical } };
  }
}

// A product's shareable address. With Cache Components, params are runtime data, so they're read inside Suspense.
export default function ProductPage({ params }: Params) {
  return (
    <Suspense fallback={null}>
      {params.then(({ slug }) => (
        <AppShell route={{ page: 'product', slug: decodeURIComponent(slug) }} />
      ))}
    </Suspense>
  );
}
