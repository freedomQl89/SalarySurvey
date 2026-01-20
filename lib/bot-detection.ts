/**
 * 反机器人检测
 * 通过用户行为特征判断是否为真实用户
 */

const STORAGE_KEY = 'user_behavior';

interface BehaviorData {
  mouseMovements: number;
  clicks: number;
  scrolls: number;
  keyPresses: number;
  startTime: number;
  lastActivity: number;
  touchEvents: number;
}

let behaviorData: BehaviorData = {
  mouseMovements: 0,
  clicks: 0,
  scrolls: 0,
  keyPresses: 0,
  startTime: Date.now(),
  lastActivity: Date.now(),
  touchEvents: 0,
};

/**
 * 初始化行为追踪
 */
export function initBehaviorTracking(): void {
  if (typeof window === 'undefined') return;

  // 鼠标移动
  let mouseMoveCount = 0;
  window.addEventListener('mousemove', () => {
    mouseMoveCount++;
    if (mouseMoveCount % 10 === 0) { // 每10次记录一次，避免过于频繁
      behaviorData.mouseMovements++;
      behaviorData.lastActivity = Date.now();
    }
  }, { passive: true });

  // 点击
  window.addEventListener('click', () => {
    behaviorData.clicks++;
    behaviorData.lastActivity = Date.now();
  }, { passive: true });

  // 滚动
  let scrollCount = 0;
  window.addEventListener('scroll', () => {
    scrollCount++;
    if (scrollCount % 5 === 0) {
      behaviorData.scrolls++;
      behaviorData.lastActivity = Date.now();
    }
  }, { passive: true });

  // 键盘
  window.addEventListener('keydown', () => {
    behaviorData.keyPresses++;
    behaviorData.lastActivity = Date.now();
  }, { passive: true });

  // 触摸事件（移动端）
  window.addEventListener('touchstart', () => {
    behaviorData.touchEvents++;
    behaviorData.lastActivity = Date.now();
  }, { passive: true });
}

/**
 * 验证用户行为是否像真人
 */
export function validateHumanBehavior(): {
  isHuman: boolean;
  reason?: string;
  score: number;
} {
  const now = Date.now();
  const timeSpent = (now - behaviorData.startTime) / 1000; // 秒
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  let score = 0;
  const reasons: string[] = [];

  // 1. 检查停留时间（至少10秒）
  if (timeSpent < 10) {
    reasons.push('停留时间过短');
  } else {
    score += 20;
  }

  // 2. PC端检查鼠标移动
  if (!isMobile) {
    if (behaviorData.mouseMovements < 5) {
      reasons.push('鼠标移动过少');
    } else if (behaviorData.mouseMovements > 10) {
      score += 30;
    } else {
      score += 15;
    }
  }

  // 3. 移动端检查触摸事件
  if (isMobile) {
    if (behaviorData.touchEvents < 3) {
      reasons.push('触摸交互过少');
    } else {
      score += 30;
    }
  }

  // 4. 检查点击次数（至少3次，选择答案）
  if (behaviorData.clicks < 3) {
    reasons.push('点击次数过少');
  } else {
    score += 25;
  }

  // 5. 检查是否有交互（滚动或键盘）
  if (behaviorData.scrolls > 0 || behaviorData.keyPresses > 0) {
    score += 15;
  }

  // 6. 检查活跃度（最后活动时间不能太久）
  const timeSinceLastActivity = (now - behaviorData.lastActivity) / 1000;
  if (timeSinceLastActivity > 60) {
    reasons.push('长时间无活动');
    score -= 20;
  } else {
    score += 10;
  }

  // 判断阈值：60分以上认为是真人
  const isHuman = score >= 60;

  return {
    isHuman,
    reason: reasons.length > 0 ? reasons.join(', ') : undefined,
    score,
  };
}

/**
 * 获取行为数据（用于提交）
 */
export function getBehaviorData(): BehaviorData {
  return { ...behaviorData };
}

/**
 * 重置行为数据
 */
export function resetBehaviorData(): void {
  behaviorData = {
    mouseMovements: 0,
    clicks: 0,
    scrolls: 0,
    keyPresses: 0,
    startTime: Date.now(),
    lastActivity: Date.now(),
    touchEvents: 0,
  };
}

