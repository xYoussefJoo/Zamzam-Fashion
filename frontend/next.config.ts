import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  poweredByHeader: false,
  partialPrefetching: true,
  productionBrowserSourceMaps: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    const security = [
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
      // Report-only first: it logs what a strict policy would block without breaking anything.
      {
        key: "Content-Security-Policy-Report-Only",
        value:
          "default-src 'self'; img-src 'self' data: blob: https:; font-src 'self'; style-src 'self' 'unsafe-inline'; " +
          "script-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
      },
    ];
    return [
      { source: "/:path*", headers: security },
      // The dashboard never belongs in search results.
      { source: "/admin/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      // public/assets files keep their names when changed, so a week, not "immutable".
      { source: "/assets/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" }] },
    ];
  },
  // The browser only talks to this origin; /api/* is forwarded to the .NET API,
  // so the owner's auth cookie stays first-party.
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.API_URL ?? "http://localhost:5055"}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
