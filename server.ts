import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import {
  applyScenarioToQuote,
  buildOrderBookForPhase,
  createInitialIndices,
  createInitialQuotes,
  generateIntradayForSymbol,
  generateKLinesForSymbol,
} from './src/data/seedMarket.ts';
import type {
  ChartPeriod,
  MarketIndexQuote,
  MarketScenario,
  TickData,
  TradeTick,
  WSClientMessage,
  WSServerMessage,
} from './src/types/market.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

/**
 * 服务端权威行情状态库 (Authoritative Level-1 State Store)
 */
const quotesStore: Record<string, TickData> = createInitialQuotes();
const indicesStore: Record<string, MarketIndexQuote> = createInitialIndices();

/**
 * 数据推流节流缓冲区 (Snapshot Batch Throttle Buffer)
 * 上游高频 Tick 仅更新 dirty 字典，由 150ms (100ms ~ 200ms 区间) 定时器合并下发，
 * 严禁“上游推一条、WebSocket 下发一条”。
 */
const dirtyQuotes = new Map<string, TickData>();
const dirtyIndices = new Map<string, MarketIndexQuote>();
let batchWindowMs = 150; // 默认 150ms 窗口快照合并 (符合 100ms ~ 200ms 规范)
let tickSequence = 0;

function formatNowTime(): string {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

/**
 * 模拟上游高频 Level-1 行情源产生 Tick（每 35ms 产生一次微跳动，写入快照合并缓冲区）
 */
function simulateUpstreamTick(): void {
  tickSequence++;
  const symbols = Object.keys(quotesStore);
  const symbol = symbols[tickSequence % symbols.length];
  const current = quotesStore[symbol];
  if (!current) return;

  const updated: TickData = {
    ...current,
    orderBook: {
      bids: [...current.orderBook.bids] as TickData['orderBook']['bids'],
      asks: [...current.orderBook.asks] as TickData['orderBook']['asks'],
    },
    recentTrades: [...current.recentTrades],
  };

  const step = updated.price >= 100 ? 0.05 : 0.01;
  const tradeHands = Math.max(1, Math.round((updated.price > 500 ? 8 : updated.price > 100 ? 45 : 180) * (0.3 + Math.random() * 1.4)));

  if (updated.phase === 'LIMIT_UP') {
    // 涨停状态：价格锁死在涨停价，卖一至卖五保持为空档 null，仅买一封单量与成交量轻微变动
    updated.price = updated.limitUpPrice;
    updated.orderBook = buildOrderBookForPhase(
      updated.price,
      'LIMIT_UP',
      updated.limitUpPrice,
      updated.limitDownPrice,
      tickSequence % 60
    );
  } else if (updated.phase === 'LIMIT_DOWN') {
    // 跌停状态：价格锁死在跌停价，买一至买五保持为空档 null
    updated.price = updated.limitDownPrice;
    updated.orderBook = buildOrderBookForPhase(
      updated.price,
      'LIMIT_DOWN',
      updated.limitUpPrice,
      updated.limitDownPrice,
      tickSequence % 60
    );
  } else if (updated.phase === 'CALL_AUCTION') {
    // 集合竞价阶段：仅买一/卖一匹配量轻微变动，3~5档保持空档 null
    const jitter = (Math.random() - 0.49) * step;
    updated.price = Number(
      Math.min(updated.limitUpPrice, Math.max(updated.limitDownPrice, updated.price + jitter)).toFixed(2)
    );
    updated.orderBook = buildOrderBookForPhase(
      updated.price,
      'CALL_AUCTION',
      updated.limitUpPrice,
      updated.limitDownPrice,
      tickSequence % 80
    );
  } else {
    // 正常连续竞价交易
    const deltaTicks = Math.random() > 0.485 ? 1 : -1;
    const priceDelta = (Math.random() > 0.35 ? deltaTicks : 0) * step;
    const nextPrice = Number(
      Math.min(updated.limitUpPrice, Math.max(updated.limitDownPrice, updated.price + priceDelta)).toFixed(2)
    );
    updated.price = nextPrice;
    if (nextPrice > updated.high) updated.high = nextPrice;
    if (nextPrice < updated.low) updated.low = nextPrice;

    updated.volume += tradeHands;
    updated.amount += Math.round(tradeHands * 100 * nextPrice);
    const isBuy = priceDelta >= 0;
    if (isBuy) {
      updated.outerVolume += tradeHands;
    } else {
      updated.innerVolume += tradeHands;
    }

    const newTrade: TradeTick = {
      id: `t-${Date.now()}-${tickSequence}`,
      time: formatNowTime(),
      price: nextPrice,
      volume: tradeHands,
      side: priceDelta > 0 ? 'BUY' : priceDelta < 0 ? 'SELL' : Math.random() > 0.5 ? 'BUY' : 'SELL',
    };
    updated.recentTrades = [newTrade, ...updated.recentTrades.slice(0, 29)];
    updated.orderBook = buildOrderBookForPhase(
      updated.price,
      'TRADING',
      updated.limitUpPrice,
      updated.limitDownPrice,
      tickSequence
    );
  }

  updated.change = Number((updated.price - updated.prevClose).toFixed(2));
  updated.changePercent = Number(((updated.change / updated.prevClose) * 100).toFixed(2));
  updated.amplitude = Number((((updated.high - updated.low) / updated.prevClose) * 100).toFixed(2));
  updated.updatedAt = Date.now();

  quotesStore[symbol] = updated;
  dirtyQuotes.set(symbol, updated);

  // 每 3 次 Tick 同步微调一个核心指数
  if (tickSequence % 3 === 0) {
    const idxKeys = Object.keys(indicesStore);
    const idxSymbol = idxKeys[(tickSequence / 3) % idxKeys.length];
    const curIdx = indicesStore[idxSymbol];
    if (curIdx) {
      const idxDelta = Number(((Math.random() - 0.49) * (curIdx.price * 0.0004)).toFixed(2));
      const nextIdxPrice = Number((curIdx.price + idxDelta).toFixed(2));
      const nextIdxChange = Number((nextIdxPrice - curIdx.prevClose).toFixed(2));
      const nextIdxPercent = Number(((nextIdxChange / curIdx.prevClose) * 100).toFixed(2));
      const updatedIdx: MarketIndexQuote = {
        ...curIdx,
        price: nextIdxPrice,
        change: nextIdxChange,
        changePercent: nextIdxPercent,
        amount: Number((curIdx.amount + Math.random() * 1.8).toFixed(1)),
      };
      indicesStore[idxSymbol] = updatedIdx;
      dirtyIndices.set(idxSymbol, updatedIdx);
    }
  }
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // 1. REST API: 获取全市场初始 Level-1 快照
  app.get('/api/market/snapshot', (_req, res) => {
    res.json({
      quotes: quotesStore,
      indices: indicesStore,
      batchWindowMs,
      serverTime: Date.now(),
    });
  });

  // 2. REST API: 获取指定股票的 K 线与分时图序列
  app.get('/api/market/klines/:symbol', (req, res) => {
    const { symbol } = req.params;
    const period = ((req.query.period as ChartPeriod) || '1D') as ChartPeriod;
    const quote = quotesStore[symbol] || Object.values(quotesStore)[0];

    if (!quote) {
      res.status(404).json({ error: 'Stock symbol not found' });
      return;
    }

    if (period === 'intraday') {
      res.json({
        symbol: quote.symbol,
        period: 'intraday',
        prevClose: quote.prevClose,
        intraday: generateIntradayForSymbol(quote),
      });
      return;
    }

    res.json({
      symbol: quote.symbol,
      period,
      prevClose: quote.prevClose,
      klines: generateKLinesForSymbol(quote, period, 120),
    });
  });

  // 3. REST API: 切换某只股票的特殊盘口场景（正常交易 / 涨停空卖盘 / 跌停空买盘 / 集合竞价空档）
  app.post('/api/market/scenario', (req, res) => {
    const { symbol, scenario } = req.body as { symbol?: string; scenario?: MarketScenario };
    if (!symbol || !quotesStore[symbol] || !scenario) {
      res.status(400).json({ error: 'Invalid symbol or scenario' });
      return;
    }
    const updated = applyScenarioToQuote(quotesStore[symbol], scenario);
    quotesStore[symbol] = updated;
    dirtyQuotes.set(symbol, updated);
    res.json({ ok: true, quote: updated });
  });

  const server = http.createServer(app);

  // 4. WebSocket 服务端 (使用 noServer 模式精准接管 upgrade，避免 ws 库拦截非 /ws 升级请求导致 @vite/client 报错)
  const wss = new WebSocketServer({ noServer: true });
  const viteHmrWss = new WebSocketServer({ noServer: true });

  viteHmrWss.on('connection', (ws: WebSocket) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'connected' }));
    }
  });

  server.on('upgrade', (req, socket, head) => {
    const pathname = req.url ? req.url.split('?')[0] : '/';
    if (pathname === '/ws') {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    } else {
      // 兼容任何来自 @vite/client 的 HMR WebSocket 握手请求，防止出现 "WebSocket closed without opened"
      viteHmrWss.handleUpgrade(req, socket, head, (ws) => {
        viteHmrWss.emit('connection', ws, req);
      });
    }
  });

  wss.on('connection', (ws: WebSocket) => {
    // 连接建立后立即下发一次全量 Level-1 初始快照
    const initMsg: WSServerMessage = {
      type: 'INIT_SNAPSHOT',
      quotes: quotesStore,
      indices: indicesStore,
      batchWindowMs,
      serverTime: Date.now(),
    };
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(initMsg));
    }

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as WSClientMessage;
        if (msg.type === 'PING') {
          const pong: WSServerMessage = {
            type: 'PONG',
            clientTimestamp: msg.timestamp,
            serverTime: Date.now(),
          };
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(pong));
          }
        } else if (msg.type === 'SET_BATCH_WINDOW') {
          // 强制约束节流时间窗在 100ms ~ 200ms 规范区间内
          const clamped = Math.max(100, Math.min(200, Math.round(msg.windowMs)));
          batchWindowMs = clamped;
        }
      } catch {
        // 忽略非法 JSON
      }
    });
  });

  // 启动上游高频 Tick 发生器 (每 40ms 产生一次内部状态更新)
  setInterval(simulateUpstreamTick, 40);

  // 启动服务端时间窗口快照合并推送器 (150ms Snapshot Batch Throttle)
  const flushSnapshotBatch = () => {
    if ((dirtyQuotes.size > 0 || dirtyIndices.size > 0) && wss.clients.size > 0) {
      const payload: WSServerMessage = {
        type: 'SNAPSHOT_BATCH',
        quotes: Array.from(dirtyQuotes.values()),
        indices: Array.from(dirtyIndices.values()),
        batchWindowMs,
        serverTime: Date.now(),
      };
      const serialized = JSON.stringify(payload);
      dirtyQuotes.clear();
      dirtyIndices.clear();

      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(serialized);
        }
      });
    }
    setTimeout(flushSnapshotBatch, batchWindowMs);
  };
  setTimeout(flushSnapshotBatch, batchWindowMs);

  // 5. 挂载 Vite 开发中间件或生产静态资源
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        watch: null,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[AlphaPulse L1 Server] Running on http://0.0.0.0:${PORT} (WS Snapshot Throttle: ${batchWindowMs}ms)`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
