import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateOrderBookMetrics,
  calculateSMA,
  calculateEMA,
  calculateBOLL,
  calculateMACD,
  calculateKDJ,
  calculateRSI,
  filterAndSortStocks,
  formatPrice,
  formatVolumeHands,
  evaluatePriceAlertRule,
  formatAlertConditionLabel,
  buildAlertTriggerMessage,
} from './marketCalc';
import type { KLineBar, OrderBook5, PriceAlertRule, TickData } from '../types/market';

test('OrderBook5 正常五档盘口计算：委差、委比与卖五至卖一排序', () => {
  const orderBook: OrderBook5 = {
    bids: [
      { level: 1, price: 1500.0, volume: 300 },
      { level: 2, price: 1499.8, volume: 200 },
      { level: 3, price: 1499.5, volume: 150 },
      { level: 4, price: 1499.2, volume: 100 },
      { level: 5, price: 1499.0, volume: 50 },
    ],
    asks: [
      { level: 1, price: 1500.2, volume: 100 },
      { level: 2, price: 1500.5, volume: 100 },
      { level: 3, price: 1500.8, volume: 80 },
      { level: 4, price: 1501.0, volume: 70 },
      { level: 5, price: 1501.5, volume: 50 },
    ],
  };

  const metrics = calculateOrderBookMetrics(orderBook, 1490.0);

  // TotalBid = 300+200+150+100+50 = 800
  // TotalAsk = 100+100+80+70+50 = 400
  assert.equal(metrics.totalBidVolume, 800);
  assert.equal(metrics.totalAskVolume, 400);

  // 委差 = 800 - 400 = +400
  assert.equal(metrics.imbalanceVolume, 400);
  assert.equal(metrics.imbalanceVolumeText, '+400');

  // 委比 = (400 / 1200) * 100 = +33.33%
  assert.equal(metrics.imbalanceRatioText, '+33.33%');

  // 卖盘必须由卖五至卖一由高到低排列
  assert.deepEqual(
    metrics.asksTopToBottom.map((r) => r.label),
    ['卖五', '卖四', '卖三', '卖二', '卖一']
  );
  assert.equal(metrics.asksTopToBottom[0].priceText, '1501.50');
  assert.equal(metrics.asksTopToBottom[4].priceText, '1500.20');

  // 买盘必须由买一至买五排列
  assert.deepEqual(
    metrics.bidsTopToBottom.map((r) => r.label),
    ['买一', '买二', '买三', '买四', '买五']
  );
  // 最大挂单量 300（买一），深度条应为 100%
  assert.equal(metrics.bidsTopToBottom[0].depthPercent, 100);
});

test('OrderBook5 涨停封板空档保护：卖一至卖五全空优雅降级为 --', () => {
  const limitUpBook: OrderBook5 = {
    bids: [
      { level: 1, price: 11.0, volume: 95000 },
      { level: 2, price: 10.99, volume: 1200 },
      { level: 3, price: 10.98, volume: 800 },
      { level: 4, price: 10.97, volume: 600 },
      { level: 5, price: 10.96, volume: 400 },
    ],
    asks: [
      { level: 1, price: null, volume: null },
      { level: 2, price: null, volume: null },
      { level: 3, price: null, volume: null },
      { level: 4, price: null, volume: null },
      { level: 5, price: null, volume: null },
    ],
  };

  const metrics = calculateOrderBookMetrics(limitUpBook, 10.0);
  assert.equal(metrics.totalAskVolume, 0);
  assert.equal(metrics.imbalanceRatioText, '+100.00%');
  for (const askRow of metrics.asksTopToBottom) {
    assert.equal(askRow.priceText, '--');
    assert.equal(askRow.volumeText, '--');
    assert.equal(askRow.depthPercent, 0);
  }
});

test('OrderBook5 集合竞价全空盘口保护：不抛异常且委比委差降级为 --', () => {
  const emptyBook: OrderBook5 = {
    bids: [
      { level: 1, price: null, volume: null },
      { level: 2, price: null, volume: null },
      { level: 3, price: null, volume: null },
      { level: 4, price: null, volume: null },
      { level: 5, price: null, volume: null },
    ],
    asks: [
      { level: 1, price: null, volume: null },
      { level: 2, price: null, volume: null },
      { level: 3, price: null, volume: null },
      { level: 4, price: null, volume: null },
      { level: 5, price: null, volume: null },
    ],
  };

  const metrics = calculateOrderBookMetrics(emptyBook, 20.0);
  assert.equal(metrics.imbalanceVolume, null);
  assert.equal(metrics.imbalanceRatio, null);
  assert.equal(metrics.imbalanceVolumeText, '--');
  assert.equal(metrics.imbalanceRatioText, '--');
  assert.equal(metrics.bidPowerPercent, 50);
});

test('技术指标计算准确性：SMA, EMA, BOLL, MACD, KDJ, RSI', () => {
  const sampleBars: KLineBar[] = Array.from({ length: 30 }, (_, i) => ({
    time: `2026-09-${String(i + 1).padStart(2, '0')}`,
    timestamp: 1700000000 + i * 86400,
    open: 100 + i,
    high: 102 + i,
    low: 99 + i,
    close: 101 + i,
    volume: 10000 + i * 100,
    amount: 1000000 + i * 10000,
  }));

  const sma5 = calculateSMA(sampleBars, 5);
  assert.equal(sma5[3], null);
  // 第5根K线 (index 4): close 为 101, 102, 103, 104, 105 -> 均值 103
  assert.equal(sma5[4], 103);

  const ema5 = calculateEMA(sampleBars, 5);
  assert.equal(ema5.length, 30);
  assert.ok((ema5[29] ?? 0) > 125);

  const boll = calculateBOLL(sampleBars, 20, 2);
  assert.equal(boll[18].mid, null);
  assert.ok(boll[19].mid !== null && boll[19].upper! > boll[19].mid! && boll[19].lower! < boll[19].mid!);

  const macd = calculateMACD(sampleBars);
  assert.equal(macd.length, 30);
  assert.ok(macd[29].dif > 0);

  const kdj = calculateKDJ(sampleBars, 9);
  assert.equal(kdj.length, 30);
  assert.ok(kdj[29].k > 50);

  const rsi = calculateRSI(sampleBars, 14);
  assert.equal(rsi[13], null);
  assert.equal(rsi[14], 100); // 单边上涨序列 RSI = 100
});

test('自选股拼音首字母与代码过滤', () => {
  const mockStocks = [
    {
      symbol: '600519.SH',
      code: '600519',
      name: '贵州茅台',
      pinyin: 'gzmt',
      sector: '酿酒行业',
      price: 1580,
      changePercent: 2.15,
      phase: 'TRADING',
    },
    {
      symbol: '002594.SZ',
      code: '002594',
      name: '比亚迪',
      pinyin: 'byd',
      sector: '新能源车',
      price: 295,
      changePercent: 4.3,
      phase: 'TRADING',
    },
  ] as unknown as TickData[];

  const byPinyin = filterAndSortStocks(mockStocks, 'BYD', 'all', []);
  assert.equal(byPinyin.length, 1);
  assert.equal(byPinyin[0].code, '002594');

  const byCode = filterAndSortStocks(mockStocks, '6005', 'all', []);
  assert.equal(byCode.length, 1);
  assert.equal(byCode[0].name, '贵州茅台');

  assert.equal(formatPrice(null), '--');
  assert.equal(formatVolumeHands(125000), '12.50万');
});

test('价格与涨跌幅预警阈值计算与触发判定', () => {
  const sampleTick = {
    symbol: '600519.SH',
    code: '600519',
    name: '贵州茅台',
    price: 1585.0,
    prevClose: 1548.0,
    change: 37.0,
    changePercent: 2.39,
  } as unknown as TickData;

  const upRule: PriceAlertRule = {
    id: 'r-1',
    symbol: '600519.SH',
    stockName: '贵州茅台',
    condition: 'CHANGE_PCT_ABOVE',
    threshold: 2.0,
    enabled: true,
    triggered: false,
    createdAt: Date.now(),
  };

  assert.equal(evaluatePriceAlertRule(upRule, sampleTick), true);
  assert.equal(formatAlertConditionLabel('CHANGE_PCT_ABOVE', 2.0), '涨跌幅 ≥ +2.00%');
  assert.ok(buildAlertTriggerMessage(upRule, sampleTick).includes('贵州茅台 (600519.SH) 触发预警'));

  // 已触发或未启用的规则不应重复触发
  assert.equal(evaluatePriceAlertRule({ ...upRule, triggered: true }, sampleTick), false);
  assert.equal(evaluatePriceAlertRule({ ...upRule, enabled: false }, sampleTick), false);

  // 跌幅阈值未达到时不触发
  const downRule: PriceAlertRule = {
    ...upRule,
    id: 'r-2',
    condition: 'CHANGE_PCT_BELOW',
    threshold: -1.5,
  };
  assert.equal(evaluatePriceAlertRule(downRule, sampleTick), false);
});

import {
  calculateAuctionRadar,
  calculateBoardLadderSummary,
  calculateThemeResonance,
  calculateRegulatoryDeviation,
  calculateVWDVR,
} from './ultraShortQuant';
import { createInitialQuotes, generateIntradayForSymbol } from '../data/seedMarket';

test('09:25 竞价雷达算子：识别一字巨封、超预期抢筹、爆量兑现与竞价核按钮', () => {
  const quotes = createInitialQuotes();

  // 1. 三六零 (601360.SH): 09:25 一字巨封顶板
  const q360 = calculateAuctionRadar(quotes['601360.SH']);
  assert.equal(q360.signal, 'LOCKED_LIMIT_UP');
  assert.equal(q360.signalLabel, '一字巨封顶板');
  assert.ok(q360.amountToYesterdayRatio > 5);

  // 2. 科大讯飞 (002230.SZ): 09:25 超预期抢筹 (占昨比 11.6%)
  const qKdxf = calculateAuctionRadar(quotes['002230.SZ']);
  assert.equal(qKdxf.signal, 'SUPER_GRAB');
  assert.equal(qKdxf.signalLabel, '超预期抢筹');
  assert.equal(qKdxf.amountToYesterdayRatio, 11.6);

  // 3. 东方财富 (300059.SZ): 竞价金额占昨比 > 20% 爆量兑现预警
  const qDfcf = calculateAuctionRadar(quotes['300059.SZ']);
  assert.equal(qDfcf.signal, 'OVERHEAT_DUMP');
  assert.ok(qDfcf.amountToYesterdayRatio >= 21.0);

  // 4. 格力电器 (000651.SZ): 竞价深水核按钮
  const qGldq = calculateAuctionRadar(quotes['000651.SZ']);
  assert.equal(qGldq.signal, 'NUCLEAR_BUTTON');
  assert.ok(qGldq.unmatchedHands < -50000);
});

test('涨跌停连板梯队引擎：最高空间板、首板晋级率与断层监测 (缺失5板/4板)', () => {
  const quotes = Object.values(createInitialQuotes());
  const ladder = calculateBoardLadderSummary(quotes);

  // 最高空间板应为 6连板 三六零
  assert.equal(ladder.maxBoardHeight, 6);
  assert.equal(ladder.spaceDragonSymbol, '601360.SH');
  assert.equal(ladder.spaceDragonName, '三六零');

  // 6板 与 3板 之间缺失 5连板、4连板，必须触发断层预警
  assert.equal(ladder.hasLadderFault, true);
  assert.deepEqual(ladder.missingBoards, [5, 4]);
  assert.ok(ladder.faultWarningText.includes('5连板'));
  assert.ok(ladder.faultWarningText.includes('4连板'));

  // 封板率与晋级率校验
  assert.ok(ladder.firstToSecondRate > 0);
  assert.ok(ladder.sealSuccessRate > 60 && ladder.sealSuccessRate < 100);
});

test('题材点面共振与先锋龙身位识别：点面共振得分与先锋龙/中军龙归位', () => {
  const quotes = Object.values(createInitialQuotes());
  const themes = calculateThemeResonance(quotes);

  assert.ok(themes.length >= 5);
  // 人工智能板块含 6板三六零 + 3板科大讯飞，应排在主线强共振前列
  const aiTheme = themes.find((t) => t.sectorName === '人工智能');
  assert.ok(aiTheme);
  assert.equal(aiTheme.resonanceStatus, '主线强共振');
  assert.equal(aiTheme.pioneerDragon.symbol, '601360.SH');
  assert.equal(aiTheme.limitUpCount, 2);
});

test('注册制法定复利异动监管逆推 (k ∈ {2, 3}) 与 10日100%特停锁死预警', () => {
  const quotes = createInitialQuotes();

  // 1. 科大讯飞 (主板 20% 偏离阈值，T-2=+9.96%, T-1=+10.01%)
  const regKdxf = calculateRegulatoryDeviation(quotes['002230.SZ']);
  assert.equal(regKdxf.ruleThresholdPercent, 20);
  // k=3 复利累计涨幅已极高，k=3 的触发临界价应显著低于 k=2 触发临界价
  assert.equal(regKdxf.bindingWindowK, 3);
  assert.ok(regKdxf.triggerPrice3Day < regKdxf.triggerPrice2Day);

  // 2. 中芯国际 (科创板 30% 偏离阈值)
  const regSmic = calculateRegulatoryDeviation(quotes['688981.SH']);
  assert.equal(regSmic.ruleThresholdPercent, 30);
  assert.ok(regSmic.effectiveTriggerPrice > 95);

  // 3. 三六零 (6连板，10日累计偏离 > 95%，触发高危特停锁死预警)
  const reg360 = calculateRegulatoryDeviation(quotes['601360.SH']);
  assert.equal(reg360.severeSuspensionLockWarning, true);
  assert.ok(reg360.remainingTo100Percent < 10);
});

test('真实成交量加权承接算子 (VW-DVR)：水上筹码锁定率与回撤买盘吸收率', () => {
  const quotes = createInitialQuotes();
  const qMoutai = quotes['600519.SH'];
  const intraday = generateIntradayForSymbol(qMoutai);

  const dvr = calculateVWDVR(qMoutai, intraday);
  assert.ok(dvr.vwap > 1500);
  assert.ok(dvr.vwDvrScore >= 5 && dvr.vwDvrScore <= 100);
  assert.ok(dvr.aboveVwapVolumeRatio >= 0 && dvr.aboveVwapVolumeRatio <= 100);

  // 跌停股格力电器应表现为承接衰竭
  const qGree = quotes['000651.SZ'];
  const dvrGree = calculateVWDVR(qGree, generateIntradayForSymbol(qGree));
  assert.equal(dvrGree.signal, 'WEAK_DISTRIBUTION');
  assert.ok(dvrGree.vwDvrScore < 48);
});


