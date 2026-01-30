import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { checkGlobalRateLimit, validateAndConsumeToken } from '@/lib/rate-limit';
import { validateSurveyData } from '@/lib/validation';
import { validateCSRF } from '@/lib/csrf-protection';
import { validateEncryptedToken } from '@/lib/token-crypto';
import { verifyRecaptcha } from '@/lib/recaptcha';
import { isMobileUserAgent } from '@/lib/user-agent-utils';

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

    // 4. 解析请求体（带错误处理）
    // 注意：不使用 Promise.race 超时，因为它不会取消原操作
    // Next.js 的 request.json() 已经有内置超时机制
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          error: '无效的请求格式',
          message: '请求数据格式错误'
        },
        { status: 400 }
      );
    }
    const { submitToken, behaviorData, recaptchaToken } = body;

    // 5. 验证reCAPTCHA（防止机器人）
    const recaptchaResult = await verifyRecaptcha(recaptchaToken);
    if (!recaptchaResult.success) {
      return NextResponse.json(
        {
          error: 'reCAPTCHA验证失败',
          message: recaptchaResult.error || '请完成人机验证'
        },
        { status: 400 }
      );
    }

    // 6. 验证加密token（防止篡改和重放攻击）
    // 5.1. 首先验证token是否由问卷数据加密生成（防止篡改）
    const tokenValidation = validateEncryptedToken(submitToken, {
      industry: body.industry,
      salary_months: body.salary_months,
      personal_income: body.personal_income,
      friends_status: body.friends_status,
      personal_arrears: body.personal_arrears,
      friends_arrears_perception: body.friends_arrears_perception,
      welfare_cut: body.welfare_cut
    });

    if (!tokenValidation.valid) {
      console.warn('[Token Validation Failed]', tokenValidation.reason);
      return NextResponse.json(
        {
          error: '无效的提交请求',
          message: '请刷新页面后重试',
          debug: process.env.NODE_ENV === 'development' ? tokenValidation.reason : undefined
        },
        { status: 400 }
      );
    }

    // 5.2. 然后检查token是否已被使用（防止重放攻击）
    const tokenConsumed = await validateAndConsumeToken(submitToken);
    if (!tokenConsumed) {
      return NextResponse.json(
        {
          error: '无效的提交请求',
          message: 'Token无效，请刷新页面后重试'
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
      const isMobile = isMobileUserAgent(request.headers.get('user-agent'));

      // 检查时间是否合理
      // 1. 不能是未来时间
      // 2. 不能超过10分钟（正常用户完成问卷需要30秒-5分钟，10分钟已经很宽松）
      // 3. 与Token有效期（2分钟）保持合理关系，防止长时间保持页面后批量提交
      const MAX_TIME_WINDOW = 600; // 10分钟（秒）
      const MIN_TIME_SPENT = 10; // 最少10秒

      if (timeSpent < 0 || timeSpent > MAX_TIME_WINDOW) {
        return NextResponse.json(
          { error: '检测到异常行为：时间数据异常' },
          { status: 403 }
        );
      }

      // 基本检查：停留时间至少10秒
      if (timeSpent < MIN_TIME_SPENT) {
        return NextResponse.json(
          { error: '检测到异常行为：停留时间过短，请正常填写问卷' },
          { status: 403 }
        );
      }

      // 检查最后活动时间（防止长时间挂起页面后提交）
      // lastActivity 应该在最近的合理时间内（比如最近2分钟）
      const timeSinceLastActivity = lastActivity ? (Date.now() - lastActivity) / 1000 : Infinity;
      const MAX_IDLE_TIME = 120; // 最后活动距离现在不能超过2分钟

      if (timeSinceLastActivity > MAX_IDLE_TIME) {
        return NextResponse.json(
          { error: '检测到异常行为：长时间无活动，请刷新页面重新填写' },
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
    // 注意：welfare_cut 已经在 validateSurveyData 中验证为数组，无需再次检查
    const cleanedData = {
      industry: String(industry).trim().substring(0, 100),
      salary_months: parseFloat(String(salary_months)),
      personal_income: String(personal_income).trim().substring(0, 100),
      friends_status: String(friends_status).trim().substring(0, 100),
      personal_arrears: String(personal_arrears).trim().substring(0, 100),
      friends_arrears_perception: String(friends_arrears_perception).trim().substring(0, 100),
      welfare_cut: JSON.stringify(welfare_cut) // 已验证为数组，直接使用
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

    // 注意：不检测提交内容是否重复
    // 原因：不同用户可能填写完全相同的答案（如都是"互联网/大厂，2个月，温和下跌"）
    // Token一次性使用机制已经足够防止同一用户的重放攻击

    // 10. 插入数据到数据库（使用参数化查询，防止 SQL 注入）
    // 使用 PostgreSQL 的 statement_timeout 而非 Promise.race，确保超时时查询真正被取消
    let insertResult: Array<Record<string, any>>;
    try {
      // 使用事务并设置语句级超时（10秒），超时后 PostgreSQL 会真正取消查询
      await sql`BEGIN`;
      await sql`SET LOCAL statement_timeout = '10s'`;

      // 使用 RETURNING id 来确认插入成功
      insertResult = await sql`
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
        RETURNING id
      `;

      await sql`COMMIT`;
    } catch (error) {
      // 回滚事务
      try {
        await sql`ROLLBACK`;
      } catch (rollbackError) {
        console.error('[Transaction Rollback Failed]', rollbackError);
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      // PostgreSQL 超时错误包含 "canceling statement due to statement timeout"
      if (errorMessage.includes('timeout') || errorMessage.includes('canceling statement')) {
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

    // 11. 验证插入结果（确保数据真正插入到数据库）
    // 使用 RETURNING 子句，如果插入成功会返回包含 id 的数组
    if (!insertResult || insertResult.length !== 1 || !insertResult[0]?.['id']) {
      console.error('[Database Insert Failed]', {
        resultLength: insertResult?.length,
        result: insertResult,
        message: '数据未成功插入到数据库'
      });
      throw new Error('数据插入失败：未返回插入的记录');
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

