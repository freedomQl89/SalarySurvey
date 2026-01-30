import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

/**
 * 清理过期数据的 API 端点
 * 
 * 用途：
 * 1. 如果数据库不支持 pg_cron，可以使用外部 cron 服务调用此端点
 * 2. 可以手动触发清理操作
 * 
 * 安全性：
 * - 只允许 POST 请求
 * - 建议配置环境变量 CLEANUP_SECRET 进行身份验证
 */
export async function POST(request: Request) {
  try {
    // 可选：验证密钥（如果配置了 CLEANUP_SECRET）
    const cleanupSecret = process.env['CLEANUP_SECRET'];
    if (cleanupSecret) {
      const authHeader = request.headers.get("authorization");
      if (authHeader !== `Bearer ${cleanupSecret}`) {
        return NextResponse.json(
          { error: "未授权" },
          { status: 401 }
        );
      }
    }

    // 执行清理操作
    const results = {
      rateLimitCleaned: 0,
      tokensCleaned: 0,
    };

    // 清理过期的速率限制记录
    try {
      await sql`SELECT cleanup_old_rate_limit_records()`;
      const rateLimitCount = await sql`
        SELECT COUNT(*) as count
        FROM rate_limit_global
        WHERE window_start < NOW() - INTERVAL '1 hour'
      ` as Array<{ count: string }>;
      results.rateLimitCleaned = parseInt(rateLimitCount[0]?.['count'] || '0');
    } catch (error) {
      console.error('[Cleanup] Rate limit cleanup failed:', error);
    }

    // 清理过期的 token
    try {
      await sql`SELECT cleanup_expired_tokens()`;
      const tokenCount = await sql`
        SELECT COUNT(*) as count
        FROM used_tokens
        WHERE expires_at < NOW()
      ` as Array<{ count: string }>;
      results.tokensCleaned = parseInt(tokenCount[0]?.['count'] || '0');
    } catch (error) {
      console.error('[Cleanup] Token cleanup failed:', error);
    }

    return NextResponse.json({
      success: true,
      message: "清理完成",
      results,
    });
  } catch (error) {
    console.error('[Cleanup API Error]', error);
    return NextResponse.json(
      { error: "清理失败" },
      { status: 500 }
    );
  }
}

