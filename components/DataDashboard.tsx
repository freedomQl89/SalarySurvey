"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { ShieldCheck, FileWarning, Users, AlertTriangle } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts";

interface DataDashboardProps {
  onBack: () => void;
}

interface StatsData {
  total: number;
  avgMonths: string;
  income: {
    growth: number;
    stable: number;
    decline: number;
  };
  friends: {
    better: number;
    mixed: number;
    worse: number;
  };
  arrears: {
    safe: number;
    risk: number;
  };
}

export default function DataDashboard({ onBack }: DataDashboardProps) {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  // 使用 ref 存储上次请求时间，避免触发重新渲染和依赖循环
  const lastFetchRef = useRef<number>(0);

  useEffect(() => {
    // 从 API 获取聚合数据
    const fetchData = async () => {
      // 防抖：如果距离上次请求不到 5 秒，跳过
      const now = Date.now();
      if (now - lastFetchRef.current < 5000) {
        return;
      }

      try {
        const response = await fetch("/api/survey/stats", {
          // 使用浏览器缓存
          cache: "default",
          next: { revalidate: 30 },
        });
        const result = await response.json();
        if (result.success) {
          setStats(result.stats);
          lastFetchRef.current = now;
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // 每 60 秒刷新一次数据（降低刷新频率）
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []); // 空依赖数组，effect 只在组件挂载时执行一次

  // 1. 关键指标（直接使用 API 返回的数据）
  const metrics = useMemo(() => {
    if (!stats) return { avgMonths: "0", total: 0 };
    return {
      total: stats.total,
      avgMonths: stats.avgMonths,
    };
  }, [stats]);

  // 2. 个人收入 vs 身边人状态对比（直接使用 API 返回的数据）
  const incomeComparison = useMemo(() => {
    if (!stats) return [];
    return [
      { name: "个人实况: 增长", value: stats.income.growth, type: "personal" },
      { name: "个人实况: 持平", value: stats.income.stable, type: "personal" },
      { name: "个人实况: 下跌", value: stats.income.decline, type: "personal" },
      {
        name: "环境体感: 普遍好",
        value: stats.friends.better,
        type: "friends",
      },
      { name: "环境体感: 普遍差", value: stats.friends.worse, type: "friends" },
    ];
  }, [stats]);

  // 3. 欠薪比例（直接使用 API 返回的数据）
  const arrearsData = useMemo(() => {
    if (!stats) return [];
    return [
      { name: "按时发放", value: stats.arrears.safe },
      { name: "遭遇欠薪", value: stats.arrears.risk },
    ];
  }, [stats]);

  if (loading)
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center text-stone-500 font-mono">
        ENCRYPTED CONNECTION...
      </div>
    );

  return (
    <div className="min-h-screen bg-stone-950 text-stone-200 p-4 md:p-8 font-sans animate-in fade-in">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-10 border-b border-stone-800 pb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
              2025 全网账本
            </h1>
            <div className="flex items-center gap-4 text-stone-500 text-xs font-mono mt-2">
              <span className="flex items-center gap-1">
                <ShieldCheck size={12} className="text-green-500" /> DATA
                ENCRYPTED
              </span>
              <span>LIVE UPDATES</span>
            </div>
          </div>
          <button
            onClick={onBack}
            className="text-sm border border-stone-700 hover:bg-stone-800 px-4 py-2 rounded text-stone-400 transition-colors"
          >
            返回首页
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Card: 关键数字 */}
          <div className="bg-stone-900 border border-stone-800 p-6 rounded-lg flex flex-col justify-center">
            <div className="text-stone-400 text-xs font-bold uppercase tracking-wider mb-2">
              平均实发薪资
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-black text-white">
                {metrics.avgMonths}
              </span>
              <span className="text-stone-500">个月</span>
            </div>
            <div className="mt-4 pt-4 border-t border-stone-800">
              <div className="text-stone-400 text-xs font-bold uppercase tracking-wider mb-1">
                样本总数
              </div>
              <div className="text-2xl font-bold text-white">
                {metrics.total}{" "}
                <span className="text-sm font-normal text-stone-500">人</span>
              </div>
            </div>
          </div>

          {/* Chart: 欠薪比例 */}
          <div className="bg-stone-900 border border-stone-800 p-6 rounded-lg">
            <h3 className="text-stone-400 text-xs font-bold mb-4 uppercase tracking-wider flex items-center gap-2">
              <FileWarning size={14} /> 样本欠薪率
            </h3>
            <div className="h-48 w-full">
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={arrearsData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={60}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    <Cell fill="#22c55e" /> {/* Green */}
                    <Cell fill="#ef4444" /> {/* Red */}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0c0a09",
                      border: "1px solid #333",
                    }}
                    itemStyle={{ color: "#fff" }}
                  />
                  <Legend
                    verticalAlign="middle"
                    align="right"
                    layout="vertical"
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-stone-500 mt-2 text-center">
              红色区域代表存在拖欠行为
            </p>
          </div>

          {/* Chart: 个人vs环境 */}
          <div className="bg-stone-900 border border-stone-800 p-6 rounded-lg lg:col-span-1">
            <h3 className="text-stone-400 text-xs font-bold mb-4 uppercase tracking-wider flex items-center gap-2">
              <Users size={14} /> 个人实感 vs 环境观察
            </h3>
            <div className="h-48 w-full">
              <ResponsiveContainer>
                <BarChart
                  data={incomeComparison}
                  layout="vertical"
                  margin={{ left: 0 }}
                >
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={110}
                    tick={{ fontSize: 10, fill: "#78716c" }}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(255,255,255,0.05)" }}
                    contentStyle={{
                      backgroundColor: "#0c0a09",
                      border: "1px solid #333",
                    }}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {incomeComparison.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.type === "personal" ? "#3b82f6" : "#57534e"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-stone-500 mt-2 text-center">
              蓝色: 个人实际 | 灰色: 观察到的环境
            </p>
          </div>

          {/* 洞察文字 */}
          <div className="lg:col-span-3 bg-stone-900 border-l-4 border-red-600 p-6">
            <h4 className="text-white font-bold mb-2 flex items-center gap-2">
              <AlertTriangle size={16} className="text-red-500" /> 数据洞察
            </h4>
            <div className="text-stone-400 text-sm space-y-2">
              <p>
                • <strong>&ldquo;平均实发薪资&rdquo;</strong>{" "}
                是衡量行业健康度的金标准。低于 12
                个月意味着大规模的年终奖取消或扣薪。
              </p>
              <p>
                • 观察
                <strong>
                  &ldquo;个人实况&rdquo;与&ldquo;环境体感&rdquo;的差值
                </strong>
                。如果环境普遍恶化（灰色条长），但个人大多持平（蓝色条长），可能存在&ldquo;幸存者偏差&rdquo;——即只有状况尚可的人才愿意填写问卷。
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
