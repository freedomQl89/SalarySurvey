/**
 * Token验证模块
 *
 * 安全说明：
 * 移除了基于加密的token验证，因为客户端密钥必然会暴露。
 * 真正的安全性由以下机制保证：
 * 1. reCAPTCHA 验证（防止机器人）
 * 2. 行为数据验证（检测自动化）
 * 3. Token一次性使用（防止重放攻击）
 * 4. 服务端数据完整性验证（防止篡改）
 */

// Token有效期（2分钟）
const TOKEN_VALIDITY = 2 * 60 * 1000;

/**
 * 问卷数据接口
 */
export interface SurveyData {
  industry: string;
  salary_months: string | number;
  personal_income: string;
  friends_status: string;
  personal_arrears: string;
  friends_arrears_perception: string;
  welfare_cut: string[] | string;
}



/**
 * 验证token是否有效（服务端调用）
 * 1. 检查token格式
 * 2. 检查时间戳是否在有效期内
 *
 * 注意：不再验证token与数据的加密匹配，因为客户端密钥必然暴露。
 * 真正的安全性由 reCAPTCHA、行为验证、一次性使用机制保证。
 *
 * @param token 格式：timestamp-random
 * @param _surveyData 问卷数据（保留参数以兼容现有代码，但不使用）
 * @returns 验证结果
 */
export function validateEncryptedToken(
  token: string,
  _surveyData: SurveyData
): { valid: boolean; reason?: string } {
  // 1. 检查token格式
  if (!token || typeof token !== 'string') {
    return { valid: false, reason: 'Token格式无效' };
  }

  const parts = token.split('-');
  if (parts.length !== 2) {
    return { valid: false, reason: 'Token格式错误' };
  }

  const [timestampStr, random] = parts;
  const timestamp = parseInt(timestampStr || '');

  if (isNaN(timestamp)) {
    return { valid: false, reason: 'Token时间戳无效' };
  }

  // 检查随机字符串长度
  if (!random || random.length !== 32) {
    return { valid: false, reason: 'Token格式错误' };
  }

  // 2. 检查时间戳是否在有效期内
  const now = Date.now();
  const tokenAge = now - timestamp;

  if (tokenAge < 0) {
    return { valid: false, reason: 'Token时间戳异常（未来时间）' };
  }

  if (tokenAge > TOKEN_VALIDITY) {
    return { valid: false, reason: 'Token已过期' };
  }

  return { valid: true };
}

/**
 * 获取Token有效期
 */
export function getTokenValidityDuration(): number {
  return TOKEN_VALIDITY;
}

