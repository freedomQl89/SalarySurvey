/**
 * Content Security Policy (CSP) 工具
 */

import { randomBytes } from "crypto";

export function generateNonce(): string {
  return randomBytes(16).toString("base64");
}

/**
 * 构建 CSP 头部字符串
 */
export function buildCSPHeader(nonce: string): string {
  const cspDirectives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ];

  // 开发环境添加额外的源（用于热重载）
  if (process.env.NODE_ENV === "development") {
    cspDirectives[1] = `script-src 'self' 'nonce-${nonce}' 'unsafe-eval'`; // webpack HMR 需要
    cspDirectives[4] = "connect-src 'self' ws: wss:"; // 热重载 WebSocket
  }

  return cspDirectives.join("; ");
}

/**
 * 获取所有安全响应头
 */
export function getSecurityHeaders(nonce: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Security-Policy": buildCSPHeader(nonce),

    "X-Content-Type-Options": "nosniff",

    "X-Frame-Options": "DENY",

    "X-XSS-Protection": "1; mode=block",

    "Referrer-Policy": "strict-origin-when-cross-origin",

    "Permissions-Policy":
      "camera=(), microphone=(), geolocation=(), interest-cohort=()",

    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Embedder-Policy": "require-corp",
    "Cross-Origin-Resource-Policy": "same-origin",
  };

  // 生产环境添加 HSTS
  if (process.env.NODE_ENV === "production") {
    headers["Strict-Transport-Security"] =
      "max-age=31536000; includeSubDomains; preload";
  }

  return headers;
}
