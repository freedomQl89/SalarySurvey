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

  if (process.env.NODE_ENV === "development" && origin?.includes("localhost")) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type");
  } else if (origin && host && origin.includes(host)) {
    headers.set("Access-Control-Allow-Origin", origin);
  } else {
    headers.delete("Access-Control-Allow-Origin");
  }

  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("X-XSS-Protection", "1; mode=block");

  const csp = [
    "default-src 'self'",
    process.env.NODE_ENV === "development"
      ? `script-src 'self' 'unsafe-inline' 'unsafe-eval'` // 开发环境需要这些用于HMR
      : `script-src 'self' 'unsafe-inline'`, // 生产环境Next.js需要unsafe-inline
    `style-src 'self' 'unsafe-inline'`, // React需要unsafe-inline用于内联样式
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    process.env.NODE_ENV === "development"
      ? "connect-src 'self' ws: wss:" // 开发环境WebSocket
      : "connect-src 'self'",
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
