'use client';

import React from 'react';
import { ShieldCheck, CheckCircle2, EyeOff, BarChart3 } from 'lucide-react';

interface SafetyResultProps {
  onReset: () => void;
  onViewData: () => void;
}

export default function SafetyResult({ onReset, onViewData }: SafetyResultProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-stone-950 text-stone-100 font-sans animate-in fade-in">
      <div className="max-w-md w-full text-center space-y-8">
        
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 bg-green-900/20 rounded-full flex items-center justify-center border border-green-800 text-green-500">
            <ShieldCheck size={40} />
          </div>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-white mb-2">数据已加密归档</h1>
          <p className="text-stone-400 text-sm">
            您的个人数据与环境观察记录已混入匿名数据池。
          </p>
        </div>

        <div className="bg-stone-900 p-6 rounded text-left space-y-4 border border-stone-800">
          <div className="flex items-start gap-3">
             <CheckCircle2 className="text-green-600 shrink-0 mt-0.5" size={18} />
             <div className="text-sm text-stone-300">
               <span className="block text-stone-500 text-xs mb-1">PRIVACY</span>
               本地 Session 已重置。
             </div>
          </div>
          <div className="flex items-start gap-3">
             <EyeOff className="text-green-600 shrink-0 mt-0.5" size={18} />
             <div className="text-sm text-stone-300">
               <span className="block text-stone-500 text-xs mb-1">NO LOGS</span>
               未关联任何身份 ID。请勿截图分享本页。
             </div>
          </div>
        </div>

        <div className="pt-8 space-y-4">
          <button 
            onClick={onViewData}
            className="w-full py-4 bg-stone-100 text-stone-950 font-bold hover:bg-white transition-all rounded shadow-lg shadow-white/5 flex items-center justify-center gap-2"
          >
            <BarChart3 size={18} /> 查看全网统计数据
          </button>
          
          <button 
            onClick={onReset}
            className="text-stone-500 text-sm hover:text-stone-300 underline underline-offset-4"
          >
            关闭 / 离开
          </button>
        </div>

      </div>
    </div>
  );
}

