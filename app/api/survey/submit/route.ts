import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { checkGlobalRateLimit, validateSubmitToken } from '@/lib/rate-limit';
import { validateSurveyData } from '@/lib/validation';
import { validateCSRF } from '@/lib/csrf-protection';

export async function POST(request: NextRequest) {
  try {
    // 1. CSRF 保护检查（防止跨站请求伪造）
    const csrfCheck = validateCSRF(request);
    if (!csrfCheck.valid) {
      console.warn('[CSRF] 请求被拒绝:', csrfCheck.reason);
      return NextResponse.json(
        {
          error: '请求来源验证失败',
          message: '请从正确的页面提交问卷'
        },
        { status: 403 }
      );
    }

    // 2. 检查全局速率限制（防止 DDoS，不记录用户信息）
    const rateLimitPassed = await checkGlobalRateLimit();
    if (!rateLimitPassed) {
      return NextResponse.json(
        {
          error: '服务器繁忙',
          message: '当前提交人数过多，请稍后再试'
        },
        { status: 503 }
      );
    }

    // 3. 检查请求体大小（防止大型 payload 攻击）
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > 10240) { // 10KB 限制
      return NextResponse.json(
        {
          error: '请求数据过大',
          message: '提交的数据超过大小限制'
        },
        { status: 413 }
      );
    }

    // 4. 解析请求体（带超时和错误处理）
    let body;
    try {
      // 设置5秒超时，防止慢速攻击
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), 5000);
      });

      body = await Promise.race([
        request.json(),
        timeoutPromise
      ]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('timeout')) {
        return NextResponse.json(
          {
            error: '请求超时',
            message: '请求处理时间过长'
          },
          { status: 408 }
        );
      }
      return NextResponse.json(
        {
          error: '无效的请求格式',
          message: '请求数据格式错误'
        },
        { status: 400 }
      );
    }
    const { submitToken, behaviorData } = body;

    // 5. 验证提交 token（防止脚本刷新）
    if (!validateSubmitToken(submitToken)) {
      return NextResponse.json(
        {
          error: '无效的提交请求',
          message: '请刷新页面后重试'
        },
        { status: 400 }
      );
    }

    // 5.5. 验证用户行为数据（防止机器人）
    if (behaviorData) {
      // 验证behaviorData是对象
      if (typeof behaviorData !== 'object' || Array.isArray(behaviorData)) {
        return NextResponse.json(
          { error: '无效的行为数据格式' },
          { status: 400 }
        );
      }

      const {
        mouseMovements = 0,
        clicks = 0,
        touchEvents = 0,
        startTime = 0,
        scrolls = 0,
        keyPresses = 0,
        lastActivity = 0
      } = behaviorData;

      // 验证所有字段都是数字且在合理范围内
      const fields = { mouseMovements, clicks, touchEvents, startTime, scrolls, keyPresses, lastActivity };
      for (const [, value] of Object.entries(fields)) {
        if (typeof value !== 'number' || value < 0 || !Number.isFinite(value)) {
          return NextResponse.json(
            { error: '行为数据包含无效值' },
            { status: 400 }
          );
        }
      }

      const timeSpent = startTime ? (Date.now() - startTime) / 1000 : 0;
      const isMobile = request.headers.get('user-agent')?.match(/Android|iPhone|iPad|iPod/i);

      // 检查时间是否合理（不能是未来时间，不能超过1小时）
      if (timeSpent < 0 || timeSpent > 3600) {
        return NextResponse.json(
          { error: '检测到异常行为：时间数据异常' },
          { status: 403 }
        );
      }

      // 基本检查：停留时间至少10秒
      if (timeSpent < 10) {
        return NextResponse.json(
          { error: '检测到异常行为：停留时间过短，请正常填写问卷' },
          { status: 403 }
        );
      }

      // PC端检查鼠标移动
      if (!isMobile && mouseMovements < 5) {
        return NextResponse.json(
          { error: '检测到异常行为：缺少正常交互，请正常填写问卷' },
          { status: 403 }
        );
      }

      // 移动端检查触摸事件
      if (isMobile && touchEvents < 3) {
        return NextResponse.json(
          { error: '检测到异常行为：缺少正常交互，请正常填写问卷' },
          { status: 403 }
        );
      }

      // 检查点击次数（至少3次）
      if (clicks < 3) {
        return NextResponse.json(
          { error: '检测到异常行为：交互次数过少，请正常填写问卷' },
          { status: 403 }
        );
      }
    }

    // 6. 验证数据完整性和合法性
    const validation = validateSurveyData(body);
    if (!validation.valid) {
      return NextResponse.json(
        {
          error: '数据验证失败',
          message: '提交的数据不符合要求',
          details: validation.errors
        },
        { status: 400 }
      );
    }

    // 7. 提取并清理验证后的数据（额外的安全层）
    const {
      industry,
      salary_months,
      personal_income,
      friends_status,
      personal_arrears,
      friends_arrears_perception,
      welfare_cut
    } = body;

    // 8. 数据清理和类型转换（防止 SQL 注入和数据污染）
    const cleanedData = {
      industry: String(industry).trim().substring(0, 100),
      salary_months: parseFloat(String(salary_months)),
      personal_income: String(personal_income).trim().substring(0, 100),
      friends_status: String(friends_status).trim().substring(0, 100),
      personal_arrears: String(personal_arrears).trim().substring(0, 100),
      friends_arrears_perception: String(friends_arrears_perception).trim().substring(0, 100),
      welfare_cut: JSON.stringify(Array.isArray(welfare_cut) ? welfare_cut : [])
    };

    // 9. 最终验证清理后的数据
    if (isNaN(cleanedData.salary_months)) {
      return NextResponse.json(
        {
          error: '数据格式错误',
          message: 'salary_months 必须是有效的数字'
        },
        { status: 400 }
      );
    }

    // 10. 插入数据到数据库（使用参数化查询，防止 SQL 注入，带超时保护）
    try {
      const dbTimeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Database timeout')), 10000); // 10秒超时
      });

      await Promise.race([
        sql`
          INSERT INTO survey_responses (
            industry,
            salary_months,
            personal_income,
            friends_status,
            personal_arrears,
            friends_arrears_perception,
            welfare_cut
          )
          VALUES (
            ${cleanedData.industry},
            ${cleanedData.salary_months},
            ${cleanedData.personal_income},
            ${cleanedData.friends_status},
            ${cleanedData.personal_arrears},
            ${cleanedData.friends_arrears_perception},
            ${cleanedData.welfare_cut}
          )
        `,
        dbTimeoutPromise
      ]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('timeout')) {
        return NextResponse.json(
          {
            error: '数据库操作超时',
            message: '服务器繁忙，请稍后重试'
          },
          { status: 503 }
        );
      }
      throw error; // 其他错误继续抛出
    }

    // 11. 返回成功响应（带安全头）
    return NextResponse.json(
      {
        success: true,
        message: '提交成功'
      },
      {
        status: 200,
        headers: {
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY',
          'X-XSS-Protection': '1; mode=block'
        }
      }
    );
  } catch (error) {
    // 记录错误但不暴露详细信息给客户端
    if (error instanceof Error) {
      console.error('[Survey Submit Error]', {
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    } else {
      console.error('[Survey Submit Error]', error);
    }

    return NextResponse.json(
      {
        error: '提交失败',
        message: '服务器处理请求时发生错误，请稍后重试'
      },
      {
        status: 500,
        headers: {
          'X-Content-Type-Options': 'nosniff'
        }
      }
    );
  }
}

