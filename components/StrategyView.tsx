
import React, { useRef, useState, useEffect } from 'react';
import { InvestmentGoal, InvestmentStrategy, RiskTolerance } from '../types';
import { Feather, Eraser } from 'lucide-react';

interface StrategyViewProps {
  strategy: InvestmentStrategy;
  onUpdate: (s: InvestmentStrategy) => void;
  darkMode: boolean;
}

export const StrategyView: React.FC<StrategyViewProps> = ({ strategy, onUpdate, darkMode }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  
  const handleChange = (field: keyof InvestmentStrategy, value: any) => {
    onUpdate({ ...strategy, [field]: value });
  };

  useEffect(() => {
    if (strategy.signature && canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        const img = new Image();
        img.onload = () => {
            ctx?.drawImage(img, 0, 0);
        };
        img.src = strategy.signature;
    }
  }, []); // Initial load only

  const getCoordinates = (event: React.MouseEvent | React.TouchEvent) => {
      if (!canvasRef.current) return { x: 0, y: 0 };
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      let clientX, clientY;

      if ('touches' in event) {
          clientX = event.touches[0].clientX;
          clientY = event.touches[0].clientY;
      } else {
          clientX = (event as React.MouseEvent).clientX;
          clientY = (event as React.MouseEvent).clientY;
      }

      return {
          x: clientX - rect.left,
          y: clientY - rect.top
      };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
      if(e.type === 'touchstart') e.preventDefault(); // Prevent scrolling
      setIsDrawing(true);
      const { x, y } = getCoordinates(e);
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineWidth = 2;
          ctx.lineCap = 'round';
          // Use a color that is visible on both or adapt.
          // Since image saves pixels, we adapt to current mode.
          // If mode switches, signature might be hard to read.
          ctx.strokeStyle = darkMode ? '#94a3b8' : '#1e293b'; // Slate 400 (Dark Mode) or Slate 800 (Light Mode)
      }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
      if (!isDrawing) return;
      if(e.type === 'touchmove') e.preventDefault();
      const { x, y } = getCoordinates(e);
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) {
          ctx.lineTo(x, y);
          ctx.stroke();
      }
  };

  const stopDrawing = () => {
      if (isDrawing) {
          setIsDrawing(false);
          if (canvasRef.current) {
              onUpdate({ ...strategy, signature: canvasRef.current.toDataURL() });
          }
      }
  };

  const clearSignature = () => {
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx && canvasRef.current) {
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          onUpdate({ ...strategy, signature: '' });
      }
  };

  return (
    <div className="max-w-3xl mx-auto bg-white dark:bg-slate-800 p-4 md:p-10 shadow-lg relative min-h-[600px] paper-shadow">
      {/* Background Lines */}
      <div className="absolute inset-0 pointer-events-none" 
           style={{ 
             backgroundImage: darkMode 
                ? 'linear-gradient(#334155 1px, transparent 1px)' // Darker lines for dark mode
                : 'linear-gradient(#e5e7eb 1px, transparent 1px)', 
             backgroundSize: '100% 40px',
             marginTop: '60px' 
           }}>
      </div>

      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-10 border-b-4 border-slate-800 dark:border-slate-400 pb-4">
          <Feather className="text-slate-800 dark:text-slate-200 w-8 h-8" />
          <h2 className="text-4xl font-bold handwritten text-slate-800 dark:text-slate-100">My Manifesto</h2>
        </div>

        <div className="space-y-12 font-serif text-2xl leading-[40px] text-slate-800 dark:text-slate-300">
          
          <div className="flex flex-wrap items-baseline gap-2">
            <span>My primary objective in the market is to achieve</span>
            <div className="relative inline-block group">
              <select 
                value={strategy.goal}
                onChange={(e) => handleChange('goal', e.target.value)}
                className="appearance-none bg-transparent border-b-2 border-indigo-500 dark:border-indigo-400 font-bold text-indigo-700 dark:text-indigo-400 focus:outline-none px-2 py-0 cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/30"
              >
                {Object.values(InvestmentGoal).map((g) => (
                  <option key={g} value={g} className="text-slate-800">{g}</option>
                ))}
              </select>
            </div>
            <span>.</span>
          </div>

          <div className="flex flex-wrap items-baseline gap-2">
            <span>I consider my tolerance for financial risk to be</span>
            <div className="flex flex-wrap gap-4 mx-2">
                {Object.values(RiskTolerance).map((risk) => (
                    <label key={risk} className="cursor-pointer flex items-center gap-1">
                        <div className={`w-5 h-5 border-2 border-slate-600 dark:border-slate-400 rounded-full flex items-center justify-center ${strategy.riskTolerance === risk ? 'bg-slate-800 dark:bg-slate-200' : 'bg-transparent'}`}>
                            {strategy.riskTolerance === risk && <div className="w-2 h-2 bg-white dark:bg-slate-800 rounded-full"></div>}
                        </div>
                        <span className={`handwritten text-xl ${strategy.riskTolerance === risk ? 'font-bold underline text-slate-800 dark:text-slate-200' : 'text-slate-500 dark:text-slate-500'}`}>{risk}</span>
                        <input 
                            type="radio" 
                            name="risk" 
                            className="hidden" 
                            checked={strategy.riskTolerance === risk}
                            onChange={() => handleChange('riskTolerance', risk)}
                        />
                    </label>
                ))}
            </div>
            <span>.</span>
          </div>

          <div className="flex flex-wrap items-baseline gap-2">
            <span>I plan to hold these investments for at least</span>
            <input 
                type="number" 
                value={strategy.horizonYears}
                onChange={(e) => handleChange('horizonYears', Number(e.target.value))}
                className="w-16 bg-transparent border-b-2 border-emerald-500 dark:border-emerald-400 font-bold text-emerald-700 dark:text-emerald-400 text-center focus:outline-none"
                min="1" max="50"
            />
            <span>years.</span>
          </div>

          <div className="block mt-8">
            <span className="block mb-2 font-bold handwritten text-3xl text-slate-400 dark:text-slate-500 -rotate-1">Notes to self:</span>
            <textarea 
              value={strategy.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              className="w-full h-40 bg-transparent resize-none focus:outline-none font-serif text-xl leading-[40px] text-slate-700 dark:text-slate-300 placeholder:text-slate-300 dark:placeholder:text-slate-600"
              placeholder="Write your specific goals here..."
              style={{ lineHeight: '40px' }}
            />
          </div>

        </div>

        <div className="mt-12 flex justify-end">
            <div className="text-right">
                <div className="relative group inline-block">
                    <canvas 
                        ref={canvasRef}
                        width={300}
                        height={100}
                        className="border-b-2 border-slate-800 dark:border-slate-400 cursor-crosshair touch-none max-w-full"
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                        onTouchStart={startDrawing}
                        onTouchMove={draw}
                        onTouchEnd={stopDrawing}
                    />
                    {strategy.signature && (
                        <button 
                            onClick={clearSignature}
                            className="absolute -top-2 -right-2 p-1 bg-white dark:bg-slate-700 rounded-full shadow-md text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Clear Signature"
                        >
                            <Eraser className="w-4 h-4" />
                        </button>
                    )}
                    {!strategy.signature && (
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600 font-handwritten pointer-events-none text-xl opacity-50">
                            Sign Here
                        </div>
                    )}
                </div>
                <p className="handwritten text-slate-500 dark:text-slate-400 mt-2">Signature</p>
            </div>
        </div>
      </div>
    </div>
  );
};
