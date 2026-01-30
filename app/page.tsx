"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  ArrowRight,
  Lock,
  ShieldCheck,
  BarChart3,
  ChevronRight,
  Check,
  Calculator,
} from "lucide-react";
import ReCAPTCHA from "react-google-recaptcha";
import { questions } from "@/lib/questions";
import DataDashboard from "@/components/DataDashboard";
import SafetyResult from "@/components/SafetyResult";
import { canSubmit, recordSubmission } from "@/lib/client-rate-limit";
import {
  initBehaviorTracking,
  validateHumanBehavior,
  getBehaviorData,
} from "@/lib/bot-detection";
import { generateEncryptedToken } from "@/lib/client-token-crypto";

export default function SuanZhangFullSurvey() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [viewMode, setViewMode] = useState<"survey" | "dashboard">("survey");
  const [currentSelection, setCurrentSelection] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRecaptchaReady, setIsRecaptchaReady] = useState(false);
  const recaptchaRef = useRef<ReCAPTCHA>(null);
  // 使用 ref 跟踪提交状态，防止竞态条件
  const isSubmittingRef = useRef(false);

  // 初始化行为追踪
  useEffect(() => {
    initBehaviorTracking();
  }, []);

  // 监听步骤变化，重置 ReCAPTCHA 状态
  useEffect(() => {
    // 如果不是最后一题，重置 ReCAPTCHA 准备状态
    if (step !== questions.length) {
      setIsRecaptchaReady(false);
    } else {
      // 到达最后一题时，延迟检查 reCAPTCHA 是否已加载
      // 因为 onLoad 回调可能不可靠
      let attempts = 0;
      const maxAttempts = 20; // 最多等待 10 秒（20 * 500ms）

      const checkRecaptcha = () => {
        attempts++;

        if (recaptchaRef.current) {
          setIsRecaptchaReady(true);
        } else if (attempts >= maxAttempts) {
          // 超时后强制设置为准备好，避免用户无法提交
          setIsRecaptchaReady(true);
          setSubmitError("人机验证加载较慢，如提交失败请刷新页面重试");
        } else {
          // 继续等待
          setTimeout(checkRecaptcha, 500);
        }
      };

      setTimeout(checkRecaptcha, 100);
    }
  }, [step]);

  const submitData = async (finalAnswers: Record<string, any>) => {
    // 防止竞态条件：检查是否已经在提交中
    if (isSubmittingRef.current) {
      console.warn('[Submit] 已有提交正在进行中，忽略重复提交');
      return false;
    }

    // 立即设置 ref（同步），防止快速重复点击
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // 1. 检查客户端速率限制
      const rateLimitCheck = canSubmit();
      if (!rateLimitCheck.allowed) {
        setSubmitError(rateLimitCheck.message || "提交过于频繁，请稍后再试");
        isSubmittingRef.current = false;
        setIsSubmitting(false);
        return false;
      }

      // 2. 验证答案完整性
      const requiredFields = questions.map(q => q.id);
      const missingFields = requiredFields.filter(field => {
        const value = finalAnswers[field];
        return value === undefined || value === null || value === '';
      });

      if (missingFields.length > 0) {
        setSubmitError(`请完成所有问题：缺少 ${missingFields.join(', ')}`);
        isSubmittingRef.current = false;
        setIsSubmitting(false);
        return false;
      }

      // 3. 验证答案有效性（选项是否匹配）
      for (const q of questions) {
        const value = finalAnswers[q.id];

        if (q.type === 'choice' && q.options) {
          if (!q.options.includes(value)) {
            setSubmitError(`无效的答案：${q.id}`);
            isSubmittingRef.current = false;
            setIsSubmitting(false);
            return false;
          }
        } else if (q.type === 'multi' && q.options) {
          if (!Array.isArray(value) || value.length === 0) {
            setSubmitError(`请至少选择一项：${q.id}`);
            isSubmittingRef.current = false;
            setIsSubmitting(false);
            return false;
          }
          for (const item of value) {
            if (!q.options.includes(item)) {
              setSubmitError(`无效的选项：${q.id}`);
              isSubmittingRef.current = false;
              setIsSubmitting(false);
              return false;
            }
          }
        } else if (q.type === 'range') {
          const numValue = Number(value);
          if (isNaN(numValue) || numValue < (q.min || 0) || numValue > (q.max || 100)) {
            setSubmitError(`数值超出范围：${q.id}`);
            isSubmittingRef.current = false;
            setIsSubmitting(false);
            return false;
          }
        }
      }

      // 4. 验证人类行为
      const behaviorCheck = validateHumanBehavior();
      if (!behaviorCheck.isHuman) {
        setSubmitError(
          `检测到异常行为：${behaviorCheck.reason}，请正常填写问卷`,
        );
        isSubmittingRef.current = false;
        setIsSubmitting(false);
        return false;
      }

      // 5. 获取reCAPTCHA token
      // 检查 reCAPTCHA 组件是否已挂载
      if (!recaptchaRef.current) {
        setSubmitError("人机验证组件未加载，请刷新页面重试");
        isSubmittingRef.current = false;
        setIsSubmitting(false);
        return false;
      }

      const recaptchaToken = recaptchaRef.current.getValue();
      if (!recaptchaToken) {
        setSubmitError("请完成人机验证");
        isSubmittingRef.current = false;
        setIsSubmitting(false);
        return false;
      }

      // 6. 生成加密token（基于问卷数据 + 客户端时间戳）
      const clientTimestamp = Date.now();
      const submitToken = await generateEncryptedToken(
        {
          industry: finalAnswers["industry"],
          salary_months: finalAnswers["salary_months"],
          personal_income: finalAnswers["personal_income"],
          friends_status: finalAnswers["friends_status"],
          personal_arrears: finalAnswers["personal_arrears"],
          friends_arrears_perception:
            finalAnswers["friends_arrears_perception"],
          welfare_cut: finalAnswers["welfare_cut"],
        },
        clientTimestamp,
      );

      // 7. 获取行为数据
      const behaviorData = getBehaviorData();

      // 8. 发送请求
      const response = await fetch("/api/survey/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...finalAnswers,
          submitToken,
          behaviorData,
          recaptchaToken,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // 处理错误
        if (response.status === 429 || response.status === 503) {
          setSubmitError(data.message || "提交过于频繁，请稍后再试");
        } else if (response.status === 403 && data.error?.includes("行为")) {
          setSubmitError(data.error || "检测到异常行为");
        } else {
          setSubmitError(data.error || "提交失败，请稍后重试");
        }
        isSubmittingRef.current = false;
        setIsSubmitting(false);
        recaptchaRef.current?.reset();
        return false;
      }

      // 9. 提交成功，记录到本地存储
      recordSubmission();
      setSubmitError(null);
      isSubmittingRef.current = false;
      setIsSubmitting(false);

      // 10. 重置reCAPTCHA
      recaptchaRef.current?.reset();

      // 11. 返回成功标志
      return true;
    } catch (e) {
      console.error("Error submitting survey:", e);
      setSubmitError("提交失败，请稍后重试");
      isSubmittingRef.current = false;
      setIsSubmitting(false);

      // 提交失败也重置reCAPTCHA
      recaptchaRef.current?.reset();
      return false;
    }
  };

  const handleAnswer = async (key: string, value: any) => {
    // 防止在提交过程中重复点击
    if (isSubmittingRef.current) {
      console.warn('[handleAnswer] 提交中，忽略点击');
      return;
    }

    const newAns = { ...answers, [key]: value };
    setAnswers(newAns);
    setCurrentSelection(null);

    // 如果是最后一题，先提交数据
    // step从1开始计数，questions.length是题目总数
    // 当step === questions.length时，表示正在回答最后一题（questions[step-1]即questions[questions.length-1]）
    if (step === questions.length) {
      const success = await submitData(newAns);
      // 只有提交成功才跳转到结果页
      if (success) {
        setTimeout(() => setStep((prev) => prev + 1), 250);
      }
    } else {
      // 非最后一题，直接跳转
      setTimeout(() => setStep((prev) => prev + 1), 250);
    }
  };

  const handleMulti = (key: string, val: string) => {
    const curr = answers[key] || [];
    const next = curr.includes(val)
      ? curr.filter((i: string) => i !== val)
      : [...curr, val];
    setAnswers({ ...answers, [key]: next });
  };

  const submitMulti = async () => {
    // 防止在提交过程中重复点击
    if (isSubmittingRef.current) {
      console.warn('[submitMulti] 提交中，忽略点击');
      return;
    }

    // 如果是最后一题，先提交数据
    // step从1开始计数，questions.length是题目总数
    // 当step === questions.length时，表示正在回答最后一题（questions[step-1]即questions[questions.length-1]）
    if (step === questions.length) {
      // submitData 内部会设置 isSubmittingRef，不需要在这里提前设置
      const success = await submitData(answers);
      // 只有提交成功才跳转到结果页
      if (success) {
        setStep((prev) => prev + 1);
      }
    } else {
      // 非最后一题，直接跳转
      setStep((prev) => prev + 1);
    }
  };

  if (viewMode === "dashboard")
    return <DataDashboard onBack={() => setViewMode("survey")} />;

  // Intro
  if (step === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-stone-950 text-stone-100 p-6 font-sans">
        <div className="max-w-lg w-full space-y-10 animate-in fade-in duration-700">
          <div className="border-l-2 border-red-600 pl-6">
            <h1 className="text-5xl md:text-6xl font-black text-white mb-2 tracking-tighter">
              算账
            </h1>
            <div className="flex items-center gap-2 text-stone-500 font-mono text-sm uppercase tracking-widest">
              <Lock size={14} />
              <span>Reckoning 2025</span>
            </div>
          </div>

          <div className="space-y-4 text-lg text-stone-400 leading-relaxed">
            <p>
              <strong>不记录 IP，不记录身份。</strong>
            </p>
            <p>
              我们需要你个人的真实数据（如实发薪资月数），也需要你对周围环境的客观观察。
            </p>
            <p className="text-stone-500 text-base">
              数据将用于生成 2025 年度全网生存状况看板。
            </p>
          </div>

          <div className="pt-6 space-y-4">
            <button
              onClick={() => setStep(1)}
              className="w-full py-5 bg-stone-100 text-stone-950 text-xl font-bold hover:bg-white transition-all flex items-center justify-center gap-3"
            >
              开始匿名记录 <ArrowRight size={20} />
            </button>

            <button
              onClick={() => setViewMode("dashboard")}
              className="w-full py-4 border border-stone-800 text-stone-500 hover:text-stone-300 hover:border-stone-600 transition-all flex items-center justify-center gap-2"
            >
              <BarChart3 size={16} /> 直接查看现有数据
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Result
  if (step > questions.length) {
    return (
      <SafetyResult
        onReset={() => {
          setAnswers({});
          setStep(0);
          setSubmitError(null);
        }}
        onViewData={() => setViewMode("dashboard")}
        error={submitError}
      />
    );
  }

  // Survey
  const q = questions[step - 1];

  // 安全检查：如果问题不存在，返回到首页
  if (!q) {
    setStep(0);
    return null;
  }

  const progress = (step / questions.length) * 100;

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col font-sans">
      <div className="w-full h-1 bg-stone-900 sticky top-0 z-50">
        <div
          className="h-full bg-red-600 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-4 w-full max-w-2xl mx-auto mt-4">
        <div
          className="w-full animate-in fade-in slide-in-from-right-8 duration-300"
          key={step}
        >
          <div className="mb-8 border-b border-stone-800 pb-4">
            <div className="flex items-center gap-2 text-stone-500 font-mono text-xs mb-2">
              <Calculator size={14} />
              <span>
                QUESTION 0{step} / 0{questions.length}
              </span>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold mb-3 leading-snug">
              {q.question}
            </h2>
            {q.sub && <p className="text-stone-400 text-sm italic">{q.sub}</p>}
          </div>

          <div className="space-y-3">
            {/* 单选 */}
            {q.type === "choice" &&
              q.options?.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => handleAnswer(q.id, opt)}
                  className="w-full text-left p-4 rounded border border-stone-800 bg-stone-900/30 hover:bg-stone-100 hover:text-stone-900 hover:border-stone-100 transition-all flex justify-between items-center group"
                >
                  <span className="text-lg">{opt}</span>
                  <ChevronRight
                    className="opacity-0 group-hover:opacity-100 transition-all"
                    size={18}
                  />
                </button>
              ))}

            {/* 滑块 (核心功能回归) */}
            {q.type === "range" && (
              <div className="py-8 px-6 bg-stone-900/50 border border-stone-800 rounded text-center">
                <div className="flex items-end justify-center gap-2 mb-2">
                  <div className="text-7xl font-black text-white font-mono tracking-tighter">
                    {currentSelection ?? 12}
                  </div>
                  <div className="text-stone-500 pb-2 mb-1">{q.unit}</div>
                </div>
                <div className="text-xs text-stone-500 mb-8">
                  （拖动滑块调整数字）
                </div>

                <input
                  type="range"
                  min={q.min}
                  max={q.max}
                  step={q.step}
                  defaultValue={12}
                  onChange={(e) => setCurrentSelection(e.target.value)}
                  className="w-full h-2 bg-stone-700 rounded-lg appearance-none cursor-pointer accent-red-600 hover:accent-red-500"
                />

                <button
                  onClick={() => handleAnswer(q.id, currentSelection ?? 12)}
                  className="w-full py-4 bg-stone-100 text-stone-900 font-bold mt-8 hover:bg-white rounded transition-all"
                >
                  确认记录
                </button>
              </div>
            )}

            {/* 多选 */}
            {q.type === "multi" && (
              <>
                {q.options?.map((opt, i) => {
                  const active = (answers[q.id] || []).includes(opt);
                  return (
                    <button
                      key={i}
                      onClick={() => handleMulti(q.id, opt)}
                      className={`w-full text-left p-4 rounded border transition-all flex justify-between items-center ${
                        active
                          ? "border-red-600 bg-stone-900 text-red-500"
                          : "border-stone-800 text-stone-400 hover:bg-stone-900 hover:text-stone-200"
                      }`}
                    >
                      <span>{opt}</span>
                      {active && <Check size={18} />}
                    </button>
                  );
                })}

                {/* reCAPTCHA */}
                <div className="flex justify-center mt-6">
                  <ReCAPTCHA
                    ref={recaptchaRef}
                    sitekey={
                      process.env["NEXT_PUBLIC_RECAPTCHA_SITE_KEY"] || ""
                    }
                    size="normal"
                    theme="dark"
                    onLoad={() => {
                      setIsRecaptchaReady(true);
                    }}
                    onErrored={() => {
                      setIsRecaptchaReady(false);
                      setSubmitError("人机验证加载失败，请刷新页面重试");
                    }}
                    onExpired={() => {
                      setSubmitError("人机验证已过期，请重新验证");
                    }}
                  />
                </div>

                {/* 调试信息（仅开发环境） */}
                {process.env.NODE_ENV === 'development' && (
                  <div className="mt-2 text-xs text-stone-600">
                    reCAPTCHA 状态: {isRecaptchaReady ? '✓ 已加载' : '⏳ 加载中...'}
                    {!process.env["NEXT_PUBLIC_RECAPTCHA_SITE_KEY"] && (
                      <span className="text-red-500"> | ⚠️ 缺少 SITE_KEY</span>
                    )}
                  </div>
                )}

                <button
                  onClick={submitMulti}
                  className="w-full py-4 bg-stone-100 text-stone-900 font-bold mt-6 hover:bg-white rounded disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  disabled={
                    !answers[q.id] ||
                    answers[q.id].length === 0 ||
                    isSubmitting ||
                    !isRecaptchaReady
                  }
                >
                  {isSubmitting
                    ? "提交中..."
                    : !isRecaptchaReady
                    ? "加载人机验证中..."
                    : "确认提交"}
                </button>

                {/* 显示提交错误 */}
                {submitError && (
                  <div className="mt-4 p-4 bg-red-900/20 border border-red-600 rounded text-red-400 text-sm">
                    {submitError}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="mt-12 text-center">
            <p className="text-stone-700 text-xs flex items-center justify-center gap-1">
              <ShieldCheck size={10} /> 此数据仅用于生成匿名统计
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
