-- 创建问卷回复表（包含所有 7 个字段）
CREATE TABLE IF NOT EXISTS survey_responses (
  id SERIAL PRIMARY KEY,
  industry VARCHAR(100) NOT NULL,
  salary_months DECIMAL(4, 1) NOT NULL,
  personal_income VARCHAR(100) NOT NULL,
  friends_status VARCHAR(100) NOT NULL,
  personal_arrears VARCHAR(100) NOT NULL,
  friends_arrears_perception VARCHAR(100) NOT NULL,
  welfare_cut TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_created_at ON survey_responses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_personal_income ON survey_responses(personal_income);
CREATE INDEX IF NOT EXISTS idx_friends_status ON survey_responses(friends_status);
CREATE INDEX IF NOT EXISTS idx_personal_arrears ON survey_responses(personal_arrears);

-- 创建聚合统计表（用于缓存计算结果）
CREATE TABLE IF NOT EXISTS aggregated_stats (
  id SERIAL PRIMARY KEY,
  total_responses INTEGER NOT NULL,
  avg_salary_months DECIMAL(10, 2) NOT NULL,
  income_growth INTEGER NOT NULL,
  income_stable INTEGER NOT NULL,
  income_decline INTEGER NOT NULL,
  friends_better INTEGER NOT NULL,
  friends_mixed INTEGER NOT NULL,
  friends_worse INTEGER NOT NULL,
  arrears_safe INTEGER NOT NULL,
  arrears_risk INTEGER NOT NULL,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 插入初始统计记录（指定 id=1，确保与触发器一致）
INSERT INTO aggregated_stats (
  id, total_responses, avg_salary_months, income_growth, income_stable, income_decline,
  friends_better, friends_mixed, friends_worse, arrears_safe, arrears_risk
) VALUES (1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)
ON CONFLICT (id) DO NOTHING;

-- 创建触发器函数来自动更新统计数据
CREATE OR REPLACE FUNCTION update_aggregated_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE aggregated_stats
  SET
    total_responses = (SELECT COUNT(*) FROM survey_responses),
    avg_salary_months = (
      SELECT COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY salary_months), 0)
      FROM survey_responses
    ),
    income_growth = (SELECT COUNT(*) FROM survey_responses WHERE personal_income = '逆势增长 (涨幅 > 10%)'),
    income_stable = (SELECT COUNT(*) FROM survey_responses WHERE personal_income = '基本持平 (波动 < 10%)'),
    income_decline = (SELECT COUNT(*) FROM survey_responses WHERE personal_income IN ('温和下跌 (跌幅 10%-30%)', '严重下跌 (跌幅 > 30%)', '腰斩/失业归零')),
    friends_better = (SELECT COUNT(*) FROM survey_responses WHERE friends_status = '普遍在涨薪/跳槽，行情不错'),
    friends_mixed = (SELECT COUNT(*) FROM survey_responses WHERE friends_status = '只有极个别能力强的在涨，大部分苟着'),
    friends_worse = (SELECT COUNT(*) FROM survey_responses WHERE friends_status IN ('大家都在降薪/被裁，怨气很重', '都在谈论维权/讨薪，情况恶劣')),
    arrears_safe = (SELECT COUNT(*) FROM survey_responses WHERE personal_arrears IN ('从未欠薪，按时发放', '偶尔延迟，最终发了')),
    arrears_risk = (SELECT COUNT(*) FROM survey_responses WHERE personal_arrears IN ('正在被拖欠 (3个月以内)', '正在被拖欠 (半年以上/无望)')),
    last_updated = CURRENT_TIMESTAMP
  WHERE id = 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器
DROP TRIGGER IF EXISTS trigger_update_stats ON survey_responses;
CREATE TRIGGER trigger_update_stats
AFTER INSERT OR UPDATE OR DELETE ON survey_responses
FOR EACH STATEMENT
EXECUTE FUNCTION update_aggregated_stats();

-- 创建全局速率限制表
CREATE TABLE IF NOT EXISTS rate_limit_global (
  id SERIAL PRIMARY KEY,
  window_start TIMESTAMP NOT NULL UNIQUE,
  request_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_rate_limit_window ON rate_limit_global(window_start DESC);

-- 创建自动清理过期记录的函数
CREATE OR REPLACE FUNCTION cleanup_old_rate_limit_records()
RETURNS void AS $$
BEGIN
  DELETE FROM rate_limit_global
  WHERE window_start < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;
-- 创建已使用token表（防止token重放攻击）
CREATE TABLE IF NOT EXISTS used_tokens (
  id SERIAL PRIMARY KEY,
  token VARCHAR(100) NOT NULL UNIQUE,
  used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_used_tokens_token ON used_tokens(token);
CREATE INDEX IF NOT EXISTS idx_used_tokens_expires ON used_tokens(expires_at);

-- 创建自动清理过期token的函数
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS void AS $$
BEGIN
  DELETE FROM used_tokens
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- 创建定时任务（使用 pg_cron 扩展，如果可用）
-- 注意：pg_cron 需要在数据库中启用：CREATE EXTENSION IF NOT EXISTS pg_cron;
-- 如果 pg_cron 不可用，这些语句会失败但不影响其他功能
DO $$
BEGIN
  -- 尝试创建定时任务
  -- 每小时清理一次过期的速率限制记录
  PERFORM cron.schedule('cleanup-rate-limit', '0 * * * *', 'SELECT cleanup_old_rate_limit_records()');

  -- 每小时清理一次过期的 token
  PERFORM cron.schedule('cleanup-tokens', '0 * * * *', 'SELECT cleanup_expired_tokens()');
EXCEPTION
  WHEN undefined_function THEN
    RAISE NOTICE 'pg_cron extension not available. Please run cleanup functions manually or use external scheduler.';
  WHEN OTHERS THEN
    RAISE NOTICE 'Failed to create cron jobs: %. Please run cleanup functions manually.', SQLERRM;
END $$;

-- 注意：不添加submission_hash字段
-- 原因：不同用户可能填写完全相同的答案，内容去重会误伤正常用户
-- Token一次性使用机制已经足够防止重放攻击

