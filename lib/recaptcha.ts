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
  // 检查是否配置了密钥
  if (!RECAPTCHA_SECRET_KEY) {
    console.error('[reCAPTCHA] RECAPTCHA_SECRET_KEY not configured');
    // 开发环境允许通过，生产环境拒绝
    if (process.env.NODE_ENV === 'development') {
      console.warn('[reCAPTCHA] Development mode: bypassing verification');
      return { success: true };
    }
    return { success: false, error: 'reCAPTCHA未配置' };
  }

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

    const data = await response.json();

    if (!data.success) {
      console.warn('[reCAPTCHA] Verification failed:', data['error-codes']);
      return { 
        success: false, 
        error: 'reCAPTCHA验证失败' 
      };
    }

    // 检查分数（v2不需要，但保留兼容性）
    return { success: true };
  } catch (error) {
    console.error('[reCAPTCHA] Verification error:', error);
    return { 
      success: false, 
      error: 'reCAPTCHA验证服务异常' 
    };
  }
}

