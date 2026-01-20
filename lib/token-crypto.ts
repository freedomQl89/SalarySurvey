/**
 * Token加密模块
 * 基于问卷数据生成加密token，防止篡改
 */

import crypto from 'crypto';

// 从环境变量获取密钥，如果没有则使用默认值（生产环境必须设置）
const SECRET_KEY = process.env.TOKEN_SECRET_KEY;

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
 * 标准化问卷数据（确保加密前后一致）
 * @param data 问卷数据
 * @param clientTimestamp 客户端提交时间戳（用于防止相同答案的token重复）
 */
function normalizeSurveyData(data: SurveyData, clientTimestamp: number): string {
  return JSON.stringify({
    industry: String(data.industry).trim(),
    salary_months: String(data.salary_months).trim(),
    personal_income: String(data.personal_income).trim(),
    friends_status: String(data.friends_status).trim(),
    personal_arrears: String(data.personal_arrears).trim(),
    friends_arrears_perception: String(data.friends_arrears_perception).trim(),
    welfare_cut: Array.isArray(data.welfare_cut)
      ? JSON.stringify(data.welfare_cut.sort()) // 排序确保一致性
      : String(data.welfare_cut),
    clientTimestamp: clientTimestamp // 添加客户端时间戳
  });
}

/**
 * 多层加密函数（嵌套3层）
 * 第1层：HMAC-SHA256
 * 第2层：再次HMAC-SHA256（使用第1层结果作为输入）
 * 第3层：最终HMAC-SHA256（使用第2层结果作为输入）
 */
function multiLayerEncrypt(data: string, timestamp: number): string {
  // 第1层：原始数据 + 时间戳
  const layer1Input = `${data}:${timestamp}`;
  const layer1 = crypto
    .createHmac('sha256', SECRET_KEY)
    .update(layer1Input)
    .digest('hex');

  // 第2层：使用第1层结果
  const layer2 = crypto
    .createHmac('sha256', SECRET_KEY + ':layer2')
    .update(layer1)
    .digest('hex');

  // 第3层：使用第2层结果
  const layer3 = crypto
    .createHmac('sha256', SECRET_KEY + ':layer3')
    .update(layer2)
    .digest('hex');

  return layer3; // 固定64字符（SHA256 hex）
}

/**
 * 生成加密token（服务端调用，仅用于测试）
 * 格式：timestamp-clientTimestamp-encryptedHash
 *
 * @param surveyData 问卷数据
 * @param clientTimestamp 客户端提交时间戳（可选，默认使用当前时间）
 * @returns 加密token字符串
 */
export function generateEncryptedToken(
  surveyData: SurveyData,
  clientTimestamp?: number
): string {
  const timestamp = Date.now();
  const submitTimestamp = clientTimestamp || timestamp;
  const normalizedData = normalizeSurveyData(surveyData, submitTimestamp);
  const encryptedHash = multiLayerEncrypt(normalizedData, timestamp);

  // 格式：tokenTimestamp-clientTimestamp-hash
  return `${timestamp}-${submitTimestamp}-${encryptedHash}`;
}

/**
 * 验证token是否有效（服务端调用）
 * 1. 检查token格式
 * 2. 检查时间戳是否在有效期内
 * 3. 重新加密提交的数据，对比hash是否一致
 *
 * @param token 格式：tokenTimestamp-clientTimestamp-hash
 * @param surveyData 问卷数据
 * @returns 验证结果
 */
export function validateEncryptedToken(
  token: string,
  surveyData: SurveyData
): { valid: boolean; reason?: string; clientTimestamp?: number } {
  // 1. 检查token格式
  if (!token || typeof token !== 'string') {
    return { valid: false, reason: 'Token格式无效' };
  }

  const parts = token.split('-');
  if (parts.length !== 3) {
    return { valid: false, reason: 'Token格式错误' };
  }

  const [timestampStr, clientTimestampStr, receivedHash] = parts;
  const timestamp = parseInt(timestampStr || '');
  const clientTimestamp = parseInt(clientTimestampStr || '');

  if (isNaN(timestamp) || isNaN(clientTimestamp)) {
    return { valid: false, reason: 'Token时间戳无效' };
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

  // 2.5. 检查客户端时间戳是否合理
  if (clientTimestamp < 0 || clientTimestamp > now + 60000) {
    return { valid: false, reason: '客户端时间戳异常' };
  }

  // 3. 重新加密提交的数据，对比hash
  const normalizedData = normalizeSurveyData(surveyData, clientTimestamp);
  const expectedHash = multiLayerEncrypt(normalizedData, timestamp);

  if (receivedHash !== expectedHash) {
    return { valid: false, reason: 'Token与数据不匹配（检测到篡改）' };
  }

  return { valid: true, clientTimestamp };
}

/**
 * 客户端使用的简化版本（不依赖crypto模块）
 * 注意：这个函数需要在客户端重新实现，使用Web Crypto API
 */
export function getTokenValidityDuration(): number {
  return TOKEN_VALIDITY;
}

