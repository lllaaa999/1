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
} from './marketCalc';
import type { KLineBar, OrderBook5, TickData } from '../types/market';

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
