
import React, { useState, useRef } from 'react';
import { StockPosition, Transaction } from '../types';
import { Plus, Trash2, RefreshCw, NotebookPen, X, TrendingUp, TrendingDown, Upload, ChevronDown, ChevronUp, Banknote, AlertCircle, AlertTriangle } from 'lucide-react';
import * as XLSX from 'xlsx';

interface PortfolioViewProps {
  portfolio: StockPosition[];
  liquidCash: number;
  onUpdateLiquidCash: (amount: number) => void;
  onAddStock: (stock: StockPosition) => void;
  onRemoveStock: (id: string) => void;
  onUpdateStock: (id: string, transaction: Transaction) => void;
  onRefreshPrices: () => void;
  isRefreshing: boolean;
  onImportStocks: (stocks: StockPosition[]) => void;
  darkMode: boolean;
}

export const PortfolioView: React.FC<PortfolioViewProps> = ({ 
  portfolio, 
  liquidCash,
  onUpdateLiquidCash,
  onAddStock, 
  onRemoveStock,
  onUpdateStock,
  onRefreshPrices,
  isRefreshing,
  onImportStocks,
  darkMode
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [showImportWarning, setShowImportWarning] = useState(false);
  const [newStock, setNewStock] = useState({ symbol: '', shares: '', price: '' });
  const [expandedStockId, setExpandedStockId] = useState<string | null>(null);
  
  // Transaction Modal State
  const [selectedStock, setSelectedStock] = useState<StockPosition | null>(null);
  const [newTransaction, setNewTransaction] = useState({ type: 'BUY' as 'BUY'|'SELL', shares: '', price: '' });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStock.symbol || !newStock.shares || !newStock.price) return;
    
    onAddStock({
      id: Date.now().toString(),
      symbol: newStock.symbol.toUpperCase(),
      shares: Number(newStock.shares),
      avgBuyPrice: Number(newStock.price),
      currentPrice: Number(newStock.price),
      transactions: [] // Initial transaction added by parent
    });
    setNewStock({ symbol: '', shares: '', price: '' });
    setShowAddForm(false);
  };

  const handleImportConfirmed = () => {
      setShowImportWarning(false);
      // Trigger the file input click after user confirms in the custom modal
      fileInputRef.current?.click();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if(!file) return;

    // No window.confirm here anymore because it's blocked in sandbox.
    // The confirmation happened via the custom modal before this input was clicked.
    
    try {
        const arrayBuffer = await file.arrayBuffer();
        // Convert to Uint8Array for better compatibility with xlsx in browser
        const data = new Uint8Array(arrayBuffer);
        
        // Use wildcard namespace (XLSX.read)
        const wb = XLSX.read(data, { type: 'array' });
        
        if (!wb.SheetNames || wb.SheetNames.length === 0) {
            alert("The uploaded file appears to be empty or invalid.");
            return;
        }

        const ws = wb.Sheets[wb.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        
        const stockMap = new Map<string, StockPosition>();
        let importedCount = 0;
        
        jsonData.forEach((row, index) => {
            if (row.length < 3) return; // Skip empty rows
            
            const symbol = String(row[0]).toUpperCase().trim();
            const qty = Number(row[1]);
            const cost = Number(row[2]);
            
            // Heuristic to skip header: check if 2nd or 3rd col are NOT numbers
            if (index === 0 && (isNaN(qty) || isNaN(cost))) return;
            
            if (symbol && !isNaN(qty) && !isNaN(cost) && qty > 0) {
                 const newTx: Transaction = {
                     id: Date.now().toString() + Math.random().toString(),
                     type: 'BUY',
                     shares: qty,
                     price: cost,
                     date: new Date().toISOString()
                 };

                 if (stockMap.has(symbol)) {
                     const existing = stockMap.get(symbol)!;
                     const totalCost = (existing.shares * existing.avgBuyPrice) + (qty * cost);
                     const totalShares = existing.shares + qty;
                     
                     existing.shares = totalShares;
                     existing.avgBuyPrice = totalCost / totalShares;
                     // We don't necessarily update currentPrice from history file, keep it as cost for now or update later via API
                     existing.transactions!.push(newTx);
                 } else {
                     stockMap.set(symbol, {
                         id: Date.now().toString() + Math.random().toString(),
                         symbol,
                         shares: qty,
                         avgBuyPrice: cost,
                         currentPrice: cost,
                         transactions: [newTx]
                     });
                 }
                 importedCount++;
            }
        });
        
        const aggregatedStocks = Array.from(stockMap.values());
        // Sort transactions by date descending for consistency
        aggregatedStocks.forEach(s => {
            s.transactions?.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        });

        if (aggregatedStocks.length > 0) {
            onImportStocks(aggregatedStocks);
            // Replaced alert with console log to avoid sandbox issues
            console.log(`Successfully imported ${importedCount} transactions.`);
        } else {
            console.warn("No valid rows found.");
        }
        
    } catch (err) {
        console.error("Import failed:", err);
    } finally {
        // Always reset the input so the same file can be selected again if needed
        if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAddTransactionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStock || !newTransaction.shares || !newTransaction.price) return;

    const shares = Number(newTransaction.shares);
    const price = Number(newTransaction.price);

    if (newTransaction.type === 'SELL' && shares > selectedStock.shares) {
      alert("Cannot sell more shares than you own!");
      return;
    }

    const transaction: Transaction = {
      id: Date.now().toString(),
      type: newTransaction.type,
      shares,
      price,
      date: new Date().toISOString()
    };

    onUpdateStock(selectedStock.id, transaction);
    setSelectedStock(null); 
    setNewTransaction({ type: 'BUY', shares: '', price: '' });
  };

  const totalValue = portfolio.reduce((acc, stock) => acc + (stock.shares * (stock.currentPrice || stock.avgBuyPrice)), 0);
  const totalCost = portfolio.reduce((acc, stock) => acc + (stock.shares * stock.avgBuyPrice), 0);
  const totalGain = totalValue - totalCost;
  const totalNetWorth = totalValue + liquidCash;

  return (
    <div className="space-y-6">
      {/* Portfolio Header / Stats */}
      <div className="bg-white dark:bg-slate-800 p-6 shadow-sm border border-slate-200 dark:border-slate-700 relative overflow-hidden group paper-shadow">
          <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-100 dark:bg-yellow-900/20 rounded-bl-full -mr-16 -mt-16 transition-transform group-hover:scale-110"></div>
          
          <div className="relative z-10 flex flex-col xl:flex-row justify-between xl:items-center gap-8">
              <div className="flex flex-col md:flex-row gap-8 text-center md:text-left">
                  <div>
                      <h3 className="text-slate-500 dark:text-slate-400 font-bold uppercase text-xs tracking-widest mb-1">Asset Value</h3>
                      <p className="text-3xl font-bold text-slate-900 dark:text-white handwritten">PKR {(totalValue / 1000).toLocaleString()}k</p>
                  </div>
                  
                  <div className="group relative">
                      <h3 className="text-slate-500 dark:text-slate-400 font-bold uppercase text-xs tracking-widest mb-1 flex items-center gap-1 justify-center md:justify-start">
                          <Banknote className="w-3 h-3" /> Liquid Cash
                      </h3>
                      <div className="flex items-center justify-center md:justify-start">
                          <span className="text-3xl font-bold text-indigo-700 dark:text-indigo-400 handwritten mr-2">PKR</span>
                          <input 
                              type="number" 
                              value={liquidCash === 0 ? '' : liquidCash} 
                              onChange={(e) => onUpdateLiquidCash(Number(e.target.value))}
                              className="text-3xl font-bold text-indigo-700 dark:text-indigo-400 handwritten bg-transparent w-[140px] focus:outline-none border-b border-dashed border-indigo-300 focus:border-indigo-600"
                              placeholder="0"
                          />
                      </div>
                  </div>

                  <div>
                      <h3 className="text-slate-500 dark:text-slate-400 font-bold uppercase text-xs tracking-widest mb-1">Total Gain</h3>
                      <div className={`flex items-center justify-center md:justify-start gap-1 text-2xl font-bold handwritten ${totalGain >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                          {totalGain >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                          PKR {(Math.abs(totalGain) / 1000).toLocaleString()}k
                      </div>
                  </div>
              </div>
              
              <div className="flex flex-col items-end gap-1">
                  <div className="flex flex-wrap gap-3 justify-end">
                      <button 
                        onClick={() => setShowImportWarning(true)}
                        className="flex items-center gap-2 px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-sm hover:bg-slate-50 dark:hover:bg-slate-700 text-sm font-bold uppercase tracking-wider group relative"
                        title="Imports will replace current data"
                      >
                          <Upload className="w-4 h-4" /> Import XLSX
                      </button>
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileUpload} 
                        accept=".xlsx,.csv" 
                        className="hidden" 
                      />
                      <button 
                        onClick={onRefreshPrices}
                        disabled={isRefreshing}
                        className="flex items-center gap-2 px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-sm hover:bg-slate-50 dark:hover:bg-slate-700 text-sm font-bold uppercase tracking-wider disabled:opacity-50"
                      >
                          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} /> Refresh
                      </button>
                      <button 
                        onClick={() => setShowAddForm(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-slate-700 text-white rounded-sm hover:bg-slate-800 dark:hover:bg-slate-600 text-sm font-bold uppercase tracking-wider shadow-md"
                      >
                          <Plus className="w-4 h-4" /> Add Asset
                      </button>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500 mr-1 mt-1">
                      <AlertCircle className="w-3 h-3" />
                      <span>Note: Importing replaces current ledger</span>
                  </div>
              </div>
          </div>
      </div>

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm rounded-sm overflow-hidden animate-fade-in">
          {portfolio.length === 0 ? (
            <div className="p-12 text-center text-slate-400 font-serif italic">
                Your ledger is empty. Add a stock or import a file to begin.
            </div>
          ) : (
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[800px]">
                    <thead>
                        <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            <th className="p-4 w-8"></th>
                            <th className="p-4">Symbol</th>
                            <th className="p-4">Shares</th>
                            <th className="p-4">Avg Price</th>
                            <th className="p-4">Current</th>
                            <th className="p-4">Value</th>
                            <th className="p-4">Gain/Loss</th>
                            <th className="p-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {portfolio.map((stock) => {
                            const current = stock.currentPrice || stock.avgBuyPrice;
                            const value = current * stock.shares;
                            const gain = value - (stock.avgBuyPrice * stock.shares);
                            const gainPercent = (gain / (stock.avgBuyPrice * stock.shares)) * 100;
                            const isExpanded = expandedStockId === stock.id;

                            return (
                            <React.Fragment key={stock.id}>
                                <tr className={`hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group ${isExpanded ? 'bg-slate-50 dark:bg-slate-800/80' : ''}`}>
                                    <td className="p-4 text-center">
                                        <button onClick={() => setExpandedStockId(isExpanded ? null : stock.id)} className="text-slate-400 hover:text-slate-600">
                                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                        </button>
                                    </td>
                                    <td className="p-4">
                                        <div className="font-bold text-slate-900 dark:text-white">{stock.symbol}</div>
                                        <div className="text-xs text-slate-500 font-serif truncate max-w-[150px]">{stock.companyName || stock.sector}</div>
                                    </td>
                                    <td className="p-4 font-mono text-slate-700 dark:text-slate-300">{stock.shares.toLocaleString()}</td>
                                    <td className="p-4 font-mono text-slate-700 dark:text-slate-300">{stock.avgBuyPrice.toFixed(2)}</td>
                                    <td className="p-4 font-mono font-bold text-slate-900 dark:text-white">{current.toFixed(2)}</td>
                                    <td className="p-4 font-mono text-slate-700 dark:text-slate-300">{value.toLocaleString()}</td>
                                    <td className={`p-4 font-bold ${gain >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                        {gain >= 0 ? '+' : ''}{gain.toLocaleString()} ({gainPercent.toFixed(1)}%)
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button 
                                            onClick={() => setSelectedStock(stock)}
                                            className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                            title="Add Transaction"
                                            >
                                                <NotebookPen className="w-4 h-4" />
                                            </button>
                                            <button 
                                            onClick={() => onRemoveStock(stock.id)}
                                            className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                                            title="Remove Asset"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                                {isExpanded && (
                                    <tr className="bg-slate-50 dark:bg-slate-900/50">
                                        <td colSpan={8} className="p-4 pl-12">
                                            <div className="border-l-2 border-slate-300 dark:border-slate-600 pl-4">
                                                <h4 className="text-xs font-bold uppercase text-slate-500 mb-2">Transaction History</h4>
                                                {stock.transactions && stock.transactions.length > 0 ? (
                                                    <table className="w-full text-sm">
                                                        <thead>
                                                            <tr className="text-left text-slate-400 border-b border-slate-200 dark:border-slate-700">
                                                                <th className="pb-2 font-normal">Date</th>
                                                                <th className="pb-2 font-normal">Type</th>
                                                                <th className="pb-2 font-normal">Shares</th>
                                                                <th className="pb-2 font-normal">Price</th>
                                                                <th className="pb-2 font-normal">Total</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="font-mono text-slate-600 dark:text-slate-400">
                                                            {stock.transactions.map((tx, idx) => (
                                                                <tr key={idx} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                                                                    <td className="py-2">{new Date(tx.date).toLocaleDateString()}</td>
                                                                    <td className={`py-2 font-bold ${tx.type === 'BUY' ? 'text-emerald-600' : 'text-rose-600'}`}>{tx.type}</td>
                                                                    <td className="py-2">{tx.shares}</td>
                                                                    <td className="py-2">{tx.price}</td>
                                                                    <td className="py-2">{(tx.shares * tx.price).toLocaleString()}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                ) : (
                                                    <p className="text-slate-400 italic text-sm">No individual transaction records.</p>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>
          )}
      </div>

      {/* Add Stock Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-800 p-8 w-full max-w-md shadow-2xl relative paper-shadow transform rotate-1">
                <button onClick={() => setShowAddForm(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
                    <X className="w-6 h-6" />
                </button>
                <h3 className="text-2xl font-bold handwritten mb-6 text-slate-800 dark:text-slate-100 border-b border-slate-200 dark:border-slate-700 pb-2">
                    Acquire Asset
                </h3>
                <form onSubmit={handleAdd} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Symbol</label>
                        <input 
                            value={newStock.symbol}
                            onChange={(e) => setNewStock({...newStock, symbol: e.target.value.toUpperCase()})}
                            className="w-full p-2 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 focus:ring-2 focus:ring-slate-400 outline-none font-bold uppercase"
                            placeholder="e.g. ENGRO"
                            autoFocus
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Quantity</label>
                            <input 
                                type="number"
                                value={newStock.shares}
                                onChange={(e) => setNewStock({...newStock, shares: e.target.value})}
                                className="w-full p-2 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 focus:ring-2 focus:ring-slate-400 outline-none"
                                placeholder="100"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Avg Price</label>
                            <input 
                                type="number"
                                value={newStock.price}
                                onChange={(e) => setNewStock({...newStock, price: e.target.value})}
                                className="w-full p-2 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 focus:ring-2 focus:ring-slate-400 outline-none"
                                placeholder="250.50"
                            />
                        </div>
                    </div>
                    <button type="submit" className="w-full py-3 bg-slate-900 dark:bg-slate-600 text-white font-bold uppercase tracking-wider hover:bg-slate-800 dark:hover:bg-slate-500 transition-colors mt-2">
                        Record Entry
                    </button>
                </form>
            </div>
        </div>
      )}

      {/* Warning Modal for Import */}
      {showImportWarning && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-800 p-8 w-full max-w-sm shadow-2xl relative paper-shadow border-t-4 border-amber-500">
                <button onClick={() => setShowImportWarning(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
                    <X className="w-6 h-6" />
                </button>
                <div className="flex flex-col items-center text-center mb-6">
                    <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-full text-amber-600 dark:text-amber-500 mb-4">
                        <AlertTriangle className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">
                        Overwrite Portfolio?
                    </h3>
                    <p className="text-slate-500 dark:text-slate-400 font-serif leading-relaxed">
                        Importing a file will <strong>permanently replace</strong> your current portfolio and transaction history. This action cannot be undone.
                    </p>
                </div>
                
                <div className="flex gap-3">
                    <button 
                        onClick={() => setShowImportWarning(false)}
                        className="flex-1 py-2 border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wider hover:bg-slate-50 dark:hover:bg-slate-700"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleImportConfirmed}
                        className="flex-1 py-2 bg-slate-900 dark:bg-slate-600 text-white font-bold uppercase tracking-wider hover:bg-slate-800 dark:hover:bg-slate-500"
                    >
                        Proceed
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Transaction Modal */}
      {selectedStock && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-800 p-8 w-full max-w-md shadow-2xl relative paper-shadow">
                <button onClick={() => setSelectedStock(null)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
                    <X className="w-6 h-6" />
                </button>
                <h3 className="text-2xl font-bold handwritten mb-1 text-slate-800 dark:text-slate-100">
                    Update Ledger
                </h3>
                <p className="text-slate-500 mb-6 font-serif italic">Recording transaction for <strong>{selectedStock.symbol}</strong></p>
                
                <form onSubmit={handleAddTransactionSubmit} className="space-y-4">
                     <div className="flex gap-4 mb-4">
                        <label className={`flex-1 cursor-pointer border-2 p-2 text-center font-bold uppercase text-sm ${newTransaction.type === 'BUY' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-400'}`}>
                            <input type="radio" name="type" className="hidden" checked={newTransaction.type === 'BUY'} onChange={() => setNewTransaction({...newTransaction, type: 'BUY'})} />
                            Buy
                        </label>
                        <label className={`flex-1 cursor-pointer border-2 p-2 text-center font-bold uppercase text-sm ${newTransaction.type === 'SELL' ? 'border-rose-500 bg-rose-50 text-rose-700' : 'border-slate-200 text-slate-400'}`}>
                            <input type="radio" name="type" className="hidden" checked={newTransaction.type === 'SELL'} onChange={() => setNewTransaction({...newTransaction, type: 'SELL'})} />
                            Sell
                        </label>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Shares</label>
                            <input 
                                type="number"
                                value={newTransaction.shares}
                                onChange={(e) => setNewTransaction({...newTransaction, shares: e.target.value})}
                                className="w-full p-2 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 focus:ring-2 focus:ring-slate-400 outline-none"
                                placeholder="Quantity"
                                autoFocus
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Price / Share</label>
                            <input 
                                type="number"
                                value={newTransaction.price}
                                onChange={(e) => setNewTransaction({...newTransaction, price: e.target.value})}
                                className="w-full p-2 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 focus:ring-2 focus:ring-slate-400 outline-none"
                                placeholder="Price"
                            />
                        </div>
                    </div>
                    <button type="submit" className="w-full py-3 bg-slate-900 dark:bg-slate-600 text-white font-bold uppercase tracking-wider hover:bg-slate-800 dark:hover:bg-slate-500 transition-colors mt-2">
                        Confirm Transaction
                    </button>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};
