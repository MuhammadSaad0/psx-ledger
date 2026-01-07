
import React from 'react';
import { StockPosition, InvestmentStrategy, AnalysisResult } from '../types';
import { ArrowUpRight, ArrowDownRight, Paperclip, Activity, Scale, Percent, Coins, ArrowUp, ArrowDown } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface DashboardProps {
  portfolio: StockPosition[];
  strategy: InvestmentStrategy;
  analysis: AnalysisResult | null;
  darkMode: boolean;
  liquidCash: number;
}

export const Dashboard: React.FC<DashboardProps> = ({ portfolio, strategy, analysis, darkMode, liquidCash }) => {
  const stockValue = portfolio.reduce((acc, stock) => acc + (stock.shares * (stock.currentPrice || stock.avgBuyPrice)), 0);
  const totalValue = stockValue + liquidCash;
  const totalCost = portfolio.reduce((acc, stock) => acc + (stock.shares * stock.avgBuyPrice), 0);
  
  // Gain calculations usually based on Invested amount vs Current Value of Stocks
  // Gain = Current Stock Value - Cost Basis. Cash is just cash, no gain/loss unless currency fluctuation (ignored here).
  const gain = stockValue - totalCost;
  const gainPercent = totalCost ? (gain / totalCost) * 100 : 0;

  // Pie Chart Data
  const sectorData = portfolio.reduce((acc, stock) => {
    const sector = stock.sector || 'Uncategorized';
    const value = (stock.currentPrice || stock.avgBuyPrice) * stock.shares;
    const existing = acc.find(i => i.name === sector);
    if (existing) existing.value += value;
    else acc.push({ name: sector, value });
    return acc;
  }, [] as { name: string; value: number }[]);
  
  // Add Cash to allocation if significant
  if (liquidCash > 0) {
      sectorData.push({ name: 'Liquid Cash', value: liquidCash });
  }

  // Calculate Diversity Score
  const diversityScore = Math.min(sectorData.length * 20, 100);
  
  // Win/Loss Count
  const winners = portfolio.filter(s => (s.currentPrice || s.avgBuyPrice) > s.avgBuyPrice).length;
  const losers = portfolio.filter(s => (s.currentPrice || s.avgBuyPrice) < s.avgBuyPrice).length;

  // Updated Colors: Distinct and vibrant
  const PIE_COLORS = darkMode 
    ? ['#34d399', '#60a5fa', '#f472b6', '#a78bfa', '#fbbf24', '#22d3ee', '#fb7185', '#a3e635'] 
    : ['#059669', '#2563eb', '#db2777', '#7c3aed', '#d97706', '#0891b2', '#e11d48', '#65a30d'];

  // Mock chart data - ideally this would come from historical snapshots
  const chartData = [
    { name: 'Jan', value: totalValue * 0.8 },
    { name: 'Feb', value: totalValue * 0.85 },
    { name: 'Mar', value: totalValue * 0.82 },
    { name: 'Apr', value: totalValue * 0.9 },
    { name: 'May', value: totalValue * 0.95 },
    { name: 'Jun', value: totalValue },
  ];

  const chartStroke = darkMode ? '#e2e8f0' : '#2d2a2e';
  const chartFill = darkMode ? '#e2e8f0' : '#2d2a2e';

  return (
    <div className="space-y-8 relative">
       {/* Sticky Notes Row */}
       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Note 1 */}
          <div className="bg-[#fef3c7] dark:bg-yellow-900/40 dark:border dark:border-yellow-800 p-6 shadow-md rotate-1 transform hover:rotate-0 transition-transform duration-300 relative paper-shadow">
             <div className="w-32 h-8 bg-yellow-200/50 dark:bg-yellow-800/30 absolute -top-4 left-1/2 -translate-x-1/2 rotate-1 tape"></div>
             <h3 className="text-slate-500 dark:text-slate-400 font-bold uppercase text-xs tracking-wider mb-2 font-sans">Net Worth</h3>
             <div className="text-3xl font-bold handwritten text-slate-800 dark:text-slate-200">
                PKR {(totalValue / 100000).toFixed(2)}L
             </div>
             <div className="mt-4 pt-4 border-t border-yellow-300 dark:border-yellow-800 text-yellow-800 dark:text-yellow-500 text-sm italic handwritten">
                "Cash: {(liquidCash/1000).toFixed(1)}k"
             </div>
          </div>

          {/* Note 2 */}
          <div className="bg-[#dcfce7] dark:bg-emerald-900/40 dark:border dark:border-emerald-800 p-6 shadow-md -rotate-1 transform hover:rotate-0 transition-transform duration-300 relative paper-shadow">
            <div className="w-32 h-8 bg-white/30 dark:bg-white/10 absolute -top-4 left-1/2 -translate-x-1/2 -rotate-2 tape"></div>
             <h3 className="text-slate-500 dark:text-slate-400 font-bold uppercase text-xs tracking-wider mb-2 font-sans">Total Return</h3>
             <div className="flex items-end gap-2">
                <span className={`text-4xl font-bold handwritten ${gain >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                    {gain >= 0 ? '+' : ''}{gainPercent.toFixed(1)}%
                </span>
                {gain >= 0 ? <ArrowUpRight className="text-emerald-600 dark:text-emerald-400 mb-2" /> : <ArrowDownRight className="text-rose-600 dark:text-rose-400 mb-2" />}
             </div>
             <p className="text-slate-600 dark:text-slate-400 text-sm mt-1 handwritten">
                {gain >= 0 ? '+' : ''}{gain.toLocaleString()} PKR (All time)
             </p>
          </div>

          {/* Note 3 */}
          <div className="bg-[#e0f2fe] dark:bg-sky-900/40 dark:border dark:border-sky-800 p-6 shadow-md rotate-2 transform hover:rotate-0 transition-transform duration-300 relative paper-shadow">
             <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-slate-400 dark:text-slate-500">
                 <Paperclip className="w-6 h-6 rotate-45" />
             </div>
             <h3 className="text-slate-500 dark:text-slate-400 font-bold uppercase text-xs tracking-wider mb-2 font-sans">Sentiment</h3>
             {analysis?.marketSentiment ? (
                 <div className="text-center mt-2">
                    <div className="text-2xl font-bold handwritten text-sky-900 dark:text-sky-300">{analysis.marketSentiment.overall}</div>
                    <div className="text-sm font-serif text-sky-700 dark:text-sky-400 italic mt-1">
                        Internet Score: {analysis.marketSentiment.score}/100
                    </div>
                 </div>
             ) : (
                 <div className="text-center mt-2 opacity-50">
                    <Activity className="w-8 h-8 mx-auto text-sky-400 dark:text-sky-600" />
                    <span className="text-xs text-sky-600 dark:text-sky-400 font-sans">No analysis yet</span>
                 </div>
             )}
          </div>

          {/* Note 4 */}
          <div className="bg-[#ffe4e6] dark:bg-rose-900/40 dark:border dark:border-rose-800 p-6 shadow-md -rotate-1 transform hover:rotate-0 transition-transform duration-300 relative paper-shadow">
             <div className="w-32 h-8 bg-white/30 dark:bg-white/10 absolute -top-4 left-1/2 -translate-x-1/2 rotate-1 tape"></div>
             <h3 className="text-slate-500 dark:text-slate-400 font-bold uppercase text-xs tracking-wider mb-2 font-sans">Strategy</h3>
             <div className="text-2xl font-bold handwritten text-rose-900 dark:text-rose-300 leading-tight">
                {strategy.goal}
             </div>
             <div className="mt-3 flex items-center gap-2">
                <span className="text-xs font-bold px-2 py-1 bg-rose-200 dark:bg-rose-900 text-rose-800 dark:text-rose-300 rounded-sm uppercase tracking-wide">
                    {strategy.riskTolerance} Risk
                </span>
             </div>
          </div>
       </div>

       {/* Quick Stats Row */}
       <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-slate-800 p-4 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between">
                <div>
                    <h4 className="text-slate-500 dark:text-slate-400 uppercase tracking-widest text-xs font-bold mb-1">Portfolio Diversity</h4>
                    <div className="flex items-center gap-2">
                         <Scale className="w-5 h-5 text-slate-700 dark:text-slate-300" />
                         <span className="text-xl font-bold font-serif text-slate-800 dark:text-slate-200">{diversityScore}%</span>
                    </div>
                </div>
                <div className="w-32 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-slate-800 dark:bg-slate-400" style={{ width: `${diversityScore}%` }}></div>
                </div>
            </div>
            
            <div className="bg-white dark:bg-slate-800 p-4 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between">
                 <div>
                    <h4 className="text-slate-500 dark:text-slate-400 uppercase tracking-widest text-xs font-bold mb-1">Win / Loss Ratio</h4>
                    <div className="flex items-center gap-2">
                         <Percent className="w-5 h-5 text-slate-700 dark:text-slate-300" />
                         <span className="text-xl font-bold font-serif">
                            <span className="text-emerald-600 dark:text-emerald-400">{winners}</span>
                            <span className="mx-1 text-slate-400">/</span>
                            <span className="text-rose-600 dark:text-rose-400">{losers}</span>
                         </span>
                    </div>
                </div>
                <div className="flex gap-1">
                     {Array.from({length: winners}).map((_, i) => <div key={`w-${i}`} className="w-2 h-6 bg-emerald-400 dark:bg-emerald-600 rounded-sm"></div>)}
                     {Array.from({length: losers}).map((_, i) => <div key={`l-${i}`} className="w-2 h-6 bg-rose-400 dark:bg-rose-600 rounded-sm"></div>)}
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-4 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between">
                 <div>
                    <h4 className="text-slate-500 dark:text-slate-400 uppercase tracking-widest text-xs font-bold mb-1">Est. Dividends</h4>
                    <div className="flex items-center gap-2">
                         <Coins className="w-5 h-5 text-amber-600 dark:text-amber-500" />
                         {analysis?.dividendForecast ? (
                             <span className="text-xl font-bold font-serif text-slate-900 dark:text-slate-200">
                                PKR {(analysis.dividendForecast.estimatedAnnualIncome / 1000).toFixed(1)}k
                                <span className="text-xs text-slate-400 font-normal ml-1 font-sans">
                                    ({analysis.dividendForecast.portfolioYield.toFixed(1)}%)
                                </span>
                             </span>
                         ) : (
                             <span className="text-lg font-serif italic text-slate-400">Run Analysis</span>
                         )}
                    </div>
                </div>
            </div>
       </div>

       {/* Charts Row */}
       <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
            {/* Main Area Chart */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-sm shadow-sm border border-slate-200 dark:border-slate-700 relative">
                <h3 className="text-2xl handwritten mb-6 text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-600 pb-2 inline-block">
                    Performance Sketch
                </h3>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                            <defs>
                            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={chartFill} stopOpacity={0.1}/>
                                <stop offset="95%" stopColor={chartFill} stopOpacity={0}/>
                            </linearGradient>
                            </defs>
                            <XAxis 
                                dataKey="name" 
                                stroke={darkMode ? "#94a3b8" : "#94a3b8"} 
                                tick={{fill: darkMode ? '#cbd5e1' : '#64748b', fontFamily: 'Patrick Hand', fontSize: 18}} 
                                tickLine={false} 
                                axisLine={{ stroke: darkMode ? '#475569' : '#cbd5e1', strokeWidth: 2 }} 
                            />
                            <YAxis 
                                stroke={darkMode ? "#94a3b8" : "#94a3b8"} 
                                tick={{fill: darkMode ? '#cbd5e1' : '#64748b', fontFamily: 'Patrick Hand', fontSize: 16}} 
                                tickLine={false} 
                                axisLine={false} 
                                tickFormatter={(value) => `${(value/1000)}k`} 
                            />
                            <Tooltip 
                                contentStyle={{ 
                                    backgroundColor: darkMode ? '#1e293b' : '#fff', 
                                    borderColor: darkMode ? '#475569' : '#2d2a2e',
                                    borderWidth: '2px', 
                                    borderRadius: '0px',
                                    boxShadow: '4px 4px 0px rgba(0,0,0,0.1)',
                                    fontFamily: 'Crimson Pro',
                                    color: darkMode ? '#e2e8f0' : '#1e293b'
                                }}
                            />
                            <Area 
                                type="monotone" 
                                dataKey="value" 
                                stroke={chartStroke} 
                                strokeWidth={3} 
                                fillOpacity={1} 
                                fill="url(#colorValue)" 
                                dot={{ stroke: chartStroke, strokeWidth: 2, r: 4, fill: darkMode ? '#1e293b' : '#fff' }}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Sector Pie Chart */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-sm shadow-sm border border-slate-200 dark:border-slate-700 relative flex flex-col items-center">
                <h3 className="text-2xl handwritten mb-4 text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-600 pb-2">
                    Allocation
                </h3>
                {portfolio.length > 0 || liquidCash > 0 ? (
                    <>
                        <div className="h-[200px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={sectorData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={50}
                                        outerRadius={70}
                                        paddingAngle={2}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {sectorData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip 
                                        contentStyle={{ backgroundColor: darkMode ? '#1e293b' : '#fff', borderColor: darkMode ? '#94a3b8' : '#000', fontFamily: 'Crimson Pro', color: darkMode ? '#e2e8f0' : '#000' }}
                                        formatter={(value: number) => `PKR ${value.toLocaleString()}`}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="w-full mt-4 space-y-2 max-h-[100px] overflow-y-auto">
                            {sectorData.map((entry, index) => (
                                <div key={entry.name} className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}></div>
                                        <span className="font-serif text-slate-600 dark:text-slate-300 truncate max-w-[100px]">{entry.name}</span>
                                    </div>
                                    <span className="font-bold text-slate-800 dark:text-slate-100">
                                        {((entry.value / totalValue) * 100).toFixed(0)}%
                                    </span>
                                </div>
                            ))}
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-slate-400 font-serif italic text-center">
                        Add stocks or cash to see allocation
                    </div>
                )}
            </div>
       </div>

        {/* Desktop Navigation Hint */}
        <div className="hidden md:flex fixed bottom-12 right-12 flex-col items-center gap-2 opacity-50 hover:opacity-100 transition-opacity">
            <div className="flex flex-col gap-1">
                <div className="w-8 h-8 rounded-md bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 shadow-sm flex items-center justify-center">
                    <ArrowUp className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                </div>
                <div className="w-8 h-8 rounded-md bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 shadow-sm flex items-center justify-center">
                    <ArrowDown className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                </div>
            </div>
            <span className="handwritten text-lg text-slate-400 dark:text-slate-500 -rotate-6">Navigate Pages</span>
        </div>
    </div>
  );
};
