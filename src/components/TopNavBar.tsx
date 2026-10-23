import React from 'react';
import { useMarketStore } from '../store/useMarketStore';

export const TopNavBar: React.FC = () => {
  const filterCategory = useMarketStore((s) => s.filterCategory);
  const setFilterCategory = useMarketStore((s) => s.setFilterCategory);
  const setPeriod = useMarketStore((s) => s.setPeriod);
  const setArchModalOpen = useMarketStore((s) => s.setArchModalOpen);

  return (
    <header className="flex items-center justify-between gap-8 px-4 h-11 bg-[#0d0e12] border-b border-[#2a2e39] select-none shrink-0">
      {/* Zone 1: Single text element wordmark */}
      <a
        href="#top"
        onClick={(e) => {
          e.preventDefault();
          setFilterCategory('all');
        }}
        className="text-sm sm:text-base font-bold tracking-tight text-white whitespace-nowrap shrink-0"
      >
        AlphaPulse L1
      </a>

      {/* Zone 2: 4 clean single-line text navigation links */}
      <nav
        aria-label="主工作台视图导航"
        className="hidden md:flex items-center gap-6 text-xs font-medium text-[#9ca3af]"
      >
        <button
          type="button"
          onClick={() => setFilterCategory('all')}
          className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            filterCategory === 'all' ? 'text-white underline underline-offset-4 decoration-[#2962ff]' : ''
          }`}
        >
          沪深核心行情
        </button>
        <button
          type="button"
          onClick={() => setFilterCategory('watchlist')}
          className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            filterCategory === 'watchlist' ? 'text-white underline underline-offset-4 decoration-[#2962ff]' : ''
          }`}
        >
          自选盯盘池
        </button>
        <button
          type="button"
          onClick={() => setFilterCategory('special')}
          className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            filterCategory === 'special' ? 'text-white underline underline-offset-4 decoration-[#2962ff]' : ''
          }`}
        >
          涨跌停与竞价
        </button>
        <button
          type="button"
          onClick={() => setPeriod('intraday')}
          className="hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          日内分时全景
        </button>
      </nav>

      {/* Zone 3: 1 primary action */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={() => setArchModalOpen(true)}
          className="px-3 py-1.5 text-xs font-medium text-white bg-[#2962ff] rounded hover:bg-[#1e53e5] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          终端设置与PWA安装
        </button>
      </div>
    </header>
  );
};
