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

-- 插入初始统计记录
INSERT INTO aggregated_stats (
  total_responses, avg_salary_months, income_growth, income_stable, income_decline,
  friends_better, friends_mixed, friends_worse, arrears_safe, arrears_risk
) VALUES (0, 0, 0, 0, 0, 0, 0, 0, 0, 0)
ON CONFLICT DO NOTHING;

-- 创建触发器函数来自动更新统计数据
CREATE OR REPLACE FUNCTION update_aggregated_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE aggregated_stats
  SET
    total_responses = (SELECT COUNT(*) FROM survey_responses),
    avg_salary_months = (SELECT COALESCE(AVG(CAST(salary_months AS DECIMAL)), 0) FROM survey_responses),
    income_growth = (SELECT COUNT(*) FROM survey_responses WHERE personal_income LIKE '%增长%'),
    income_stable = (SELECT COUNT(*) FROM survey_responses WHERE personal_income LIKE '%持平%'),
    income_decline = (SELECT COUNT(*) FROM survey_responses WHERE personal_income NOT LIKE '%增长%' AND personal_income NOT LIKE '%持平%'),
    friends_better = (SELECT COUNT(*) FROM survey_responses WHERE friends_status LIKE '%涨薪%'),
    friends_mixed = (SELECT COUNT(*) FROM survey_responses WHERE friends_status LIKE '%个别%'),
    friends_worse = (SELECT COUNT(*) FROM survey_responses WHERE friends_status NOT LIKE '%涨薪%' AND friends_status NOT LIKE '%个别%'),
    arrears_safe = (SELECT COUNT(*) FROM survey_responses WHERE personal_arrears LIKE '%从未%' OR personal_arrears LIKE '%偶尔%'),
    arrears_risk = (SELECT COUNT(*) FROM survey_responses WHERE personal_arrears NOT LIKE '%从未%' AND personal_arrears NOT LIKE '%偶尔%'),
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
