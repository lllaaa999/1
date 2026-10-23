import { create } from 'zustand';
import {
  applyScenarioToQuote,
  createInitialIndices,
  createInitialQuotes,
} from '../data/seedMarket';
import type {
  ChartPeriod,
  ConnectionStatus,
  MainIndicator,
  MarketIndexQuote,
  MarketScenario,
  SubIndicator,
  TickData,
} from '../types/market';

/**
 * 原生 Canvas 图表命令式订阅通道 (Imperative Chart Update Bus)
 * 当 WebSocket 收到高频快照时，直接通知原生 Canvas 图表实例执行 updateData(tick)，
 * 彻底绕过 React Virtual DOM Diff 与组件重渲染。
 */
type TickListener = (tick: TickData) => void;
const symbolTickListeners = new Map<string, Set<TickListener>>();

export function subscribeSymbolImperativeTick(symbol: string, listener: TickListener): () => void {
  let set = symbolTickListeners.get(symbol);
  if (!set) {
    set = new Set();
    symbolTickListeners.set(symbol, set);
  }
  set.add(listener);
  return () => {
    const currentSet = symbolTickListeners.get(symbol);
    if (currentSet) {
      currentSet.delete(listener);
      if (currentSet.size === 0) {
        symbolTickListeners.delete(symbol);
      }
    }
  };
}

function emitImperativeTick(tick: TickData): void {
  const listeners = symbolTickListeners.get(tick.symbol);
  if (listeners) {
    listeners.forEach((fn) => fn(tick));
  }
}

const DEFAULT_WATCHLIST = [
  '600519.SH',
  '300750.SZ',
  '002594.SZ',
  '688981.SH',
  '601360.SH',
  '002230.SZ',
  '300059.SZ',
  '000651.SZ',
];

function loadSavedWatchlist(): string[] {
  try {
    const saved = localStorage.getItem('alphapulse_watchlist_v1');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // ignore storage errors
  }
  return DEFAULT_WATCHLIST;
}

export interface MarketStoreState {
  // 行情字典（以 symbol 为 key，方便子组件通过 s => s.quotes[symbol] 精确订阅）
  quotes: Record<string, TickData>;
  indices: Record<string, MarketIndexQuote>;
  symbolOrder: string[];

  // 当前选中的股票与图表配置
  selectedSymbol: string;
  period: ChartPeriod;
  mainIndicator: MainIndicator;
  subIndicator: SubIndicator;

  // 自选股与左侧列表检索状态
  watchlist: string[];
  searchQuery: string;
  filterCategory: 'all' | 'watchlist' | 'special';
  sortBy: 'default' | 'price' | 'changePercent';
  sortDir: 'asc' | 'desc';

  // 移动端底部面板与抽屉状态
  mobileBottomTab: 'orderbook' | 'trades' | 'fundamentals';
  isMobileWatchlistOpen: boolean;
  isArchModalOpen: boolean;

  // WebSocket 连接与节流监控状态
  connectionStatus: ConnectionStatus;
  batchWindowMs: number;
  lastServerTime: number;

  // Actions
  setSelectedSymbol: (symbol: string) => void;
  setPeriod: (period: ChartPeriod) => void;
  setMainIndicator: (indicator: MainIndicator) => void;
  setSubIndicator: (indicator: SubIndicator) => void;
  setSearchQuery: (query: string) => void;
  setFilterCategory: (category: 'all' | 'watchlist' | 'special') => void;
  toggleSort: (field: 'price' | 'changePercent') => void;
  toggleWatchlist: (symbol: string) => void;
  setMobileBottomTab: (tab: 'orderbook' | 'trades' | 'fundamentals') => void;
  setMobileWatchlistOpen: (open: boolean) => void;
  setArchModalOpen: (open: boolean) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  setBatchWindowMs: (ms: number) => void;

  // 批量合并服务端快照
  applyInitSnapshot: (
    quotes: Record<string, TickData>,
    indices: Record<string, MarketIndexQuote>,
    batchWindowMs: number,
    serverTime: number
  ) => void;
  applySnapshotBatch: (
    quotesBatch: TickData[],
    indicesBatch: MarketIndexQuote[],
    batchWindowMs: number,
    serverTime: number
  ) => void;
  triggerScenario: (symbol: string, scenario: MarketScenario) => Promise<void>;
}

const initialQuotes = createInitialQuotes();
const initialIndices = createInitialIndices();

export const useMarketStore = create<MarketStoreState>((set, get) => ({
  quotes: initialQuotes,
  indices: initialIndices,
  symbolOrder: Object.keys(initialQuotes),

  selectedSymbol: '600519.SH',
  period: '1D',
  mainIndicator: 'MA',
  subIndicator: 'VOL',

  watchlist: loadSavedWatchlist(),
  searchQuery: '',
  filterCategory: 'all',
  sortBy: 'default',
  sortDir: 'desc',

  mobileBottomTab: 'orderbook',
  isMobileWatchlistOpen: false,
  isArchModalOpen: false,

  connectionStatus: 'CONNECTING',
  batchWindowMs: 150,
  lastServerTime: Date.now(),

  setSelectedSymbol: (symbol) =>
    set({
      selectedSymbol: symbol,
      isMobileWatchlistOpen: false,
    }),

  setPeriod: (period) => set({ period }),

  setMainIndicator: (mainIndicator) => set({ mainIndicator }),

  setSubIndicator: (subIndicator) => set({ subIndicator }),

  setSearchQuery: (searchQuery) => set({ searchQuery }),

  setFilterCategory: (filterCategory) => set({ filterCategory }),

  toggleSort: (field) =>
    set((state) => {
      if (state.sortBy !== field) {
        return { sortBy: field, sortDir: 'desc' };
      }
      if (state.sortDir === 'desc') {
        return { sortBy: field, sortDir: 'asc' };
      }
      return { sortBy: 'default', sortDir: 'desc' };
    }),

  toggleWatchlist: (symbol) =>
    set((state) => {
      const exists = state.watchlist.includes(symbol);
      const next = exists
        ? state.watchlist.filter((s) => s !== symbol)
        : [symbol, ...state.watchlist];
      try {
        localStorage.setItem('alphapulse_watchlist_v1', JSON.stringify(next));
      } catch {
        // ignore
      }
      return { watchlist: next };
    }),

  setMobileBottomTab: (mobileBottomTab) => set({ mobileBottomTab }),

  setMobileWatchlistOpen: (isMobileWatchlistOpen) => set({ isMobileWatchlistOpen }),

  setArchModalOpen: (isArchModalOpen) => set({ isArchModalOpen }),

  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),

  setBatchWindowMs: (batchWindowMs) => set({ batchWindowMs }),

  applyInitSnapshot: (quotes, indices, batchWindowMs, serverTime) => {
    set({
      quotes,
      indices,
      symbolOrder: Object.keys(quotes),
      batchWindowMs,
      lastServerTime: serverTime,
    });
    const active = quotes[get().selectedSymbol];
    if (active) {
      emitImperativeTick(active);
    }
  },

  applySnapshotBatch: (quotesBatch, indicesBatch, batchWindowMs, serverTime) => {
    if (quotesBatch.length === 0 && indicesBatch.length === 0) return;

    set((state) => {
      const nextQuotes = { ...state.quotes };
      for (const q of quotesBatch) {
        nextQuotes[q.symbol] = q;
      }

      const nextIndices = indicesBatch.length > 0 ? { ...state.indices } : state.indices;
      for (const idx of indicesBatch) {
        nextIndices[idx.symbol] = idx;
      }

      return {
        quotes: nextQuotes,
        indices: nextIndices,
        batchWindowMs,
        lastServerTime: serverTime,
      };
    });

    // 命令式触发当前选中股票的 Canvas 图表 updateData()，不触发图表组件 Virtual DOM 重绘
    const selected = get().selectedSymbol;
    for (const q of quotesBatch) {
      if (q.symbol === selected) {
        emitImperativeTick(q);
      }
    }
  },

  triggerScenario: async (symbol, scenario) => {
    // 1. 乐观更新本地状态，确保零延迟响应
    const current = get().quotes[symbol];
    if (current) {
      const optimistic = applyScenarioToQuote(current, scenario);
      set((state) => ({
        quotes: {
          ...state.quotes,
          [symbol]: optimistic,
        },
      }));
      emitImperativeTick(optimistic);
    }

    // 2. 同步至服务端权威状态
    try {
      const res = await fetch('/api/market/scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, scenario }),
      });
      if (res.ok) {
        const data = (await res.json()) as { ok: boolean; quote: TickData };
        if (data.quote) {
          set((state) => ({
            quotes: {
              ...state.quotes,
              [symbol]: data.quote,
            },
          }));
          emitImperativeTick(data.quote);
        }
      }
    } catch {
      // 网络异常时保留本地乐观状态
    }
  },
}));
