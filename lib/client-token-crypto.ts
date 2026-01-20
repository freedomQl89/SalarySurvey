/**
 * 客户端Token加密模块
 * 使用Web Crypto API实现与服务端相同的加密逻辑
 */

'use client';

// 密钥（与服务端保持一致）
// 注意：这个密钥是公开的（客户端代码），主要用于防止简单篡改
// 真正的安全性来自服务端验证token与数据的一致性
const SECRET_KEY = '39574f366ce17dd97c838538fb2a02c2';

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
 * 标准化问卷数据（与服务端保持一致）
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
 * HMAC-SHA256加密（使用Web Crypto API）
 */
async function hmacSha256(key: string, data: string): Promise<string> {
  const encoder = new TextEncoder();
  
  // 导入密钥
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  // 签名
  const signature = await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    encoder.encode(data)
  );
  
  // 转换为hex字符串
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * 多层加密函数（嵌套3层，与服务端保持一致）
 */
async function multiLayerEncrypt(data: string, timestamp: number): Promise<string> {
  // 第1层：原始数据 + 时间戳
  const layer1Input = `${data}:${timestamp}`;
  const layer1 = await hmacSha256(SECRET_KEY, layer1Input);

  // 第2层：使用第1层结果
  const layer2 = await hmacSha256(SECRET_KEY + ':layer2', layer1);

  // 第3层：使用第2层结果
  const layer3 = await hmacSha256(SECRET_KEY + ':layer3', layer2);

  return layer3; // 固定64字符（SHA256 hex）
}

/**
 * 生成加密token（客户端调用）
 * 格式：timestamp-clientTimestamp-encryptedHash
 *
 * @param surveyData 问卷数据
 * @param clientTimestamp 客户端提交时间戳（可选，默认使用当前时间）
 * @returns 加密token字符串
 */
export async function generateEncryptedToken(
  surveyData: SurveyData,
  clientTimestamp?: number
): Promise<string> {
  const timestamp = Date.now();
  const submitTimestamp = clientTimestamp || timestamp;
  const normalizedData = normalizeSurveyData(surveyData, submitTimestamp);
  const encryptedHash = await multiLayerEncrypt(normalizedData, timestamp);

  // 格式：tokenTimestamp-clientTimestamp-hash
  return `${timestamp}-${submitTimestamp}-${encryptedHash}`;
}

/**
 * 验证token格式（客户端简单验证）
 */
export function validateTokenFormat(token: string): boolean {
  if (!token || typeof token !== 'string') {
    return false;
  }

  const parts = token.split('-');
  if (parts.length !== 2) {
    return false;
  }

  const [timestampStr, hash] = parts;
  const timestamp = parseInt(timestampStr || '');

  if (isNaN(timestamp)) {
    return false;
  }

  // 检查hash长度（应该是64字符）
  if (hash?.length !== 64) {
    return false;
  }

  // 检查时间戳是否合理（不能是未来时间）
  if (timestamp > Date.now()) {
    return false;
  }

  return true;
}

