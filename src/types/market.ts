/**
 * 股票看盘平台核心类型定义 (Strictly Level-1 Market Data Specification)
 * 严禁包含任何 Level-2 专有结构（如 10 档盘口、千档队列、逐笔委托还原等）
 */

export type TradingPhase = 'TRADING' | 'CALL_AUCTION' | 'LIMIT_UP' | 'LIMIT_DOWN' | 'CLOSED';

export type PriceDirection = 'UP' | 'DOWN' | 'FLAT';

/**
 * 单档盘口挂单结构
 * 当处于涨跌停封板或集合竞价无挂单时，price 和 volume 允许为 null，UI 优雅降级为 '--'
 */
export interface OrderBookLevel {
  level: 1 | 2 | 3 | 4 | 5;
  price: number | null;
  volume: number | null; // 单位：手 (1手 = 100股)
}

/**
 * 标准 Level-1 五档盘口数据结构 (OrderBook5)
 * 买盘：买一至买五 (bids[0] ~ bids[4])
 * 卖盘：卖一至卖五 (asks[0] ~ asks[4]，UI 渲染时由卖五至卖一从高到低排列)
 */
export interface OrderBook5 {
  bids: [OrderBookLevel, OrderBookLevel, OrderBookLevel, OrderBookLevel, OrderBookLevel];
  asks: [OrderBookLevel, OrderBookLevel, OrderBookLevel, OrderBookLevel, OrderBookLevel];
}

/**
 * 渲染用的单档盘口视图模型（包含相对深度百分比与格式化文本）
 */
export interface FormattedOrderBookRow {
  side: 'ask' | 'bid';
  level: 1 | 2 | 3 | 4 | 5;
  label: string; // 如 '卖五', '卖一', '买一', '买五'
  rawPrice: number | null;
  rawVolume: number | null;
  priceText: string; // 无数据时为 '--'
  volumeText: string; // 无数据时为 '--'
  depthPercent: number; // 0 ~ 100，用于绘制半透明 Volume Depth Bar
  priceDirection: PriceDirection;
}

/**
 * 基于五档盘口实时计算的衍生指标：【委差】与【委比】
 */
export interface OrderBookMetrics {
  totalBidVolume: number; // 买一至买五总挂单手数
  totalAskVolume: number; // 卖一至卖五总挂单手数
  imbalanceVolume: number | null; // 委差 = TotalBid - TotalAsk
  imbalanceRatio: number | null; // 委比 = ((TotalBid - TotalAsk) / (TotalBid + TotalAsk)) * 100%
  imbalanceVolumeText: string; // 格式化委差（如 '+1,240' 或 '--'）
  imbalanceRatioText: string; // 格式化委比（如 '+34.52%' 或 '--'）
  bidPowerPercent: number; // 买盘力量占比 (0 ~ 100)，用于委比红绿进度条
  asksTopToBottom: FormattedOrderBookRow[]; // 卖五 -> 卖一（由高到低排列）
  bidsTopToBottom: FormattedOrderBookRow[]; // 买一 -> 买五（由高到低排列）
}

/**
 * Level-1 实时分笔成交简表项 (非 L2 逐笔还原，仅为 L1 快照切片成交明细)
 */
export interface TradeTick {
  id: string;
  time: string; // HH:mm:ss
  price: number;
  volume: number; // 成交手数
  side: 'BUY' | 'SELL' | 'NEUTRAL'; // B (外盘主动买) / S (内盘主动卖) / - (中性盘)
}

/**
 * Level-1 实时单只股票快照数据 (TickData)
 */
export interface TickData {
  symbol: string; // 如 '600519.SH'
  code: string; // 如 '600519'
  market: 'SH' | 'SZ';
  name: string; // 如 '贵州茅台'
  pinyin: string; // 拼音首字母，如 'gzmt'，用于左侧自选股快速检索
  sector: string; // 所属板块，如 '酿酒行业'
  price: number; // 最新价
  prevClose: number; // 昨收价
  open: number; // 今开价
  high: number; // 最高价
  low: number; // 最低价
  change: number; // 涨跌额
  changePercent: number; // 涨跌幅 (%)
  volume: number; // 总成交量（手）
  amount: number; // 总成交额（元）
  turnoverRate: number; // 换手率 (%)
  volumeRatio: number; // 量比
  amplitude: number; // 振幅 (%)
  peTtm: number; // 市盈率 (TTM)
  pb: number; // 市净率
  marketCap: number; // 总市值（亿元）
  floatMarketCap: number; // 流通市值（亿元）
  outerVolume: number; // 外盘（主动买，手）
  innerVolume: number; // 内盘（主动卖，手）
  limitUpPrice: number; // 涨停价
  limitDownPrice: number; // 跌停价
  phase: TradingPhase; // 当前交易状态（正常、涨停封板、跌停封板、集合竞价）
  orderBook: OrderBook5; // 五档盘口
  recentTrades: TradeTick[]; // 最近分笔成交明细
  updatedAt: number; // 时间戳 (ms)
}

/**
 * K 线标准柱状数据 (KLineBar)
 */
export interface KLineBar {
  time: string; // 日期 'YYYY-MM-DD' 或分钟时间 'YYYY-MM-DD HH:mm'
  timestamp: number; // 秒级时间戳
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number; // 成交手数
  amount: number; // 成交金额
  turnoverRate?: number;
}

/**
 * 分时图单点结构 (IntradayPoint)
 */
export interface IntradayPoint {
  time: string; // '09:30' ~ '15:00'
  timestamp: number;
  price: number;
  avgPrice: number; // 均价线 (VWAP)
  volume: number; // 当分钟成交量（手）
  changePercent: number;
}

/**
 * 核心市场指数快照（跑马灯监控）
 */
export interface MarketIndexQuote {
  symbol: string; // '000001.SH'
  name: string; // '上证指数'
  price: number;
  prevClose: number;
  change: number;
  changePercent: number;
  volume: number; // 亿手
  amount: number; // 亿元
  upCount: number; // 上涨家数
  downCount: number; // 下跌家数
  flatCount: number; // 平盘家数
}

export type ChartPeriod = 'intraday' | '5m' | '15m' | '1D' | '1W' | '1M';

export type MainIndicator = 'MA' | 'EMA' | 'BOLL' | 'NONE';

export type SubIndicator = 'VOL' | 'MACD' | 'KDJ' | 'RSI';

export type ConnectionStatus = 'CONNECTED' | 'CONNECTING' | 'RECONNECTING' | 'DISCONNECTED';

export type MarketScenario = 'normal' | 'limit_up' | 'limit_down' | 'call_auction';

/**
 * WebSocket 服务端推送与客户端消息协议
 */
export type WSServerMessage =
  | {
      type: 'INIT_SNAPSHOT';
      quotes: Record<string, TickData>;
      indices: Record<string, MarketIndexQuote>;
      batchWindowMs: number;
      serverTime: number;
    }
  | {
      type: 'SNAPSHOT_BATCH';
      quotes: TickData[];
      indices: MarketIndexQuote[];
      batchWindowMs: number;
      serverTime: number;
    }
  | {
      type: 'PONG';
      clientTimestamp: number;
      serverTime: number;
    };

export type WSClientMessage =
  | {
      type: 'PING';
      timestamp: number;
    }
  | {
      type: 'SUBSCRIBE';
      symbols: string[];
    }
  | {
      type: 'SET_BATCH_WINDOW';
      windowMs: number;
    };
