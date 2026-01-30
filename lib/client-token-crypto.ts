/**
 * 客户端Token生成模块
 *
 * 安全说明：
 * 客户端不应该使用加密密钥生成token，因为任何客户端密钥都会暴露。
 * 改用简单的随机token，真正的安全性由以下机制保证：
 * 1. reCAPTCHA 验证（防止机器人）
 * 2. 行为数据验证（检测自动化）
 * 3. Token一次性使用（防止重放攻击）
 * 4. 服务端数据验证（防止篡改）
 */

'use client';

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
 * 生成简单的随机token（客户端调用）
 * 格式：timestamp-random
 *
 * 安全性由以下机制保证：
 * - reCAPTCHA 验证
 * - 行为数据验证
 * - Token一次性使用（数据库记录）
 * - 服务端数据完整性验证
 *
 * @param _surveyData 问卷数据（保留参数以兼容现有代码，但不使用）
 * @param _clientTimestamp 客户端时间戳（保留参数以兼容现有代码，但不使用）
 * @returns 简单token字符串
 */
export async function generateEncryptedToken(
  _surveyData: SurveyData,
  _clientTimestamp?: number
): Promise<string> {
  const timestamp = Date.now();

  // 生成随机字符串（使用 Web Crypto API）
  const randomBytes = new Uint8Array(16);
  crypto.getRandomValues(randomBytes);
  const random = Array.from(randomBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  // 格式：timestamp-random（与服务端期望的格式不同，但服务端会适配）
  return `${timestamp}-${random}`;
}

/**
 * 验证token格式（客户端简单验证）
 * 格式：timestamp-random（2部分）
 */
export function validateTokenFormat(token: string): boolean {
  if (!token || typeof token !== 'string') {
    return false;
  }

  const parts = token.split('-');
  if (parts.length !== 2) {
    return false;
  }

  const [timestampStr, random] = parts;
  const timestamp = parseInt(timestampStr || '');

  // 验证时间戳是有效数字
  if (isNaN(timestamp)) {
    return false;
  }

  // 检查随机字符串长度（应该是32字符，16字节的hex）
  if (random?.length !== 32) {
    return false;
  }

  // 检查时间戳是否合理（不能是未来时间）
  const now = Date.now();
  if (timestamp > now + 60000) {
    return false;
  }

  return true;
}

