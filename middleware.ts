import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");

  const response = NextResponse.next();

  const headers = response.headers;

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  const origin = request.headers.get("origin");
  const host = request.headers.get("host");

  // CORS 配置：使用精确匹配防止绕过攻击
  if (process.env.NODE_ENV === "development" && origin?.includes("localhost")) {
    // 开发环境：允许 localhost 的任意端口
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type");
  } else if (origin && host) {
    // 生产环境：精确匹配 origin
    // 防止 includes 绕过：例如 "yoursite.comevil.com".includes("yoursite.com") = true
    try {
      const originUrl = new URL(origin);
      const expectedOrigin = `${originUrl.protocol}//${host}`;

      if (origin === expectedOrigin) {
        headers.set("Access-Control-Allow-Origin", origin);
      } else {
        headers.delete("Access-Control-Allow-Origin");
      }
    } catch {
      // origin 格式无效
      headers.delete("Access-Control-Allow-Origin");
    }
  } else {
    headers.delete("Access-Control-Allow-Origin");
  }

  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("X-XSS-Protection", "1; mode=block");

  const csp = [
    "default-src 'self'",
    process.env.NODE_ENV === "development"
      ? `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.google.com https://www.gstatic.com` // 开发环境 + reCAPTCHA
      : `script-src 'self' 'unsafe-inline' https://www.google.com https://www.gstatic.com`, // 生产环境 + reCAPTCHA
    `style-src 'self' 'unsafe-inline'`, // React需要unsafe-inline用于内联样式
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    process.env.NODE_ENV === "development"
      ? "connect-src 'self' ws: wss: https://www.google.com" // 开发环境WebSocket + reCAPTCHA
      : "connect-src 'self' https://www.google.com",
    "frame-src https://www.google.com", // reCAPTCHA iframe
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");

  headers.set("Content-Security-Policy", csp);

  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  );

  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  headers.set("Cross-Origin-Resource-Policy", "same-origin");

  if (process.env.NODE_ENV === "production") {
    headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload",
    );
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
    headers,
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
