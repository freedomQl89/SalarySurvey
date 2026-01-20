import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 生产环境优化
  poweredByHeader: false, // 隐藏 X-Powered-By 头，避免暴露技术栈

  // 压缩
  compress: true,

  // 严格模式
  reactStrictMode: true,

  // 环境变量白名单（只暴露必要的环境变量到客户端）
  env: {
    // 不暴露任何环境变量到客户端
  },
};

export default nextConfig;
