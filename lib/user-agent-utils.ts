/**
 * User-Agent 工具函数
 * 提供统一的设备检测逻辑，确保客户端和服务端判断一致
 */

/**
 * 移动设备检测正则表达式
 * 包含常见的移动设备标识
 */
const MOBILE_REGEX = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;

/**
 * 检测是否为移动设备（客户端使用）
 * @returns {boolean} 如果是移动设备返回 true，否则返回 false
 */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }
  
  return MOBILE_REGEX.test(navigator.userAgent);
}

/**
 * 检测是否为移动设备（服务端使用）
 * @param userAgent - User-Agent 字符串
 * @returns {boolean} 如果是移动设备返回 true，否则返回 false
 */
export function isMobileUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent) {
    return false;
  }
  
  return MOBILE_REGEX.test(userAgent);
}

/**
 * 获取设备类型描述
 * @param userAgent - User-Agent 字符串（可选，服务端使用）
 * @returns {string} 设备类型：'mobile' 或 'desktop'
 */
export function getDeviceType(userAgent?: string | null): 'mobile' | 'desktop' {
  if (userAgent !== undefined) {
    // 服务端调用
    return isMobileUserAgent(userAgent) ? 'mobile' : 'desktop';
  } else {
    // 客户端调用
    return isMobileDevice() ? 'mobile' : 'desktop';
  }
}

