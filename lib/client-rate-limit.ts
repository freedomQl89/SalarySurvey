/**
 * 客户端速率限制（基于 localStorage）
 * 完全匿名，所有数据存储在用户浏览器本地
 */

const STORAGE_KEY = 'survey_submissions';
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 小时
const MAX_REQUESTS = 3; // 每小时最多 3 次

interface SubmissionRecord {
  timestamps: number[];
}

/**
 * 检查是否可以提交
 */
export function canSubmit(): {
  allowed: boolean;
  remaining: number;
  resetAt: Date | null;
  message?: string;
} {
  if (typeof window === 'undefined') {
    return { allowed: true, remaining: MAX_REQUESTS, resetAt: null };
  }

  const now = Date.now();
  const record = getSubmissionRecord();
  
  // 清理过期的时间戳
  const validTimestamps = record.timestamps.filter(
    timestamp => now - timestamp < RATE_LIMIT_WINDOW
  );
  
  const remaining = MAX_REQUESTS - validTimestamps.length;
  const allowed = remaining > 0;
  
  let resetAt: Date | null = null;
  let message: string | undefined;

  if (validTimestamps.length > 0) {
    const oldestTimestamp = validTimestamps[0];
    if (oldestTimestamp !== undefined) {
      resetAt = new Date(oldestTimestamp + RATE_LIMIT_WINDOW);
    }
  }
  
  if (!allowed && resetAt) {
    const resetTime = resetAt.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit'
    });
    message = `您已达到提交限制（每小时最多 ${MAX_REQUESTS} 次）。请在 ${resetTime} 后再试。`;
  }
  
  return {
    allowed,
    remaining,
    resetAt,
    message
  };
}

/**
 * 记录一次提交
 */
export function recordSubmission(): void {
  if (typeof window === 'undefined') return;
  
  const now = Date.now();
  const record = getSubmissionRecord();
  
  // 清理过期的时间戳
  const validTimestamps = record.timestamps.filter(
    timestamp => now - timestamp < RATE_LIMIT_WINDOW
  );
  
  // 添加新的时间戳
  validTimestamps.push(now);
  
  // 保存到 localStorage
  saveSubmissionRecord({ timestamps: validTimestamps });
}

/**
 * 生成提交 token
 */
export function generateSubmitToken(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `${timestamp}-${random}`;
}

/**
 * 获取提交记录
 */
function getSubmissionRecord(): SubmissionRecord {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) {
      return { timestamps: [] };
    }
    
    const parsed = JSON.parse(data);
    return {
      timestamps: Array.isArray(parsed.timestamps) ? parsed.timestamps : []
    };
  } catch (error) {
    console.error('Failed to read submission record:', error);
    return { timestamps: [] };
  }
}

/**
 * 保存提交记录
 */
function saveSubmissionRecord(record: SubmissionRecord): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch (error) {
    console.error('Failed to save submission record:', error);
  }
}

/**
 * 清空提交记录（用于测试）
 */
export function clearSubmissionRecord(): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear submission record:', error);
  }
}

/**
 * 获取剩余提交次数
 */
export function getRemainingSubmissions(): number {
  const result = canSubmit();
  return result.remaining;
}

