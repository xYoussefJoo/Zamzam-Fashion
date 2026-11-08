import type { MetadataRoute } from 'next';

// Home + every visible product, for search engines. Built from NEXT_PUBLIC_SITE_URL (the live domain).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  const pages: MetadataRoute.Sitemap = [{ url: `${site}/`, changeFrequency: 'daily', priority: 1 }];
  try {
    const res = await fetch(`${process.env.API_URL ?? 'http://localhost:5055'}/api/products?page=1&pageSize=100`, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const { items } = (await res.json()) as { items: { slug: string; createdAt: string }[] };
      for (const p of items) pages.push({ url: `${site}/products/${p.slug}`, lastModified: p.createdAt, changeFrequency: 'weekly', priority: 0.8 });
    }
  } catch {
    // API unreachable: the home page alone is still a valid sitemap.
  }
  return pages;
}
