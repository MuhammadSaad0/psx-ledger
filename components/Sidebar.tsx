
import React from 'react';
import { TabView } from '../types';

interface SidebarProps {
  currentTab: TabView;
  onTabChange: (tab: TabView) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onTabChange }) => {
  const navItems = [
    { id: 'dashboard', label: 'Overview' },
    { id: 'portfolio', label: 'Holdings' },
    { id: 'advisor', label: 'AI Insights' },
    { id: 'market', label: 'Strategy' },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 z-50 flex justify-between items-stretch shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
      {navItems.map((item) => {
        const isActive = currentTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id as TabView)}
            className={`flex-1 flex items-center justify-center py-4 transition-all duration-200 relative
              ${isActive 
                ? 'text-slate-900 dark:text-white font-bold bg-slate-50 dark:bg-slate-800' 
                : 'text-slate-400 dark:text-slate-500 font-medium hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
          >
            {isActive && (
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-slate-900 dark:bg-white mx-4"></div>
            )}
            <span className="text-[10px] uppercase tracking-widest">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
