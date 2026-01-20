/**
 * 基于数据库的速率限制器
 * 完全匿名，不记录任何用户信息
 *
 * 策略：
 * 1. 前端使用 localStorage 记录提交时间
 * 2. 后端生成一次性 token 验证
 * 3. 服务端使用数据库做全局防刷保护（不记录用户信息）
 */

import { sql } from "./db";

// 配置
export const RATE_LIMIT_CONFIG = {
  WINDOW: 60 * 60 * 1000, // 1 小时（毫秒）
  MAX_REQUESTS: 3, // 每小时最多 3 次
  STORAGE_KEY: "survey_submissions", // localStorage key
};

// 全局速率限制配置
const GLOBAL_LIMIT = 1000; // 每分钟全局最多 1000 个请求
const GLOBAL_WINDOW_SECONDS = 60; // 1 分钟窗口

/**
 * 检查全局速率限制（防止 DDoS）
 * 使用数据库存储，支持多实例部署和Serverless环境
 */
export async function checkGlobalRateLimit(): Promise<boolean> {
  try {
    const now = new Date();
    const windowStart = new Date(now.getTime() - GLOBAL_WINDOW_SECONDS * 1000);

    // 使用事务确保原子性操作
    // 1. 清理过期记录（超过1分钟的）
    await sql`
      DELETE FROM rate_limit_global
      WHERE window_start < ${windowStart}
    `;

    // 2. 获取当前窗口的请求计数
    const result = await sql`
      SELECT COALESCE(SUM(request_count), 0) as total_requests
      FROM rate_limit_global
      WHERE window_start >= ${windowStart}
    `;

    const currentCount = parseInt(result[0]?.["total_requests"] || "0");

    // 3. 如果超过限制，拒绝请求
    if (currentCount >= GLOBAL_LIMIT) {
      console.warn(
        `[Rate Limit] Global limit exceeded: ${currentCount} requests in last ${GLOBAL_WINDOW_SECONDS} seconds`,
      );
      return false;
    }

    // 4. 记录本次请求（插入或更新当前分钟的记录）
    const currentMinute = new Date(Math.floor(now.getTime() / 60000) * 60000);

    await sql`
      INSERT INTO rate_limit_global (window_start, request_count, updated_at)
      VALUES (${currentMinute}, 1, ${now})
      ON CONFLICT (window_start)
      DO UPDATE SET
        request_count = rate_limit_global.request_count + 1,
        updated_at = ${now}
    `;

    return true;
  } catch (error) {
    // 数据库错误时，为了不影响服务，允许请求通过，但记录错误
    console.error("[Rate Limit] Database error, allowing request:", error);
    return true;
  }
}

/**
 * 生成一次性提交 token（用于验证）
 * 这个 token 不包含任何用户信息
 */
export function generateSubmitToken(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `${timestamp}-${random}`;
}

/**
 * 验证提交 token 是否有效
 * 只检查 token 格式和时间，不记录任何信息
 */
export function validateSubmitToken(token: string): boolean {
  if (!token) return false;

  const parts = token.split("-");
  if (parts.length !== 2) return false;

  const timestamp = parseInt(parts[0] || '');
  if (isNaN(timestamp)) return false;

  // Token 有效期 2 分钟（缩短以减少重放攻击风险）
  const now = Date.now();
  const tokenAge = now - timestamp;
  const TOKEN_VALIDITY = 2 * 60 * 1000; // 2 分钟

  if (tokenAge < 0 || tokenAge > TOKEN_VALIDITY) {
    return false;
  }

  return true;
}

/**
 * 获取全局统计信息（用于监控）
 */
export async function getGlobalStats(): Promise<{
  requestCount: number;
  windowStart: Date | null;
  windowEnd: Date;
}> {
  try {
    const now = new Date();
    const windowStart = new Date(now.getTime() - GLOBAL_WINDOW_SECONDS * 1000);

    const result = await sql`
      SELECT
        COALESCE(SUM(request_count), 0) as total_requests,
        MIN(window_start) as earliest_window
      FROM rate_limit_global
      WHERE window_start >= ${windowStart}
    `;

    return {
      requestCount: parseInt(result[0]?.["total_requests"] || "0"),
      windowStart: result[0]?.["earliest_window"] || null,
      windowEnd: now,
    };
  } catch (error) {
    console.error("[Rate Limit] Error getting stats:", error);
    return {
      requestCount: 0,
      windowStart: null,
      windowEnd: new Date(),
    };
  }
}
