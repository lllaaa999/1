import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Flame,
  Layers,
  Radar,
  Scale,
  ShieldAlert,
  Zap,
} from 'lucide-react';
import { generateIntradayForSymbol } from '../data/seedMarket';
import { useMarketStore } from '../store/useMarketStore';
import type { AuctionSignalType } from '../types/market';
import {
  formatAmountCN,
  formatPrice,
  formatSignedPercent,
  getSignedColorClass,
} from '../utils/marketCalc';
import {
  calculateAuctionRadar,
  calculateBoardLadderSummary,
  calculateRegulatoryDeviation,
  calculateThemeResonance,
  calculateVWDVR,
  getDragonRoleLabel,
} from '../utils/ultraShortQuant';

function getAuctionSignalBadgeClass(signal: AuctionSignalType): string {
  switch (signal) {
    case 'LOCKED_LIMIT_UP':
      return 'bg-[#F6465D]/20 text-[#F6465D] border-[#F6465D]/50';
    case 'SUPER_GRAB':
      return 'bg-[#F6465D]/15 text-[#ff6b81] border-[#F6465D]/40';
    case 'WEAK_TO_STRONG':
      return 'bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/40';
    case 'OVERHEAT_DUMP':
      return 'bg-[#a855f7]/15 text-[#c084fc] border-[#a855f7]/40';
    case 'NUCLEAR_BUTTON':
      return 'bg-[#0ECB81]/20 text-[#0ECB81] border-[#0ECB81]/50';
    default:
      return 'bg-[#131722] text-[#9ca3af] border-[#2a2e39]';
  }
}

/**
 * 顶部单股超短游资五维实时诊断条 (常驻于 K 线/分时主图上方)
 * 让交易员在看盘同时一眼掌握：09:25竞价占昨比、连板身位与断层、题材点面共振、k∈{2,3}异动安全上限价、VW-DVR承接算子
 */
export const UltraShortStockDiagnosticStrip: React.FC = () => {
  const quotes = useMarketStore((s) => s.quotes);
  const selectedSymbol = useMarketStore((s) => s.selectedSymbol);
  const workspaceMode = useMarketStore((s) => s.workspaceMode);
  const openQuantModule = useMarketStore((s) => s.openQuantModule);
  const setWorkspaceMode = useMarketStore((s) => s.setWorkspaceMode);

  const activeQuote = quotes[selectedSymbol];

  const diagnostic = useMemo(() => {
    if (!activeQuote) return null;
    const allQuotes = Object.values(quotes);
    const auction = calculateAuctionRadar(activeQuote);
    const ladder = calculateBoardLadderSummary(allQuotes);
    const themes = calculateThemeResonance(allQuotes);
    const currentTheme = themes.find((t) => t.sectorName === activeQuote.sector) ?? themes[0];
    const reg = calculateRegulatoryDeviation(activeQuote);
    const intraday = generateIntradayForSymbol(activeQuote);
    const dvr = calculateVWDVR(activeQuote, intraday);

    return {
      auction,
      ladder,
      currentTheme,
      reg,
      dvr,
    };
  }, [activeQuote, quotes]);

  if (!activeQuote || !diagnostic) return null;

  const { auction, ladder, currentTheme, reg, dvr } = diagnostic;
  const boards = activeQuote.ultraShort?.consecutiveBoards ?? 0;
  const roleLabel = getDragonRoleLabel(activeQuote.ultraShort?.dragonRole ?? 'FOLLOWER');

  return (
    <div
      data-testid="ultrashort-diagnostic-strip"
      className="bg-[#131722] border-b border-[#2a2e39] px-3 py-1.5 select-none shrink-0"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* 五大超短游资实时算子速览卡片 */}
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          {/* 1. 09:25 竞价雷达 */}
          <button
            type="button"
            onClick={() => openQuantModule('auction')}
            className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#1e222d] hover:bg-[#262b38] border border-[#2a2e39] text-[11px] transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Radar className="w-3.5 h-3.5 text-[#F59E0B]" />
            <span className="text-[#787b86]">09:25竞价:</span>
            <span
              className={`px-1.5 py-0.2 rounded border text-[10px] font-semibold ${getAuctionSignalBadgeClass(
                auction.signal
              )}`}
            >
              {auction.signalLabel}
            </span>
            <span className="font-mono tabular-nums text-[#d1d4dc]">
              占昨 <strong className="text-white">{auction.amountToYesterdayRatio.toFixed(1)}%</strong>
            </span>
          </button>

          {/* 2. 连板身位与断层监测 */}
          <button
            type="button"
            onClick={() => openQuantModule('ladder')}
            className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#1e222d] hover:bg-[#262b38] border border-[#2a2e39] text-[11px] transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Flame className="w-3.5 h-3.5 text-[#F6465D]" />
            <span className="text-[#787b86]">梯队身位:</span>
            <span className="font-mono tabular-nums font-semibold text-[#F6465D]">
              {boards >= 1 ? `${boards}连板` : '趋势/首板备选'} · {roleLabel}
            </span>
            <span className="text-[#787b86]">|</span>
            <span className="font-mono tabular-nums text-[#9ca3af]">
              最高标 <strong className="text-white">{ladder.maxBoardHeight}板</strong>
              {ladder.hasLadderFault && (
                <span className="ml-1 text-[#F59E0B]">
                  (断层缺{ladder.missingBoards.join('/')}板)
                </span>
              )}
            </span>
          </button>

          {/* 3. 题材点面共振 */}
          {currentTheme && (
            <button
              type="button"
              onClick={() => openQuantModule('resonance')}
              className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded bg-[#1e222d] hover:bg-[#262b38] border border-[#2a2e39] text-[11px] transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Layers className="w-3.5 h-3.5 text-[#38bdf8]" />
              <span className="text-[#787b86]">点面共振:</span>
              <span className="text-white font-medium">{currentTheme.sectorName}</span>
              <span className="font-mono tabular-nums text-[#38bdf8] font-semibold">
                {currentTheme.resonanceScore}分
              </span>
              <span className="text-[10px] text-[#9ca3af]">({currentTheme.resonanceStatus})</span>
            </button>
          )}

          {/* 4. 注册制法定复利异动逆推 (k ∈ {2, 3}) */}
          <button
            type="button"
            onClick={() => openQuantModule('regulatory')}
            className={`flex items-center gap-1.5 px-2 py-1 rounded border text-[11px] transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              reg.severeSuspensionLockWarning || reg.isTriggeredToday
                ? 'bg-[#F59E0B]/15 border-[#F59E0B]/50 text-[#F59E0B]'
                : 'bg-[#1e222d] hover:bg-[#262b38] border-[#2a2e39] text-[#d1d4dc]'
            }`}
          >
            <Scale className="w-3.5 h-3.5 text-[#F59E0B]" />
            <span className="text-[#787b86]">k∈&#123;2,3&#125;异动红线:</span>
            <span className="font-mono tabular-nums font-semibold">
              {formatPrice(reg.effectiveTriggerPrice)}元 (
              {formatSignedPercent(reg.effectiveMaxSafeChangePercent)})
            </span>
            {reg.severeSuspensionLockWarning && (
              <span className="px-1 rounded bg-[#F6465D] text-white text-[10px] font-bold">
                10日{reg.cumDeviation10dPercent}%特停预警
              </span>
            )}
          </button>

          {/* 5. 真实成交量加权承接算子 (VW-DVR) */}
          <button
            type="button"
            onClick={() => openQuantModule('vwdvr')}
            className="hidden lg:flex items-center gap-1.5 px-2 py-1 rounded bg-[#1e222d] hover:bg-[#262b38] border border-[#2a2e39] text-[11px] transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Activity className="w-3.5 h-3.5 text-[#0ECB81]" />
            <span className="text-[#787b86]">VW-DVR承接:</span>
            <span
              className={`font-mono tabular-nums font-bold ${
                dvr.vwDvrScore >= 74
                  ? 'text-[#F6465D]'
                  : dvr.vwDvrScore >= 48
                  ? 'text-[#F59E0B]'
                  : 'text-[#0ECB81]'
              }`}
            >
              {dvr.vwDvrScore}分
            </span>
            <span className="text-[10px] text-[#9ca3af]">({dvr.signalLabel})</span>
          </button>
        </div>

        {/* 右侧：切换全景超短量化作战室按钮 */}
        <button
          type="button"
          data-testid="toggle-quant-workbench-btn"
          onClick={() =>
            setWorkspaceMode(workspaceMode === 'quant' ? 'chart' : 'quant')
          }
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            workspaceMode === 'quant'
              ? 'bg-[#2962ff] text-white'
              : 'bg-[#F6465D]/15 text-[#F6465D] border border-[#F6465D]/40 hover:bg-[#F6465D] hover:text-white'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          <span>{workspaceMode === 'quant' ? '返回K线看盘主图' : '超短游资量化作战室'}</span>
        </button>
      </div>
    </div>
  );
};

/**
 * 超短游资量化作战室主面板 (包含 5 大核心实战引擎)
 * 1. 09:25 竞价雷达（金额占昨比、量比、竞价核按钮/超预期抢筹识别）
 * 2. 涨跌停连板梯队（高度板、首板晋级率、断层监测）
 * 3. 题材点面共振与先锋龙身位识别
 * 4. 现行注册制法定复利异动监管逆推（k∈{2,3} 法定异动窗口与特停锁死预警）
 * 5. 真实成交量加权承接算子（VW-DVR）
 */
export const UltraShortQuantWorkbench: React.FC<{ compact?: boolean }> = ({
  compact = false,
}) => {
  const quotes = useMarketStore((s) => s.quotes);
  const symbolOrder = useMarketStore((s) => s.symbolOrder);
  const selectedSymbol = useMarketStore((s) => s.selectedSymbol);
  const quantModuleTab = useMarketStore((s) => s.quantModuleTab);
  const setQuantModuleTab = useMarketStore((s) => s.setQuantModuleTab);
  const setSelectedSymbol = useMarketStore((s) => s.setSelectedSymbol);
  const setWorkspaceMode = useMarketStore((s) => s.setWorkspaceMode);

  // 竞价雷达信号过滤器
  const [auctionFilter, setAuctionFilter] = useState<'ALL' | AuctionSignalType>('ALL');
  // 注册制异动逆推：基准指数今日实时涨幅模拟滑块 (%)
  const [simulatedIndexPct, setSimulatedIndexPct] = useState<number | null>(null);

  const allQuotes = useMemo(
    () => symbolOrder.map((sym) => quotes[sym]).filter(Boolean),
    [quotes, symbolOrder]
  );

  const activeQuote = quotes[selectedSymbol] ?? allQuotes[0];

  // 1. 09:25 竞价雷达全量计算
  const auctionList = useMemo(() => {
    const list = allQuotes.map((q) => calculateAuctionRadar(q));
    return list.sort((a, b) => b.amountToYesterdayRatio - a.amountToYesterdayRatio);
  }, [allQuotes]);

  const filteredAuctionList = useMemo(() => {
    if (auctionFilter === 'ALL') return auctionList;
    return auctionList.filter((item) => item.signal === auctionFilter);
  }, [auctionList, auctionFilter]);

  // 2. 连板梯队与断层监测
  const ladderSummary = useMemo(
    () => calculateBoardLadderSummary(allQuotes),
    [allQuotes]
  );

  // 3. 题材点面共振
  const themeResonanceList = useMemo(
    () => calculateThemeResonance(allQuotes),
    [allQuotes]
  );

  // 4. 注册制法定复利异动监管逆推 (k ∈ {2, 3})
  const activeRegDeviation = useMemo(
    () =>
      activeQuote
        ? calculateRegulatoryDeviation(
            activeQuote,
            simulatedIndexPct !== null ? simulatedIndexPct : undefined
          )
        : null,
    [activeQuote, simulatedIndexPct]
  );

  const allRegDeviations = useMemo(
    () =>
      allQuotes
        .map((q) =>
          calculateRegulatoryDeviation(
            q,
            simulatedIndexPct !== null ? simulatedIndexPct : undefined
          )
        )
        .sort((a, b) => b.cumDeviation10dPercent - a.cumDeviation10dPercent),
    [allQuotes, simulatedIndexPct]
  );

  // 5. VW-DVR 真实成交量加权承接算子
  const activeVWDVR = useMemo(() => {
    if (!activeQuote) return null;
    const pts = generateIntradayForSymbol(activeQuote);
    return calculateVWDVR(activeQuote, pts);
  }, [activeQuote]);

  const allVWDVRList = useMemo(() => {
    return allQuotes
      .map((q) => calculateVWDVR(q, generateIntradayForSymbol(q)))
      .sort((a, b) => b.vwDvrScore - a.vwDvrScore);
  }, [allQuotes]);

  const tabs: {
    id: typeof quantModuleTab;
    label: string;
    shortLabel: string;
  }[] = [
    { id: 'overview', label: '五维实战总览', shortLabel: '总览' },
    { id: 'auction', label: '09:25 竞价雷达', shortLabel: '09:25竞价' },
    { id: 'ladder', label: '连板梯队与断层', shortLabel: '连板梯队' },
    { id: 'resonance', label: '题材点面共振', shortLabel: '点面共振' },
    { id: 'regulatory', label: 'k∈{2,3} 异动逆推', shortLabel: '异动逆推' },
    { id: 'vwdvr', label: 'VW-DVR 承接算子', shortLabel: 'VW-DVR' },
  ];

  return (
    <div
      data-testid="ultrashort-quant-workbench"
      className="flex flex-col flex-1 min-h-0 bg-[#0d0e12] text-[#d1d4dc] overflow-hidden select-none"
    >
      {/* 顶部子模块导航栏 */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-[#131722] border-b border-[#2a2e39] shrink-0">
        <div className="flex items-center gap-1 overflow-x-auto">
          {tabs.map((tab) => {
            const active = quantModuleTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                data-testid={`quant-tab-${tab.id}`}
                onClick={() => setQuantModuleTab(tab.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-[#2962ff] text-white font-semibold'
                    : 'text-[#9ca3af] hover:text-white hover:bg-[#1e222d]'
                }`}
              >
                {compact ? tab.shortLabel : tab.label}
              </button>
            );
          })}
        </div>

        {!compact && (
          <div className="hidden xl:flex items-center gap-2 shrink-0">
            <span className="text-[11px] text-[#787b86] font-mono tabular-nums">
              纯 Level-1 衍生算子 · 零 L2 虚构依赖
            </span>
          </div>
        )}
      </div>

      {/* 主体内容滚动区 */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
        {/* ==================== 模块一：09:25 集合竞价雷达 ==================== */}
        {(quantModuleTab === 'overview' || quantModuleTab === 'auction') && (
          <section
            aria-label="09:25 集合竞价雷达"
            className="bg-[#1e222d] border border-[#2a2e39] rounded-md overflow-hidden"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-[#131722] border-b border-[#2a2e39]">
              <div className="flex items-center gap-2">
                <Radar className="w-4 h-4 text-[#F59E0B]" />
                <h2 className="text-xs sm:text-sm font-bold text-white">
                  09:25 集合竞价雷达 (竞价金额占昨比 / 竞价量比 / 核按钮与抢筹识别)
                </h2>
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                {(
                  [
                    { id: 'ALL', label: '全部标的' },
                    { id: 'SUPER_GRAB', label: '超预期抢筹' },
                    { id: 'LOCKED_LIMIT_UP', label: '一字巨封' },
                    { id: 'WEAK_TO_STRONG', label: '分歧弱转强' },
                    { id: 'OVERHEAT_DUMP', label: '爆量兑现' },
                    { id: 'NUCLEAR_BUTTON', label: '竞价核按钮' },
                  ] as { id: 'ALL' | AuctionSignalType; label: string }[]
                ).map((btn) => (
                  <button
                    key={btn.id}
                    type="button"
                    onClick={() => setAuctionFilter(btn.id)}
                    className={`px-2 py-0.5 rounded text-[11px] transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      auctionFilter === btn.id
                        ? 'bg-[#2962ff] text-white font-semibold'
                        : 'bg-[#1e222d] text-[#9ca3af] hover:text-white'
                    }`}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#2a2e39] text-[#787b86] bg-[#161a24] text-[11px]">
                    <th className="py-2 px-2.5 whitespace-nowrap">代码/名称</th>
                    <th className="py-2 px-2 text-right whitespace-nowrap">09:25撮合 / 涨幅</th>
                    <th className="py-2 px-2 text-right whitespace-nowrap">竞价额</th>
                    <th className="py-2 px-2.5 whitespace-nowrap">
                      竞价占昨比 (黄金线 6%~16%)
                    </th>
                    <th className="py-2 px-2 text-right whitespace-nowrap">竞价量比</th>
                    <th className="py-2 px-2 text-right whitespace-nowrap">未匹配封单/压单</th>
                    <th className="py-2 px-2 whitespace-nowrap">定性信号</th>
                    <th className="py-2 px-2.5 whitespace-nowrap">游资盘口诊断</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2a2e39]/60">
                  {filteredAuctionList.map((item) => {
                    const isSelected = item.symbol === selectedSymbol;
                    const pctColor = getSignedColorClass(item.auctionChangePercent);
                    const barWidth = Math.min(100, Math.round(item.amountToYesterdayRatio * 4));
                    return (
                      <tr
                        key={item.symbol}
                        onClick={() => setSelectedSymbol(item.symbol)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-[#2962ff]/15 hover:bg-[#2962ff]/20'
                            : 'hover:bg-[#262b38]'
                        }`}
                      >
                        <td className="py-2 px-2.5 whitespace-nowrap">
                          <div className="font-semibold text-white">{item.name}</div>
                          <div className="text-[10px] font-mono tabular-nums text-[#787b86]">
                            {item.symbol} · {item.sector}
                          </div>
                        </td>
                        <td
                          className={`py-2 px-2 text-right font-mono tabular-nums font-semibold whitespace-nowrap ${pctColor}`}
                        >
                          <div>{formatPrice(item.auctionPrice)}</div>
                          <div className="text-[11px]">
                            {formatSignedPercent(item.auctionChangePercent)}
                          </div>
                        </td>
                        <td className="py-2 px-2 text-right font-mono tabular-nums text-[#d1d4dc] whitespace-nowrap">
                          {formatAmountCN(item.auctionAmount)}
                        </td>
                        <td className="py-2 px-2.5 whitespace-nowrap min-w-[140px]">
                          <div className="flex items-center justify-between font-mono tabular-nums text-xs mb-1">
                            <span
                              className={
                                item.amountToYesterdayRatio >= 20
                                  ? 'text-[#c084fc] font-bold'
                                  : item.amountToYesterdayRatio >= 6.5
                                  ? 'text-[#F6465D] font-bold'
                                  : 'text-[#d1d4dc]'
                              }
                            >
                              {item.amountToYesterdayRatio.toFixed(2)}%
                            </span>
                            <span className="text-[10px] text-[#787b86]">
                              昨 {formatAmountCN(item.yesterdayAmount)}
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-[#131722] rounded overflow-hidden">
                            <div
                              className={`h-full ${
                                item.amountToYesterdayRatio >= 20
                                  ? 'bg-[#a855f7]'
                                  : item.amountToYesterdayRatio >= 6.5
                                  ? 'bg-[#F6465D]'
                                  : 'bg-[#2962ff]'
                              }`}
                              style={{ width: `${barWidth}%` }}
                            />
                          </div>
                        </td>
                        <td className="py-2 px-2 text-right font-mono tabular-nums text-[#F59E0B] font-semibold whitespace-nowrap">
                          {item.auctionVolumeRatio.toFixed(2)}x
                        </td>
                        <td
                          className={`py-2 px-2 text-right font-mono tabular-nums font-semibold whitespace-nowrap ${
                            item.unmatchedHands >= 0 ? 'text-[#F6465D]' : 'text-[#0ECB81]'
                          }`}
                        >
                          {item.unmatchedHands >= 0
                            ? `买封 +${item.unmatchedHands.toLocaleString('en-US')}手`
                            : `卖压 ${item.unmatchedHands.toLocaleString('en-US')}手`}
                        </td>
                        <td className="py-2 px-2 whitespace-nowrap">
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded border text-[11px] font-semibold whitespace-nowrap ${getAuctionSignalBadgeClass(
                              item.signal
                            )}`}
                          >
                            {item.signalLabel}
                          </span>
                        </td>
                        <td className="py-2 px-2.5 text-[11px] text-[#9ca3af] max-w-[190px] truncate">
                          {item.signalReason}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ==================== 模块二：涨跌停连板梯队与断层监测 ==================== */}
        {(quantModuleTab === 'overview' || quantModuleTab === 'ladder') && (
          <section
            aria-label="涨跌停连板梯队与断层监测"
            className="bg-[#1e222d] border border-[#2a2e39] rounded-md overflow-hidden"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-[#131722] border-b border-[#2a2e39]">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-[#F6465D]" />
                <h2 className="text-xs sm:text-sm font-bold text-white">
                  涨跌停连板梯队引擎 (最高空间板 / 首板晋级率 / 连板断层监测)
                </h2>
              </div>
              <div className="flex items-center gap-3 text-xs font-mono tabular-nums">
                <span className="text-[#9ca3af]">
                  情绪周期:{' '}
                  <strong className="text-[#F6465D] font-sans">
                    {ladderSummary.sentimentPhase}
                  </strong>
                </span>
                <span className="text-[#9ca3af]">
                  最高空间板:{' '}
                  <strong className="text-white">
                    {ladderSummary.maxBoardHeight}连板 ({ladderSummary.spaceDragonName})
                  </strong>
                </span>
              </div>
            </div>

            {/* 核心晋级率与封板率五维仪表栏 */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-3 bg-[#161a24] border-b border-[#2a2e39]">
              <div className="p-2.5 rounded bg-[#1e222d] border border-[#2a2e39]">
                <div className="text-[11px] text-[#787b86]">最高空间板高度</div>
                <div className="mt-1 flex items-baseline justify-between font-mono tabular-nums">
                  <span className="text-lg font-bold text-[#F6465D]">
                    {ladderSummary.maxBoardHeight} 连板
                  </span>
                  <span className="text-xs text-white font-sans">
                    {ladderSummary.spaceDragonName}
                  </span>
                </div>
              </div>

              <div className="p-2.5 rounded bg-[#1e222d] border border-[#2a2e39]">
                <div className="text-[11px] text-[#787b86]">首板晋级率 (1进2)</div>
                <div className="mt-1 flex items-baseline justify-between font-mono tabular-nums">
                  <span className="text-lg font-bold text-[#F59E0B]">
                    {ladderSummary.firstToSecondRate.toFixed(1)}%
                  </span>
                  <span className="text-[11px] text-[#9ca3af]">接力试错指标</span>
                </div>
              </div>

              <div className="p-2.5 rounded bg-[#1e222d] border border-[#2a2e39]">
                <div className="text-[11px] text-[#787b86]">2进3 / 高位晋级率</div>
                <div className="mt-1 flex items-baseline justify-between font-mono tabular-nums">
                  <span className="text-lg font-bold text-[#F6465D]">
                    {ladderSummary.secondToThirdRate.toFixed(1)}%
                  </span>
                  <span className="text-[11px] text-[#9ca3af]">
                    高位 {ladderSummary.highBoardPromotionRate.toFixed(0)}%
                  </span>
                </div>
              </div>

              <div className="p-2.5 rounded bg-[#1e222d] border border-[#2a2e39]">
                <div className="text-[11px] text-[#787b86]">今日封板率 / 炸板</div>
                <div className="mt-1 flex items-baseline justify-between font-mono tabular-nums">
                  <span className="text-lg font-bold text-[#F6465D]">
                    {ladderSummary.sealSuccessRate.toFixed(1)}%
                  </span>
                  <span className="text-[11px] text-[#0ECB81]">
                    炸板 {ladderSummary.brokenBoardCount} 家
                  </span>
                </div>
              </div>

              <div className="p-2.5 rounded bg-[#1e222d] border border-[#2a2e39]">
                <div className="text-[11px] text-[#787b86]">跌停 / 核按钮家数</div>
                <div className="mt-1 flex items-baseline justify-between font-mono tabular-nums">
                  <span className="text-lg font-bold text-[#0ECB81]">
                    {ladderSummary.limitDownCount} 家
                  </span>
                  <span className="text-[11px] text-[#9ca3af]">亏钱效应监控</span>
                </div>
              </div>
            </div>

            {/* 连板梯队断层监测实时预警条 */}
            {ladderSummary.hasLadderFault && (
              <div
                data-testid="ladder-fault-warning"
                className="flex items-center gap-2.5 px-3 py-2 bg-[#F59E0B]/10 border-b border-[#F59E0B]/30 text-xs text-[#F59E0B]"
              >
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span className="font-medium leading-snug">
                  {ladderSummary.faultWarningText}
                </span>
              </div>
            )}

            {/* 完整阶梯金字塔（包含断层空缺行可视化） */}
            <div className="divide-y divide-[#2a2e39]">
              {Array.from(
                { length: ladderSummary.maxBoardHeight },
                (_, idx) => ladderSummary.maxBoardHeight - idx
              ).map((boardNum) => {
                const tier = ladderSummary.tiers.find((t) => t.boardCount === boardNum);
                const isMissing = !tier || tier.stocks.length === 0;

                if (isMissing) {
                  return (
                    <div
                      key={`board-missing-${boardNum}`}
                      className="flex items-center justify-between px-3 py-2 bg-[#131722]/70 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="inline-block w-24 font-mono tabular-nums font-semibold text-[#787b86]">
                          {boardNum}连板 (断层)
                        </span>
                        <span className="px-2 py-0.5 rounded bg-[#F59E0B]/10 border border-[#F59E0B]/30 text-[11px] text-[#F59E0B]">
                          断层真空区 · 昨日 {boardNum - 1} 板晋级失败
                        </span>
                      </div>
                      <span className="font-mono tabular-nums text-[11px] text-[#787b86]">
                        晋级率 0.0%
                      </span>
                    </div>
                  );
                }

                return (
                  <div
                    key={`board-tier-${boardNum}`}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 py-2.5 hover:bg-[#262b38]/50"
                  >
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="inline-block w-28 font-mono tabular-nums font-bold text-xs text-[#F6465D]">
                        {tier.label}
                      </span>
                      <span className="text-[11px] font-mono tabular-nums text-[#9ca3af]">
                        {tier.promotionRate !== null
                          ? `${boardNum - 1}进${boardNum} 晋级率 ${tier.promotionRate}%`
                          : `今日首板 ${tier.todaySealedCount} 家`}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 flex-1 justify-end">
                      {tier.stocks.map((st) => (
                        <button
                          key={st.symbol}
                          type="button"
                          onClick={() => setSelectedSymbol(st.symbol)}
                          className="flex items-center gap-2 px-2.5 py-1 rounded bg-[#131722] hover:bg-[#2962ff]/20 border border-[#2a2e39] text-xs transition-colors cursor-pointer"
                        >
                          <span className="font-bold text-white">{st.name}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#F6465D]/15 text-[#F6465D] font-medium">
                            {st.sector}
                          </span>
                          <span className="font-mono tabular-nums text-[11px] text-[#9ca3af]">
                            封板 {st.firstSealTime}
                          </span>
                          <span className="font-mono tabular-nums text-[11px] text-[#F59E0B]">
                            封单 {formatAmountCN(st.sealOrderAmount)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ==================== 模块三：题材点面共振与先锋龙身位识别 ==================== */}
        {(quantModuleTab === 'overview' || quantModuleTab === 'resonance') && (
          <section
            aria-label="题材点面共振与先锋龙身位识别"
            className="bg-[#1e222d] border border-[#2a2e39] rounded-md overflow-hidden"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-[#131722] border-b border-[#2a2e39]">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#38bdf8]" />
                <h2 className="text-xs sm:text-sm font-bold text-white">
                  题材点面共振与先锋龙身位识别 (“点”最早封板/最高标 × “面”板块涨幅/红盘比/涨停潮)
                </h2>
              </div>
              <span className="text-[11px] text-[#9ca3af]">
                点击任意龙头标的即时联动切换主图与盘口
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 p-3">
              {themeResonanceList.slice(0, 6).map((theme) => {
                const pctColor = getSignedColorClass(theme.sectorChangePercent);
                return (
                  <div
                    key={theme.sectorName}
                    className="flex flex-col justify-between p-3 rounded bg-[#131722] border border-[#2a2e39] space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-[#2a2e39] pb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">
                          {theme.sectorName}
                        </span>
                        <span
                          className={`font-mono tabular-nums text-xs font-bold ${pctColor}`}
                        >
                          {formatSignedPercent(theme.sectorChangePercent)}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            theme.resonanceStatus === '主线强共振'
                              ? 'bg-[#F6465D]/20 text-[#F6465D] border border-[#F6465D]/40'
                              : theme.resonanceStatus === '局部轮动'
                              ? 'bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/40'
                              : 'bg-[#1e222d] text-[#9ca3af] border border-[#2a2e39]'
                          }`}
                        >
                          {theme.resonanceStatus}
                        </span>
                      </div>
                      <div className="text-xs font-mono tabular-nums">
                        <span className="text-[#787b86]">共振分: </span>
                        <strong className="text-[#38bdf8]">{theme.resonanceScore}</strong>
                      </div>
                    </div>

                    {/* 板块“面”与核心“点”对照 */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => setSelectedSymbol(theme.pioneerDragon.symbol)}
                        className="text-left p-2 rounded bg-[#1e222d] hover:bg-[#262b38] border border-[#2a2e39] transition-colors cursor-pointer"
                      >
                        <div className="text-[10px] text-[#787b86]">
                          点火先锋龙 / 空间标杆 (“点”)
                        </div>
                        <div className="mt-0.5 flex items-center justify-between">
                          <span className="font-bold text-white">
                            {theme.pioneerDragon.name}
                          </span>
                          <span
                            className={`font-mono tabular-nums font-semibold ${getSignedColorClass(
                              theme.pioneerDragon.changePercent
                            )}`}
                          >
                            {formatSignedPercent(theme.pioneerDragon.changePercent)}
                          </span>
                        </div>
                        <div className="mt-0.5 text-[10px] font-mono tabular-nums text-[#F59E0B]">
                          {theme.pioneerDragon.consecutiveBoards >= 1
                            ? `${theme.pioneerDragon.consecutiveBoards}连板 · 封板 ${
                                theme.pioneerDragon.firstSealTime ?? '09:30'
                              }`
                            : '日内领涨先锋'}
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedSymbol(theme.capacityCore.symbol)}
                        className="text-left p-2 rounded bg-[#1e222d] hover:bg-[#262b38] border border-[#2a2e39] transition-colors cursor-pointer"
                      >
                        <div className="text-[10px] text-[#787b86]">
                          大容量趋势中军 (“面”核心)
                        </div>
                        <div className="mt-0.5 flex items-center justify-between">
                          <span className="font-bold text-white">
                            {theme.capacityCore.name}
                          </span>
                          <span
                            className={`font-mono tabular-nums font-semibold ${getSignedColorClass(
                              theme.capacityCore.changePercent
                            )}`}
                          >
                            {formatSignedPercent(theme.capacityCore.changePercent)}
                          </span>
                        </div>
                        <div className="mt-0.5 text-[10px] font-mono tabular-nums text-[#9ca3af]">
                          成交额 {formatAmountCN(theme.capacityCore.amount)} · 红盘比{' '}
                          {theme.upRatioPercent}%
                        </div>
                      </button>
                    </div>

                    {/* 板块内身位成员列表 */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {theme.memberStocks.map((m) => (
                        <button
                          key={m.symbol}
                          type="button"
                          onClick={() => setSelectedSymbol(m.symbol)}
                          className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#1e222d] hover:bg-[#2962ff]/20 border border-[#2a2e39] text-[11px] cursor-pointer"
                        >
                          <span className="text-[#38bdf8] font-medium">
                            [{m.roleLabel}]
                          </span>
                          <span className="text-white font-medium">{m.name}</span>
                          <span
                            className={`font-mono tabular-nums ${getSignedColorClass(
                              m.changePercent
                            )}`}
                          >
                            {formatSignedPercent(m.changePercent)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ==================== 模块四：现行注册制法定复利异动监管逆推 (k ∈ {2, 3}) ==================== */}
        {(quantModuleTab === 'overview' || quantModuleTab === 'regulatory') &&
          activeRegDeviation && (
            <section
              aria-label="现行注册制法定复利异动监管逆推"
              className="bg-[#1e222d] border border-[#2a2e39] rounded-md overflow-hidden"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-[#131722] border-b border-[#2a2e39]">
                <div className="flex items-center gap-2">
                  <Scale className="w-4 h-4 text-[#F59E0B]" />
                  <h2 className="text-xs sm:text-sm font-bold text-white">
                    现行注册制法定复利异动监管逆推 (k ∈ &#123;2, 3&#125; 法定异动窗口 & 10日100%特停锁死预警)
                  </h2>
                </div>

                {/* 交互式基准指数今日涨跌幅推演控制器 */}
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-[#9ca3af] whitespace-nowrap">
                    基准指数涨幅推演:
                  </span>
                  <input
                    type="range"
                    aria-label="基准指数今日涨跌幅推演滑块"
                    min={-3.0}
                    max={5.0}
                    step={0.1}
                    value={
                      simulatedIndexPct ??
                      activeQuote.ultraShort?.indexReturnToday ??
                      1.05
                    }
                    onChange={(e) => setSimulatedIndexPct(Number(e.target.value))}
                    className="w-24 accent-[#2962ff] cursor-pointer"
                  />
                  <span className="font-mono tabular-nums font-bold text-[#38bdf8] w-14 text-right">
                    {formatSignedPercent(
                      simulatedIndexPct ??
                        activeQuote.ultraShort?.indexReturnToday ??
                        1.05
                    )}
                  </span>
                  {simulatedIndexPct !== null && (
                    <button
                      type="button"
                      onClick={() => setSimulatedIndexPct(null)}
                      className="px-1.5 py-0.5 rounded bg-[#1e222d] border border-[#2a2e39] text-[10px] text-[#9ca3af] hover:text-white cursor-pointer"
                    >
                      重置实盘
                    </button>
                  )}
                </div>
              </div>

              {/* 当前选中股票的精确逆推面板 */}
              <div className="p-3 bg-[#161a24] border-b border-[#2a2e39]">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">
                      当前算子标的：{activeRegDeviation.name} ({activeRegDeviation.symbol})
                    </span>
                    <span className="px-2 py-0.5 rounded bg-[#2962ff]/20 border border-[#2962ff]/40 text-[11px] font-mono tabular-nums text-[#38bdf8]">
                      法定阈值 ±{activeRegDeviation.ruleThresholdPercent}% (
                      {activeRegDeviation.ruleThresholdPercent === 30
                        ? '创业板/科创板注册制'
                        : '沪深主板注册制'}
                      )
                    </span>
                  </div>
                  <span
                    className={`text-xs font-semibold ${
                      activeRegDeviation.severeSuspensionLockWarning ||
                      activeRegDeviation.isTriggeredToday
                        ? 'text-[#F59E0B]'
                        : 'text-[#0ECB81]'
                    }`}
                  >
                    {activeRegDeviation.statusSummary}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5 text-xs">
                  {/* k = 2 窗口 */}
                  <div className="p-2.5 rounded bg-[#1e222d] border border-[#2a2e39]">
                    <div className="flex items-center justify-between text-[11px] text-[#787b86] whitespace-nowrap">
                      <span>k = 2 (2日复利窗口)</span>
                      {activeRegDeviation.bindingWindowK === 2 && (
                        <span className="text-[#F59E0B] font-semibold">[主约束]</span>
                      )}
                    </div>
                    <div className="mt-1.5 flex items-baseline justify-between font-mono tabular-nums whitespace-nowrap">
                      <span className="text-[#9ca3af]">当前2日偏离:</span>
                      <span className="text-sm font-bold text-white">
                        {formatSignedPercent(activeRegDeviation.dev2DayCurrentPercent)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-baseline justify-between font-mono tabular-nums whitespace-nowrap">
                      <span className="text-[#9ca3af]">k=2 临界价:</span>
                      <span className="text-xs font-bold text-[#F6465D]">
                        {formatPrice(activeRegDeviation.triggerPrice2Day)}元 (
                        {formatSignedPercent(activeRegDeviation.maxSafeChange2DayPercent)})
                      </span>
                    </div>
                  </div>

                  {/* k = 3 窗口 */}
                  <div className="p-2.5 rounded bg-[#1e222d] border border-[#2a2e39]">
                    <div className="flex items-center justify-between text-[11px] text-[#787b86] whitespace-nowrap">
                      <span>k = 3 (3日复利窗口)</span>
                      {activeRegDeviation.bindingWindowK === 3 && (
                        <span className="text-[#F59E0B] font-semibold">[主约束]</span>
                      )}
                    </div>
                    <div className="mt-1.5 flex items-baseline justify-between font-mono tabular-nums whitespace-nowrap">
                      <span className="text-[#9ca3af]">当前3日偏离:</span>
                      <span className="text-sm font-bold text-white">
                        {formatSignedPercent(activeRegDeviation.dev3DayCurrentPercent)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-baseline justify-between font-mono tabular-nums whitespace-nowrap">
                      <span className="text-[#9ca3af]">k=3 临界价:</span>
                      <span className="text-xs font-bold text-[#F6465D]">
                        {formatPrice(activeRegDeviation.triggerPrice3Day)}元 (
                        {formatSignedPercent(activeRegDeviation.maxSafeChange3DayPercent)})
                      </span>
                    </div>
                  </div>

                  {/* 综合今日安全压线价 */}
                  <div className="p-2.5 rounded bg-[#1e222d] border border-[#F59E0B]/40">
                    <div className="text-[11px] text-[#F59E0B] whitespace-nowrap">
                      今日绕异动安全上限 (min k∈&#123;2,3&#125;)
                    </div>
                    <div className="mt-1.5 flex items-baseline justify-between font-mono tabular-nums whitespace-nowrap">
                      <span className="text-[#9ca3af]">压线临界价:</span>
                      <span className="text-base font-bold text-[#F59E0B]">
                        {formatPrice(activeRegDeviation.effectiveTriggerPrice)} 元
                      </span>
                    </div>
                    <div className="mt-1 flex items-baseline justify-between font-mono tabular-nums whitespace-nowrap">
                      <span className="text-[#9ca3af]">安全最高涨幅:</span>
                      <span className="text-xs font-bold text-white">
                        {formatSignedPercent(
                          activeRegDeviation.effectiveMaxSafeChangePercent
                        )}
                      </span>
                    </div>
                  </div>

                  {/* 10日 100% 严重异动与特停锁死监控 */}
                  <div
                    className={`p-2.5 rounded border ${
                      activeRegDeviation.severeSuspensionLockWarning
                        ? 'bg-[#F6465D]/15 border-[#F6465D]'
                        : 'bg-[#1e222d] border-[#2a2e39]'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] whitespace-nowrap">
                      <span className="text-[#787b86]">10日100%特停红线</span>
                      <ShieldAlert
                        className={`w-3.5 h-3.5 ${
                          activeRegDeviation.severeSuspensionLockWarning
                            ? 'text-[#F6465D]'
                            : 'text-[#787b86]'
                        }`}
                      />
                    </div>
                    <div className="mt-1.5 flex items-baseline justify-between font-mono tabular-nums whitespace-nowrap">
                      <span className="text-[#9ca3af]">10日累计偏离:</span>
                      <span className="text-sm font-bold text-[#F6465D]">
                        +{activeRegDeviation.cumDeviation10dPercent.toFixed(2)}%
                      </span>
                    </div>
                    <div className="mt-1 flex items-baseline justify-between font-mono tabular-nums whitespace-nowrap">
                      <span className="text-[#9ca3af]">距100%特停余量:</span>
                      <span className="text-xs font-bold text-white">
                        {activeRegDeviation.remainingTo100Percent.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 全市场标的异动红线速查表 */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#2a2e39] text-[#787b86] bg-[#161a24] text-[11px]">
                      <th className="py-2 px-2.5 whitespace-nowrap">股票标的</th>
                      <th className="py-2 px-2 text-right whitespace-nowrap">现价 / 涨幅</th>
                      <th className="py-2 px-2 text-center whitespace-nowrap">红线</th>
                      <th className="py-2 px-2 text-right whitespace-nowrap">
                        k=2 偏离 / 临界价
                      </th>
                      <th className="py-2 px-2 text-right whitespace-nowrap">
                        k=3 偏离 / 临界价
                      </th>
                      <th className="py-2 px-2 text-right whitespace-nowrap">
                        今日绕监管极限安全价
                      </th>
                      <th className="py-2 px-2.5 text-right whitespace-nowrap">
                        10日偏离 (100%特停线)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2a2e39]/60">
                    {allRegDeviations.map((row) => (
                      <tr
                        key={row.symbol}
                        onClick={() => setSelectedSymbol(row.symbol)}
                        className={`cursor-pointer transition-colors ${
                          row.symbol === selectedSymbol
                            ? 'bg-[#2962ff]/15'
                            : 'hover:bg-[#262b38]'
                        }`}
                      >
                        <td className="py-2 px-2.5 whitespace-nowrap">
                          <span className="font-semibold text-white">{row.name}</span>
                          <span className="ml-1 font-mono tabular-nums text-[10px] text-[#787b86]">
                            {row.code}
                          </span>
                        </td>
                        <td
                          className={`py-2 px-2 text-right font-mono tabular-nums font-semibold whitespace-nowrap ${getSignedColorClass(
                            row.currentChangePercent
                          )}`}
                        >
                          {formatPrice(row.currentPrice)} (
                          {formatSignedPercent(row.currentChangePercent)})
                        </td>
                        <td className="py-2 px-2 text-center font-mono tabular-nums text-[#9ca3af] whitespace-nowrap">
                          ±{row.ruleThresholdPercent}%
                        </td>
                        <td className="py-2 px-2 text-right font-mono tabular-nums whitespace-nowrap">
                          <span className="text-white">
                            {formatSignedPercent(row.dev2DayCurrentPercent)}
                          </span>{' '}
                          <span className="text-[#787b86]">
                            / {formatPrice(row.triggerPrice2Day)}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-right font-mono tabular-nums whitespace-nowrap">
                          <span className="text-white">
                            {formatSignedPercent(row.dev3DayCurrentPercent)}
                          </span>{' '}
                          <span className="text-[#787b86]">
                            / {formatPrice(row.triggerPrice3Day)}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-right font-mono tabular-nums font-bold text-[#F59E0B] whitespace-nowrap">
                          {formatPrice(row.effectiveTriggerPrice)}元 (
                          {formatSignedPercent(row.effectiveMaxSafeChangePercent)})
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono tabular-nums whitespace-nowrap">
                          <span
                            className={
                              row.severeSuspensionLockWarning
                                ? 'text-[#F6465D] font-bold'
                                : 'text-[#d1d4dc]'
                            }
                          >
                            +{row.cumDeviation10dPercent.toFixed(2)}%
                          </span>
                          <span className="text-[10px] text-[#787b86] ml-1">
                            (余{row.remainingTo100Percent.toFixed(1)}%)
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

        {/* ==================== 模块五：真实成交量加权承接算子 (VW-DVR) ==================== */}
        {(quantModuleTab === 'overview' || quantModuleTab === 'vwdvr') &&
          activeVWDVR && (
            <section
              aria-label="真实成交量加权承接算子 VW-DVR"
              className="bg-[#1e222d] border border-[#2a2e39] rounded-md overflow-hidden"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-[#131722] border-b border-[#2a2e39]">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#0ECB81]" />
                  <h2 className="text-xs sm:text-sm font-bold text-white">
                    真实成交量加权承接算子 (VW-DVR = 0.42·η_vwap + 0.35·α_dip + 0.23·β_shadow)
                  </h2>
                </div>
                <span className="text-[11px] font-mono tabular-nums text-[#9ca3af]">
                  当前选中：{activeVWDVR.name} ({activeVWDVR.symbol}) · VW-DVR 得分{' '}
                  <strong className="text-white">{activeVWDVR.vwDvrScore}</strong>
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5 p-3 bg-[#161a24] border-b border-[#2a2e39] text-xs">
                <div className="p-2.5 rounded bg-[#1e222d] border border-[#2a2e39]">
                  <div className="text-[11px] text-[#787b86]">
                    水上筹码锚定率 (η_vwap · 权重42%)
                  </div>
                  <div className="mt-1 flex items-baseline justify-between font-mono tabular-nums">
                    <span className="text-lg font-bold text-[#F6465D]">
                      {activeVWDVR.aboveVwapVolumeRatio.toFixed(1)}%
                    </span>
                    <span className="text-[11px] text-[#9ca3af]">
                      VWAP {formatPrice(activeVWDVR.vwap)}
                    </span>
                  </div>
                </div>

                <div className="p-2.5 rounded bg-[#1e222d] border border-[#2a2e39]">
                  <div className="text-[11px] text-[#787b86]">
                    分时回撤买盘吸收率 (α_dip · 权重35%)
                  </div>
                  <div className="mt-1 flex items-baseline justify-between font-mono tabular-nums">
                    <span className="text-lg font-bold text-[#F59E0B]">
                      {activeVWDVR.dipBuyAbsorptionRatio.toFixed(1)}%
                    </span>
                    <span className="text-[11px] text-[#9ca3af]">回踩外盘吞噬度</span>
                  </div>
                </div>

                <div className="p-2.5 rounded bg-[#1e222d] border border-[#2a2e39]">
                  <div className="text-[11px] text-[#787b86]">
                    下影线探底韧性 (β_shadow · 权重23%)
                  </div>
                  <div className="mt-1 flex items-baseline justify-between font-mono tabular-nums">
                    <span className="text-lg font-bold text-[#38bdf8]">
                      {activeVWDVR.lowerShadowResilience.toFixed(1)}%
                    </span>
                    <span className="text-[11px] text-[#9ca3af]">
                      均价乖离 {formatSignedPercent(activeVWDVR.priceToVwapDiffPercent)}
                    </span>
                  </div>
                </div>

                <div className="p-2.5 rounded bg-[#1e222d] border border-[#2a2e39]">
                  <div className="text-[11px] text-[#787b86]">VW-DVR 综合承接定性</div>
                  <div className="mt-1 flex items-baseline justify-between">
                    <span
                      className={`font-mono tabular-nums text-lg font-bold ${
                        activeVWDVR.vwDvrScore >= 74
                          ? 'text-[#F6465D]'
                          : activeVWDVR.vwDvrScore >= 48
                          ? 'text-[#F59E0B]'
                          : 'text-[#0ECB81]'
                      }`}
                    >
                      {activeVWDVR.vwDvrScore}分
                    </span>
                    <span className="text-xs font-semibold text-white">
                      {activeVWDVR.signalLabel}
                    </span>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#2a2e39] text-[#787b86] bg-[#161a24] text-[11px]">
                      <th className="py-2 px-3 whitespace-nowrap">股票标的</th>
                      <th className="py-2 px-2.5 text-right whitespace-nowrap">日内均价 (VWAP)</th>
                      <th className="py-2 px-2.5 text-right whitespace-nowrap">VWAP乖离率</th>
                      <th className="py-2 px-2.5 text-right whitespace-nowrap">
                        水上筹码比 η_vwap
                      </th>
                      <th className="py-2 px-2.5 text-right whitespace-nowrap">
                        回撤买盘吸收 α_dip
                      </th>
                      <th className="py-2 px-2.5 text-right whitespace-nowrap">
                        下影线韧性 β_shadow
                      </th>
                      <th className="py-2 px-2.5 text-right whitespace-nowrap">VW-DVR 得分</th>
                      <th className="py-2 px-2.5 whitespace-nowrap">承接状态定性</th>
                      <th className="py-2 px-3 whitespace-nowrap">超短分时应对策略</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2a2e39]/60">
                    {allVWDVRList.map((item) => (
                      <tr
                        key={item.symbol}
                        onClick={() => setSelectedSymbol(item.symbol)}
                        className={`cursor-pointer transition-colors ${
                          item.symbol === selectedSymbol
                            ? 'bg-[#2962ff]/15'
                            : 'hover:bg-[#262b38]'
                        }`}
                      >
                        <td className="py-2 px-3 whitespace-nowrap">
                          <span className="font-semibold text-white">{item.name}</span>
                          <span className="ml-1.5 font-mono tabular-nums text-[10px] text-[#787b86]">
                            {item.symbol}
                          </span>
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono tabular-nums text-[#F59E0B] whitespace-nowrap">
                          {formatPrice(item.vwap)}
                        </td>
                        <td
                          className={`py-2 px-2.5 text-right font-mono tabular-nums font-semibold whitespace-nowrap ${getSignedColorClass(
                            item.priceToVwapDiffPercent
                          )}`}
                        >
                          {formatSignedPercent(item.priceToVwapDiffPercent)}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono tabular-nums text-white whitespace-nowrap">
                          {item.aboveVwapVolumeRatio.toFixed(1)}%
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono tabular-nums text-white whitespace-nowrap">
                          {item.dipBuyAbsorptionRatio.toFixed(1)}%
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono tabular-nums text-white whitespace-nowrap">
                          {item.lowerShadowResilience.toFixed(1)}%
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono tabular-nums font-bold text-[#F6465D] whitespace-nowrap">
                          {item.vwDvrScore.toFixed(1)}
                        </td>
                        <td className="py-2 px-2.5 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                              item.signal === 'STRONG_ABSORPTION'
                                ? 'bg-[#F6465D]/20 text-[#F6465D]'
                                : item.signal === 'HEALTHY_TURNOVER'
                                ? 'bg-[#F59E0B]/20 text-[#F59E0B]'
                                : 'bg-[#0ECB81]/20 text-[#0ECB81]'
                            }`}
                          >
                            {item.signalLabel}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-[11px] text-[#9ca3af] max-w-xs truncate">
                          {item.actionAdvice}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
      </div>
    </div>
  );
};
