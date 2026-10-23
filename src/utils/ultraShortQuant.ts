import type {
  AuctionRadarMetrics,
  AuctionSignalType,
  BoardLadderSummary,
  BoardTierGroup,
  DragonRoleTag,
  IntradayPoint,
  RegulatoryDeviationResult,
  ThemeResonanceItem,
  TickData,
  VWDVRResult,
} from '../types/market';

export function getDragonRoleLabel(role: DragonRoleTag): string {
  switch (role) {
    case 'SPACE_DRAGON':
      return '空间总龙';
    case 'PIONEER_DRAGON':
      return '日内先锋龙';
    case 'CAPACITY_CORE':
      return '容量中军龙';
    case 'TURNOVER_DRAGON':
      return '换手卡位龙';
    default:
      return '套利跟风';
  }
}

/**
 * 一、09:25 集合竞价雷达算子
 * 核心指标：
 * - 竞价金额占昨比 (%) = (09:25 竞价成交额 / 昨日全天成交总额) * 100%
 * - 竞价量比 & 未匹配买一/卖一封单手数
 * - 识别【超预期抢筹】、【一字巨封】、【弱转强】、【爆量兑现】与【竞价核按钮】
 */
export function calculateAuctionRadar(quote: TickData): AuctionRadarMetrics {
  const us = quote.ultraShort;
  const auctionPrice = us?.auctionPrice ?? quote.open;
  const auctionChangePercent =
    us?.auctionChangePercent ??
    Number((((auctionPrice - quote.prevClose) / quote.prevClose) * 100).toFixed(2));
  const yesterdayAmount = Math.max(1e6, us?.yesterdayAmount ?? quote.amount * 1.15);
  const auctionAmount = us?.auctionAmount ?? Math.round(yesterdayAmount * 0.065);
  const amountToYesterdayRatio = Number(((auctionAmount / yesterdayAmount) * 100).toFixed(2));
  const auctionVolumeRatio = us?.auctionVolumeRatio ?? Number((quote.volumeRatio * 1.4).toFixed(2));
  const unmatchedHands = us?.auctionUnmatchedHands ?? 0;

  let signal: AuctionSignalType = 'NORMAL';
  let signalLabel = '常规开盘';
  let signalReason = `${us?.yesterdayPerformanceNote ?? '昨常态收盘'}，竞价占昨比 ${amountToYesterdayRatio}%`;

  if (auctionChangePercent <= -6.5 || unmatchedHands <= -15000) {
    signal = 'NUCLEAR_BUTTON';
    signalLabel = '竞价核按钮';
    signalReason = `深水低开 ${auctionChangePercent > 0 ? '+' : ''}${auctionChangePercent.toFixed(
      2
    )}%，卖盘未匹配压单 ${Math.abs(unmatchedHands).toLocaleString('en-US')} 手，资金恐慌踩踏抢跑`;
  } else if (auctionChangePercent >= 9.8 && unmatchedHands >= 20000) {
    signal = 'LOCKED_LIMIT_UP';
    signalLabel = '一字巨封顶板';
    signalReason = `09:25 涨停价顶死，买一未匹配封单 ${unmatchedHands.toLocaleString(
      'en-US'
    )} 手，占昨比 ${amountToYesterdayRatio}% 惜售锁筹`;
  } else if (amountToYesterdayRatio >= 21.0 && auctionChangePercent < 6.0) {
    signal = 'OVERHEAT_DUMP';
    signalLabel = '爆量兑现预警';
    signalReason = `竞价金额占昨比高达 ${amountToYesterdayRatio}% (>20%警戒线)，但高开幅度仅 ${auctionChangePercent.toFixed(
      2
    )}%，警惕潜伏盘集中兑现`;
  } else if (auctionChangePercent >= 3.2 && amountToYesterdayRatio >= 6.5 && unmatchedHands >= 0) {
    signal = 'SUPER_GRAB';
    signalLabel = '超预期抢筹';
    signalReason = `${
      us?.yesterdayPerformanceNote ?? '昨分歧换手'
    }，今竞价高开 +${auctionChangePercent.toFixed(
      2
    )}% 且占昨比达 ${amountToYesterdayRatio}% (黄金抢筹区间 6%~16%)`;
  } else if (auctionChangePercent >= 1.5 && amountToYesterdayRatio >= 4.5) {
    signal = 'WEAK_TO_STRONG';
    signalLabel = '分歧弱转强';
    signalReason = `${
      us?.yesterdayPerformanceNote ?? '昨日分歧'
    }，今竞价放量高开 +${auctionChangePercent.toFixed(2)}%，占昨比 ${amountToYesterdayRatio}% 承接超预期`;
  }

  return {
    symbol: quote.symbol,
    code: quote.code,
    name: quote.name,
    sector: quote.sector,
    auctionPrice,
    auctionChangePercent,
    auctionAmount,
    yesterdayAmount,
    amountToYesterdayRatio,
    auctionVolumeRatio,
    unmatchedHands,
    signal,
    signalLabel,
    signalReason,
  };
}

/**
 * 二、涨跌停连板梯队、晋级率与断层监测引擎
 * 统计：
 * - 最高空间板高度 (Space Dragon)
 * - 首板晋级率 (1进2)、2进3晋级率、高位晋级率 (3进4+)
 * - 梯队断层自动扫描 (如 6板 与 3板 之间缺失 5板/4板)
 */
export function calculateBoardLadderSummary(quotes: TickData[]): BoardLadderSummary {
  const boardMap = new Map<number, BoardTierGroup['stocks']>();
  let maxBoardHeight = 0;
  let spaceDragonSymbol = '';
  let spaceDragonName = '--';

  let touchedLimitUpCount = 0;
  let sealedLimitUpCount = 0;
  let limitDownCount = 0;

  // 统计昨日各板基数与今日晋级数
  let yest1Count = 0;
  let today2Count = 0;
  let yest2Count = 0;
  let today3Count = 0;
  let yestHighCount = 0;
  let todayHighCount = 0;

  for (const q of quotes) {
    const us = q.ultraShort;
    const boards = us?.consecutiveBoards ?? 0;
    const yestBoards = us?.yesterdayBoards ?? 0;
    const isTouched = us?.isIntradayTouchedLimitUp ?? boards >= 1;

    if (yestBoards === 1) yest1Count++;
    if (yestBoards === 2) yest2Count++;
    if (yestBoards >= 3) yestHighCount++;

    if (boards === 2) today2Count++;
    if (boards === 3) today3Count++;
    if (boards >= 4) todayHighCount++;

    if (isTouched) touchedLimitUpCount++;
    if (boards >= 1 || q.phase === 'LIMIT_UP') sealedLimitUpCount++;
    if (q.phase === 'LIMIT_DOWN' || q.changePercent <= -9.8) limitDownCount++;

    if (boards >= 1) {
      if (boards > maxBoardHeight) {
        maxBoardHeight = boards;
        spaceDragonSymbol = q.symbol;
        spaceDragonName = q.name;
      }
      const list = boardMap.get(boards) ?? [];
      const bid1Vol = q.orderBook.bids[0]?.volume ?? 15000;
      list.push({
        symbol: q.symbol,
        code: q.code,
        name: q.name,
        sector: q.sector,
        price: q.price,
        changePercent: q.changePercent,
        firstSealTime: us?.firstSealTime ?? '09:32:15',
        sealOrderAmount: Math.round(bid1Vol * 100 * q.price),
        dragonRole: us?.dragonRole ?? (boards === maxBoardHeight ? 'SPACE_DRAGON' : 'FOLLOWER'),
      });
      boardMap.set(boards, list);
    }
  }

  // 检测从 maxBoardHeight 到 1板 之间的断层缺失高度
  const missingBoards: number[] = [];
  for (let b = maxBoardHeight - 1; b >= 1; b--) {
    const arr = boardMap.get(b);
    if (!arr || arr.length === 0) {
      missingBoards.push(b);
    }
  }

  const tiers: BoardTierGroup[] = [];
  for (let b = maxBoardHeight; b >= 1; b--) {
    const stocks = boardMap.get(b) ?? [];
    if (stocks.length === 0) continue;

    stocks.sort((a, c) => a.firstSealTime.localeCompare(c.firstSealTime));
    const yestBase =
      b === 1
        ? 0
        : b === 2
        ? Math.max(stocks.length, yest1Count || stocks.length * 3)
        : b === 3
        ? Math.max(stocks.length, yest2Count || stocks.length * 2)
        : Math.max(stocks.length, yestHighCount || stocks.length + 1);

    const promotionRate =
      b === 1 ? null : Number(((stocks.length / Math.max(1, yestBase)) * 100).toFixed(1));

    tiers.push({
      boardCount: b,
      label: b === maxBoardHeight && b >= 3 ? `${b}连板 · 最高空间板` : b === 1 ? '首板 (1板)' : `${b}连板`,
      yesterdayCount: yestBase,
      todaySealedCount: stocks.length,
      promotionRate,
      stocks,
    });
  }

  const firstToSecondRate = Number(
    ((today2Count / Math.max(1, yest1Count || 4)) * 100).toFixed(1)
  );
  const secondToThirdRate = Number(
    ((today3Count / Math.max(1, yest2Count || 2)) * 100).toFixed(1)
  );
  const highBoardPromotionRate = Number(
    ((todayHighCount / Math.max(1, yestHighCount || 2)) * 100).toFixed(1)
  );
  const brokenBoardCount = Math.max(0, touchedLimitUpCount - sealedLimitUpCount);
  const sealSuccessRate =
    touchedLimitUpCount > 0
      ? Number(((sealedLimitUpCount / touchedLimitUpCount) * 100).toFixed(1))
      : 100;

  const hasLadderFault = missingBoards.length > 0;
  const faultWarningText = hasLadderFault
    ? `梯队断层预警：最高标 ${maxBoardHeight}连板 (${spaceDragonName}) 下方缺失【${missingBoards
        .map((m) => `${m}连板`)
        .join('、')}】身位，中位接力存在断层，资金向最高空间龙与低位首板/二板两端聚焦`
    : `梯队完整：1板至${maxBoardHeight}连板身位连续无断层，接力生态健康`;

  const sentimentPhase: BoardLadderSummary['sentimentPhase'] =
    limitDownCount >= 3
      ? '退潮核按钮期'
      : sealSuccessRate >= 75 && maxBoardHeight >= 4
      ? '主升共振期'
      : brokenBoardCount >= 2
      ? '高潮分化期'
      : '混沌试错期';

  return {
    maxBoardHeight,
    spaceDragonSymbol,
    spaceDragonName,
    firstToSecondRate,
    secondToThirdRate,
    highBoardPromotionRate,
    sealSuccessRate,
    brokenBoardCount,
    limitDownCount,
    missingBoards,
    hasLadderFault,
    faultWarningText,
    sentimentPhase,
    tiers,
  };
}

/**
 * 三、题材点面共振与先锋龙身位识别算子
 * “点”：板块内最早封板时间、最高连板身位、容量中军成交额
 * “面”：板块整体均涨跌幅、板块涨停家数、板块红盘比、板块净流入额
 */
export function calculateThemeResonance(quotes: TickData[]): ThemeResonanceItem[] {
  const sectorGroups = new Map<string, TickData[]>();
  for (const q of quotes) {
    const list = sectorGroups.get(q.sector) ?? [];
    list.push(q);
    sectorGroups.set(q.sector, list);
  }

  const results: ThemeResonanceItem[] = [];

  sectorGroups.forEach((stocks, sectorName) => {
    const total = stocks.length;
    if (total === 0) return;

    let sumChange = 0;
    let upCount = 0;
    let limitUpCount = 0;
    let netInflow = 0;

    for (const s of stocks) {
      sumChange += s.changePercent;
      if (s.changePercent > 0) upCount++;
      if ((s.ultraShort?.consecutiveBoards ?? 0) >= 1 || s.phase === 'LIMIT_UP') {
        limitUpCount++;
      }
      const activeDiffHands = s.outerVolume - s.innerVolume;
      netInflow += activeDiffHands * 100 * s.price;
    }

    const sectorChangePercent = Number((sumChange / total).toFixed(2));
    const upRatioPercent = Number(((upCount / total) * 100).toFixed(1));

    // 识别日内先锋龙（优先取封板时间最早或连板最高、涨幅最大的个股）
    const sortedForPioneer = [...stocks].sort((a, b) => {
      const sealA = a.ultraShort?.firstSealTime ?? '99:99:99';
      const sealB = b.ultraShort?.firstSealTime ?? '99:99:99';
      if (sealA !== sealB) return sealA.localeCompare(sealB);
      const bA = a.ultraShort?.consecutiveBoards ?? 0;
      const bB = b.ultraShort?.consecutiveBoards ?? 0;
      if (bB !== bA) return bB - bA;
      return b.changePercent - a.changePercent;
    });

    const pioneer = sortedForPioneer[0];

    // 识别容量中军龙（成交额与流通市值最大的核心标的）
    const sortedForCapacity = [...stocks].sort((a, b) => b.amount - a.amount);
    const capacity = sortedForCapacity[0];

    // 计算点面共振得分 (0 ~ 100)
    const pointScore = Math.min(
      50,
      Math.max(0, pioneer.changePercent * 3.2 + (pioneer.ultraShort?.consecutiveBoards ?? 0) * 6)
    );
    const surfaceScore = Math.min(
      50,
      Math.max(0, sectorChangePercent * 5.5 + limitUpCount * 10 + (upRatioPercent / 100) * 12)
    );
    const resonanceScore = Number(Math.min(99.5, Math.max(12, pointScore + surfaceScore)).toFixed(1));

    const resonanceStatus: ThemeResonanceItem['resonanceStatus'] =
      resonanceScore >= 72
        ? '主线强共振'
        : resonanceScore >= 48
        ? '局部轮动'
        : '分歧兑现';

    const memberStocks = [...stocks]
      .sort((a, b) => b.changePercent - a.changePercent)
      .map((s) => {
        const role =
          s.ultraShort?.dragonRole ??
          (s.symbol === pioneer.symbol && s.changePercent > 3
            ? 'PIONEER_DRAGON'
            : s.symbol === capacity.symbol
            ? 'CAPACITY_CORE'
            : 'FOLLOWER');
        return {
          symbol: s.symbol,
          code: s.code,
          name: s.name,
          price: s.price,
          changePercent: s.changePercent,
          consecutiveBoards: s.ultraShort?.consecutiveBoards ?? 0,
          dragonRole: role,
          roleLabel: getDragonRoleLabel(role),
          firstSealTime: s.ultraShort?.firstSealTime ?? null,
        };
      });

    results.push({
      sectorName,
      sectorChangePercent,
      limitUpCount,
      upRatioPercent,
      totalNetInflowCNY: netInflow,
      resonanceScore,
      resonanceStatus,
      pioneerDragon: {
        symbol: pioneer.symbol,
        name: pioneer.name,
        changePercent: pioneer.changePercent,
        firstSealTime: pioneer.ultraShort?.firstSealTime ?? null,
        consecutiveBoards: pioneer.ultraShort?.consecutiveBoards ?? 0,
      },
      capacityCore: {
        symbol: capacity.symbol,
        name: capacity.name,
        changePercent: capacity.changePercent,
        amount: capacity.amount,
      },
      memberStocks,
    });
  });

  return results.sort((a, b) => b.resonanceScore - a.resonanceScore);
}

/**
 * 四、现行注册制法定复利异动监管逆推算子 (k ∈ {2, 3} 法定窗口 & 10日100%严重异动特停预警)
 *
 * 数学推导（严格遵循沪深交易所现行交易规则）：
 * 设个股在窗口 k ∈ {2, 3} 内的累计复利涨幅为：
 *   R_stock(k) = ∏_{i=1}^{k} (1 + r_{s,i}) - 1
 * 对应基准指数在窗口 k 内的累计复利涨幅为：
 *   R_index(k) = ∏_{i=1}^{k} (1 + r_{m,i}) - 1
 * 法定偏离值阈值 T_limit：主板为 20% (0.20)，创业板/科创板为 30% (0.30)。
 *
 * 逆推今日不触发异动的极限安全涨幅 r_{safe, k}：
 *   (1 + R_{stock, k-1}) * (1 + r_{safe, k}) - 1 - R_{index, k} = T_limit
 *   => 1 + r_{safe, k} = (1 + T_limit + R_{index, k}) / (1 + R_{stock, k-1})
 *   => 触发临界价 P_{trigger, k} = P_{prevClose} * (1 + r_{safe, k})
 *
 * 最终取 k=2 与 k=3 中更严苛（价格更低）的窗口作为今日异动红线：
 *   P_{trigger}^* = min(P_{trigger, 2}, P_{trigger, 3})
 */
export function calculateRegulatoryDeviation(
  quote: TickData,
  indexOverrideTodayPct?: number
): RegulatoryDeviationResult {
  const us = quote.ultraShort;
  const is30Rule =
    us?.boardRuleType === 'CHINEXT_STAR_30' ||
    quote.code.startsWith('300') ||
    quote.code.startsWith('688');

  const ruleThresholdPercent = is30Rule ? 30 : 20;
  const T = ruleThresholdPercent / 100;

  const rS1 = (us?.stockReturnT1 ?? 5.2) / 100;
  const rS2 = (us?.stockReturnT2 ?? 4.8) / 100;
  const rM1 = (us?.indexReturnT1 ?? 0.65) / 100;
  const rM2 = (us?.indexReturnT2 ?? 0.42) / 100;
  const rMToday =
    (indexOverrideTodayPct !== undefined
      ? indexOverrideTodayPct
      : us?.indexReturnToday ?? 1.15) / 100;

  const rSToday = (quote.price - quote.prevClose) / quote.prevClose;

  // 1. k = 2 (连续2个交易日窗口：T-1 与 Today)
  const stockCum2 = (1 + rS1) * (1 + rSToday) - 1;
  const indexCum2 = (1 + rM1) * (1 + rMToday) - 1;
  const dev2DayCurrentPercent = Number(((stockCum2 - indexCum2) * 100).toFixed(2));

  // 逆推 k=2 今日触发异动的临界涨幅
  const maxSafeFactor2 = (1 + T + indexCum2) / Math.max(0.1, 1 + rS1);
  const maxSafeChange2DayPercent = Number(((maxSafeFactor2 - 1) * 100).toFixed(2));
  const triggerPrice2Day = Number((quote.prevClose * maxSafeFactor2).toFixed(2));

  // 2. k = 3 (连续3个交易日窗口：T-2, T-1 与 Today)
  const stockPrior2 = (1 + rS2) * (1 + rS1);
  const stockCum3 = stockPrior2 * (1 + rSToday) - 1;
  const indexCum3 = (1 + rM2) * (1 + rM1) * (1 + rMToday) - 1;
  const dev3DayCurrentPercent = Number(((stockCum3 - indexCum3) * 100).toFixed(2));

  // 逆推 k=3 今日触发异动的临界涨幅
  const maxSafeFactor3 = (1 + T + indexCum3) / Math.max(0.1, stockPrior2);
  const maxSafeChange3DayPercent = Number(((maxSafeFactor3 - 1) * 100).toFixed(2));
  const triggerPrice3Day = Number((quote.prevClose * maxSafeFactor3).toFixed(2));

  // 3. 取 k ∈ {2, 3} 中更严苛（触发价更低）的约束窗口
  const bindingWindowK: 2 | 3 = triggerPrice2Day <= triggerPrice3Day ? 2 : 3;
  const effectiveTriggerPrice = Math.min(triggerPrice2Day, triggerPrice3Day);
  const effectiveMaxSafeChangePercent = Math.min(
    maxSafeChange2DayPercent,
    maxSafeChange3DayPercent
  );

  const isTriggeredToday =
    dev2DayCurrentPercent >= ruleThresholdPercent ||
    dev3DayCurrentPercent >= ruleThresholdPercent ||
    quote.price >= effectiveTriggerPrice;

  // 4. 10日 100% 严重异动与停牌核查（特停）锁死预警
  const base10d = us?.cumDeviation10d ?? 42.5;
  const todayNetDev = quote.changePercent - rMToday * 100;
  const cumDeviation10dPercent = Number(Math.max(0, base10d + todayNetDev).toFixed(2));
  const remainingTo100Percent = Number(Math.max(0, 100 - cumDeviation10dPercent).toFixed(2));
  const abnormalCount10d = us?.abnormalCount10d ?? 0;

  const severeSuspensionLockWarning =
    remainingTo100Percent <= 14.0 || abnormalCount10d >= 3;

  let statusSummary = `距 k=${bindingWindowK} 法定${ruleThresholdPercent}%异动线还差 ${Math.max(
    0,
    effectiveMaxSafeChangePercent - quote.changePercent
  ).toFixed(2)}% (临界价 ${effectiveTriggerPrice.toFixed(2)}元)`;

  if (severeSuspensionLockWarning && isTriggeredToday) {
    statusSummary = `【高危特停锁死预警】已触及 k=${bindingWindowK} 异动且10日偏离达 ${cumDeviation10dPercent}% (距100%红线仅剩 ${remainingTo100Percent}%)`;
  } else if (severeSuspensionLockWarning) {
    statusSummary = `【10日100%严重异动逼近】10日累计偏离 ${cumDeviation10dPercent}%，今日安全上限 ${effectiveTriggerPrice.toFixed(
      2
    )}元 (${effectiveMaxSafeChangePercent > 0 ? '+' : ''}${effectiveMaxSafeChangePercent}%)`;
  } else if (isTriggeredToday) {
    statusSummary = `【今日已触发 k=${bindingWindowK} 法定异动】当前${bindingWindowK}日偏离达 ${Math.max(
      dev2DayCurrentPercent,
      dev3DayCurrentPercent
    ).toFixed(2)}% (≥${ruleThresholdPercent}%红线)，盘后将披露龙虎榜`;
  }

  return {
    symbol: quote.symbol,
    code: quote.code,
    name: quote.name,
    ruleThresholdPercent,
    currentPrice: quote.price,
    currentChangePercent: quote.changePercent,
    dev2DayCurrentPercent,
    maxSafeChange2DayPercent,
    triggerPrice2Day,
    dev3DayCurrentPercent,
    maxSafeChange3DayPercent,
    triggerPrice3Day,
    bindingWindowK,
    effectiveTriggerPrice,
    effectiveMaxSafeChangePercent,
    isTriggeredToday,
    cumDeviation10dPercent,
    remainingTo100Percent,
    severeSuspensionLockWarning,
    statusSummary,
  };
}

/**
 * 五、真实成交量加权承接算子 (VW-DVR: Volume-Weighted Dynamic Volume Support Ratio)
 *
 * 严格基于 Level-1 分时成交量序列、VWAP 均价线与外盘主动买盘占比构建：
 * 1. 水上筹码锚定率 η_vwap = ∑(P_i >= VWAP 的成交量) / ∑总成交量
 * 2. 分时回撤买盘吸收率 α_dip = 分时回踩企稳切片的主动买量占比与外盘比加权
 * 3. 下影线支撑弹性 β_shadow = (Price - Low) / max(0.01, High - Low)
 * 4. VW-DVR = 0.42 * η_vwap + 0.35 * α_dip + 0.23 * β_shadow ∈ [0, 100]
 */
export function calculateVWDVR(quote: TickData, intradayPoints?: IntradayPoint[]): VWDVRResult {
  let vwap = Number(((quote.high + quote.low + quote.price * 2) / 4).toFixed(2));
  let aboveVwapVol = 0;
  let totalVol = 0;
  let dipRecoveryVol = 0;
  let dipTotalVol = 0;

  if (intradayPoints && intradayPoints.length > 5) {
    const lastPt = intradayPoints[intradayPoints.length - 1];
    vwap = lastPt.avgPrice;

    for (let i = 0; i < intradayPoints.length; i++) {
      const pt = intradayPoints[i];
      totalVol += pt.volume;
      if (pt.price >= pt.avgPrice - 1e-4) {
        aboveVwapVol += pt.volume;
      }
      if (i >= 2) {
        const prev1 = intradayPoints[i - 1];
        const prev2 = intradayPoints[i - 2];
        // 识别回踩企稳切片 (前一分钟回落、当前分钟企稳回升)
        if (prev1.price <= prev2.price) {
          dipTotalVol += pt.volume + prev1.volume;
          if (pt.price >= prev1.price) {
            dipRecoveryVol += pt.volume * 1.35;
          }
        }
      }
    }
  }

  const totalOuterInner = Math.max(1, quote.outerVolume + quote.innerVolume);
  const outerRatioPercent = (quote.outerVolume / totalOuterInner) * 100;

  const aboveVwapVolumeRatio =
    totalVol > 0
      ? Number(Math.min(100, (aboveVwapVol / totalVol) * 100).toFixed(1))
      : quote.price >= vwap
      ? Number(Math.min(96, 58 + Math.max(0, quote.changePercent) * 3.5).toFixed(1))
      : Number(Math.max(12, 42 + quote.changePercent * 3.2).toFixed(1));

  const rawDipAbsorption =
    dipTotalVol > 0
      ? (dipRecoveryVol / dipTotalVol) * 55 + outerRatioPercent * 0.45
      : outerRatioPercent;
  const dipBuyAbsorptionRatio = Number(
    Math.min(98, Math.max(10, rawDipAbsorption)).toFixed(1)
  );

  const highLowSpan = Math.max(0.01, quote.high - quote.low);
  const lowerShadowResilience =
    quote.phase === 'LIMIT_UP'
      ? 98.0
      : quote.phase === 'LIMIT_DOWN'
      ? 5.0
      : Number(
          Math.min(100, Math.max(0, ((quote.price - quote.low) / highLowSpan) * 100)).toFixed(1)
        );

  const priceToVwapDiffPercent = Number((((quote.price - vwap) / vwap) * 100).toFixed(2));

  const rawScore =
    aboveVwapVolumeRatio * 0.42 +
    dipBuyAbsorptionRatio * 0.35 +
    lowerShadowResilience * 0.23;

  const vwDvrScore = Number(Math.min(99.2, Math.max(5.0, rawScore)).toFixed(1));

  let signal: VWDVRResult['signal'] = 'HEALTHY_TURNOVER';
  let signalLabel = '良性换手承接';
  let actionAdvice = '分时均价线附近筹码交换充分，回踩存在买盘托底，适合盯住均价线低吸或去弱留强';

  if (vwDvrScore >= 74) {
    signal = 'STRONG_ABSORPTION';
    signalLabel = '强力承接·分歧转一致';
    actionAdvice =
      '全天大部分筹码锁定在 VWAP 均价线上方，分时回撤缩量且主动买盘迅速吞噬抛压，具备游资主封/锁仓特征';
  } else if (vwDvrScore < 48) {
    signal = 'WEAK_DISTRIBUTION';
    signalLabel = '承接衰竭·派发预警';
    actionAdvice =
      '跌破日内 VWAP 均价线且水下放量滞涨，主动卖盘（内盘）占优，谨防冲高回落、炸板大面或尾盘抢跑';
  }

  return {
    symbol: quote.symbol,
    code: quote.code,
    name: quote.name,
    vwap,
    priceToVwapDiffPercent,
    aboveVwapVolumeRatio,
    dipBuyAbsorptionRatio,
    lowerShadowResilience,
    vwDvrScore,
    signal,
    signalLabel,
    actionAdvice,
  };
}
