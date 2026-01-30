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
    // 使用精确匹配，防止 startsWith 绕过漏洞
    // 例如：攻击者可以使用 "https://yoursite.comevil.com" 绕过 startsWith 检查
    const isAllowed = allowedOrigins.some((allowed) => origin === allowed);

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
    // 从 Referer 中提取 origin（协议 + 域名 + 端口）
    // 防止 startsWith 绕过漏洞
    try {
      const refererUrl = new URL(referer);
      const refererOrigin = refererUrl.origin; // 例如：https://yoursite.com

      const isAllowed = allowedOrigins.some((allowed) => refererOrigin === allowed);

      if (!isAllowed) {
        return {
          valid: false,
          reason: `Referer 不匹配: ${referer}`,
        };
      }

      return { valid: true };
    } catch (error) {
      // Referer 格式无效
      return {
        valid: false,
        reason: `Referer 格式无效: ${referer}`,
      };
    }
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
 * 注意：CORS 响应头由 middleware.ts 统一管理
 *
 * middleware.ts 动态设置 CORS 头：
 * - 开发环境：允许 localhost 的任意端口
 * - 生产环境：只允许与 host 匹配的 origin
 *
 * 本模块只负责验证请求来源（validateCSRF），不设置响应头
 * 这样保持了职责分离：
 * - middleware.ts: 设置全局响应头（包括 CORS）
 * - csrf-protection.ts: 验证请求来源
 */
