import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. دور الـ Proxy: إضافة السر المشترك لطلبات الباك إند (نفس وظيفة proxy.ts)
  if (pathname.startsWith("/api")) {
    const secret = process.env.PROXY_SHARED_SECRET;
    if (!secret) return NextResponse.next();

    const headers = new Headers(request.headers);
    headers.set("X-Proxy-Secret", secret);
    return NextResponse.next({ request: { headers } });
  }

  // 2. دور حماية الأدمن: فحص جلسة الأدمن ومسارات الطلبات
  if (pathname.startsWith("/admin")) {
    const authCookie =
      request.cookies.get("zz.auth") ||
      request.cookies.get(".AspNetCore.Identity.Application") ||
      request.cookies.get(".AspNetCore.Cookies");

    // حماية تفاصيل الطلبات إذا لم يكن هناك جلسة نشطة
    if (pathname.startsWith("/admin/orders") && !authCookie?.value) {
      const loginUrl = new URL("/admin", request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

// دمج المسارات المستهدفة للاثنين معاً
export const config = {
  matcher: ["/api/:path*", "/admin/:path*"],
};
