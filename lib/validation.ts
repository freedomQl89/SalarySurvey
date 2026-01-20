// 输入验证模块
import { questions } from './questions';

export interface SurveyData {
  industry: string;
  salary_months: string;
  personal_income: string;
  personal_arrears: string;
  friends_status: string;
  friends_arrears_perception: string;
  welfare_cut: string[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * 验证问卷数据的完整性和合法性
 */
export function validateSurveyData(data: unknown): ValidationResult {
  const errors: string[] = [];

  // 1. 检查数据对象是否存在
  if (!data || typeof data !== 'object') {
    return {
      valid: false,
      errors: ['无效的数据格式']
    };
  }

  // 类型保护：将 data 转换为可索引的对象
  const surveyData = data as Record<string, unknown>;

  // 2. 检查所有必填字段是否存在
  const requiredFields = [
    'industry',
    'salary_months',
    'personal_income',
    'personal_arrears',
    'friends_status',
    'friends_arrears_perception'
  ];

  for (const field of requiredFields) {
    if (surveyData[field] === undefined || surveyData[field] === null || surveyData[field] === '') {
      errors.push(`缺少必填字段: ${field}`);
    }
  }

  // 如果缺少必填字段，直接返回
  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // 3. 验证 salary_months 范围和格式
  const salaryMonths = parseFloat(String(surveyData['salary_months']));
  if (isNaN(salaryMonths)) {
    errors.push('salary_months 必须是有效的数字');
  } else if (salaryMonths < 0 || salaryMonths > 18) {
    errors.push('salary_months 必须在 0-18 之间');
  } else if (salaryMonths % 0.5 !== 0) {
    errors.push('salary_months 必须是 0.5 的倍数');
  }

  // 4. 验证 industry 选项
  const industryQuestion = questions.find(q => q.id === 'industry');
  if (industryQuestion?.options) {
    if (!industryQuestion.options.includes(String(surveyData['industry']))) {
      errors.push('industry 选项无效');
    }
  }

  // 5. 验证 personal_income 选项
  const personalIncomeQuestion = questions.find(q => q.id === 'personal_income');
  if (personalIncomeQuestion?.options) {
    if (!personalIncomeQuestion.options.includes(String(surveyData['personal_income']))) {
      errors.push('personal_income 选项无效');
    }
  }

  // 6. 验证 personal_arrears 选项
  const personalArrearsQuestion = questions.find(q => q.id === 'personal_arrears');
  if (personalArrearsQuestion?.options) {
    if (!personalArrearsQuestion.options.includes(String(surveyData['personal_arrears']))) {
      errors.push('personal_arrears 选项无效');
    }
  }

  // 7. 验证 friends_status 选项
  const friendsStatusQuestion = questions.find(q => q.id === 'friends_status');
  if (friendsStatusQuestion?.options) {
    if (!friendsStatusQuestion.options.includes(String(surveyData['friends_status']))) {
      errors.push('friends_status 选项无效');
    }
  }

  // 8. 验证 friends_arrears_perception 选项
  const friendsArrearsQuestion = questions.find(q => q.id === 'friends_arrears_perception');
  if (friendsArrearsQuestion?.options) {
    if (!friendsArrearsQuestion.options.includes(String(surveyData['friends_arrears_perception']))) {
      errors.push('friends_arrears_perception 选项无效');
    }
  }

  // 9. 验证 welfare_cut 是数组且选项有效
  if (!Array.isArray(surveyData['welfare_cut'])) {
    errors.push('welfare_cut 必须是数组');
  } else {
    const welfareCutQuestion = questions.find(q => q.id === 'welfare_cut');
    if (welfareCutQuestion?.options) {
      // 检查数组长度
      if (surveyData['welfare_cut'].length === 0) {
        errors.push('welfare_cut 至少需要选择一项');
      } else if (surveyData['welfare_cut'].length > welfareCutQuestion.options.length) {
        errors.push('welfare_cut 选项数量超过限制');
      }

      // 检查每个选项是否有效
      for (const item of surveyData['welfare_cut']) {
        if (typeof item !== 'string') {
          errors.push('welfare_cut 包含非字符串选项');
          break;
        }
        if (!welfareCutQuestion.options.includes(item)) {
          errors.push(`welfare_cut 包含无效选项: ${item}`);
        }
      }
    }
  }

  // 10. 验证字符串长度（防止超长输入）
  const maxStringLength = 200;
  for (const [key, value] of Object.entries(surveyData)) {
    if (typeof value === 'string' && value.length > maxStringLength) {
      errors.push(`${key} 长度超过限制 (最大 ${maxStringLength} 字符)`);
    }
  }

  // 11. 检查是否有额外的未知字段（防止数据污染）
  const allowedFields = [
    ...requiredFields,
    'welfare_cut',
    'submitToken', // 允许提交 token
    'behaviorData' // 允许行为数据
  ];

  for (const key of Object.keys(surveyData)) {
    if (!allowedFields.includes(key)) {
      errors.push(`包含未知字段: ${key}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

