/**
 * Google reCAPTCHA v2 服务端验证
 */

const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY;
const RECAPTCHA_VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';

/**
 * 验证reCAPTCHA token
 * @param token 客户端返回的reCAPTCHA token
 * @returns 验证结果
 */
export async function verifyRecaptcha(token: string): Promise<{
  success: boolean;
  error?: string;
}> {
  // 检查是否配置了密钥（生产环境必须配置）
  if (!RECAPTCHA_SECRET_KEY) {
    console.error('[reCAPTCHA] RECAPTCHA_SECRET_KEY not configured - this is a critical security issue');
    return {
      success: false,
      error: 'reCAPTCHA服务未正确配置，请联系管理员'
    };
  }

  // 验证token是否存在
  if (!token) {
    return { success: false, error: 'reCAPTCHA token缺失' };
  }

  try {
    const response = await fetch(RECAPTCHA_VERIFY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `secret=${RECAPTCHA_SECRET_KEY}&response=${token}`,
    });

    if (!response.ok) {
      console.error('[reCAPTCHA] HTTP error:', response.status);
      return {
        success: false,
        error: 'reCAPTCHA验证服务异常'
      };
    }

    const data = await response.json();

    if (!data.success) {
      console.warn('[reCAPTCHA] Verification failed:', data['error-codes']);
      return {
        success: false,
        error: 'reCAPTCHA验证失败，请重试'
      };
    }

    // 验证成功
    return { success: true };
  } catch (error) {
    console.error('[reCAPTCHA] Verification error:', error);
    return {
      success: false,
      error: 'reCAPTCHA验证服务异常，请稍后重试'
    };
  }
}

