import { NextResponse, type NextRequest } from "next/server";

// Every /api call goes through the next.config rewrite to the .NET API. Behind Vercel the API sees
// Vercel's IP, so it only trusts X-Forwarded-For (the shopper's real IP, for its per-IP rate limits)
// when this shared secret comes with it. Runs on the server: the browser never sees the secret.
export function proxy(request: NextRequest) {
  const secret = process.env.PROXY_SHARED_SECRET;
  if (!secret) return NextResponse.next();

  const headers = new Headers(request.headers);
  headers.set("X-Proxy-Secret", secret);
  return NextResponse.next({ request: { headers } });
}

export const config = { matcher: "/api/:path*" };
