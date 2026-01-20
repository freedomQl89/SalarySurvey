import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

export const sql = neon(process.env.DATABASE_URL);

// 数据库表结构
export interface SurveyResponse {
  id: number;
  industry: string;
  salary_months: number;
  personal_income: string;
  friends_status: string;
  personal_arrears: string;
  friends_arrears_perception: string;
  welfare_cut: string;
  created_at: Date;
}

export interface AggregatedStats {
  total_responses: number;
  avg_salary_months: number;
  income_growth: number;
  income_stable: number;
  income_decline: number;
  friends_better: number;
  friends_mixed: number;
  friends_worse: number;
  arrears_safe: number;
  arrears_risk: number;
  last_updated: Date;
}

