'use client';

import React, { useState, useEffect } from 'react';
import {
  ArrowRight, Lock, ShieldCheck, BarChart3,
  ChevronRight, Check, Calculator
} from 'lucide-react';
import { signInAnonymously, onAuthStateChanged, User } from 'firebase/auth';
import { collection, addDoc } from 'firebase/firestore';
import { auth, db, appId, COLLECTION_NAME } from '@/lib/firebase';
import { questions, Question } from '@/lib/questions';
import DataDashboard from '@/components/DataDashboard';
import SafetyResult from '@/components/SafetyResult';

export default function SuanZhangFullSurvey() {
  const [user, setUser] = useState<User | null>(null);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [viewMode, setViewMode] = useState<'survey' | 'dashboard'>('survey');
  const [currentSelection, setCurrentSelection] = useState<string | null>(null);

  useEffect(() => {
    // 匿名登录
    const init = async () => {
      try {
        await signInAnonymously(auth);
      } catch (e) { console.error(e); }
    };
    init();
    return onAuthStateChanged(auth, setUser);
  }, []);

  const submitData = async (finalAnswers: Record<string, any>) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', COLLECTION_NAME), {
        ...finalAnswers,
        uid: 'ANON_' + Math.random().toString(36).substr(2, 9), // 仅存随机伪ID
        timestamp: new Date().toISOString(),
      });
    } catch (e) { console.error(e); }
  };

  const handleAnswer = (key: string, value: any) => {
    const newAns = { ...answers, [key]: value };
    setAnswers(newAns);
    setCurrentSelection(null);

    if (step === questions.length) {
      submitData(newAns);
    }

    setTimeout(() => setStep(prev => prev + 1), 250);
  };

  const handleMulti = (key: string, val: string) => {
    const curr = answers[key] || [];
    const next = curr.includes(val) ? curr.filter((i: string) => i !== val) : [...curr, val];
    setAnswers({ ...answers, [key]: next });
  };

  const submitMulti = () => {
    if (step === questions.length) submitData(answers);
    setStep(prev => prev + 1);
  };

  if (viewMode === 'dashboard') return <DataDashboard onBack={() => setViewMode('survey')} />;

  // Intro
  if (step === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-stone-950 text-stone-100 p-6 font-sans">
        <div className="max-w-lg w-full space-y-10 animate-in fade-in duration-700">
          <div className="border-l-2 border-red-600 pl-6">
            <h1 className="text-5xl md:text-6xl font-black text-white mb-2 tracking-tighter">算账</h1>
            <div className="flex items-center gap-2 text-stone-500 font-mono text-sm uppercase tracking-widest">
               <Lock size={14} />
               <span>Reckoning 2025</span>
            </div>
          </div>

          <div className="space-y-4 text-lg text-stone-400 leading-relaxed">
            <p><strong>不记录 IP，不记录身份。</strong></p>
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
              onClick={() => setViewMode('dashboard')}
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
    return <SafetyResult onReset={() => { setAnswers({}); setStep(0); }} onViewData={() => setViewMode('dashboard')} />;
  }

  // Survey
  const q = questions[step - 1];
  const progress = (step / questions.length) * 100;

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col font-sans">
      <div className="w-full h-1 bg-stone-900 sticky top-0 z-50">
        <div className="h-full bg-red-600 transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-4 w-full max-w-2xl mx-auto mt-4">
        <div className="w-full animate-in fade-in slide-in-from-right-8 duration-300" key={step}>

          <div className="mb-8 border-b border-stone-800 pb-4">
            <div className="flex items-center gap-2 text-stone-500 font-mono text-xs mb-2">
              <Calculator size={14} />
              <span>QUESTION 0{step} / 0{questions.length}</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold mb-3 leading-snug">{q.question}</h2>
            {q.sub && <p className="text-stone-400 text-sm italic">{q.sub}</p>}
          </div>

          <div className="space-y-3">
            {/* 单选 */}
            {q.type === 'choice' && q.options?.map((opt, i) => (
              <button
                key={i}
                onClick={() => handleAnswer(q.id, opt)}
                className="w-full text-left p-4 rounded border border-stone-800 bg-stone-900/30 hover:bg-stone-100 hover:text-stone-900 hover:border-stone-100 transition-all flex justify-between items-center group"
              >
                <span className="text-lg">{opt}</span>
                <ChevronRight className="opacity-0 group-hover:opacity-100 transition-all" size={18} />
              </button>
            ))}

            {/* 滑块 (核心功能回归) */}
            {q.type === 'range' && (
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
                  min={q.min} max={q.max} step={q.step}
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
            {q.type === 'multi' && (
              <>
                {q.options?.map((opt, i) => {
                  const active = (answers[q.id] || []).includes(opt);
                  return (
                    <button
                      key={i}
                      onClick={() => handleMulti(q.id, opt)}
                      className={`w-full text-left p-4 rounded border transition-all flex justify-between items-center ${
                        active
                          ? 'border-red-600 bg-stone-900 text-red-500'
                          : 'border-stone-800 text-stone-400 hover:bg-stone-900 hover:text-stone-200'
                      }`}
                    >
                      <span>{opt}</span>
                      {active && <Check size={18} />}
                    </button>
                  );
                })}
                <button
                  onClick={submitMulti}
                  className="w-full py-4 bg-stone-100 text-stone-900 font-bold mt-6 hover:bg-white rounded disabled:opacity-50"
                  disabled={!answers[q.id] || answers[q.id].length === 0}
                >
                  确认提交
                </button>
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
