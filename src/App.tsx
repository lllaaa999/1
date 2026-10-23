/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { FinancialChart } from './components/FinancialChart';
import { IndexTickerBar } from './components/IndexTickerBar';
import { OrderBook5Panel } from './components/OrderBook5Panel';
import { PWAInstallModal } from './components/PWAInstallModal';
import { StockQuoteHeader } from './components/StockQuoteHeader';
import { TopNavBar } from './components/TopNavBar';
import { TradeTicksAndMetricsPanel } from './components/TradeTicksAndMetricsPanel';
import { WatchlistPanel } from './components/WatchlistPanel';
import { marketWsClient } from './services/wsClient';
import { useMarketStore } from './store/useMarketStore';

export default function App() {
  const mobileBottomTab = useMarketStore((s) => s.mobileBottomTab);
  const setMobileBottomTab = useMarketStore((s) => s.setMobileBottomTab);
  const isMobileWatchlistOpen = useMarketStore((s) => s.isMobileWatchlistOpen);
  const setMobileWatchlistOpen = useMarketStore((s) => s.setMobileWatchlistOpen);

  useEffect(() => {
    marketWsClient.connect();
    return () => {
      marketWsClient.disconnect();
    };
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0d0e12] text-[#d1d4dc]">
      {/* 1. 顶部三区导航栏与核心指数跑马灯监控条 */}
      <TopNavBar />
      <IndexTickerBar />

      {/* 2. 主工作台：PC 端三栏满视口网格 (>=768px) / 移动端单列自适应流 (<768px) */}
      <main className="flex-1 min-h-0 flex flex-col md:grid md:grid-cols-[276px_minmax(0,1fr)_308px] overflow-hidden">
        {/* 左侧栏 (PC 常驻)：自选股高密度列表 (支持代码/拼音首字母过滤) */}
        <div className="hidden md:flex md:flex-col h-full min-h-0 overflow-hidden">
          <WatchlistPanel />
        </div>

        {/* 中间主区域：顶部股票实时总览 + 中部原生 Canvas K线/分时主副图 */}
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden md:border-r md:border-[#2a2e39]">
          <StockQuoteHeader />
          <FinancialChart />

          {/* 移动端专属 (<768px)：底部分屏 Tab 切换展示【五档盘口】、【实时成交简表】、【基本面/指标】 */}
          <div className="flex md:hidden flex-col h-[325px] shrink-0 border-t border-[#2a2e39] bg-[#1e222d] pb-safe">
            <div
              role="tablist"
              aria-label="移动端盘口与指标切换"
              className="grid grid-cols-3 border-b border-[#2a2e39] bg-[#131722] shrink-0"
            >
              <button
                type="button"
                role="tab"
                aria-selected={mobileBottomTab === 'orderbook'}
                onClick={() => setMobileBottomTab('orderbook')}
                className={`min-h-[42px] text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  mobileBottomTab === 'orderbook'
                    ? 'text-white border-b-2 border-[#2962ff] bg-[#1e222d]'
                    : 'text-[#787b86] hover:text-[#d1d4dc]'
                }`}
              >
                五档盘口
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mobileBottomTab === 'trades'}
                onClick={() => setMobileBottomTab('trades')}
                className={`min-h-[42px] text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  mobileBottomTab === 'trades'
                    ? 'text-white border-b-2 border-[#2962ff] bg-[#1e222d]'
                    : 'text-[#787b86] hover:text-[#d1d4dc]'
                }`}
              >
                实时成交简表
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mobileBottomTab === 'fundamentals'}
                onClick={() => setMobileBottomTab('fundamentals')}
                className={`min-h-[42px] text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  mobileBottomTab === 'fundamentals'
                    ? 'text-white border-b-2 border-[#2962ff] bg-[#1e222d]'
                    : 'text-[#787b86] hover:text-[#d1d4dc]'
                }`}
              >
                基本面/指标
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto">
              {mobileBottomTab === 'orderbook' && <OrderBook5Panel />}
              {mobileBottomTab === 'trades' && (
                <TradeTicksAndMetricsPanel forcedTab="trades" />
              )}
              {mobileBottomTab === 'fundamentals' && (
                <TradeTicksAndMetricsPanel forcedTab="fundamentals" />
              )}
            </div>
          </div>
        </div>

        {/* 右侧栏 (PC 常驻)：上半部 Level-1 五档盘口 + 委比条，下半部实时成交明细与换手指标 */}
        <div className="hidden md:flex md:flex-col h-full min-h-0 overflow-hidden bg-[#1e222d]">
          <OrderBook5Panel />
          <TradeTicksAndMetricsPanel />
        </div>
      </main>

      {/* 移动端自选股快速切换抽屉 (<768px) */}
      {isMobileWatchlistOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="移动端自选股切换抽屉"
          className="fixed inset-0 z-50 md:hidden flex bg-black/70"
          onClick={() => setMobileWatchlistOpen(false)}
        >
          <div
            className="w-[84%] max-w-xs h-full bg-[#1e222d] flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#2a2e39] bg-[#131722]">
              <span className="text-xs font-semibold text-white">
                切换股票标的 (支持拼音/代码)
              </span>
              <button
                type="button"
                aria-label="关闭自选股列表"
                onClick={() => setMobileWatchlistOpen(false)}
                className="p-1 text-[#787b86] hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              <WatchlistPanel />
            </div>
          </div>
        </div>
      )}

      {/* PWA 安装与终端参数弹窗 */}
      <PWAInstallModal />
    </div>
  );
}
