
import React, { useState, useEffect, useRef } from 'react';
import { Dashboard } from './components/Dashboard';
import { PortfolioView } from './components/PortfolioView';
import { StrategyView } from './components/StrategyView';
import { AdvisorView } from './components/AdvisorView';
import { Sidebar } from './components/Sidebar';
import { INITIAL_STRATEGY } from './constants';
import { StockPosition, InvestmentStrategy, TabView, AnalysisResult, Transaction } from './types';
import { updateStockPrices, generatePortfolioAnalysis } from './services/geminiService';
import { generatePDFReport } from './services/pdfService';
import { Book, ChevronDown, ChevronUp, Eraser, Download, Moon, Sun } from 'lucide-react';

const TABS: TabView[] = ['dashboard', 'portfolio', 'advisor', 'market'];

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabView>('dashboard');
  
  // Dark Mode State - Default to LIGHT mode
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('theme');
        return saved === 'dark'; // Only true if explicitly saved as 'dark', otherwise false (light)
    }
    return false;
  });

  // Apply Dark Mode Effect
  useEffect(() => {
    if (darkMode) {
      document.body.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.body.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  const toggleDarkMode = () => setDarkMode(!darkMode);

  // Initialize state from localStorage or use EMPTY array
  const [portfolio, setPortfolio] = useState<StockPosition[]>(() => {
    try {
      const saved = localStorage.getItem('portfolio');
      return saved !== null ? JSON.parse(saved) : []; 
    } catch (e) {
      console.error("Failed to load portfolio", e);
      return [];
    }
  });

  // Liquid Cash State
  const [liquidCash, setLiquidCash] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('liquidCash');
      return saved !== null ? Number(saved) : 0;
    } catch (e) {
      return 0;
    }
  });

  const [strategy, setStrategy] = useState<InvestmentStrategy>(() => {
    try {
      const saved = localStorage.getItem('strategy');
      return saved !== null ? JSON.parse(saved) : INITIAL_STRATEGY;
    } catch (e) {
      return INITIAL_STRATEGY;
    }
  });

  // --- ANALYSIS HISTORY STATE ---
  const [analysisHistory, setAnalysisHistory] = useState<AnalysisResult[]>(() => {
    try {
      const saved = localStorage.getItem('analysisHistory');
      return saved !== null ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [viewingAnalysisId, setViewingAnalysisId] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Ref to track the latest portfolio state for async operations
  const portfolioRef = useRef(portfolio);

  // Derived active analysis
  const currentAnalysis = viewingAnalysisId 
    ? analysisHistory.find(a => a.id === viewingAnalysisId) || null
    : analysisHistory.length > 0 ? analysisHistory[0] : null;

  // Persistence Effects & Ref Sync
  useEffect(() => {
    portfolioRef.current = portfolio;
    localStorage.setItem('portfolio', JSON.stringify(portfolio));
  }, [portfolio]);

  useEffect(() => {
    localStorage.setItem('strategy', JSON.stringify(strategy));
  }, [strategy]);

  useEffect(() => {
    localStorage.setItem('analysisHistory', JSON.stringify(analysisHistory));
  }, [analysisHistory]);

  useEffect(() => {
    localStorage.setItem('liquidCash', liquidCash.toString());
  }, [liquidCash]);

  // Initial Price Fetch
  useEffect(() => {
    if (portfolio.length > 0) {
      handleRefreshPrices();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keyboard Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      const currentIndex = TABS.indexOf(activeTab);
      
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const nextIndex = Math.min(currentIndex + 1, TABS.length - 1);
        setActiveTab(TABS[nextIndex]);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prevIndex = Math.max(currentIndex - 1, 0);
        setActiveTab(TABS[prevIndex]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab]);

  const handleRefreshPrices = async () => {
    const currentPortfolio = portfolioRef.current;
    if (currentPortfolio.length === 0) return;
    
    setIsRefreshing(true);
    try {
      const updatedPortfolio = await updateStockPrices(currentPortfolio);
      if (portfolioRef.current.length === 0) return; // Discard updates if reset happened
      setPortfolio(updatedPortfolio);
    } catch (error) {
      console.error("Failed to update prices", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleRunAnalysis = async () => {
    // We allow analysis even if portfolio is empty, if there is cash, to get buy suggestions
    if (portfolio.length === 0 && liquidCash === 0) {
        setAnalysisError("Please add assets or update liquid cash first.");
        return;
    }
    
    setIsAnalyzing(true);
    setAnalysisError('');
    
    const newId = Date.now().toString();
    const newEntry: AnalysisResult = {
        id: newId,
        timestamp: Date.now()
    };

    setAnalysisHistory(prev => [newEntry, ...prev]);
    setViewingAnalysisId(newId);

    try {
      await generatePortfolioAnalysis(portfolio, strategy, liquidCash, (partialData) => {
          setAnalysisHistory(prev => {
              return prev.map(item => {
                  if (item.id === newId) {
                      return { ...item, ...partialData };
                  }
                  return item;
              });
          });
      });
    } catch (err) {
      setAnalysisError("Analysis unavailable. Try again later.");
      setAnalysisHistory(prev => prev.filter(item => item.id !== newId));
      setViewingAnalysisId(null);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDownloadReport = () => {
      generatePDFReport(portfolio, strategy, currentAnalysis);
  };

  const handleAddStock = (stock: StockPosition) => {
    const initialTransaction: Transaction = {
        id: Date.now().toString(),
        type: 'BUY',
        shares: stock.shares,
        price: stock.avgBuyPrice,
        date: new Date().toISOString()
    };
    
    setPortfolio(prev => {
        // Check if symbol exists
        const existingIndex = prev.findIndex(p => p.symbol.toUpperCase() === stock.symbol.toUpperCase());
        
        if (existingIndex >= 0) {
            // Merge into existing
            const existing = prev[existingIndex];
            const totalCost = (existing.shares * existing.avgBuyPrice) + (stock.shares * stock.avgBuyPrice);
            const totalShares = existing.shares + stock.shares;
            const newAvg = totalCost / totalShares;
            
            const updatedStock: StockPosition = {
                ...existing,
                shares: totalShares,
                avgBuyPrice: newAvg,
                transactions: [initialTransaction, ...(existing.transactions || [])]
            };
            
            const newArr = [...prev];
            newArr[existingIndex] = updatedStock;
            return newArr;
        } else {
            // Add as new
            const stockWithHistory = {
                ...stock,
                transactions: [initialTransaction]
            };
            return [...prev, stockWithHistory];
        }
    });
    
    setTimeout(() => handleRefreshPrices(), 500); 
  };

  const handleImportStocks = (stocks: StockPosition[]) => {
    // Replace portfolio entirely with new aggregated list
    setPortfolio(stocks);
    setTimeout(() => handleRefreshPrices(), 1000);
  };

  const handleTransaction = (stockId: string, transaction: Transaction) => {
    setPortfolio(prevPortfolio => {
      return prevPortfolio.map(stock => {
        if (stock.id !== stockId) return stock;

        let newShares = stock.shares;
        let newAvgPrice = stock.avgBuyPrice;

        if (transaction.type === 'BUY') {
          const totalCost = (stock.shares * stock.avgBuyPrice) + (transaction.shares * transaction.price);
          newShares = stock.shares + transaction.shares;
          newAvgPrice = totalCost / newShares;
        } else if (transaction.type === 'SELL') {
          newShares = Math.max(0, stock.shares - transaction.shares);
          if (newShares === 0) newAvgPrice = 0;
        }

        const updatedTransactions = stock.transactions ? [...stock.transactions, transaction] : [transaction];
        updatedTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        return {
          ...stock,
          shares: newShares,
          avgBuyPrice: newAvgPrice,
          transactions: updatedTransactions
        };
      });
    });
    
    // Optional: Adjust liquid cash on transaction
    const amount = transaction.shares * transaction.price;
    if (transaction.type === 'BUY') {
        setLiquidCash(prev => Math.max(0, prev - amount));
    } else {
        setLiquidCash(prev => prev + amount);
    }
  };

  const handleRemoveStock = (id: string) => {
    setPortfolio(portfolio.filter(s => s.id !== id));
  };

  const handleReset = () => {
    if (window.confirm("Are you sure you want to erase your journal? This will delete all entries permanently.")) {
      setPortfolio([]);
      setLiquidCash(0);
      setStrategy({ ...INITIAL_STRATEGY, notes: '' });
      setAnalysisHistory([]);
      setViewingAnalysisId(null);
      setAnalysisError('');
      
      localStorage.setItem('portfolio', '[]');
      localStorage.setItem('liquidCash', '0');
      localStorage.setItem('strategy', JSON.stringify({ ...INITIAL_STRATEGY, notes: '' }));
      localStorage.setItem('analysisHistory', '[]');
      setActiveTab('dashboard');
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard portfolio={portfolio} strategy={strategy} analysis={currentAnalysis} darkMode={darkMode} liquidCash={liquidCash} />;
      case 'portfolio':
        return (
          <PortfolioView 
            portfolio={portfolio} 
            liquidCash={liquidCash}
            onUpdateLiquidCash={setLiquidCash}
            onAddStock={handleAddStock} 
            onRemoveStock={handleRemoveStock}
            onUpdateStock={handleTransaction}
            onRefreshPrices={handleRefreshPrices}
            isRefreshing={isRefreshing}
            onImportStocks={handleImportStocks}
            darkMode={darkMode}
          />
        );
      case 'advisor':
        return (
          <AdvisorView 
            portfolio={portfolio} 
            liquidCash={liquidCash}
            strategy={strategy} 
            analysis={currentAnalysis}
            history={analysisHistory}
            onSelectAnalysis={setViewingAnalysisId}
            loading={isAnalyzing}
            error={analysisError}
            onRunAnalysis={handleRunAnalysis}
            darkMode={darkMode}
          />
        );
      case 'market':
        return <StrategyView strategy={strategy} onUpdate={setStrategy} darkMode={darkMode} />;
      default:
        return <Dashboard portfolio={portfolio} strategy={strategy} analysis={currentAnalysis} darkMode={darkMode} liquidCash={liquidCash} />;
    }
  };

  return (
    <div className={`min-h-screen flex font-serif bg-paper-light dark:bg-paper-dark text-ink-light dark:text-ink-dark relative overflow-x-hidden selection:bg-yellow-200 dark:selection:bg-yellow-900 transition-colors duration-300`}>
      
      {/* Navigation - Responsive Sidebar (Mobile Only now) */}
      <Sidebar currentTab={activeTab} onTabChange={setActiveTab} />

      {/* Main Content Area */}
      <main className="flex-1 p-4 md:p-12 mb-20 md:mb-0 relative w-full transition-all duration-300">
        
        <header className="mb-10 pt-4 border-b-2 border-slate-300 dark:border-slate-700 pb-4 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-1">
                <Book className="w-4 h-4" />
                <span className="text-sm italic uppercase tracking-widest">Personal Investment Journal</span>
            </div>
            <h1 className="text-4xl lg:text-6xl font-bold text-slate-800 dark:text-slate-100 handwritten leading-tight">
              {activeTab === 'dashboard' && 'Daily Overview'}
              {activeTab === 'portfolio' && 'My Ledger'}
              {activeTab === 'advisor' && 'Advisor Notes'}
              {activeTab === 'market' && 'My Manifesto'}
            </h1>
          </div>
          <div className="flex flex-col items-end gap-2 w-full md:w-auto">
            <div className="hidden md:block text-right">
              <div className="handwritten text-2xl text-slate-400 dark:text-slate-500 rotate-[-2deg]">
                {new Date().toLocaleDateString('en-US', { weekday: 'long' })}
              </div>
              <div className="font-serif text-sm text-slate-400 dark:text-slate-500">
                {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </div>
            </div>
            <div className="flex items-center justify-end w-full gap-3">
                 <button 
                  onClick={toggleDarkMode}
                  className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
                  title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
                 >
                    {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                 </button>

                 <button 
                  type="button"
                  onClick={handleDownloadReport}
                  className="group flex items-center gap-2 text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors text-sm font-sans font-bold uppercase tracking-wider cursor-pointer border border-slate-300 dark:border-slate-600 px-3 py-1 rounded-sm bg-white dark:bg-slate-800 shadow-sm hover:shadow-md"
                  title="Download PDF Report"
                >
                  <Download className="w-4 h-4" />
                  <span className="hidden md:inline">Report</span>
                </button>
                <button 
                  type="button"
                  onClick={handleReset}
                  className="group flex items-center gap-2 text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors text-sm font-sans font-bold uppercase tracking-wider cursor-pointer"
                  title="Reset Account"
                >
                  <Eraser className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                  <span className="hidden md:inline">Erase All</span>
                </button>
            </div>
          </div>
        </header>

        <div className="animate-fade-in relative z-10 min-h-[60vh]">
          {renderContent()}
        </div>

      </main>
    </div>
  );
};

export default App;
