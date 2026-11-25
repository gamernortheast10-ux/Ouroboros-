import {
  CommunityChatUsage,
  CommunityMessage,
  MarketAsset,
  NewsItem,
  PredictionMarket,
  TimeHorizon,
} from '../types/trading';

export const DAILY_COMMUNITY_CHAT_LIMIT = 2;

export interface CandlePoint {
  index: number;
  label: string;
  open: number;
  high: number;
  low: number;
  close: number;
  bullish: boolean;
}

export interface PatternAnalysis {
  patternName: string;
  bias: 'Bullish' | 'Bearish' | 'Consolidation';
  support: number;
  resistance: number;
  smaSeries: number[];
  upperChannel: number[];
  lowerChannel: number[];
}

const HORIZON_VOLATILITY: Record<TimeHorizon, number> = {
  '15s': 0.0025,
  '30s': 0.0035,
  '1m': 0.0055,
  '5m': 0.0085,
  '15m': 0.011,
  '1h': 0.014,
  '4h': 0.019,
  '1d': 0.024,
  '24h': 0.024,
  '7d': 0.042,
};

export function buildOhlcCandles(
  history: number[],
  currentPrice: number,
  horizon: TimeHorizon = '5m',
  candleCount = 16
): CandlePoint[] {
  const baseSeries = history.length >= 2 ? [...history] : [currentPrice * 0.99, currentPrice];
  // Interpolate smoothly to guarantee requested candle count ending at currentPrice
  const expanded: number[] = [];
  for (let i = 0; i < candleCount; i++) {
    const pos = (i / Math.max(1, candleCount - 1)) * (baseSeries.length - 1);
    const loIdx = Math.floor(pos);
    const hiIdx = Math.min(baseSeries.length - 1, loIdx + 1);
    const frac = pos - loIdx;
    const interpolated = baseSeries[loIdx] * (1 - frac) + baseSeries[hiIdx] * frac;
    const microRipple = Math.sin(i * 1.65 + currentPrice * 0.13) * (HORIZON_VOLATILITY[horizon] * 0.45) * interpolated;
    expanded.push(i === candleCount - 1 ? currentPrice : Math.max(0.5, interpolated + microRipple));
  }

  const vol = HORIZON_VOLATILITY[horizon] ?? 0.0085;
  const candles: CandlePoint[] = [];

  for (let i = 0; i < expanded.length; i++) {
    const close = Number(expanded[i].toFixed(2));
    const open =
      i === 0
        ? Number((close * (1 - Math.sin(currentPrice) * vol * 0.6)).toFixed(2))
        : candles[i - 1].close;
    const bodyHigh = Math.max(open, close);
    const bodyLow = Math.min(open, close);
    const wickUp = bodyHigh * (vol * (0.45 + Math.abs(Math.sin(i * 2.1 + 0.7)) * 0.8));
    const wickDown = bodyLow * (vol * (0.45 + Math.abs(Math.cos(i * 1.9 + 0.3)) * 0.8));
    const high = Number((bodyHigh + wickUp).toFixed(2));
    const low = Number(Math.max(0.1, bodyLow - wickDown).toFixed(2));

    candles.push({
      index: i,
      label: `T-${candleCount - 1 - i}`,
      open,
      high,
      low,
      close,
      bullish: close >= open,
    });
  }

  return candles;
}

export function analyzeChartPattern(values: number[]): PatternAnalysis {
  const series = values.length >= 3 ? values : [100, 101, 102];
  const minVal = Math.min(...series);
  const maxVal = Math.max(...series);
  const first = series[0];
  const last = series[series.length - 1];
  const mid = series[Math.floor(series.length / 2)];
  const pctMove = first > 0 ? ((last - first) / first) * 100 : 0;

  const smaSeries = series.map((_, i) => {
    const start = Math.max(0, i - 2);
    const slice = series.slice(start, i + 1);
    const avg = slice.reduce((s, v) => s + v, 0) / slice.length;
    return Number(avg.toFixed(2));
  });

  const spread = Math.max((maxVal - minVal) * 0.14, last * 0.004);
  const upperChannel = series.map((_, i) => {
    const t = i / Math.max(1, series.length - 1);
    const slope = (last - first) * 0.55;
    return Number((maxVal - (maxVal - first) * (1 - t) * 0.25 + slope * t * 0.2 + spread * 0.5).toFixed(2));
  });
  const lowerChannel = series.map((_, i) => {
    const t = i / Math.max(1, series.length - 1);
    const slope = (last - first) * 0.55;
    return Number((minVal + (last - minVal) * t * 0.25 + slope * t * 0.2 - spread * 0.5).toFixed(2));
  });

  let patternName = 'Range Consolidation';
  let bias: PatternAnalysis['bias'] = 'Consolidation';

  if (pctMove > 1.2) {
    patternName = last > mid && mid > first ? 'Ascending Impulse Channel' : 'Bullish Cup Breakout';
    bias = 'Bullish';
  } else if (pctMove < -1.2) {
    patternName = last < mid && mid < first ? 'Descending Supply Channel' : 'Bearish Flag Breakdown';
    bias = 'Bearish';
  } else if (last >= smaSeries[smaSeries.length - 1]) {
    patternName = 'Higher-Low Support Coil';
    bias = 'Bullish';
  } else {
    patternName = 'Symmetrical Triangle Compression';
    bias = 'Consolidation';
  }

  return {
    patternName,
    bias,
    support: Number(minVal.toFixed(2)),
    resistance: Number(maxVal.toFixed(2)),
    smaSeries,
    upperChannel,
    lowerChannel,
  };
}

export function getTodayDateKey(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getCommunityRemainingCount(
  usage: CommunityChatUsage | undefined,
  todayKey: string = getTodayDateKey()
): number {
  if (!usage || usage.date !== todayKey) {
    return DAILY_COMMUNITY_CHAT_LIMIT;
  }
  return Math.max(0, DAILY_COMMUNITY_CHAT_LIMIT - usage.count);
}

export function postCommunityMessage(params: {
  messages: CommunityMessage[];
  usage: CommunityChatUsage | undefined;
  username: string;
  text: string;
  todayKey?: string;
}):
  | {
      ok: true;
      nextMessages: CommunityMessage[];
      nextUsage: CommunityChatUsage;
      remaining: number;
    }
  | { ok: false; error: string } {
  const todayKey = params.todayKey ?? getTodayDateKey();
  const cleanText = params.text.trim();
  if (!cleanText) {
    return { ok: false, error: 'Please write a message first.' };
  }
  const currentCount =
    params.usage && params.usage.date === todayKey ? params.usage.count : 0;

  if (currentCount >= DAILY_COMMUNITY_CHAT_LIMIT) {
    return {
      ok: false,
      error: `Daily limit of ${DAILY_COMMUNITY_CHAT_LIMIT} messages reached. Try again tomorrow.`,
    };
  }

  const nextCount = currentCount + 1;
  const cleanHandle = params.username.trim().replace(/\s+/g, '_') || 'Trader';
  const nextMessage: CommunityMessage = {
    id: `cm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    username: cleanHandle,
    text: cleanText.slice(0, 220),
  };

  return {
    ok: true,
    nextMessages: [...params.messages, nextMessage],
    nextUsage: { date: todayKey, count: nextCount },
    remaining: Math.max(0, DAILY_COMMUNITY_CHAT_LIMIT - nextCount),
  };
}

export function generateAutoNewsItem(
  assets: MarketAsset[],
  predictions: PredictionMarket[],
  tickIndex: number
): NewsItem {
  const totalSlots = assets.length + predictions.length;
  const slot = tickIndex % Math.max(1, totalSlots);
  const nowStr = new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (slot < assets.length) {
    const asset = assets[slot];
    const isUp = asset.changePct >= 0;
    return {
      id: `news-auto-${Date.now()}-${asset.id}`,
      ticker: asset.symbol,
      assetId: asset.id,
      topicKind: 'stock',
      sentiment: isUp ? 'BULLISH' : 'BEARISH',
      date: `Live · ${nowStr}`,
      title: `${asset.symbol} (${asset.name}) Desk Pulse: ${
        isUp ? 'Buyer Momentum Builds' : 'Short Pressure & Pullback Watch'
      }`,
      summary: `${asset.symbol} is trading at ₹${asset.price.toFixed(2)} (${
        isUp ? '+' : ''
      }${asset.changePct.toFixed(2)}%) in ${asset.category}. Active pool liquidity stands at ₹${Math.round(
        asset.longPoolAmount + asset.shortPoolAmount
      ).toLocaleString('en-IN')}.`,
      comments: [],
    };
  }

  const market = predictions[slot - assets.length] ?? predictions[0];
  const yesLeading = market.yesPool >= market.noPool;
  const totalBettors = market.yesBettors + market.noBettors;

  return {
    id: `news-auto-${Date.now()}-${market.id}`,
    ticker: market.subLabel.split('·')[0].trim().toUpperCase(),
    marketId: market.id,
    topicKind: 'bet',
    sentiment: yesLeading ? 'BULLISH' : 'NEUTRAL',
    date: `Live · ${nowStr}`,
    title: `Bet Pool Update: ${market.question}`,
    summary: `${totalBettors.toLocaleString('en-IN')} active traders positioned on ${
      market.subLabel
    }. Pool flow currently favors ${yesLeading ? 'YES' : 'NO'} (${market.endLabel}).`,
    comments: [],
  };
}

const COMMUNITY_NICK_PREFIXES = [
  'Aarav', 'Karan', 'Pooja', 'Ritik', 'Sneha', 'Nikhil', 'Zoya', 'Rohit',
  'Anjali', 'Vikas', 'Tanvi', 'Sameer', 'Ishita', 'Harsh', 'Diya', 'Yash',
  'Manish', 'Kriti', 'Arpit', 'Nandini', 'Kabir', 'Riya', 'Siddharth', 'Meera',
  'Dev', 'Tanya', 'Pranav', 'Neha', 'Vikram', 'Aryan', 'Sana', 'Gaurav',
  'Simran', 'Deepak', 'Shreya', 'Kunal', 'Aditi', 'Rohan', 'Farhan', 'Payal',
  'Sagar', 'Mansi', 'Nitin', 'Bhavna', 'Tushar', 'Ankita', 'Varun', 'Rashmi',
];

const HANDLE_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789';

export function generateUniqueCommunityHandle(
  existingHandles: Set<string> = new Set(),
  seed = Date.now()
): string {
  for (let attempt = 0; attempt < 16; attempt++) {
    const prefixIdx = Math.floor(
      Math.abs(Math.sin(seed * 0.13 + attempt * 7.1 + Math.random() * 100)) *
        COMMUNITY_NICK_PREFIXES.length
    ) % COMMUNITY_NICK_PREFIXES.length;
    const prefix = COMMUNITY_NICK_PREFIXES[prefixIdx];
    const sep = attempt % 2 === 0 ? '_' : '';
    const suffixLen = 3 + (attempt % 3);
    let suffix = '';
    for (let i = 0; i < suffixLen; i++) {
      const charIdx = Math.floor(Math.random() * HANDLE_CHARS.length);
      suffix += HANDLE_CHARS[charIdx];
    }
    const candidate = `${prefix}${sep}${suffix}`;
    if (!existingHandles.has(candidate)) {
      return candidate;
    }
  }
  return `Trader_${Date.now().toString(36).slice(-5)}`;
}

export function generateLiveCommunityMessage(
  assets: MarketAsset[],
  predictions: PredictionMarket[],
  recentMessages: CommunityMessage[] = [],
  nowMs = Date.now()
): CommunityMessage {
  const existingHandles = new Set(recentMessages.map((m) => m.username));
  const username = generateUniqueCommunityHandle(existingHandles, nowMs);

  const depositAmounts = [100, 200, 300, 500, 1000, 1500, 2000, 5000];
  const tradeAmounts = [100, 250, 500, 1000, 1500, 2500];
  const depAmt = depositAmounts[Math.floor(Math.random() * depositAmounts.length)];
  const tradeAmt = tradeAmounts[Math.floor(Math.random() * tradeAmounts.length)];
  const winAmt = Math.round(tradeAmt * (1.45 + Math.random() * 1.1));

  const asset =
    assets[Math.floor(Math.random() * Math.max(1, assets.length))] ?? {
      symbol: 'APPLE',
    };
  const market =
    predictions[Math.floor(Math.random() * Math.max(1, predictions.length))] ?? {
      subLabel: 'GTA VI',
    };
  const marketShort = market.subLabel.split('·')[0].trim();
  const dir = Math.random() >= 0.45 ? 'UP' : 'DOWN';
  const voteChoice = Math.random() >= 0.5 ? 'YES' : 'NO';

  const templates = [
    `Maine ₹${depAmt} deposit kiya UPI se, turant wallet mein aa gaya`,
    `Maine ₹${tradeAmt.toLocaleString('en-IN')} vote daal diya ${marketShort} ${voteChoice} pe`,
    `Just deposited ₹${depAmt.toLocaleString('en-IN')} via GPay — instant credit!`,
    `${asset.symbol} pe ₹${tradeAmt.toLocaleString('en-IN')} ${dir} trade lagaya abhi`,
    `Chicken Road pe ₹${winAmt.toLocaleString('en-IN')} cashout kiya just now`,
    `Color Predict green round hit! +₹${winAmt.toLocaleString('en-IN')} profit`,
    `PhonePe se ₹${depAmt.toLocaleString('en-IN')} add kiya wallet mein, live khel raha hu`,
    `${asset.symbol} 1m chart pe +₹${winAmt.toLocaleString('en-IN')} win hua`,
    `Mines game mein 4 safe gems nikle, ₹${winAmt.toLocaleString('en-IN')} claim kiya`,
    `Maine ₹${tradeAmt.toLocaleString('en-IN')} ka ${dir} position liya ${asset.symbol} pe`,
    `Daily check-in bonus aur ₹${depAmt} deposit dono ready hai`,
    `Crypto Jackpot vault spin se ₹${winAmt.toLocaleString('en-IN')} win mila`,
  ];

  const recentTexts = new Set(recentMessages.slice(-6).map((m) => m.text));
  let text = templates[Math.floor(Math.random() * templates.length)];
  for (let i = 0; i < templates.length && recentTexts.has(text); i++) {
    text = templates[i];
  }

  return {
    id: `cm-live-${nowMs}-${Math.random().toString(36).slice(2, 6)}`,
    username,
    text,
  };
}

