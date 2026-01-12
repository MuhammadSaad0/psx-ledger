
import React, { useState, useMemo } from 'react';
import { StockPosition, InvestmentStrategy, AnalysisResult, SimulationResult } from '../types';
import { Pen, Stamp, RefreshCw, BarChart3, Target, ShieldAlert, TrendingUp, Coins, Loader, History, Globe, ExternalLink, Calculator, ArrowRight, Share2, Activity, Layers, GitMerge, AlertOctagon, FlaskConical, Plus, ArrowUp, ArrowDown, Minus, Briefcase, Wallet, Scale } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ReferenceLine, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ComposedChart, Line, Area, Legend, AreaChart } from 'recharts';
import { simulatePortfolioAddition } from '../services/geminiService';

interface AdvisorViewProps {
  portfolio: StockPosition[];
  liquidCash: number;
  strategy: InvestmentStrategy;
  analysis: AnalysisResult | null;
  history: AnalysisResult[];
  onSelectAnalysis: (id: string) => void;
  loading: boolean;
  error: string;
  onRunAnalysis: () => void;
  darkMode: boolean;
}

export const AdvisorView: React.FC<AdvisorViewProps> = ({ 
  portfolio, 
  liquidCash,
  strategy, 
  analysis, 
  history,
  onSelectAnalysis,
  loading, 
  error, 
  onRunAnalysis,
  darkMode
}) => {
  
  // Allow string to handle empty input state gracefully
  const [monthlyContribution, setMonthlyContribution] = useState<string | number>(50000);
  const [rebalanceInflow, setRebalanceInflow] = useState<string | number>(100000);
  const [riskTab, setRiskTab] = useState<'network' | 'drawdown' | 'factors' | 'attribution' | 'tail'>('network');

  // Simulation State
  const [simStock, setSimStock] = useState({ symbol: '', shares: '', price: '' });
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  // Ink colors
  const SENTIMENT_COLORS = {
    high: darkMode ? '#34d399' : '#059669', // Emerald 400/600
    mid: darkMode ? '#fbbf24' : '#d97706',  // Amber 400/600
    low: darkMode ? '#f43f5e' : '#e11d48'   // Rose 400/600
  };

  const hasAnyData = analysis && Object.keys(analysis).length > 1;

  const chartFontColor = darkMode ? '#e2e8f0' : '#475569';
  const gridColor = darkMode ? '#475569' : '#cbd5e1';

  // --- HELPER: DATA SANITIZER ---
  const sanitizeScore = (score: number) => {
    if (score <= 1 && score > 0) return Math.round(score * 100);
    return Math.round(score);
  };

  // --- HELPER: MARKDOWN RENDERER ---
  const renderMarkdown = (text?: string) => {
    if (!text) return null;

    const parseBold = (str: string) => {
      const parts = str.split(/(\*\*.*?\*\*)/g);
      return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i} className="font-bold text-slate-900 dark:text-slate-100">{part.slice(2, -2)}</strong>;
        }
        return part;
      });
    };

    return text.split('\n').map((line, i) => {
       const trimmed = line.trim();
       if (!trimmed) return <br key={i} />;

       if (trimmed.startsWith('### ')) {
           return <h4 key={i} className="text-lg font-bold mt-4 mb-2 text-slate-800 dark:text-slate-200">{parseBold(trimmed.replace(/^###\s+/, ''))}</h4>;
       }
       if (trimmed.startsWith('## ')) {
           return <h3 key={i} className="text-xl font-bold mt-6 mb-3 text-slate-800 dark:text-slate-100 handwritten border-b border-slate-300 dark:border-slate-700 pb-1">{parseBold(trimmed.replace(/^##\s+/, ''))}</h3>;
       }

       if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
           return (
             <div key={i} className="flex items-start gap-2 mb-2 ml-2">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-500 mt-2.5 shrink-0"></div>
                <p className="text-lg text-slate-700 dark:text-slate-300">{parseBold(trimmed.replace(/^[\*\-]\s+/, ''))}</p>
             </div>
           );
       }
       
       return <p key={i} className="mb-2 text-lg text-slate-700 dark:text-slate-300">{parseBold(line)}</p>;
    });
  };

  const handleSimulate = async () => {
    if(!simStock.symbol || !simStock.shares || !simStock.price) return;
    setIsSimulating(true);
    try {
        const result = await simulatePortfolioAddition(portfolio, {
            symbol: simStock.symbol.toUpperCase(),
            shares: Number(simStock.shares),
            price: Number(simStock.price)
        }, strategy);
        setSimulationResult(result);
    } catch (e) {
        console.error(e);
    } finally {
        setIsSimulating(false);
    }
  }

  // --- REBALANCING LOGIC ---
  const rebalancingData = useMemo(() => {
    if (!analysis?.idealAllocation || !portfolio) return null;
    
    const inflow = typeof rebalanceInflow === 'string' ? Number(rebalanceInflow) || 0 : rebalanceInflow;
    
    // Calculate current market value for each stock
    const stockDetails = portfolio.map(stock => {
        const price = stock.currentPrice || stock.avgBuyPrice;
        const value = price * stock.shares;
        return { ...stock, value, price };
    });
    
    const totalCurrentValue = stockDetails.reduce((acc, s) => acc + s.value, 0);
    const newTotalValue = totalCurrentValue + inflow;

    // Calculate deficits
    const projections = stockDetails.map(stock => {
        const ideal = analysis.idealAllocation?.find(i => i.symbol === stock.symbol);
        const idealWeight = ideal ? ideal.idealWeight / 100 : 0;
        const targetValue = newTotalValue * idealWeight;
        const deficit = Math.max(0, targetValue - stock.value);
        const currentWeight = totalCurrentValue > 0 ? (stock.value / totalCurrentValue) * 100 : 0;
        
        return {
            symbol: stock.symbol,
            currentWeight,
            idealWeight: idealWeight * 100,
            deficit,
            price: stock.price,
            reason: ideal?.reason || ''
        };
    });
    
    const totalDeficit = projections.reduce((acc, p) => acc + p.deficit, 0);
    
    // Distribute inflow proportional to deficit
    const suggestions = projections.map(p => {
        let allocateAmount = 0;
        if (totalDeficit > 0) {
            allocateAmount = inflow * (p.deficit / totalDeficit);
        }
        return {
            ...p,
            allocateAmount,
            buyShares: p.price > 0 ? Math.floor(allocateAmount / p.price) : 0
        };
    }).sort((a, b) => b.idealWeight - a.idealWeight);

    return suggestions;

  }, [analysis, portfolio, rebalanceInflow]);


  // --- DCA SIMULATION LOGIC ---
  const dcaProjection = useMemo(() => {
    if (!analysis?.projectedGrowth || analysis.projectedGrowth.length < 2 || !analysis.dividendForecast) return null;

    const currentPortfolioValue = analysis.projectedGrowth[0].portfolioValue;
    const finalPortfolioValue = analysis.projectedGrowth[analysis.projectedGrowth.length - 1].portfolioValue;
    const years = analysis.projectedGrowth.length - 1;
    
    // Calculate Implied CAGR
    const cagr = Math.pow(finalPortfolioValue / currentPortfolioValue, 1 / years) - 1;
    
    const yieldRate = analysis.dividendForecast.portfolioYield / 100;

    // Parse numeric value from state (which might be string)
    const contributionNum = typeof monthlyContribution === 'string' ? (Number(monthlyContribution) || 0) : monthlyContribution;

    const projectionData = [];
    let runningBalance = currentPortfolioValue;
    let totalPrincipal = currentPortfolioValue;
    
    projectionData.push({
        year: `Year 0`,
        principal: Math.round(totalPrincipal),
        value: Math.round(runningBalance),
        dividends: Math.round(runningBalance * yieldRate),
    });

    for (let i = 1; i <= 5; i++) {
        const annualContribution = contributionNum * 12;
        
        totalPrincipal += annualContribution;
        
        const growthOnPrincipal = runningBalance * (1 + cagr);
        const growthOnNewMoney = annualContribution * (1 + (cagr / 2)); 
        
        runningBalance = growthOnPrincipal + growthOnNewMoney;

        projectionData.push({
            year: `Year ${i}`,
            principal: Math.round(totalPrincipal),
            value: Math.round(runningBalance),
            dividends: Math.round(runningBalance * yieldRate),
        });
    }

    return {
        data: projectionData,
        cagrPercent: (cagr * 100).toFixed(2),
        yieldPercent: (yieldRate * 100).toFixed(2),
        finalValue: projectionData[projectionData.length-1].value,
        finalDividends: projectionData[projectionData.length-1].dividends,
        totalContributed: contributionNum * 12 * 5
    };

  }, [analysis, monthlyContribution]);


  // --- NETWORK GRAPH LOGIC ---
  const networkData = useMemo(() => {
    if (!analysis?.correlationAnalysis || !portfolio) return null;
    
    const nodes = portfolio.map((stock, i) => {
      const angle = (i / portfolio.length) * 2 * Math.PI;
      const r = 100; // Radius
      return {
        id: stock.symbol,
        x: 150 + r * Math.cos(angle), // Center 150, 150
        y: 150 + r * Math.sin(angle),
        r: 10 + (Math.min(stock.shares / 500, 1) * 10) // Size based on shares
      };
    });

    const links = analysis.correlationAnalysis.links.map(link => {
       const sourceNode = nodes.find(n => n.id === link.source);
       const targetNode = nodes.find(n => n.id === link.target);
       if (!sourceNode || !targetNode) return null;
       return {
         x1: sourceNode.x,
         y1: sourceNode.y,
         x2: targetNode.x,
         y2: targetNode.y,
         strength: link.strength
       };
    }).filter(l => l !== null) as {x1:number, y1:number, x2:number, y2:number, strength:number}[];

    return { nodes, links };
  }, [analysis, portfolio]);

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
            <h2 className="text-3xl font-bold handwritten text-slate-800 dark:text-slate-100">Dear Advisor...</h2>
            <p className="text-slate-500 dark:text-slate-400 font-serif italic">Asking the AI to review my journal entries.</p>
        </div>
        
        <div className="flex items-center gap-3 self-end md:self-auto">
          {history.length > 0 && (
             <div className="relative group">
               <div className="flex items-center gap-2 px-3 py-3 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-sm shadow-sm text-slate-600 dark:text-slate-300 font-sans text-sm font-bold uppercase tracking-wider cursor-pointer hover:border-slate-400">
                  <History className="w-4 h-4" />
                  <select 
                    className="appearance-none bg-transparent outline-none cursor-pointer w-[140px] text-slate-800 dark:text-slate-200"
                    value={analysis?.id || ''}
                    onChange={(e) => onSelectAnalysis(e.target.value)}
                  >
                    {history.map((h, idx) => (
                      <option key={h.id || idx} value={h.id} className="text-slate-800 dark:text-slate-800">
                         {h.timestamp ? new Date(h.timestamp).toLocaleDateString() : 'Draft'} {h.timestamp ? new Date(h.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}
                      </option>
                    ))}
                  </select>
               </div>
             </div>
          )}

          <button
            onClick={onRunAnalysis}
            disabled={loading}
            className="flex items-center gap-3 px-6 py-3 bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 text-white rounded-sm font-bold transition-all shadow-md handwritten text-xl disabled:opacity-50"
          >
            {loading ? <RefreshCw className="w-5 h-5 animate-spin"/> : <Pen className="w-5 h-5" />}
            {loading ? 'Thinking...' : 'New Analysis'}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 text-red-700 dark:text-red-300 font-serif">
            {error}
        </div>
      )}

      {!hasAnyData && !loading && !error && (
        <div className="text-center py-20 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg bg-slate-50/50 dark:bg-slate-800/50">
            <h3 className="text-2xl handwritten text-slate-400 dark:text-slate-500">Page is blank</h3>
            <p className="text-slate-500 dark:text-slate-400 font-serif max-w-md mx-auto mt-2">
                Tap the button to let the AI analyze your <strong>{strategy.goal}</strong> strategy against your manifesto.
            </p>
        </div>
      )}

      {loading && !hasAnyData && (
          <div className="text-center py-20">
              <RefreshCw className="w-12 h-12 text-slate-400 animate-spin mx-auto mb-4" />
              <p className="text-slate-500 dark:text-slate-400 font-serif text-lg">Consulting the markets and reviewing your manifesto...</p>
          </div>
      )}

      {hasAnyData && analysis && (
        <div className="bg-white dark:bg-slate-800 p-8 md:p-12 shadow-lg relative animate-fade-in paper-shadow transition-colors duration-300">
            {/* Paper Texture Overlay */}
            <div className={`absolute inset-0 ${darkMode ? 'opacity-10' : 'bg-[#fffdf5] opacity-50'} pointer-events-none`}></div>
            
            <div className="relative z-10 space-y-10">
                {/* Top Section */}
                <div className="flex flex-col md:flex-row gap-6 justify-between border-b-2 border-slate-200 dark:border-slate-700 pb-6">
                    <div className="w-full md:w-2/3">
                        <div className="flex items-center gap-2 mb-2 text-slate-500 dark:text-slate-400">
                             <Target className="w-4 h-4" />
                             <span className="uppercase text-xs font-bold tracking-wider">Manifesto Alignment</span>
                        </div>
                        {analysis.manifestoAlignmentScore !== undefined ? (
                          <>
                            <div className="flex items-end gap-3">
                                <span className={`text-4xl font-bold handwritten ${sanitizeScore(analysis.manifestoAlignmentScore) > 75 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                                    {sanitizeScore(analysis.manifestoAlignmentScore)}%
                                </span>
                                <span className="text-slate-600 dark:text-slate-400 font-serif text-lg mb-1">
                                    Match for "{strategy.goal}"
                                </span>
                            </div>
                            <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 mt-2 rounded-full overflow-hidden">
                                <div 
                                    className={`h-full ${sanitizeScore(analysis.manifestoAlignmentScore) > 75 ? 'bg-emerald-600' : 'bg-rose-500'}`} 
                                    style={{ width: `${sanitizeScore(analysis.manifestoAlignmentScore)}%` }}
                                ></div>
                            </div>
                          </>
                        ) : (
                          <div className="animate-pulse bg-slate-200 dark:bg-slate-700 h-10 w-3/4 rounded-sm mt-2"></div>
                        )}
                    </div>

                    <div className="w-full md:w-auto flex justify-start md:justify-end">
                       {analysis.score !== undefined ? (
                          <div className="border-4 border-slate-800 dark:border-slate-300 text-slate-800 dark:text-slate-300 p-2 font-bold uppercase tracking-widest text-sm opacity-80 -rotate-6 md:-rotate-12 rounded-sm flex flex-col items-center bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm min-w-[120px]">
                              <span>Health Score</span>
                              <span className="text-3xl">{sanitizeScore(analysis.score)}/100</span>
                          </div>
                       ) : (
                          <div className="h-20 w-32 bg-slate-100 dark:bg-slate-700 animate-pulse border-2 border-slate-200 dark:border-slate-600 rounded-sm"></div>
                       )}
                    </div>
                </div>

                {/* ADVANCED RISK INTELLIGENCE SECTION */}
                <div className="border-2 border-slate-300 dark:border-slate-600 p-1 relative mt-10">
                    <div className="absolute -top-3 left-4 bg-slate-800 dark:bg-slate-600 text-white px-3 py-1 text-xs font-bold uppercase tracking-widest shadow-sm">
                        Deep Dive Intelligence
                    </div>
                    
                    <div className="flex border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pt-4 px-4 overflow-x-auto">
                        <button onClick={() => setRiskTab('network')} className={`px-4 py-2 font-bold text-sm uppercase tracking-wide flex items-center gap-2 transition-colors whitespace-nowrap ${riskTab === 'network' ? 'bg-white dark:bg-slate-700 border-t-2 border-l border-r border-slate-300 dark:border-slate-600 text-indigo-600 dark:text-indigo-400 rounded-t-sm -mb-px relative z-10' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50'}`}><Share2 className="w-4 h-4" /> Risk Network</button>
                        <button onClick={() => setRiskTab('drawdown')} className={`px-4 py-2 font-bold text-sm uppercase tracking-wide flex items-center gap-2 transition-colors whitespace-nowrap ${riskTab === 'drawdown' ? 'bg-white dark:bg-slate-700 border-t-2 border-l border-r border-slate-300 dark:border-slate-600 text-rose-600 dark:text-rose-400 rounded-t-sm -mb-px relative z-10' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50'}`}><Activity className="w-4 h-4" /> Stress Test</button>
                        <button onClick={() => setRiskTab('tail')} className={`px-4 py-2 font-bold text-sm uppercase tracking-wide flex items-center gap-2 transition-colors whitespace-nowrap ${riskTab === 'tail' ? 'bg-white dark:bg-slate-700 border-t-2 border-l border-r border-slate-300 dark:border-slate-600 text-orange-600 dark:text-orange-400 rounded-t-sm -mb-px relative z-10' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50'}`}><AlertOctagon className="w-4 h-4" /> Tail Risk</button>
                        <button onClick={() => setRiskTab('factors')} className={`px-4 py-2 font-bold text-sm uppercase tracking-wide flex items-center gap-2 transition-colors whitespace-nowrap ${riskTab === 'factors' ? 'bg-white dark:bg-slate-700 border-t-2 border-l border-r border-slate-300 dark:border-slate-600 text-purple-600 dark:text-purple-400 rounded-t-sm -mb-px relative z-10' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50'}`}><Layers className="w-4 h-4" /> Factor Drift</button>
                        <button onClick={() => setRiskTab('attribution')} className={`px-4 py-2 font-bold text-sm uppercase tracking-wide flex items-center gap-2 transition-colors whitespace-nowrap ${riskTab === 'attribution' ? 'bg-white dark:bg-slate-700 border-t-2 border-l border-r border-slate-300 dark:border-slate-600 text-emerald-600 dark:text-emerald-400 rounded-t-sm -mb-px relative z-10' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50'}`}><GitMerge className="w-4 h-4" /> Attribution</button>
                    </div>

                    <div className="p-6 bg-white dark:bg-slate-700 min-h-[350px] flex flex-col md:flex-row gap-8">
                        {riskTab === 'network' && (
                            <>
                                <div className="w-full md:w-1/2 flex items-center justify-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-sm p-4 relative overflow-hidden">
                                     {networkData ? (
                                        <svg viewBox="0 0 300 300" className="w-full h-full max-w-[300px] max-h-[300px]">
                                            {networkData.links.map((link, i) => (
                                                <line key={i} x1={link.x1} y1={link.y1} x2={link.x2} y2={link.y2} stroke={darkMode ? '#6366f1' : '#4f46e5'} strokeWidth={link.strength * 4} strokeOpacity={0.6}/>
                                            ))}
                                            {networkData.nodes.map((node, i) => (
                                                <g key={i}>
                                                    <circle cx={node.x} cy={node.y} r={node.r} fill={darkMode ? '#e2e8f0' : '#1e293b'} stroke={darkMode ? '#6366f1' : '#4f46e5'} strokeWidth="2"/>
                                                    <text x={node.x} y={node.y + node.r + 12} textAnchor="middle" fontSize="10" fontWeight="bold" fill={darkMode ? '#cbd5e1' : '#334155'}>{node.id}</text>
                                                </g>
                                            ))}
                                        </svg>
                                     ) : (
                                        <div className="text-center text-slate-400 italic">Analysis required to map network</div>
                                     )}
                                </div>
                                <div className="w-full md:w-1/2">
                                     <h4 className="font-bold text-indigo-700 dark:text-indigo-400 mb-2 uppercase tracking-wide text-xs">AI Pattern Detection</h4>
                                     <p className="font-serif text-lg leading-relaxed text-slate-700 dark:text-slate-300">
                                        {analysis?.correlationAnalysis?.narrative || "Run analysis to detect hidden clusters."}
                                     </p>
                                </div>
                            </>
                        )}

                        {riskTab === 'drawdown' && (
                            <>
                                <div className="w-full md:w-1/2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-sm p-4 h-[300px]">
                                     {analysis?.drawdownAnalysis?.simulation ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <ComposedChart data={analysis.drawdownAnalysis.simulation}>
                                                <XAxis dataKey="period" hide />
                                                <YAxis tickFormatter={(v) => `${v}%`} stroke={gridColor} tick={{ fill: chartFontColor, fontSize: 10 }} />
                                                <Tooltip contentStyle={{ fontFamily: 'Crimson Pro', backgroundColor: darkMode ? '#1e293b' : '#fff', color: darkMode ? '#e2e8f0' : '#000' }} formatter={(val:number) => `${val}%`} />
                                                <Legend wrapperStyle={{ fontSize: '10px' }} />
                                                <Area type="monotone" dataKey="portfolioDrawdown" name="Your Portfolio" stroke="#e11d48" fill="#e11d48" fillOpacity={0.2} strokeWidth={2} />
                                                <Line type="monotone" dataKey="marketDrawdown" name="Market Benchmark" stroke="#94a3b8" strokeDasharray="4 4" dot={false} strokeWidth={2} />
                                            </ComposedChart>
                                        </ResponsiveContainer>
                                     ) : (
                                         <div className="w-full h-full flex items-center justify-center text-slate-400 italic">Analysis required for simulation</div>
                                     )}
                                </div>
                                <div className="w-full md:w-1/2">
                                     <h4 className="font-bold text-rose-700 dark:text-rose-400 mb-2 uppercase tracking-wide text-xs">Simulated Risk Narrative</h4>
                                     <p className="font-serif text-lg leading-relaxed text-slate-700 dark:text-slate-300">
                                        {analysis?.drawdownAnalysis?.narrative || "Run analysis to simulate market stress tests."}
                                     </p>
                                </div>
                            </>
                        )}

                        {riskTab === 'tail' && (
                           <>
                                <div className="w-full md:w-1/2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-sm p-4 h-[300px]">
                                     {analysis?.tailRiskAnalysis?.scenarios ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={analysis.tailRiskAnalysis.scenarios} layout="vertical" margin={{ left: 20 }}>
                                                <XAxis type="number" stroke={gridColor} tick={{ fill: chartFontColor, fontSize: 10 }} domain={[0, 'dataMin - 10']} hide />
                                                <YAxis dataKey="name" type="category" width={90} stroke={gridColor} tick={{ fill: chartFontColor, fontSize: 10, width: 90 }} />
                                                <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ fontFamily: 'Crimson Pro', backgroundColor: darkMode ? '#1e293b' : '#fff', color: darkMode ? '#e2e8f0' : '#000' }} formatter={(val: number) => `${val}%`} />
                                                <Legend wrapperStyle={{ fontSize: '10px' }} />
                                                <Bar dataKey="portfolioDecline" name="Your Portfolio" fill="#f97316" barSize={15} radius={[0, 4, 4, 0]} />
                                                <Bar dataKey="marketDecline" name="Market Benchmark" fill="#94a3b8" barSize={15} radius={[0, 4, 4, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                     ) : (
                                         <div className="w-full h-full flex items-center justify-center text-slate-400 italic">Analysis required for tail risk scenarios</div>
                                     )}
                                </div>
                                <div className="w-full md:w-1/2">
                                     <h4 className="font-bold text-orange-700 dark:text-orange-400 mb-2 uppercase tracking-wide text-xs">Scenario Vulnerabilities</h4>
                                     <p className="font-serif text-lg leading-relaxed text-slate-700 dark:text-slate-300">
                                        {analysis?.tailRiskAnalysis?.narrative || "Run analysis to simulate historical market crashes."}
                                     </p>
                                </div>
                           </>
                        )}

                        {riskTab === 'factors' && (
                           <>
                                <div className="w-full md:w-1/2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-sm p-4 h-[300px]">
                                     {analysis?.factorAnalysis?.timeline ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={analysis.factorAnalysis.timeline}>
                                                <XAxis dataKey="date" stroke={gridColor} tick={{ fill: chartFontColor, fontSize: 10 }} />
                                                <YAxis stroke={gridColor} tick={{ fill: chartFontColor, fontSize: 10 }} />
                                                <Tooltip contentStyle={{ fontFamily: 'Crimson Pro', backgroundColor: darkMode ? '#1e293b' : '#fff', color: darkMode ? '#e2e8f0' : '#000' }} />
                                                <Legend wrapperStyle={{ fontSize: '10px' }} />
                                                <Area type="monotone" dataKey="value" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
                                                <Area type="monotone" dataKey="growth" stackId="1" stroke="#22c55e" fill="#22c55e" fillOpacity={0.6} />
                                                <Area type="monotone" dataKey="momentum" stackId="1" stroke="#a855f7" fill="#a855f7" fillOpacity={0.6} />
                                                <Area type="monotone" dataKey="quality" stackId="1" stroke="#f97316" fill="#f97316" fillOpacity={0.6} />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                     ) : (
                                         <div className="w-full h-full flex items-center justify-center text-slate-400 italic">Analysis required for factor drift</div>
                                     )}
                                </div>
                                <div className="w-full md:w-1/2">
                                     <h4 className="font-bold text-purple-700 dark:text-purple-400 mb-2 uppercase tracking-wide text-xs">Strategy Drift Analysis</h4>
                                     <p className="font-serif text-lg leading-relaxed text-slate-700 dark:text-slate-300">
                                        {analysis?.factorAnalysis?.narrative || "Run analysis to detect style drift and regime mismatches."}
                                     </p>
                                </div>
                           </>
                        )}

                        {riskTab === 'attribution' && (
                           <>
                                <div className="w-full md:w-1/2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-sm p-4 h-[300px]">
                                     {analysis?.attributionAnalysis?.breakdown ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={analysis.attributionAnalysis.breakdown} layout="vertical">
                                                <XAxis type="number" stroke={gridColor} tick={{ fill: chartFontColor, fontSize: 10 }} />
                                                <YAxis dataKey="category" type="category" width={100} stroke={gridColor} tick={{ fill: chartFontColor, fontSize: 10 }} />
                                                <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ fontFamily: 'Crimson Pro', backgroundColor: darkMode ? '#1e293b' : '#fff', color: darkMode ? '#e2e8f0' : '#000' }} formatter={(val: number) => `${val > 0 ? '+' : ''}${val}%`} />
                                                <Bar dataKey="contribution" barSize={20}>
                                                    {analysis.attributionAnalysis.breakdown.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={entry.contribution >= 0 ? '#10b981' : '#f43f5e'} />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                     ) : (
                                         <div className="w-full h-full flex items-center justify-center text-slate-400 italic">Analysis required for return attribution</div>
                                     )}
                                </div>
                                <div className="w-full md:w-1/2">
                                     <h4 className="font-bold text-emerald-700 dark:text-emerald-400 mb-2 uppercase tracking-wide text-xs">Performance Narrative</h4>
                                     <p className="font-serif text-lg leading-relaxed text-slate-700 dark:text-slate-300">
                                        {analysis?.attributionAnalysis?.narrative || "Run analysis to break down your return drivers."}
                                     </p>
                                </div>
                           </>
                        )}
                    </div>
                </div>

                {/* Summary Section */}
                <div>
                    <h3 className="text-2xl font-bold handwritten text-slate-800 dark:text-slate-100 mb-4 inline-block">
                        Executive Summary
                    </h3>
                    {analysis.summary ? (
                      <p className="font-serif text-xl leading-relaxed text-slate-700 dark:text-slate-300 first-letter:text-5xl first-letter:font-bold first-letter:float-left first-letter:mr-3 first-letter:mt-[-10px] first-letter:text-slate-900 dark:first-letter:text-white">
                          {analysis.summary}
                      </p>
                    ) : (
                      <div className="space-y-3">
                         <div className="animate-pulse bg-slate-200 dark:bg-slate-700 h-4 w-full rounded-sm"></div>
                         <div className="animate-pulse bg-slate-200 dark:bg-slate-700 h-4 w-full rounded-sm"></div>
                         <div className="animate-pulse bg-slate-200 dark:bg-slate-700 h-4 w-3/4 rounded-sm"></div>
                      </div>
                    )}
                </div>

                {/* Internet Sentiment Section */}
                <div>
                     <div className="flex items-center gap-2 mb-2 text-slate-500 dark:text-slate-400">
                         <BarChart3 className="w-4 h-4" />
                         <span className="uppercase text-xs font-bold tracking-wider">Internet Opinion</span>
                    </div>
                    {analysis.marketSentiment ? (
                      <p className="font-serif text-lg text-slate-700 dark:text-slate-300 italic border-l-2 border-slate-300 dark:border-slate-600 pl-3">
                          "{analysis.marketSentiment.internetOpinionSummary}" (Score: {sanitizeScore(analysis.marketSentiment.score)})
                      </p>
                    ) : (
                      <div className="space-y-2 mt-2">
                         <div className="animate-pulse bg-slate-200 dark:bg-slate-700 h-4 w-full rounded-sm"></div>
                         <div className="animate-pulse bg-slate-200 dark:bg-slate-700 h-4 w-2/3 rounded-sm"></div>
                      </div>
                    )}
                </div>

                {/* SMART REBALANCING SECTION */}
                {rebalancingData && (
                    <div className="mt-8 bg-sky-50 dark:bg-slate-700/50 border border-sky-200 dark:border-sky-800 rounded-sm p-6 relative">
                        <div className="absolute -top-3 left-6 bg-sky-600 text-white px-3 py-1 text-xs font-bold uppercase tracking-widest flex items-center gap-2 shadow-sm">
                            <Scale className="w-4 h-4" /> Smart Rebalancing
                        </div>

                        <div className="mt-4 flex flex-col gap-6">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-sky-100 dark:border-sky-900/50 pb-4">
                                <p className="text-sm font-serif text-slate-600 dark:text-slate-300 max-w-lg">
                                    "Based on the ideal portfolio structure designed by the AI, here is how you should distribute your next cash inflow to align with your strategy."
                                </p>
                                <div className="flex items-center gap-2">
                                    <label className="text-xs font-bold text-sky-800 dark:text-sky-300 uppercase whitespace-nowrap">Next Inflow (PKR)</label>
                                    <input 
                                        type="number" 
                                        value={rebalanceInflow}
                                        onChange={(e) => setRebalanceInflow(e.target.value)}
                                        className="w-32 p-2 font-bold text-sky-900 dark:text-sky-100 bg-white dark:bg-slate-800 border border-sky-200 dark:border-sky-600 rounded-sm focus:outline-none focus:ring-2 focus:ring-sky-400 text-right"
                                    />
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="text-xs font-bold uppercase text-slate-400 dark:text-slate-500 border-b border-slate-200 dark:border-slate-600">
                                            <th className="pb-2">Stock</th>
                                            <th className="pb-2">Current %</th>
                                            <th className="pb-2">Ideal %</th>
                                            <th className="pb-2 text-right">Buy Amount (PKR)</th>
                                            <th className="pb-2 text-right">Est. Shares</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                                        {rebalancingData.map((item) => (
                                            <tr key={item.symbol} className="group hover:bg-white dark:hover:bg-slate-800 transition-colors">
                                                <td className="py-3 pr-4">
                                                    <div className="font-bold text-slate-800 dark:text-white">{item.symbol}</div>
                                                    <div className="text-[10px] text-slate-400 dark:text-slate-500 font-serif max-w-[150px] truncate">{item.reason}</div>
                                                </td>
                                                <td className="py-3">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-mono text-slate-600 dark:text-slate-300">{item.currentWeight.toFixed(1)}%</span>
                                                        <div className="w-16 h-1.5 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
                                                            <div className="h-full bg-slate-500 dark:bg-slate-400" style={{ width: `${Math.min(100, item.currentWeight)}%` }}></div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-3">
                                                     <div className="flex items-center gap-2">
                                                        <span className="text-sm font-mono text-sky-700 dark:text-sky-400 font-bold">{item.idealWeight.toFixed(1)}%</span>
                                                        <div className="w-16 h-1.5 bg-sky-100 dark:bg-slate-600 rounded-full overflow-hidden">
                                                            <div className="h-full bg-sky-500 dark:bg-sky-400" style={{ width: `${Math.min(100, item.idealWeight)}%` }}></div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-3 text-right">
                                                    {item.allocateAmount > 0 ? (
                                                        <span className="text-emerald-600 dark:text-emerald-400 font-bold font-mono">
                                                            + {item.allocateAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-300 dark:text-slate-600">-</span>
                                                    )}
                                                </td>
                                                <td className="py-3 text-right font-mono text-slate-600 dark:text-slate-400">
                                                    {item.buyShares > 0 ? item.buyShares : '-'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* Cash Deployment Plays */}
                {analysis.recommendedBuys && analysis.recommendedBuys.length > 0 && (
                    <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 p-6 rounded-sm animate-fade-in relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <Wallet className="w-24 h-24 text-indigo-900 dark:text-indigo-100" />
                        </div>
                        <div className="flex items-center gap-2 mb-4 relative z-10">
                             <div className="p-2 bg-indigo-200 dark:bg-indigo-800/50 rounded-full text-indigo-800 dark:text-indigo-300">
                                <Briefcase className="w-5 h-5" />
                             </div>
                             <div>
                                 <h4 className="text-indigo-900 dark:text-indigo-200 font-bold uppercase tracking-widest text-xs mb-1">Cash Deployment Plays</h4>
                                 <p className="text-indigo-800 dark:text-indigo-300 font-serif text-sm">
                                     Strategic use of your <strong>PKR {liquidCash.toLocaleString()}</strong> liquid cash.
                                 </p>
                             </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 relative z-10">
                            {analysis.recommendedBuys.map((play, idx) => (
                                <div key={idx} className="bg-white dark:bg-slate-800 p-4 border-l-4 border-indigo-500 dark:border-indigo-400 shadow-sm hover:shadow-md transition-shadow">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="font-bold text-xl text-slate-800 dark:text-white">{play.symbol}</span>
                                        <span className="text-[10px] font-bold uppercase px-2 py-1 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded-sm">
                                            {play.action}
                                        </span>
                                    </div>
                                    <div className="mb-2">
                                        <span className="text-xs text-slate-500 uppercase font-bold">Allocate</span>
                                        <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                                            PKR {play.allocationAmount.toLocaleString()}
                                        </div>
                                    </div>
                                    <p className="text-sm font-serif text-slate-600 dark:text-slate-400 leading-tight">
                                        "{play.reason}"
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Dividend Highlight Section */}
                {analysis.dividendForecast ? (
                  <div className="bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-100 dark:border-emerald-800 p-6 flex flex-col md:flex-row items-center justify-between gap-6 rounded-sm animate-fade-in">
                      <div className="flex items-start gap-4">
                          <div className="p-3 bg-emerald-200 dark:bg-emerald-800/50 rounded-full text-emerald-800 dark:text-emerald-300">
                              <Coins className="w-6 h-6" />
                          </div>
                          <div>
                              <h4 className="text-emerald-900 dark:text-emerald-200 font-bold uppercase tracking-widest text-xs mb-1">Annual Dividend Forecast</h4>
                              <p className="text-emerald-800 dark:text-emerald-300 font-serif text-lg italic">
                                  "Money making money. Your top payer is <strong>{analysis.dividendForecast.topPayer}</strong>."
                              </p>
                          </div>
                      </div>
                      <div className="text-right">
                          <div className="text-3xl font-bold handwritten text-emerald-900 dark:text-emerald-200">
                              PKR {analysis.dividendForecast.estimatedAnnualIncome.toLocaleString()}
                          </div>
                          <div className="text-sm font-sans text-emerald-700 dark:text-emerald-400 font-bold">
                              {analysis.dividendForecast.portfolioYield.toFixed(2)}% Yield
                          </div>
                      </div>
                  </div>
                ) : (
                   loading && <div className="h-24 bg-slate-50 dark:bg-slate-700/50 animate-pulse rounded-sm border border-slate-100 dark:border-slate-600 flex items-center justify-center text-slate-300 font-serif italic">Calculating dividends...</div>
                )}

                {/* DCA / SIP Calculator Section */}
                {dcaProjection && (
                    <div className="border-2 border-dashed border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-slate-800 p-6 rounded-sm relative mt-8">
                         <div className="absolute -top-3 left-4 bg-indigo-600 text-white px-3 py-1 text-xs font-bold uppercase tracking-widest transform -rotate-1 shadow-sm">
                            Future Predictor
                         </div>
                         <div className="flex flex-col md:flex-row gap-8">
                             <div className="w-full md:w-1/3 space-y-4">
                                 <div>
                                     <h3 className="text-xl font-bold handwritten text-indigo-900 dark:text-indigo-200 mb-2">Monthly Injection</h3>
                                     <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 font-serif leading-tight">
                                         Project value over 5 years if you add this amount monthly, distributed by your current portfolio ratio.
                                     </p>
                                     <div className="relative">
                                         <Calculator className="absolute left-3 top-3 w-5 h-5 text-indigo-400" />
                                         <input 
                                            type="number" 
                                            value={monthlyContribution}
                                            onChange={(e) => setMonthlyContribution(e.target.value)}
                                            className="w-full pl-10 pr-4 py-2 text-xl font-bold text-indigo-900 dark:text-indigo-100 bg-white dark:bg-slate-700 border border-indigo-200 dark:border-indigo-600 rounded-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                            placeholder="50000"
                                         />
                                         <span className="absolute right-3 top-3.5 text-xs font-bold text-indigo-300">PKR</span>
                                     </div>
                                 </div>
                                 
                                 <div className="bg-white dark:bg-slate-700/50 p-4 rounded-sm border border-indigo-100 dark:border-indigo-900/50">
                                     <div className="flex justify-between items-center mb-2">
                                         <span className="text-xs font-bold text-slate-500 uppercase">Implied Growth</span>
                                         <span className="font-bold text-emerald-600">{dcaProjection.cagrPercent}% / yr</span>
                                     </div>
                                     <div className="flex justify-between items-center">
                                         <span className="text-xs font-bold text-slate-500 uppercase">Est. Yield</span>
                                         <span className="font-bold text-amber-600">{dcaProjection.yieldPercent}%</span>
                                     </div>
                                 </div>

                                 <div className="pt-2 border-t border-indigo-200 dark:border-indigo-800">
                                     <div className="text-xs font-bold text-indigo-400 uppercase mb-1">Total Added (5Y)</div>
                                     <div className="text-lg font-bold text-slate-700 dark:text-slate-300">
                                         PKR {(dcaProjection.totalContributed / 1000).toLocaleString()}k
                                     </div>
                                 </div>
                             </div>

                             <div className="w-full md:w-2/3">
                                <div className="h-[300px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ComposedChart data={dcaProjection.data} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                            <XAxis dataKey="year" tick={{ fontFamily: 'Patrick Hand', fill: chartFontColor }} axisLine={false} tickLine={false} />
                                            <YAxis yAxisId="left" tickFormatter={(v) => `${(v/100000).toFixed(1)}L`} tick={{ fontFamily: 'Patrick Hand', fill: chartFontColor, fontSize: 12 }} axisLine={false} tickLine={false} />
                                            <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} tick={{ fontFamily: 'Patrick Hand', fill: '#d97706', fontSize: 12 }} axisLine={false} tickLine={false} />
                                            <Tooltip 
                                                contentStyle={{ fontFamily: 'Crimson Pro', backgroundColor: darkMode ? '#1e293b' : '#fff', color: darkMode ? '#e2e8f0' : '#000', borderRadius: 0, border: '1px solid #6366f1' }}
                                                formatter={(value: number, name: string) => [
                                                    `PKR ${value.toLocaleString()}`, 
                                                    name === 'value' ? 'Total Value' : name === 'dividends' ? 'Annual Divs' : 'Principal'
                                                ]}
                                            />
                                            <Legend wrapperStyle={{ fontFamily: 'Patrick Hand', paddingTop: '10px' }} />
                                            <Bar yAxisId="left" dataKey="principal" name="Principal" fill={darkMode ? '#475569' : '#cbd5e1'} barSize={20} radius={[4, 4, 0, 0]} />
                                            <Line yAxisId="left" type="monotone" dataKey="value" name="Projected Value" stroke="#6366f1" strokeWidth={3} dot={{r:4}} />
                                            <Line yAxisId="right" type="monotone" dataKey="dividends" name="Annual Dividends" stroke="#d97706" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="flex justify-between items-center mt-2 px-4">
                                     <div className="text-center">
                                         <div className="text-xs text-slate-500 uppercase tracking-wider">Resulting Value</div>
                                         <div className="text-2xl font-bold handwritten text-indigo-700 dark:text-indigo-300">
                                            PKR {(dcaProjection.finalValue / 100000).toFixed(1)} Lakh
                                         </div>
                                     </div>
                                     <ArrowRight className="text-slate-300" />
                                     <div className="text-center">
                                         <div className="text-xs text-slate-500 uppercase tracking-wider">Future Income</div>
                                         <div className="text-2xl font-bold handwritten text-amber-600 dark:text-amber-400">
                                            PKR {(dcaProjection.finalDividends / 1000).toFixed(0)}k <span className="text-sm text-slate-400">/yr</span>
                                         </div>
                                     </div>
                                </div>
                             </div>
                         </div>
                    </div>
                )}

                {/* Charts Row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Radar Chart for Risk */}
                    {analysis.riskRadar && analysis.riskRadar.length > 0 ? (
                        <div className="bg-slate-50 dark:bg-slate-700/30 p-4 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col items-center animate-fade-in">
                            <div className="flex items-center gap-2 mb-2 w-full">
                                <ShieldAlert className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                                <h3 className="font-bold font-sans text-sm uppercase tracking-wide text-slate-600 dark:text-slate-300">Risk Profile</h3>
                            </div>
                            <div className="h-[250px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={analysis.riskRadar.map(r => ({...r, A: sanitizeScore(r.A)}))}>
                                        <PolarGrid stroke={gridColor} />
                                        <PolarAngleAxis dataKey="subject" tick={{ fill: chartFontColor, fontSize: 12, fontFamily: 'Crimson Pro', fontWeight: 'bold' }} />
                                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                                        <Radar name="Portfolio" dataKey="A" stroke="#6366f1" strokeWidth={2} fill="#6366f1" fillOpacity={0.4} />
                                        <Tooltip contentStyle={{ fontFamily: 'Crimson Pro', backgroundColor: darkMode ? '#1e293b' : '#fff', color: darkMode ? '#e2e8f0' : '#000' }} />
                                    </RadarChart>
                                </ResponsiveContainer>
                            </div>
                            <p className="text-xs text-slate-400 dark:text-slate-500 font-serif italic mt-1 text-center">Score / 100 for each metric</p>
                        </div>
                    ) : (
                      loading && <div className="h-[300px] bg-slate-50 dark:bg-slate-700/50 animate-pulse rounded-sm border border-slate-100 dark:border-slate-600 flex items-center justify-center text-slate-300 font-serif italic">Plotting Risk Radar...</div>
                    )}

                    {/* Projection Chart */}
                    {analysis.projectedGrowth && analysis.projectedGrowth.length > 0 ? (
                        <div className="bg-slate-50 dark:bg-slate-700/30 p-4 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col items-center animate-fade-in">
                            <div className="flex items-center gap-2 mb-2 w-full">
                                <TrendingUp className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                                <h3 className="font-bold font-sans text-sm uppercase tracking-wide text-slate-600 dark:text-slate-300">5-Year Growth: Portfolio vs Bank Savings</h3>
                            </div>
                            <div className="h-[250px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={analysis.projectedGrowth}>
                                        <XAxis dataKey="year" tick={{ fontFamily: 'Patrick Hand', fill: chartFontColor }} stroke={gridColor} />
                                        <YAxis tickFormatter={(v) => `${(v/1000)}k`} tick={{ fontFamily: 'Patrick Hand', fill: chartFontColor }} stroke={gridColor} />
                                        <Tooltip contentStyle={{ fontFamily: 'Crimson Pro', backgroundColor: darkMode ? '#1e293b' : '#fff', color: darkMode ? '#e2e8f0' : '#000' }} formatter={(val: number) => `PKR ${val.toLocaleString()}`} />
                                        <Area type="monotone" dataKey="marketAverage" fill={darkMode ? "#334155" : "#e2e8f0"} stroke="#94a3b8" name="Market Avg" />
                                        <Line type="monotone" dataKey="portfolioValue" stroke="#059669" strokeWidth={3} dot={{r: 4}} name="My Portfolio" />
                                        <Line type="monotone" dataKey="savingsValue" stroke="#3b82f6" strokeDasharray="3 3" strokeWidth={2} dot={false} name="Bank Savings" />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>
                            <p className="text-xs text-slate-400 dark:text-slate-500 font-serif italic mt-1 text-center">Projected Value of Total Net Worth</p>
                            {analysis.projectionNarrative && (
                                <p className="text-sm font-serif text-slate-600 dark:text-slate-300 mt-3 px-4 border-l-2 border-indigo-200 dark:border-indigo-800 italic">
                                    "{analysis.projectionNarrative}"
                                </p>
                            )}
                        </div>
                    ) : (
                      loading && <div className="h-[300px] bg-slate-50 dark:bg-slate-700/50 animate-pulse rounded-sm border border-slate-100 dark:border-slate-600 flex items-center justify-center text-slate-300 font-serif italic">Projecting future growth...</div>
                    )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                     {/* Risk Assessment Text */}
                    <div className="bg-slate-50 dark:bg-slate-700/30 p-6 border border-slate-200 dark:border-slate-700 rounded-sm relative">
                        <div className="w-4 h-4 rounded-full bg-rose-200 dark:bg-rose-900 absolute -top-2 -left-2"></div>
                        <div className="w-4 h-4 rounded-full bg-rose-200 dark:bg-rose-900 absolute -top-2 -right-2"></div>
                        <div className="flex items-center gap-2 mb-4">
                            <Stamp className="text-rose-700 dark:text-rose-400 w-5 h-5" />
                            <h3 className="text-xl font-bold handwritten text-slate-800 dark:text-slate-100">Analysis Notes</h3>
                        </div>
                        <div className="prose prose-slate dark:prose-invert font-serif max-w-none">
                             {analysis.riskAssessment ? (
                               renderMarkdown(analysis.riskAssessment)
                             ) : (
                               <div className="space-y-3">
                                 <div className="animate-pulse bg-slate-200 dark:bg-slate-700 h-4 w-full rounded-sm"></div>
                                 <div className="animate-pulse bg-slate-200 dark:bg-slate-700 h-4 w-full rounded-sm"></div>
                                 <div className="animate-pulse bg-slate-200 dark:bg-slate-700 h-4 w-3/4 rounded-sm"></div>
                              </div>
                             )}
                        </div>
                    </div>

                    {/* Stock Sentiment Chart */}
                    <div className="flex flex-col border border-slate-200 dark:border-slate-700 p-6 bg-white dark:bg-slate-800 shadow-sm">
                        <h3 className="text-xl font-bold handwritten text-slate-800 dark:text-slate-100 mb-4">Stock Sentiment Analysis</h3>
                        {analysis.stockSentiments ? (
                          <>
                            <div className="h-[250px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={analysis.stockSentiments.map(s => ({...s, sentimentScore: sanitizeScore(s.sentimentScore)}))} layout="vertical" margin={{ left: 40 }}>
                                        <XAxis type="number" domain={[0, 100]} hide />
                                        <YAxis dataKey="symbol" type="category" width={50} tick={{ fontFamily: 'Crimson Pro', fontWeight: 'bold', fill: chartFontColor }} />
                                        <Tooltip 
                                            contentStyle={{ backgroundColor: darkMode ? '#1e293b' : '#fff', border: darkMode ? '1px solid #475569' : '1px solid #000', fontFamily: 'Crimson Pro', color: darkMode ? '#e2e8f0' : '#000' }}
                                            cursor={{fill: darkMode ? '#334155' : '#f1f5f9'}}
                                            formatter={(value: number, name: string, props: any) => [
                                                `${value}/100 - ${props.payload.mentions}`, 
                                                "Sentiment"
                                            ]}
                                        />
                                        <ReferenceLine x={50} stroke="#94a3b8" strokeDasharray="3 3" />
                                        <Bar dataKey="sentimentScore" radius={[0, 4, 4, 0]}>
                                            {analysis.stockSentiments.map((entry, index) => {
                                                const score = sanitizeScore(entry.sentimentScore);
                                                return (
                                                    <Cell 
                                                        key={`cell-${index}`} 
                                                        fill={score > 60 ? SENTIMENT_COLORS.high : score < 40 ? SENTIMENT_COLORS.low : SENTIMENT_COLORS.mid} 
                                                    />
                                                );
                                            })}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                            <p className="text-center text-xs text-slate-400 font-sans uppercase tracking-widest mt-2">
                                Bearish (Left) vs Bullish (Right)
                            </p>
                          </>
                        ) : (
                          <div className="flex-1 flex items-center justify-center animate-pulse">
                              <Loader className="w-8 h-8 text-slate-300 animate-spin" />
                          </div>
                        )}
                    </div>
                </div>

                {/* Lists */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                        <h3 className="handwritten text-xl text-emerald-700 dark:text-emerald-400 mb-3 border-b border-emerald-200 dark:border-emerald-800">Opportunities</h3>
                        {analysis.opportunities ? (
                          <ul className="list-disc pl-5 space-y-2 font-serif text-lg text-slate-700 dark:text-slate-300 marker:text-emerald-500">
                              {analysis.opportunities.map((opp, idx) => (
                                  <li key={idx}>{opp}</li>
                              ))}
                          </ul>
                        ) : (
                          <div className="space-y-2">
                             <div className="animate-pulse bg-slate-200 dark:bg-slate-700 h-4 w-3/4 rounded-sm"></div>
                             <div className="animate-pulse bg-slate-200 dark:bg-slate-700 h-4 w-1/2 rounded-sm"></div>
                          </div>
                        )}
                    </div>
                    <div>
                        <h3 className="handwritten text-xl text-rose-700 dark:text-rose-400 mb-3 border-b border-rose-200 dark:border-rose-800">Threats</h3>
                        {analysis.threats ? (
                          <ul className="list-disc pl-5 space-y-2 font-serif text-lg text-slate-700 dark:text-slate-300 marker:text-rose-500">
                              {analysis.threats.map((threat, idx) => (
                                  <li key={idx}>{threat}</li>
                              ))}
                          </ul>
                        ) : (
                          <div className="space-y-2">
                             <div className="animate-pulse bg-slate-200 dark:bg-slate-700 h-4 w-3/4 rounded-sm"></div>
                             <div className="animate-pulse bg-slate-200 dark:bg-slate-700 h-4 w-1/2 rounded-sm"></div>
                          </div>
                        )}
                    </div>
                </div>

                {/* Moves */}
                <div className="mt-8 pt-8 border-t-2 border-slate-800 dark:border-slate-600 border-dashed">
                    <h3 className="text-2xl font-bold handwritten text-slate-800 dark:text-slate-100 mb-6 text-center">Recommended Moves</h3>
                    <div className="space-y-4">
                        {analysis.actionableMoves ? (
                          analysis.actionableMoves.map((move, idx) => (
                              <div key={idx} className="flex items-start gap-4 p-4 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors border-b border-slate-100 dark:border-slate-700 last:border-0 group">
                                  <div className={`font-bold font-sans text-xs px-2 py-1 uppercase tracking-wider border-2 mt-1
                                      ${move.type === 'BUY' ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/50' : 
                                        move.type === 'SELL' ? 'border-rose-600 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/50' : 
                                        'border-amber-600 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/50'}`}>
                                      {move.type}
                                  </div>
                                  <div>
                                      <span className="font-bold font-serif text-xl text-slate-900 dark:text-white mr-2 group-hover:underline decoration-wavy decoration-slate-400">{move.symbol}</span>
                                      <span className="font-serif text-lg text-slate-600 dark:text-slate-400">{move.reason}</span>
                                  </div>
                              </div>
                          ))
                        ) : (
                          <div className="space-y-4">
                             <div className="animate-pulse bg-slate-100 dark:bg-slate-700 h-16 w-full rounded-sm"></div>
                             <div className="animate-pulse bg-slate-100 dark:bg-slate-700 h-16 w-full rounded-sm"></div>
                          </div>
                        )}
                    </div>
                </div>

                {/* What-If Simulator Section */}
                <div className="mt-8 p-6 bg-indigo-50 dark:bg-slate-700/50 border border-indigo-200 dark:border-indigo-800 rounded-sm relative">
                    <div className="absolute -top-3 left-6 bg-indigo-600 text-white px-3 py-1 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                        <FlaskConical className="w-4 h-4" /> What-If Laboratory
                    </div>
                    
                    <div className="mt-4 flex flex-col lg:flex-row gap-8">
                        {/* Simulation Inputs */}
                        <div className="w-full lg:w-1/3 space-y-4 border-r border-indigo-200 dark:border-indigo-800 pr-0 lg:pr-6">
                            <p className="text-sm font-serif text-slate-600 dark:text-slate-300 italic">
                                "Test a potential addition to your portfolio and see how the AI rates the impact."
                            </p>
                            <div className="space-y-3">
                                <div>
                                    <label className="text-xs font-bold text-indigo-800 dark:text-indigo-300 uppercase">Symbol</label>
                                    <input 
                                        value={simStock.symbol}
                                        onChange={(e) => setSimStock({...simStock, symbol: e.target.value})}
                                        className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-sm bg-white dark:bg-slate-800 uppercase font-bold"
                                        placeholder="e.g. LUCK"
                                    />
                                </div>
                                <div className="flex gap-4">
                                    <div className="flex-1">
                                        <label className="text-xs font-bold text-indigo-800 dark:text-indigo-300 uppercase">Shares</label>
                                        <input 
                                            type="number"
                                            value={simStock.shares}
                                            onChange={(e) => setSimStock({...simStock, shares: e.target.value})}
                                            className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-sm bg-white dark:bg-slate-800"
                                            placeholder="100"
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <label className="text-xs font-bold text-indigo-800 dark:text-indigo-300 uppercase">Price</label>
                                        <input 
                                            type="number"
                                            value={simStock.price}
                                            onChange={(e) => setSimStock({...simStock, price: e.target.value})}
                                            className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-sm bg-white dark:bg-slate-800"
                                            placeholder="550"
                                        />
                                    </div>
                                </div>
                                <button 
                                    onClick={handleSimulate}
                                    disabled={isSimulating}
                                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold uppercase tracking-wider text-sm rounded-sm flex items-center justify-center gap-2"
                                >
                                    {isSimulating ? <Loader className="w-4 h-4 animate-spin" /> : <FlaskConical className="w-4 h-4" />}
                                    Run Simulation
                                </button>
                            </div>
                        </div>

                        {/* Simulation Results */}
                        <div className="w-full lg:w-2/3">
                            {simulationResult ? (
                                <div className="animate-fade-in space-y-4">
                                    <div className="flex flex-wrap gap-4 items-center mb-4">
                                        <div className={`px-4 py-2 rounded-sm border-2 font-bold uppercase tracking-wide text-xs flex items-center gap-2
                                            ${simulationResult.riskChange === 'INCREASE' ? 'border-rose-200 bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:border-rose-800 dark:text-rose-300' :
                                              simulationResult.riskChange === 'DECREASE' ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-300' :
                                              'border-slate-200 bg-slate-50 text-slate-700 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-300'
                                            }`}>
                                            Risk: {simulationResult.riskChange}
                                            {simulationResult.riskChange === 'INCREASE' ? <ArrowUp className="w-4 h-4" /> : simulationResult.riskChange === 'DECREASE' ? <ArrowDown className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                                        </div>
                                        <div className="px-4 py-2 rounded-sm border-2 border-amber-200 bg-amber-50 dark:bg-amber-900/30 dark:border-amber-800 dark:text-amber-300 font-bold uppercase tracking-wide text-xs flex items-center gap-2 text-amber-700">
                                            Yield Impact: {simulationResult.projectedYieldChange}
                                        </div>
                                    </div>
                                    
                                    <div className="prose prose-sm dark:prose-invert font-serif">
                                        <p className="italic text-lg">"{simulationResult.impactSummary}"</p>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                        <div className="bg-white dark:bg-slate-800 p-3 rounded-sm border border-emerald-100 dark:border-emerald-900/50">
                                            <h5 className="text-emerald-600 dark:text-emerald-400 font-bold text-xs uppercase mb-2 flex items-center gap-1"><Plus className="w-3 h-3"/> Pros</h5>
                                            <ul className="text-sm space-y-1 text-slate-600 dark:text-slate-400 list-disc pl-4">
                                                {simulationResult.pros.map((p, i) => <li key={i}>{p}</li>)}
                                            </ul>
                                        </div>
                                        <div className="bg-white dark:bg-slate-800 p-3 rounded-sm border border-rose-100 dark:border-rose-900/50">
                                            <h5 className="text-rose-600 dark:text-rose-400 font-bold text-xs uppercase mb-2 flex items-center gap-1"><Minus className="w-3 h-3"/> Cons</h5>
                                            <ul className="text-sm space-y-1 text-slate-600 dark:text-slate-400 list-disc pl-4">
                                                {simulationResult.cons.map((c, i) => <li key={i}>{c}</li>)}
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-600 min-h-[200px] border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-sm">
                                    <FlaskConical className="w-8 h-8 mb-2 opacity-50" />
                                    <p className="font-serif italic text-sm">Waiting for sample data...</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Sources / Citations */}
                {analysis.sources && analysis.sources.length > 0 && (
                    <div className="mt-8 pt-8 border-t border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-2 mb-4 text-slate-400">
                             <Globe className="w-4 h-4" />
                             <h4 className="font-bold font-sans text-xs uppercase tracking-widest">Web Sources & Citations</h4>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                            {analysis.sources.map((source, idx) => (
                                <a 
                                  key={idx} 
                                  href={source.uri} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 text-sm font-serif text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:underline truncate"
                                >
                                    <ExternalLink className="w-3 h-3 flex-shrink-0" />
                                    <span className="truncate">{source.title || source.uri}</span>
                                </a>
                            ))}
                        </div>
                    </div>
                )}
            </div>
            </div>
        )}
    </div>
  );
};
