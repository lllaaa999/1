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
  ultraShort?: UltraShortProfile; // 超短游资量化扩展数据（09:25竞价、连板身位、法定异动逆推基准）
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
 * 一、09:25 集合竞价雷达信号定性
 */
export type AuctionSignalType =
  | 'SUPER_GRAB' // 超预期抢筹（爆量高开、弱转强）
  | 'LOCKED_LIMIT_UP' // 一字/T字巨封涨停
  | 'WEAK_TO_STRONG' // 分歧转一致弱转强
  | 'OVERHEAT_DUMP' // 竞价天量兑现预警
  | 'NUCLEAR_BUTTON' // 竞价核按钮（深水/跌停大单压盘）
  | 'NORMAL'; // 常规竞价

/**
 * 二、题材先锋与游资身位角色标签
 */
export type DragonRoleTag =
  | 'SPACE_DRAGON' // 全市场最高空间板总龙
  | 'PIONEER_DRAGON' // 板块日内最早封板点火先锋龙
  | 'CAPACITY_CORE' // 百亿成交大容量趋势中军
  | 'TURNOVER_DRAGON' // 换手卡位活口龙
  | 'FOLLOWER'; // 板块后排跟风/套利

/**
 * 个股超短游资量化扩展元数据（严格基于 L1 快照、日K历史与 09:25 竞价切片计算）
 */
export interface UltraShortProfile {
  // 09:25 竞价核心原始数据
  auctionPrice: number; // 09:25 撮合开盘价
  auctionChangePercent: number; // 09:25 竞价涨跌幅 (%)
  auctionVolume: number; // 09:25 竞价成交手数
  auctionAmount: number; // 09:25 竞价成交金额 (元)
  yesterdayAmount: number; // 昨日全天成交总额 (元)
  auctionUnmatchedHands: number; // 09:25 竞价未匹配手数 (正数为买一未匹配封单，负数为卖一未匹配压单)
  auctionVolumeRatio: number; // 09:25 竞价量比
  yesterdayPerformanceNote: string; // 昨日形态描述（如 "昨烂板分歧"、"昨缩量一字"、"昨冲高回落"）

  // 连板梯队与身位数据
  consecutiveBoards: number; // 当前连板高度（0 表示非连板，1 表示首板，>=2 表示连板高度）
  yesterdayBoards: number; // 昨日连板数（用于计算 N进N+1 晋级率）
  isIntradayTouchedLimitUp: boolean; // 今日是否曾触及涨停（用于计算封板率/炸板率）
  firstSealTime: string | null; // 首次封死涨停时间（如 '09:25:00', '09:31:12'，未封板为 null）
  dragonRole: DragonRoleTag; // 身位定性

  // 法定复利异动监管逆推历史输入 (k ∈ {2, 3})
  boardRuleType: 'MAIN_20' | 'CHINEXT_STAR_30'; // 主板 20% 偏离阈值 vs 创业板/科创板 30% 偏离阈值
  stockReturnT1: number; // T-1 日个股涨跌幅 (%)
  stockReturnT2: number; // T-2 日个股涨跌幅 (%)
  indexReturnT1: number; // T-1 日对应基准指数涨跌幅 (%)
  indexReturnT2: number; // T-2 日对应基准指数涨跌幅 (%)
  indexReturnToday: number; // 今日对应基准指数实时涨跌幅 (%)
  cumDeviation10d: number; // 近 10 个交易日累计涨跌幅偏离值 (%)，逼近 100% 触发严重异动/特停预警
  abnormalCount10d: number; // 近 10 日已触发同向异动次数
}

/**
 * 09:25 竞价雷达单标的计算结果
 */
export interface AuctionRadarMetrics {
  symbol: string;
  code: string;
  name: string;
  sector: string;
  auctionPrice: number;
  auctionChangePercent: number;
  auctionAmount: number;
  yesterdayAmount: number;
  amountToYesterdayRatio: number; // 竞价金额占昨比 (%) = (竞价金额 / 昨全天成交额) * 100
  auctionVolumeRatio: number; // 竞价量比
  unmatchedHands: number; // 正为抢筹未匹配买单，负为核按钮未匹配卖单
  signal: AuctionSignalType;
  signalLabel: string;
  signalReason: string;
}

/**
 * 连板梯队单层结构与全市场晋级率汇总
 */
export interface BoardTierGroup {
  boardCount: number; // 如 6, 5, 4, 3, 2, 1
  label: string; // 如 '6连板 (空间板)', '3连板', '首板 (1板)'
  yesterdayCount: number; // 昨日 (boardCount - 1) 板基数
  todaySealedCount: number; // 今日成功晋级封板数
  promotionRate: number | null; // 晋级率 (%) = todaySealedCount / yesterdayCount * 100
  stocks: {
    symbol: string;
    code: string;
    name: string;
    sector: string;
    price: number;
    changePercent: number;
    firstSealTime: string;
    sealOrderAmount: number; // 买一封单金额 (元)
    dragonRole: DragonRoleTag;
  }[];
}

export interface BoardLadderSummary {
  maxBoardHeight: number; // 当前最高空间板高度
  spaceDragonSymbol: string;
  spaceDragonName: string;
  firstToSecondRate: number; // 首板晋级率 (1进2 %)
  secondToThirdRate: number; // 2进3 晋级率 (%)
  highBoardPromotionRate: number; // 3板及以上高位晋级率 (%)
  sealSuccessRate: number; // 今日封板率 (%)
  brokenBoardCount: number; // 今日炸板家数
  limitDownCount: number; // 跌停/核按钮家数
  missingBoards: number[]; // 断层缺失的连板高度列表（如 [4, 5]）
  hasLadderFault: boolean; // 是否存在连板梯队断层
  faultWarningText: string; // 断层监测结论
  sentimentPhase: '主升共振期' | '高潮分化期' | '混沌试错期' | '退潮核按钮期';
  tiers: BoardTierGroup[];
}

/**
 * 题材点面共振与先锋龙识别结果
 */
export interface ThemeResonanceItem {
  sectorName: string;
  sectorChangePercent: number; // 板块“面”整体涨幅 (%)
  limitUpCount: number; // 板块涨停家数
  upRatioPercent: number; // 板块内红盘家数占比 (%)
  totalNetInflowCNY: number; // 板块主力净买额 (元)
  resonanceScore: number; // 点面共振综合得分 (0 ~ 100)
  resonanceStatus: '主线强共振' | '局部轮动' | '分歧兑现';
  pioneerDragon: {
    symbol: string;
    name: string;
    changePercent: number;
    firstSealTime: string | null;
    consecutiveBoards: number;
  };
  capacityCore: {
    symbol: string;
    name: string;
    changePercent: number;
    amount: number;
  };
  memberStocks: {
    symbol: string;
    code: string;
    name: string;
    price: number;
    changePercent: number;
    consecutiveBoards: number;
    dragonRole: DragonRoleTag;
    roleLabel: string;
    firstSealTime: string | null;
  }[];
}

/**
 * 现行注册制法定复利异动监管逆推结果 (k ∈ {2, 3} 窗口 + 10日100%严重异动特停预警)
 */
export interface RegulatoryDeviationResult {
  symbol: string;
  code: string;
  name: string;
  ruleThresholdPercent: number; // 20% (主板) 或 30% (创业板/科创板)
  currentPrice: number;
  currentChangePercent: number;

  // k = 2 (连续2个交易日) 复利偏离逆推
  dev2DayCurrentPercent: number; // 当前实时2日累计偏离值 (%)
  maxSafeChange2DayPercent: number; // 今日不触发2日异动的极限安全涨幅 (%)
  triggerPrice2Day: number; // 触发2日异动的精确临界价 (元)

  // k = 3 (连续3个交易日) 复利偏离逆推
  dev3DayCurrentPercent: number; // 当前实时3日累计偏离值 (%)
  maxSafeChange3DayPercent: number; // 今日不触发3日异动的极限安全涨幅 (%)
  triggerPrice3Day: number; // 触发3日异动的精确临界价 (元)

  // 取 k ∈ {2, 3} 最严苛绑定窗口
  bindingWindowK: 2 | 3;
  effectiveTriggerPrice: number; // min(triggerPrice2Day, triggerPrice3Day)
  effectiveMaxSafeChangePercent: number; // 综合安全涨幅上限 (%)
  isTriggeredToday: boolean; // 当前价格是否已触及或突破 k∈{2,3} 法定异动线

  // 10日 100% 严重异动与特停锁死预警
  cumDeviation10dPercent: number; // 实时10日累计偏离值 (%)
  remainingTo100Percent: number; // 距离 100% 严重异动红线剩余空间 (%)
  severeSuspensionLockWarning: boolean; // 是否触发严重异动/特停锁死高危预警
  statusSummary: string;
}

/**
 * 真实成交量加权承接算子 (VW-DVR: Volume-Weighted Dynamic Volume Support Ratio)
 */
export interface VWDVRResult {
  symbol: string;
  code: string;
  name: string;
  vwap: number; // 日内真实成交量加权均价
  priceToVwapDiffPercent: number; // 最新价相对 VWAP 乖离率 (%)
  aboveVwapVolumeRatio: number; // 水上（>=VWAP）成交量占总成交量比例 (%)
  dipBuyAbsorptionRatio: number; // 分时回踩切片外盘主动承接吸收率 (%)
  lowerShadowResilience: number; // 日内下影线探底回升韧性系数 (0 ~ 100)
  vwDvrScore: number; // 综合真实成交量加权承接算子得分 (0 ~ 100)
  signal: 'STRONG_ABSORPTION' | 'HEALTHY_TURNOVER' | 'WEAK_DISTRIBUTION';
  signalLabel: string;
  actionAdvice: string;
}

/**
 * 价格与涨跌幅预警条件类型
 * - CHANGE_PCT_ABOVE: 涨跌幅高于或等于指定阈值 (%)，如 +3.00%
 * - CHANGE_PCT_BELOW: 涨跌幅低于或等于指定阈值 (%)，如 -2.00%
 * - PRICE_ABOVE: 最新价高于或等于目标价 (元)
 * - PRICE_BELOW: 最新价低于或等于目标价 (元)
 */
export type AlertConditionType =
  | 'CHANGE_PCT_ABOVE'
  | 'CHANGE_PCT_BELOW'
  | 'PRICE_ABOVE'
  | 'PRICE_BELOW';

export interface PriceAlertRule {
  id: string;
  symbol: string;
  stockName: string;
  condition: AlertConditionType;
  threshold: number;
  enabled: boolean;
  triggered: boolean;
  triggeredAt?: number;
  triggeredPrice?: number;
  triggeredChangePercent?: number;
  createdAt: number;
}

export interface TriggeredAlertEvent {
  id: string;
  ruleId: string;
  symbol: string;
  stockName: string;
  condition: AlertConditionType;
  threshold: number;
  price: number;
  changePercent: number;
  message: string;
  timestamp: number;
}

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

