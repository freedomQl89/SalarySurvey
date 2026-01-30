import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { checkGlobalRateLimit } from "@/lib/rate-limit";

// 禁用 Next.js 缓存，因为 aggregated_stats 表由触发器实时维护
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 检查速率限制（防止滥用）
    const rateLimitPassed = await checkGlobalRateLimit();
    if (!rateLimitPassed) {
      return NextResponse.json(
        {
          error: "请求过于频繁",
          message: "请稍后再试",
        },
        { status: 429 },
      );
    }
    // 从预计算的 aggregated_stats 表读取数据（触发器自动维护）
    const dbTimeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Database timeout")), 10000); // 10秒超时
    });

    const stats = (await Promise.race([
      sql`
        SELECT
          total_responses as total,
          avg_salary_months as avg_months,
          income_growth,
          income_stable,
          income_decline,
          friends_better,
          friends_mixed,
          friends_worse,
          arrears_safe,
          arrears_risk
        FROM aggregated_stats
        WHERE id = 1
      `,
      dbTimeoutPromise,
    ])) as any[];
    const result = stats[0];

    // 验证查询结果
    if (!result) {

      return NextResponse.json(
        {
          error: "数据查询失败",
          message: "无法获取统计数据",
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        stats: {
          total: parseInt(result.total) || 0,
          avgMonths: parseFloat(result.avg_months).toFixed(1),
          income: {
            growth: parseInt(result.income_growth) || 0,
            stable: parseInt(result.income_stable) || 0,
            decline: parseInt(result.income_decline) || 0,
          },
          friends: {
            better: parseInt(result.friends_better) || 0,
            mixed: parseInt(result.friends_mixed) || 0,
            worse: parseInt(result.friends_worse) || 0,
          },
          arrears: {
            safe: parseInt(result.arrears_safe) || 0,
            risk: parseInt(result.arrears_risk) || 0,
          },
        },
      },
      {
        headers: {
          "Cache-Control": "no-cache",
          "X-Content-Type-Options": "nosniff",
          "X-Frame-Options": "SAMEORIGIN",
        },
      },
    );
  } catch (error) {
    // 记录错误但不暴露详细信息
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    if (error instanceof Error) {
      console.error("[Stats API Error]", {
        message: error.message,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      });
    } else {
      console.error("[Stats API Error]", error);
    }
    // 超时错误返回503
    if (errorMessage.includes("timeout")) {
      return NextResponse.json(
        {
          error: "数据库操作超时",
          message: "服务器繁忙，请稍后重试",
        },
        {
          status: 503,
          headers: {
            "X-Content-Type-Options": "nosniff",
          },
        },
      );
    }

    return NextResponse.json(
      {
        error: "获取数据失败",
        message: "服务器处理请求时发生错误",
      },
      {
        status: 500,
        headers: {
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  }
}
