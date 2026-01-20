/**
 * CSRF 防护模块
 *
 * 策略：
 * 1. 检查 Origin 和 Referer 头
 * 2. 验证请求来源是否为同源
 * 3. 使用 SameSite Cookie 策略
 */

import { NextRequest } from "next/server";

/**
 * 验证请求是否来自同源
 */
export function validateCSRF(request: NextRequest): {
  valid: boolean;
  reason?: string;
} {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");

  const host = request.headers.get("host");

  if (!host) {
    return {
      valid: false,
      reason: "无法确定请求主机",
    };
  }

  // 构建允许的源列表
  const allowedOrigins = getAllowedOrigins(host);

  // 1. 检查 Origin 头（优先）
  if (origin) {
    const isAllowed = allowedOrigins.some(
      (allowed) => origin === allowed || origin.startsWith(allowed),
    );

    if (!isAllowed) {
      return {
        valid: false,
        reason: `Origin 不匹配: ${origin}`,
      };
    }

    return { valid: true };
  }

  // 2. 如果没有 Origin，检查 Referer
  if (referer) {
    const isAllowed = allowedOrigins.some((allowed) =>
      referer.startsWith(allowed),
    );

    if (!isAllowed) {
      return {
        valid: false,
        reason: `Referer 不匹配: ${referer}`,
      };
    }

    return { valid: true };
  }

  // 3. 如果既没有 Origin 也没有 Referer，拒绝请求
  // 这可能是直接的 API 调用或恶意请求
  return {
    valid: false,
    reason: "缺少 Origin 和 Referer 头",
  };
}

/**
 * 获取允许的源列表
 */
function getAllowedOrigins(host: string): string[] {
  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";

  const origins = [`${protocol}://${host}`];

  // 开发环境允许 localhost 的不同端口
  if (process.env.NODE_ENV === "development") {
    origins.push(
      "http://localhost:3000",
      "http://localhost:3001",
      "http://127.0.0.1:3000",
      "http://127.0.0.1:3001",
    );
  }

  // 如果有自定义的允许域名（从环境变量读取）
  const customOrigins = process.env.ALLOWED_ORIGINS;
  if (customOrigins) {
    origins.push(...customOrigins.split(",").map((o) => o.trim()));
  }

  return origins;
}

/**
 * 检查请求方法是否需要 CSRF 保护
 */
export function requiresCSRFProtection(method: string): boolean {
  const protectedMethods = ["POST", "PUT", "PATCH", "DELETE"];
  return protectedMethods.includes(method.toUpperCase());
}

/**
 * 生成 CSRF 安全的响应头
 */
export function getCSRFHeaders(): Record<string, string> {
  return {
    // 防止在 iframe 中加载（防止点击劫持）
    "X-Frame-Options": "DENY",

    "Referrer-Policy": "strict-origin-when-cross-origin",

    // 跨域资源共享策略（仅允许同源）
    "Access-Control-Allow-Origin":
      process.env.NODE_ENV === "development" ? "http://localhost:3000" : "",

    // 不允许跨域携带凭证
    "Access-Control-Allow-Credentials": "false",
  };
}
