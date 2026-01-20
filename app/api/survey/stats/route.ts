import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { checkGlobalRateLimit } from "@/lib/rate-limit";

// 启用缓存，每 30 秒重新验证一次
export const revalidate = 30;

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
    // 使用数据库聚合查询，只返回统计结果（防止数据泄露），带超时保护
    const dbTimeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Database timeout")), 10000); // 10秒超时
    });

    const stats = (await Promise.race([
      sql`
        SELECT
          COUNT(*) as total,
          COALESCE(AVG(CAST(salary_months AS DECIMAL)), 0) as avg_months,
          COUNT(*) FILTER (WHERE personal_income = '逆势增长 (涨幅 > 10%)') as income_growth,
          COUNT(*) FILTER (WHERE personal_income = '基本持平 (波动 < 10%)') as income_stable,
          COUNT(*) FILTER (WHERE personal_income IN ('温和下跌 (跌幅 10%-30%)', '严重下跌 (跌幅 > 30%)', '腰斩/失业归零')) as income_decline,
          COUNT(*) FILTER (WHERE friends_status = '普遍在涨薪/跳槽，行情不错') as friends_better,
          COUNT(*) FILTER (WHERE friends_status = '只有极个别能力强的在涨，大部分苟着') as friends_mixed,
          COUNT(*) FILTER (WHERE friends_status IN ('大家都在降薪/被裁，怨气很重', '都在谈论维权/讨薪，情况恶劣')) as friends_worse,
          COUNT(*) FILTER (WHERE personal_arrears IN ('从未欠薪，按时发放', '偶尔延迟，最终发了')) as arrears_safe,
          COUNT(*) FILTER (WHERE personal_arrears IN ('正在被拖欠 (3个月以内)', '正在被拖欠 (半年以上/无望)')) as arrears_risk
        FROM survey_responses
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
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
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
