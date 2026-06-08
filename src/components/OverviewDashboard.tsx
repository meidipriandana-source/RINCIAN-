import React, { useState, useMemo } from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { Wallet, CheckCircle2, TrendingUp, Calendar } from "lucide-react";
import { motion } from "motion/react";
import { BudgetCategory, RealisasiTransaction } from "../types";
import {
  formatCurrency,
  calculateCategoryRealisasi,
  calculateCategoryRencana,
  getMonthName,
  getShortMonthName
} from "../utils";

const getCategoryColor = (id: string): string => {
  switch (id) {
    case "makan-minum": return "#f59e0b"; // Amber / Orange
    case "honorarium": return "#6366f1"; // Indigo / Blue-purple
    case "kontribusi": return "#06b6d4"; // Cyan
    case "perjadin": return "#8b5cf6"; // Purple / Violet
    case "barang-habis": return "#e11d48"; // Rose / Pink-red
    default: return "#10b981"; // Emerald / Green
  }
};

interface OverviewDashboardProps {
  categories: BudgetCategory[];
  transactions: RealisasiTransaction[];
  theme: "light" | "dark" | "navy" | "contrast";
  themeClasses: any;
  totalAnggaran: number;
  totalRealisasi: number;
  totalSisa: number;
  persentaseRealisasi: number;
  monthlyRealisasiStats: number[];
  maxMonthValue: number;
  projectionData: {
    slope: number;
    averageSpentMay: number;
    projectedSurplus: number;
    runoutMonthName: string | null;
    results: Array<{
      month: number;
      monthName: string;
      remainingBudget: number;
      projectedSpent: number;
    }>;
  };
  setActiveTab: (tabId: string) => void;
}

export const OverviewDashboard: React.FC<OverviewDashboardProps> = ({
  categories,
  transactions,
  theme,
  themeClasses,
  totalAnggaran,
  totalRealisasi,
  totalSisa,
  persentaseRealisasi,
  monthlyRealisasiStats,
  maxMonthValue,
  projectionData,
  setActiveTab
}) => {
  const isLight = theme === "light";

  // Dashboard-specific local interactive states
  const [pieChartMetric, setPieChartMetric] = useState<"spent" | "rencana">("spent");
  const [pieActiveIndex, setPieActiveIndex] = useState<number | null>(null);
  const [hoveredProjIdx, setHoveredProjIdx] = useState<number | null>(null);

  // Compute category breakdown metrics for Pie Chart dynamically inside the dashboard component
  const pieData = useMemo(() => {
    return categories.map((cat) => {
      const val = pieChartMetric === "spent"
        ? calculateCategoryRealisasi(cat.id, transactions)
        : calculateCategoryRencana(cat);

      return {
        id: cat.id,
        kode: cat.kode,
        name: cat.nama.replace("Belanja ", "").split(" - ")[0],
        fullName: cat.nama,
        value: val
      };
    }).filter(item => item.value > 0);
  }, [categories, transactions, pieChartMetric]);

  const pieTotalValue = useMemo(() => {
    return pieData.reduce((acc, curr) => acc + curr.value, 0);
  }, [pieData]);

  return (
    <div id="dashboard-capture-container" className="space-y-6 md:space-y-8 p-1">
      {/* =========================================================================
          BARIS 1: HEADER & KPI SCORECARDS (Compact Symmetrical Pillars, p-5)
          ========================================================================= */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Scorecard 1: Total Anggaran */}
        <div className={`p-5 rounded-[22px] border relative overflow-hidden shadow-lg flex flex-col justify-between group transition-all duration-300 ${isLight ? 'bg-white border-slate-200' : 'bg-[#1a1b20] border-white/5 shadow-black/40'}`}>
          <div className="absolute top-4 right-4 text-indigo-500 opacity-20 group-hover:scale-110 transition-transform duration-300">
            <Wallet size={18} />
          </div>
          <div className="space-y-0.5 relative z-10">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Total Anggaran APBD</p>
            <h3 className={`text-lg md:text-xl font-black tracking-tight ${themeClasses.textWhite}`}>
              {formatCurrency(totalAnggaran)}
            </h3>
          </div>
          <div className="mt-2.5 flex items-center gap-1.5 text-[10px] text-slate-400 relative z-10">
            <span className="font-semibold text-indigo-500">100%</span>
            <span>Alokasi RKA Dikelola</span>
          </div>
        </div>

        {/* Scorecard 2: Realisasi Anggaran */}
        <div className={`p-5 rounded-[22px] border relative overflow-hidden shadow-lg flex flex-col justify-between group transition-all duration-300 ${isLight ? 'bg-white border-slate-200' : 'bg-[#1a1b20] border-white/5 shadow-black/40'}`}>
          <div className="absolute top-4 right-4 text-[#818cf8] opacity-20 group-hover:scale-110 transition-transform duration-300">
            <CheckCircle2 size={18} />
          </div>
          <div className="space-y-0.5 relative z-10">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Realisasi Anggaran</p>
            <h3 className="text-lg md:text-xl font-black tracking-tight text-indigo-600 dark:text-[#818cf8]">
              {formatCurrency(totalRealisasi)}
            </h3>
          </div>
          <div className="mt-2.5 flex items-center gap-1.5 text-[10px] text-slate-400 relative z-10">
            <span className={`font-semibold ${persentaseRealisasi > 100 ? 'text-rose-500' : 'text-indigo-500'}`}>
              {persentaseRealisasi.toFixed(2)}%
            </span>
            <span>Tingkat Penyerapan/Serap</span>
          </div>
        </div>

        {/* Scorecard 3: Sisa Anggaran */}
        <div className={`p-5 rounded-[22px] border relative overflow-hidden shadow-lg flex flex-col justify-between group transition-all duration-300 ${isLight ? 'bg-white border-slate-200' : 'bg-[#1a1b20] border-white/5 shadow-black/40'}`}>
          <div className="absolute top-4 right-4 text-emerald-500 opacity-20 group-hover:scale-110 transition-transform duration-300">
            <TrendingUp size={18} />
          </div>
          <div className="space-y-0.5 relative z-10">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Sisa Anggaran Tersedia</p>
            <h3 className="text-lg md:text-xl font-black tracking-tight text-emerald-500">
              {formatCurrency(totalSisa)}
            </h3>
          </div>
          <div className="mt-2.5 flex items-center gap-1.5 text-[10px] text-slate-400 relative z-10">
            <span className="font-semibold text-emerald-500">
              {((totalSisa / totalAnggaran) * 100).toFixed(1)}%
            </span>
            <span>Headroom Kas Tersisa</span>
          </div>
        </div>

        {/* Scorecard 4: Absorpsi Gauge / Mini Donut Chart */}
        <div className={`p-4 rounded-[22px] border relative overflow-hidden shadow-lg flex items-center gap-3.5 transition-all duration-300 ${isLight ? 'bg-white border-slate-200' : 'bg-[#1a1b20] border-white/5 shadow-black/40'}`}>
          <div className="relative w-12 h-12 shrink-0 flex items-center justify-center">
            <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
              <circle
                cx="50"
                cy="50"
                r="41"
                fill="transparent"
                stroke={isLight ? "rgba(0, 0, 0, 0.05)" : "rgba(255, 255, 255, 0.03)"}
                strokeWidth="11"
              />
              <circle
                cx="50"
                cy="50"
                r="41"
                fill="transparent"
                stroke={persentaseRealisasi > 100 ? "#f43f5e" : "#6366f1"}
                strokeWidth="11"
                strokeDasharray={`${2 * Math.PI * 41}`}
                strokeDashoffset={`${(2 * Math.PI * 41) - (Math.min(100, persentaseRealisasi) / 100) * (2 * Math.PI * 41)}`}
                strokeLinecap="round"
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center font-mono font-black text-[10px] text-slate-800 dark:text-slate-100">
              {Math.min(100, persentaseRealisasi).toFixed(0)}%
            </div>
          </div>
          <div className="space-y-0.5 min-w-0">
            <p className="text-[8px] font-black uppercase tracking-widest text-slate-500">Tingkat Absorpsi</p>
            <h4 className={`text-md font-extrabold truncate ${themeClasses.textWhite}`}>{persentaseRealisasi.toFixed(2)}%</h4>
            <p className="text-[9px] text-slate-400 truncate">Total Penyerapan APBD</p>
          </div>
        </div>
      </section>

      {/* =========================================================================
          BARIS 2: ANALISIS GRAFIK KOMPOSISI, TREN & PROYEKSI (Sistem Grid 3 Kolom Symmetrical)
          ========================================================================= */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* Kolom 1 (Kiri): Proporsi Komposisi Anggaran (Donut Pie Chart) */}
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
          className={`p-5 rounded-[24px] border shadow-xl flex flex-col justify-between transition-all duration-350 min-h-[310px] ${isLight ? 'bg-white border-slate-200' : 'bg-[#17181d] border-white/5'}`}
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" strokeWidth="2.5" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" strokeWidth="2.5" />
              </svg>
              <h3 className={`text-sm font-bold tracking-tight ${themeClasses.textWhite}`}>
                Proporsi Komposisi Anggaran
              </h3>
            </div>
            <p className="text-[11px] text-slate-500">Proporsi kontribusi per rekening APBD</p>
          </div>

          {/* Main Recharts Donut Pie Chart */}
          <motion.div 
            initial={{ opacity: 0, y: 15, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full h-[140px] flex items-center justify-center my-1 select-none"
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={42}
                  outerRadius={58}
                  paddingAngle={3}
                  dataKey="value"
                  onMouseEnter={(_, index) => setPieActiveIndex(index)}
                  onMouseLeave={() => setPieActiveIndex(null)}
                  isAnimationActive={true}
                  animationDuration={1100}
                  animationBegin={150}
                  animationEasing="ease-out"
                >
                  {pieData.map((entry, index) => {
                    const isHovered = pieActiveIndex === index;
                    return (
                      <Cell 
                        key={`cell-${entry.id}`} 
                        fill={getCategoryColor(entry.id)} 
                        style={{
                          filter: isHovered ? "drop-shadow(0px 0px 8px rgba(99,102,241,0.5))" : "none",
                          opacity: pieActiveIndex === null || isHovered ? 1.0 : 0.45,
                          cursor: "pointer",
                        }}
                      />
                    );
                  })}
                </Pie>
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className={`p-3 border rounded-xl shadow-xl font-mono text-[10.5px] max-w-[220px] ${isLight ? "bg-white border-slate-200 text-slate-800" : "bg-[#1e1f26]/95 border-white/10 text-white"}`}>
                          <p className="font-extrabold text-[8px] text-slate-500 uppercase tracking-widest">{data.kode}</p>
                          <p className="font-bold text-indigo-555 text-indigo-500 dark:text-indigo-400 mt-0.5 line-clamp-1">{data.name}</p>
                          <div className="h-px bg-slate-200 dark:bg-white/10 my-1.5" />
                          <div className="flex justify-between items-center gap-4">
                            <span className="text-[8px] uppercase text-slate-400">Nominal:</span>
                            <span className="font-bold">{formatCurrency(data.value)}</span>
                          </div>
                          <div className="flex justify-between items-center gap-4 mt-0.5">
                            <span className="text-[8px] uppercase text-slate-400">Proporsi:</span>
                            <span className="font-black text-indigo-500">{((data.value / pieTotalValue) * 100).toFixed(1)}%</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            
            {/* Dynamic Overlay Text labels */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center transform translate-y-[2px]">
              {pieActiveIndex !== null && pieData[pieActiveIndex] ? (
                <div className="animate-in fade-in duration-200">
                  <span className="text-[15px] font-black text-slate-800 dark:text-slate-100 font-mono tracking-tight leading-none">
                    {((pieData[pieActiveIndex].value / pieTotalValue) * 100).toFixed(1)}%
                  </span>
                  <span className="block text-[8px] font-extrabold uppercase mt-1 truncate max-w-[80px]" style={{ color: getCategoryColor(pieData[pieActiveIndex].id) }}>
                    {pieData[pieActiveIndex].name}
                  </span>
                </div>
              ) : (
                <div className="animate-in fade-in duration-300">
                  <span className="text-[14px] font-black text-[#818cf8] font-mono tracking-tight leading-none block">
                    {formatCurrency(pieTotalValue / 1000000).split(',')[0]} Jt+
                  </span>
                  <span className="text-[8px] text-slate-500 uppercase font-black tracking-widest mt-0.5 block">Total APBD</span>
                </div>
              )}
            </div>
          </motion.div>

          {/* Symmetrical Metric Selection controller buttons at layout bottom */}
          <div className={`p-0.5 flex items-center rounded-xl border max-w-fit mx-auto ${isLight ? 'bg-slate-100 border-slate-200' : 'bg-[#121212] border-white/5'}`}>
            <button
              type="button"
              onClick={() => setPieChartMetric("spent")}
              className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                pieChartMetric === "spent" 
                  ? "bg-indigo-600 text-white shadow-sm" 
                  : "text-slate-500 hover:text-indigo-400"
              }`}
            >
              Serapan
            </button>
            <button
              type="button"
              onClick={() => setPieChartMetric("rencana")}
              className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                pieChartMetric === "rencana" 
                  ? "bg-indigo-600 text-white shadow-sm" 
                  : "text-slate-500 hover:text-indigo-400"
              }`}
            >
              Rencana
            </button>
          </div>
        </motion.div>

        {/* Kolom 2 (Tengah): Tren Serapan Bulanan APBD (Column Chart) */}
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
          className={`p-5 rounded-[24px] border shadow-xl flex flex-col justify-between transition-all duration-350 min-h-[310px] ${isLight ? 'bg-white border-slate-200' : 'bg-[#17181d] border-white/5'}`}
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Calendar className="text-indigo-400" size={15} />
              <h3 className={`text-sm font-bold tracking-tight ${themeClasses.textWhite}`}>
                Tren Serapan Bulanan
              </h3>
            </div>
            <p className="text-[11px] text-slate-500">Nominal realisasi belanja bulanan berjalan</p>
          </div>

          {/* Sizing box for SVG Columns */}
          <div className="pt-2 pb-1 h-36 items-end grid grid-cols-12 gap-1 relative">
            {monthlyRealisasiStats.map((amount, idx) => {
              const mName = getShortMonthName(idx + 1);
              const barHeightPct = Math.max(2, (amount / maxMonthValue) * 100);

              return (
                <div key={idx} className="group flex flex-col justify-end items-center h-full relative cursor-help">
                  
                  {/* Floating tooltip hover popover */}
                  <div className={`absolute bottom-full mb-2 hidden group-hover:block border p-2 rounded-xl text-center shadow-2xl z-30 pointer-events-none min-w-[110px] ${isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-[#1e1f26] border-white/10 text-white font-mono text-[10px]'}`}>
                    <p className="text-[8px] text-slate-400 font-bold uppercase mb-0.5">{getMonthName(idx + 1)}</p>
                    <p className="text-[10px] font-extrabold text-[#6366f1] dark:text-[#818cf8]">{formatCurrency(amount)}</p>
                  </div>

                  {/* Visual column bar */}
                  <div className={`w-full rounded-t-md grow relative overflow-hidden transition-all flex flex-col justify-end items-center border ${isLight ? 'bg-slate-50 border-slate-200/50 hover:bg-slate-100 hover:border-slate-350' : 'bg-white/[0.01] border-white/5 hover:bg-white/[0.04] hover:border-white/10'}`}>
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: `${barHeightPct}%`, opacity: 1 }}
                      transition={{ duration: 1.0, delay: idx * 0.03, ease: [0.16, 1, 0.3, 1] }}
                      className={`w-full rounded-t-sm relative ${
                        amount > 0 
                          ? "bg-gradient-to-t from-indigo-700 via-indigo-500 to-purple-400 shadow-[0_0_8px_rgba(99,102,241,0.25)]" 
                          : isLight ? "bg-slate-200/60" : "bg-white/5"
                      }`}
                    />
                  </div>

                  <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider mt-1.5 group-hover:text-indigo-555 group-hover:text-indigo-500 transition-colors">
                    {mName}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-[9px] text-slate-500 pt-2 border-t border-slate-250/20 dark:border-white/5 select-none mt-1">
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded bg-indigo-555 bg-indigo-500"></span>
              <span>Realisasi Bulanan</span>
            </div>
            <span>Puncak: <strong className="font-semibold text-slate-700 dark:text-slate-300">{formatCurrency(Math.max(...monthlyRealisasiStats))}</strong></span>
          </div>
        </motion.div>

        {/* Kolom 3 (Kanan): Proyeksi & Analisis Sisa Tahun Anggaran (Line Chart) */}
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className={`p-5 rounded-[24px] border shadow-xl flex flex-col justify-between transition-all duration-350 min-h-[310px] ${isLight ? 'bg-white border-slate-200' : 'bg-[#17181d] border-white/5'}`}
        >
          <div className="flex items-center justify-between gap-1">
            <div className="space-y-1 col-span-1">
              <div className="flex items-center gap-2">
                <TrendingUp className="text-[#818cf8]" size={15} />
                <h3 className={`text-sm font-bold tracking-tight ${themeClasses.textWhite}`}>
                  Proyeksi Sisa Pagu
                </h3>
              </div>
              <p className="text-[11px] text-slate-500">Pagu s/d Des 2026</p>
            </div>
            {projectionData.runoutMonthName ? (
              <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-450 animate-pulse shrink-0">
                Pagu Kritis
              </span>
            ) : (
              <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 shrink-0">
                Sisa Aman
              </span>
            )}
          </div>

          {/* Projection Area Graph */}
          <div className="relative w-full overflow-hidden h-[140px] flex items-end">
            {(() => {
              const chartResults = projectionData.results;
              const maxProjVal = Math.max(...chartResults.map(r => Math.max(r.remainingBudget, r.projectedSpent)), 100000);
              const paddingLeft = 45;
              const paddingRight = 10;
              const paddingTop = 12;
              const paddingBottom = 16;
              const svgWidth = 450;
              const svgHeight = 150;
              const chartWidth = svgWidth - paddingLeft - paddingRight;
              const chartHeight = svgHeight - paddingTop - paddingBottom;
              
              const pointsRemaining = chartResults.map((r, i) => {
                const x = paddingLeft + (i / 6) * chartWidth;
                const y = paddingTop + chartHeight - (r.remainingBudget / maxProjVal) * chartHeight;
                return { x, y, value: r.remainingBudget, month: r.monthName, spent: r.projectedSpent };
              });

              const pointsSpent = chartResults.map((r, i) => {
                const x = paddingLeft + (i / 6) * chartWidth;
                const y = paddingTop + chartHeight - (r.projectedSpent / maxProjVal) * chartHeight;
                return { x, y, value: r.projectedSpent, month: r.monthName, remaining: r.remainingBudget };
              });

              const remPath = pointsRemaining.length > 0 
                ? `M ${pointsRemaining[0].x} ${pointsRemaining[0].y} ` + pointsRemaining.slice(1).map(p => `L ${p.x} ${p.y}`).join(" ")
                : "";

              const spentPath = pointsSpent.length > 0 
                ? `M ${pointsSpent[0].x} ${pointsSpent[0].y} ` + pointsSpent.slice(1).map(p => `L ${p.x} ${p.y}`).join(" ")
                : "";

              return (
                <svg viewBox="0 0 450 160" className="w-full h-full">
                  {/* Grid Lines ratio */}
                  {[0.5, 1.0].map((ratio, idx) => {
                    const yVal = paddingTop + chartHeight - ratio * chartHeight;
                    const gridVal = maxProjVal * ratio;
                    const formattedLabel = gridVal >= 1000000000 
                      ? `${(gridVal/1000000000).toFixed(1)}M` 
                      : `${(gridVal/1000000).toFixed(0)}Jt`;

                    return (
                      <g key={idx}>
                        <line x1={paddingLeft} y1={yVal} x2={svgWidth - paddingRight} y2={yVal} stroke={isLight ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.03)"} />
                        <text x={paddingLeft - 6} y={yVal + 3} textAnchor="end" className="text-[9px] font-mono font-bold text-slate-500 fill-current">{formattedLabel}</text>
                      </g>
                    );
                  })}

                  {/* Lines drawing */}
                  {remPath && <path d={remPath} fill="none" stroke="#6366f1" strokeWidth="3" strokeLinecap="round" />}
                  {pointsRemaining.map((p, idx) => (
                    <circle key={idx} cx={p.x} cy={p.y} r={hoveredProjIdx === idx ? 5 : 3} fill="#6366f1" className="cursor-pointer" onMouseEnter={() => setHoveredProjIdx(idx)} onMouseLeave={() => setHoveredProjIdx(null)} />
                  ))}

                  {/* Projected spent lines */}
                  {spentPath && <path d={spentPath} fill="none" stroke="#f43f5e" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="4 2" />}
                  {pointsSpent.map((p, idx) => (
                    <circle key={idx} cx={p.x} cy={p.y} r={hoveredProjIdx === idx ? 5 : 3} fill="#f43f5e" className="cursor-pointer" onMouseEnter={() => setHoveredProjIdx(idx)} onMouseLeave={() => setHoveredProjIdx(null)} />
                  ))}

                  {/* X Axis Labels */}
                  {pointsRemaining.map((p, idx) => (
                    <text key={idx} x={p.x} y={paddingTop + chartHeight + 14} textAnchor="middle" className="text-[9px] font-bold text-slate-500 fill-current">
                      {p.month.substring(0, 3)}
                    </text>
                  ))}

                  {/* Interactive Dynamic Over tooltip details */}
                  {hoveredProjIdx !== null && (
                    <g>
                      <line x1={pointsRemaining[hoveredProjIdx].x} y1={paddingTop} x2={pointsRemaining[hoveredProjIdx].x} y2={paddingTop + chartHeight} stroke="rgba(99,102,241,0.2)" strokeDasharray="2 2" />
                      <rect x={pointsRemaining[hoveredProjIdx].x > 250 ? pointsRemaining[hoveredProjIdx].x - 120 : pointsRemaining[hoveredProjIdx].x + 10} y={paddingTop + 5} width={110} height={48} rx={6} fill={isLight ? "white" : "#1a1b20"} stroke={isLight ? "#e2e8f0" : "rgba(255,255,255,0.05)"} />
                      <text x={pointsRemaining[hoveredProjIdx].x > 250 ? pointsRemaining[hoveredProjIdx].x - 114 : pointsRemaining[hoveredProjIdx].x + 16} y={paddingTop + 17} className="text-[9px] font-bold dark:fill-white fill-slate-800">{pointsRemaining[hoveredProjIdx].month}</text>
                      <text x={pointsRemaining[hoveredProjIdx].x > 250 ? pointsRemaining[hoveredProjIdx].x - 114 : pointsRemaining[hoveredProjIdx].x + 16} y={paddingTop + 29} className="text-[9px] font-bold fill-[#6366f1]">Sisa: {formatCurrency(pointsRemaining[hoveredProjIdx].value)}</text>
                      <text x={pointsRemaining[hoveredProjIdx].x > 250 ? pointsRemaining[hoveredProjIdx].x - 114 : pointsRemaining[hoveredProjIdx].x + 16} y={paddingTop + 40} className="text-[9px] font-bold fill-rose-500">Pred: {formatCurrency(pointsRemaining[hoveredProjIdx].spent)}</text>
                    </g>
                  )}
                </svg>
              );
            })()}
          </div>

          <div className="flex items-center justify-between text-[9px] select-none text-slate-500 pt-2 border-t border-slate-250/20 dark:border-white/5 select-none mt-1">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-0.5">
                <span className="w-1.5 h-0.5 bg-[#6366f1] inline-block"></span>
                <span>Sisa</span>
              </div>
              <div className="flex items-center gap-0.5">
                <span className="w-1.5 h-0.5 border-t border-dashed border-[#f43f5e] inline-block"></span>
                <span>Pred</span>
              </div>
            </div>
            <span>Surplus Kas: <strong className="font-semibold text-emerald-500">{formatCurrency(projectionData.projectedSurplus)}</strong></span>
          </div>
        </motion.div>

      </section>

      {/* =========================================================================
          BARIS 3: TABEL KOMPARATIF EVALUASI REKENING BELANJA (Penuh 12-Kolom)
          ========================================================================= */}
      <section className={`p-5 md:p-6 rounded-[24px] shadow-xl border transition-all duration-300 ${isLight ? 'bg-white border-slate-200' : 'bg-[#17181d] border-white/5'}`}>
        <div className="flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 font-mono">
                IKHTISAR PAGU & REALISASI KOMPARATIF PER MATA REKENING
              </span>
              <h3 className={`text-base font-black tracking-tight ${themeClasses.textWhite}`}>
                Tabulasi Detail Serapan Rekening APBD
              </h3>
            </div>
            <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider hidden sm:inline-block shrink-0">
              Klik baris RKA belanja untuk menuju pengelolaan detail
            </span>
          </div>

          <div className="overflow-x-auto border border-slate-200/50 dark:border-white/5 rounded-2xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className={`text-[10px] font-semibold uppercase tracking-wider border-b ${themeClasses.tableHeader}`}>
                  <th className="p-3 pl-4">Kategori Belanja (RKA)</th>
                  <th className="p-3 text-right">Pagu Rencana</th>
                  <th className="p-3 text-right">Realisasi</th>
                  <th className="p-3 text-right">Sisa Pagu</th>
                  <th className="p-3 text-center min-w-[130px]">Absorpsi (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {categories.map((cat) => {
                  const plans = calculateCategoryRencana(cat);
                  const spent = calculateCategoryRealisasi(cat.id, transactions);
                  const sisa = Math.max(0, plans - spent);
                  const pct = plans > 0 ? (spent / plans) * 100 : 0;
                  const color = getCategoryColor(cat.id);

                  return (
                    <tr 
                      key={cat.id}
                      onClick={() => setActiveTab(cat.id)}
                      className="text-xs transition-colors hover:bg-indigo-500/[0.04] cursor-pointer group"
                    >
                      <td className="p-3 pl-4 flex items-center gap-2.5">
                        {/* Color bar indicator on leftmost cell boundary */}
                        <span className="w-1.5 h-6 rounded-full shrink-0" style={{ backgroundColor: color }} />
                        <div className="max-w-[165px] sm:max-w-none">
                          <span className="block font-bold text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-[#818cf8] transition-colors truncate">
                            {cat.nama}
                          </span>
                          <span className="block text-[8.5px] font-black font-mono text-slate-500 uppercase tracking-widest">
                            KODE: {cat.kode}
                          </span>
                        </div>
                      </td>
                      <td className="p-3 text-right font-medium text-slate-700 dark:text-slate-300 font-mono">
                        {formatCurrency(plans)}
                      </td>
                      <td className="p-3 text-right font-bold text-indigo-600 dark:text-[#818cf8] font-mono">
                        {formatCurrency(spent)}
                      </td>
                      <td className="p-3 text-right font-bold text-emerald-500 font-mono">
                        {formatCurrency(sisa)}
                      </td>
                      <td className="p-3">
                        {/* Symmetrical Inline Looker Data bars progress panel */}
                        <div className="flex items-center gap-2.5 pl-2">
                          <div className="grow bg-slate-200 dark:bg-white/5 h-2 rounded-full overflow-hidden w-20 relative border border-slate-200/50 dark:border-white/5">
                            <div 
                              className={`h-full rounded-full transition-all duration-700 ${
                                pct > 100 ? 'bg-rose-500' : pct > 80 ? 'bg-amber-400' : 'bg-gradient-to-r from-indigo-500 to-[#818cf8]'
                              }`}
                              style={{ width: `${Math.min(100, pct)}%` }}
                            />
                          </div>
                          <span className={`text-[10px] font-black shrink-0 font-mono w-10 text-right ${
                            pct > 100 ? 'text-rose-500' : pct > 80 ? 'text-amber-500' : 'text-slate-700 dark:text-slate-300'
                          }`}>
                            {pct.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

    </div>
  );
};
