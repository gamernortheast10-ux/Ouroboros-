import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  BarChart2,
  CandlestickChart,
  Clock,
  History,
  Layers,
  Maximize2,
  Minimize2,
  RotateCw,
  Search,
  TrendingUp,
  Trophy,
} from 'lucide-react';
import {
  AppState,
  MarketAsset,
  MarketCategory,
  TimeHorizon,
  TradeSide,
} from '../types/trading';
import {
  CandlePoint,
  analyzeChartPattern,
  buildOhlcCandles,
} from '../utils/chartPatterns';
import { t } from '../utils/i18n';
import {
  calculatePoolPercentages,
  calculatePositionPnl,
  calculateTradeFees,
  formatCurrency,
  getHorizonLeverage,
  validateTradeStake,
} from '../utils/tradingEngine';
import { AssetBadge } from './BrandMark';
import { MiniCandleBars } from './SparklineChart';

interface TradeTerminalViewProps {
  state: AppState;
  nowMs?: number;
  initialAssetId?: string | null;
  onBack: () => void;
  onExecuteTrade: (params: {
    assetId: string;
    side: TradeSide;
    horizon: TimeHorizon;
    stake: number;
  }) => void;
  onClosePosition?: (positionId: string) => void;
}

type ChartMode = 'candles' | 'line' | 'pattern';

const CATEGORIES: MarketCategory[] = [
  'All Markets',
  'Mobile Brands',
  'Famous Games',
  'Crypto',
  'Sports',
  'Political',
];

const TIMEFRAMES: { id: TimeHorizon; label: string }[] = [
  { id: '15s', label: '15s' },
  { id: '30s', label: '30s' },
  { id: '1m', label: '1m' },
  { id: '5m', label: '5m' },
  { id: '15m', label: '15m' },
  { id: '1h', label: '1h' },
  { id: '4h', label: '4h' },
  { id: '1d', label: '1d' },
  { id: '7d', label: '7d' },
];

const QUICK_STAKES = [100, 500, 1000, 2500];

function formatTimerClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const TradeTerminalView: React.FC<TradeTerminalViewProps> = ({
  state,
  nowMs,
  initialAssetId = null,
  onBack,
  onExecuteTrade,
  onClosePosition,
}) => {
  const [category, setCategory] = useState<MarketCategory>('All Markets');
  const [search, setSearch] = useState('');
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(initialAssetId);
  const [chartMode, setChartMode] = useState<ChartMode>('candles');
  const [chartTf, setChartTf] = useState<TimeHorizon>('30s');
  const [duration, setDuration] = useState<TimeHorizon>('30s');
  const [side, setSide] = useState<TradeSide>('long');
  const [stakeInput, setStakeInput] = useState<string>('500');
  const [hoveredCandle, setHoveredCandle] = useState<CandlePoint | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isRotated, setIsRotated] = useState(false);
  const [historyScope, setHistoryScope] = useState<'all' | 'asset'>('all');
  const [localNow, setLocalNow] = useState(() => nowMs ?? Date.now());

  useEffect(() => {
    setSelectedAssetId(initialAssetId);
  }, [initialAssetId]);

  useEffect(() => {
    if (typeof nowMs === 'number') {
      setLocalNow(nowMs);
      return;
    }
    const id = window.setInterval(() => setLocalNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [nowMs]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && (isFullscreen || isRotated)) {
        setIsFullscreen(false);
        setIsRotated(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isFullscreen, isRotated]);

  const effectiveNow = nowMs ?? localNow;
  const currency = state.profile.baseCurrency;
  const fxRates = state.fxRates;
  const lang = state.profile.language;

  const filteredAssets = useMemo(() => {
    const q = search.trim().toLowerCase();
    return state.assets.filter((a) => {
      const catOk = category === 'All Markets' || a.category === category;
      const qOk =
        !q ||
        a.symbol.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q);
      return catOk && qOk;
    });
  }, [state.assets, category, search]);

  const activeAsset: MarketAsset | null = useMemo(() => {
    if (!selectedAssetId) return null;
    return state.assets.find((a) => a.id === selectedAssetId) ?? null;
  }, [selectedAssetId, state.assets]);

  const candles = useMemo(() => {
    if (!activeAsset) return [];
    return buildOhlcCandles(activeAsset.history, activeAsset.price, chartTf, 24);
  }, [activeAsset, chartTf]);

  const patternInfo = useMemo(() => {
    if (!activeAsset) return null;
    const closes = candles.map((c) => c.close);
    return analyzeChartPattern(closes);
  }, [activeAsset, candles]);

  const openPositions = useMemo(
    () => state.positions.filter((p) => p.status === 'open'),
    [state.positions]
  );

  const closedPositions = useMemo(() => {
    const allClosed = state.positions.filter((p) => p.status === 'closed');
    if (historyScope === 'asset' && activeAsset) {
      return allClosed.filter((p) => p.assetId === activeAsset.id);
    }
    return allClosed;
  }, [state.positions, historyScope, activeAsset]);

  const tradeTxHistory = useMemo(() => {
    return state.transactions
      .filter(
        (tx) =>
          tx.type === 'trade_close' ||
          tx.type === 'trade_open' ||
          tx.type === 'trade_refund'
      )
      .filter((tx) => {
        if (historyScope === 'asset' && activeAsset) {
          return tx.title.toUpperCase().includes(activeAsset.symbol.toUpperCase());
        }
        return true;
      })
      .slice(0, 12);
  }, [state.transactions, historyScope, activeAsset]);

  const numericStake = Number(stakeInput) || 0;
  const fees = calculateTradeFees(numericStake);
  const stakeCheck = validateTradeStake(numericStake, state.balance);
  const activeLeverage = getHorizonLeverage(duration);

  const handlePlaceOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAsset) return;
    onExecuteTrade({
      assetId: activeAsset.id,
      side,
      horizon: duration,
      stake: numericStake,
    });
  };

  const handleToggleRotate = () => {
    const next = !isRotated;
    setIsRotated(next);
    if (next) {
      setIsFullscreen(true);
      try {
        const orientation = screen.orientation as ScreenOrientation & {
          lock?: (mode: string) => Promise<void>;
        };
        void orientation?.lock?.('landscape')?.catch(() => {});
      } catch {
        // Ignore on desktop or browsers without orientation lock API
      }
    } else {
      try {
        screen.orientation?.unlock?.();
      } catch {
        // Ignore
      }
    }
  };

  const handleToggleFullscreen = () => {
    const next = !isFullscreen;
    setIsFullscreen(next);
    if (!next) {
      setIsRotated(false);
    }
  };

  // =========================================================================
  // TRADING / CHART READING SCREEN (Fullscreen & Mobile Landscape Rotatable)
  // =========================================================================
  if (activeAsset && patternInfo) {
    const pool = calculatePoolPercentages(
      activeAsset.longPoolAmount,
      activeAsset.shortPoolAmount
    );
    const allPrices = candles.flatMap((c) => [c.high, c.low]);
    const minP = Math.min(...allPrices, patternInfo.support);
    const maxP = Math.max(...allPrices, patternInfo.resistance);
    const span = Math.max(0.01, maxP - minP);
    const chartW = 680;
    const chartH = isRotated ? 170 : isFullscreen ? 290 : 250;
    const padX = 16;
    const padRight = 68;
    const padY = 18;
    const toY = (price: number) =>
      chartH - padY - ((price - minP) / span) * (chartH - padY * 2);
    const toX = (idx: number) =>
      padX + (idx / Math.max(1, candles.length - 1)) * (chartW - padX - padRight);

    const linePath = candles
      .map((c, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(c.close).toFixed(1)}`)
      .join(' ');
    const areaPath = `${linePath} L${toX(candles.length - 1).toFixed(1)},${chartH} L${toX(0).toFixed(1)},${chartH} Z`;
    const smaPath = patternInfo.smaSeries
      .map((val, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(val).toFixed(1)}`)
      .join(' ');
    const upperPath = patternInfo.upperChannel
      .map((val, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(val).toFixed(1)}`)
      .join(' ');
    const lowerPath = patternInfo.lowerChannel
      .map((val, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(val).toFixed(1)}`)
      .join(' ');

    const inspected = hoveredCandle ?? candles[candles.length - 1];
    const isUp = activeAsset.changePct >= 0;
    const lastPriceY = toY(activeAsset.price);

    const wrapperCls = isRotated
      ? 'fixed top-0 left-0 z-[70] w-[100dvh] h-[100dvw] origin-top-left rotate-90 translate-x-[100dvw] bg-[#0b0814] overflow-y-auto p-3 sm:p-4 space-y-3'
      : isFullscreen
      ? 'fixed inset-0 z-[70] bg-[#0b0814] overflow-y-auto p-3 sm:p-5 lg:p-6 space-y-4'
      : 'space-y-4 animate-fade-up';

    const sideBySideLayoutCls = isRotated
      ? 'grid grid-cols-12 gap-3 items-start'
      : isFullscreen
      ? 'grid grid-cols-1 md:grid-cols-12 landscape:grid-cols-12 gap-4 items-start'
      : 'grid grid-cols-1 lg:grid-cols-12 landscape:grid-cols-12 gap-4 items-start';

    const chartColCls = isRotated
      ? 'col-span-7'
      : isFullscreen
      ? 'md:col-span-7 lg:col-span-8 landscape:col-span-7'
      : 'lg:col-span-8 landscape:col-span-7';

    const orderColCls = isRotated
      ? 'col-span-5'
      : isFullscreen
      ? 'md:col-span-5 lg:col-span-4 landscape:col-span-5'
      : 'lg:col-span-4 landscape:col-span-5';

    return (
      <div className={wrapperCls} data-fullscreen={isFullscreen ? 'true' : 'false'} data-rotated={isRotated ? 'true' : 'false'}>
        {/* Sticky Trading Header */}
        <header className="sticky top-0 z-30 rounded-2xl bg-[#15101f] border border-white/[0.08] px-3.5 py-2.5 sm:px-4 sm:py-3 flex flex-wrap items-center justify-between gap-2.5 shadow-[0_8px_24px_rgba(0,0,0,0.2)]">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => {
                if (isFullscreen || isRotated) {
                  setIsFullscreen(false);
                  setIsRotated(false);
                } else {
                  setSelectedAssetId(null);
                  setHoveredCandle(null);
                }
              }}
              aria-label={isFullscreen || isRotated ? 'Exit fullscreen view' : 'Back to all listed markets'}
              className="btn-press w-9 h-9 rounded-xl bg-[#191928] border border-white/10 flex items-center justify-center text-white shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <AssetBadge asset={activeAsset} size="sm" />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="font-display text-sm sm:text-base font-extrabold text-white truncate">
                  {activeAsset.symbol}
                </h1>
                <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-[#7c3aed]/20 text-[#a78bfa] whitespace-nowrap">
                  {activeAsset.category}
                </span>
              </div>
              <p className="text-[11px] text-[#94a3b8] truncate">{activeAsset.name}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 ml-auto">
            <div className="text-right">
              <div className="text-base sm:text-lg font-extrabold font-mono-nums text-white leading-tight">
                {formatCurrency(activeAsset.price, currency, fxRates)}
              </div>
              <div
                className={`text-[11px] font-bold font-mono-nums ${
                  isUp ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {isUp ? '+' : ''}
                {activeAsset.changePct.toFixed(2)}% Live
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleToggleRotate}
                aria-label={isRotated ? 'Exit landscape rotation' : 'Rotate screen to landscape'}
                title={isRotated ? 'Exit Rotate' : 'Rotate Landscape'}
                className={`btn-press min-h-[36px] px-2.5 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 ${
                  isRotated
                    ? 'preserve-white bg-[#7c3aed] border-[#8b5cf6] text-white'
                    : 'bg-[#191928] border-white/10 text-white hover:border-[#8b5cf6]/50'
                }`}
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{isRotated ? 'Exit Rotate' : 'Rotate'}</span>
              </button>

              <button
                type="button"
                onClick={handleToggleFullscreen}
                aria-label={isFullscreen ? 'Minimize fullscreen chart' : 'Open fullscreen chart'}
                title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                className={`btn-press min-h-[36px] px-2.5 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 ${
                  isFullscreen && !isRotated
                    ? 'preserve-white bg-[#7c3aed] border-[#8b5cf6] text-white'
                    : 'bg-[#191928] border-white/10 text-white hover:border-[#8b5cf6]/50'
                }`}
              >
                {isFullscreen ? (
                  <Minimize2 className="w-3.5 h-3.5" />
                ) : (
                  <Maximize2 className="w-3.5 h-3.5" />
                )}
                <span className="hidden sm:inline">
                  {isFullscreen ? 'Exit Full' : 'Fullscreen'}
                </span>
              </button>
            </div>
          </div>
        </header>

        {/* Chart + Place Trade Order Side-by-Side (Desktop / Fullscreen / Landscape) */}
        <div className={sideBySideLayoutCls}>
          {/* Chart Panel */}
          <section
            className={`${chartColCls} rounded-[22px] bg-[#15101f] border border-white/[0.08] p-3.5 sm:p-4 space-y-3`}
          >
            {/* Chart Mode + Timeframes */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div
                className="inline-flex p-1 rounded-xl bg-[#0b0814] border border-white/[0.06]"
                role="tablist"
                aria-label="Chart type selector"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={chartMode === 'candles'}
                  onClick={() => setChartMode('candles')}
                  className={`btn-press min-h-[32px] px-2.5 rounded-lg text-xs font-bold inline-flex items-center gap-1 ${
                    chartMode === 'candles'
                      ? 'preserve-white bg-[#7c3aed] text-white shadow-sm'
                      : 'text-[#94a3b8] hover:text-white'
                  }`}
                >
                  <CandlestickChart className="w-3.5 h-3.5" />
                  Candles
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={chartMode === 'line'}
                  onClick={() => setChartMode('line')}
                  className={`btn-press min-h-[32px] px-2.5 rounded-lg text-xs font-bold inline-flex items-center gap-1 ${
                    chartMode === 'line'
                      ? 'preserve-white bg-[#7c3aed] text-white shadow-sm'
                      : 'text-[#94a3b8] hover:text-white'
                  }`}
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  Line
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={chartMode === 'pattern'}
                  onClick={() => setChartMode('pattern')}
                  className={`btn-press min-h-[32px] px-2.5 rounded-lg text-xs font-bold inline-flex items-center gap-1 ${
                    chartMode === 'pattern'
                      ? 'preserve-white bg-[#7c3aed] text-white shadow-sm'
                      : 'text-[#94a3b8] hover:text-white'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  Pattern
                </button>
              </div>

              {/* 15s – 7d Timeframes */}
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                {TIMEFRAMES.map((tf) => (
                  <button
                    key={tf.id}
                    type="button"
                    onClick={() => setChartTf(tf.id)}
                    className={`btn-press px-2.5 py-1 rounded-lg text-[11px] font-bold font-mono-nums whitespace-nowrap ${
                      chartTf === tf.id
                        ? 'preserve-white bg-[#7c3aed] text-white'
                        : 'bg-[#0b0814] text-[#94a3b8] hover:text-white'
                    }`}
                  >
                    {tf.label}
                  </button>
                ))}
              </div>
            </div>

            {/* OHLC + Pattern Strip */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[#0b0814] border border-white/[0.06] text-[11px] font-mono-nums">
              {inspected ? (
                <div className="flex flex-wrap items-center gap-2.5 sm:gap-3.5">
                  <span>
                    O: <strong className="text-white">{formatCurrency(inspected.open, currency, fxRates)}</strong>
                  </span>
                  <span>
                    H: <strong className="text-emerald-400">{formatCurrency(inspected.high, currency, fxRates)}</strong>
                  </span>
                  <span>
                    L: <strong className="text-rose-400">{formatCurrency(inspected.low, currency, fxRates)}</strong>
                  </span>
                  <span>
                    C: <strong className="text-white">{formatCurrency(inspected.close, currency, fxRates)}</strong>
                  </span>
                </div>
              ) : null}

              <div className="flex items-center gap-1.5">
                <span className="text-[#94a3b8]">Pattern:</span>
                <span
                  className={`font-bold ${
                    patternInfo.bias === 'Bullish'
                      ? 'text-emerald-400'
                      : patternInfo.bias === 'Bearish'
                      ? 'text-rose-400'
                      : 'text-[#a78bfa]'
                  }`}
                >
                  {patternInfo.patternName}
                </span>
              </div>
            </div>

            {/* Dark Precision Chart Canvas */}
            <div className="hero-preserve-dark rounded-2xl bg-[#0f0f1a] border border-white/[0.08] p-2 sm:p-3 overflow-hidden">
              <svg
                viewBox={`0 0 ${chartW} ${chartH}`}
                className={`w-full select-none ${
                  isRotated
                    ? 'h-[168px]'
                    : isFullscreen
                    ? 'h-[260px] sm:h-[340px] lg:h-[380px]'
                    : 'h-[220px] sm:h-[280px]'
                }`}
                role="img"
                aria-label={`${activeAsset.symbol} ${chartMode} chart`}
              >
                <defs>
                  <linearGradient id="termLineFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={isUp ? '#10b981' : '#ef4444'} stopOpacity="0.32" />
                    <stop offset="100%" stopColor={isUp ? '#10b981' : '#ef4444'} stopOpacity="0" />
                  </linearGradient>
                </defs>

                {/* Horizontal price grid */}
                {[0.2, 0.4, 0.6, 0.8].map((r) => {
                  const y = padY + r * (chartH - padY * 2);
                  const labelVal = maxP - r * span;
                  return (
                    <g key={r}>
                      <line
                        x1={padX}
                        y1={y}
                        x2={chartW - padRight}
                        y2={y}
                        stroke="rgba(255,255,255,0.06)"
                        strokeDasharray="3 4"
                      />
                      <text
                        x={chartW - 8}
                        y={y + 3}
                        textAnchor="end"
                        fill="rgba(148,163,184,0.8)"
                        fontSize="10"
                        fontFamily="monospace"
                      >
                        {formatCurrency(labelVal, currency, fxRates)}
                      </text>
                    </g>
                  );
                })}

                {/* Current price dotted reference line */}
                <line
                  x1={padX}
                  y1={lastPriceY}
                  x2={chartW - padRight}
                  y2={lastPriceY}
                  stroke="#a78bfa"
                  strokeWidth="1.2"
                  strokeDasharray="4 4"
                  opacity="0.75"
                />

                {/* CANDLESTICK MODE */}
                {chartMode === 'candles' &&
                  candles.map((c, i) => {
                    const cx = toX(i);
                    const yHigh = toY(c.high);
                    const yLow = toY(c.low);
                    const yOpen = toY(c.open);
                    const yClose = toY(c.close);
                    const top = Math.min(yOpen, yClose);
                    const bodyH = Math.max(3, Math.abs(yClose - yOpen));
                    const color = c.bullish ? '#10b981' : '#ef4444';
                    const isHovered = hoveredCandle?.index === c.index;
                    return (
                      <g
                        key={c.index}
                        onMouseEnter={() => setHoveredCandle(c)}
                        onClick={() => setHoveredCandle(c)}
                        className="cursor-pointer"
                      >
                        {isHovered && (
                          <line
                            x1={cx}
                            y1={padY}
                            x2={cx}
                            y2={chartH - padY}
                            stroke="rgba(167,139,250,0.45)"
                            strokeDasharray="3 3"
                          />
                        )}
                        <line
                          x1={cx}
                          y1={yHigh}
                          x2={cx}
                          y2={yLow}
                          stroke={color}
                          strokeWidth={isHovered ? '2.2' : '1.6'}
                        />
                        <rect
                          x={cx - 6.5}
                          y={top}
                          width="13"
                          height={bodyH}
                          rx="2"
                          fill={color}
                          opacity={isHovered ? 1 : 0.92}
                          stroke={isHovered ? '#ffffff' : 'none'}
                          strokeWidth="1"
                        />
                      </g>
                    );
                  })}

                {/* LINE MODE */}
                {chartMode === 'line' && (
                  <>
                    <path d={areaPath} fill="url(#termLineFill)" />
                    <path
                      d={linePath}
                      fill="none"
                      stroke={isUp ? '#10b981' : '#ef4444'}
                      strokeWidth="2.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {candles.map((c, i) => (
                      <circle
                        key={c.index}
                        cx={toX(i)}
                        cy={toY(c.close)}
                        r={hoveredCandle?.index === c.index ? 5 : 2.5}
                        fill={isUp ? '#34d399' : '#f87171'}
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredCandle(c)}
                        onClick={() => setHoveredCandle(c)}
                      />
                    ))}
                  </>
                )}

                {/* PATTERN MODE */}
                {chartMode === 'pattern' && (
                  <>
                    <line
                      x1={padX}
                      y1={toY(patternInfo.resistance)}
                      x2={chartW - padRight}
                      y2={toY(patternInfo.resistance)}
                      stroke="#f43f5e"
                      strokeWidth="1.2"
                      strokeDasharray="5 4"
                    />
                    <line
                      x1={padX}
                      y1={toY(patternInfo.support)}
                      x2={chartW - padRight}
                      y2={toY(patternInfo.support)}
                      stroke="#10b981"
                      strokeWidth="1.2"
                      strokeDasharray="5 4"
                    />
                    <path
                      d={upperPath}
                      fill="none"
                      stroke="#a78bfa"
                      strokeWidth="1.5"
                      strokeDasharray="4 4"
                    />
                    <path
                      d={lowerPath}
                      fill="none"
                      stroke="#a78bfa"
                      strokeWidth="1.5"
                      strokeDasharray="4 4"
                    />
                    <path
                      d={smaPath}
                      fill="none"
                      stroke="#fbbf24"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    <path
                      d={linePath}
                      fill="none"
                      stroke="#38bdf8"
                      strokeWidth="2.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {candles.map((c, i) => (
                      <circle
                        key={c.index}
                        cx={toX(i)}
                        cy={toY(c.close)}
                        r={hoveredCandle?.index === c.index ? 5 : 2.5}
                        fill="#ffffff"
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredCandle(c)}
                        onClick={() => setHoveredCandle(c)}
                      />
                    ))}
                  </>
                )}
              </svg>

              {chartMode === 'pattern' && (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 mt-2 border-t border-white/[0.06] text-[11px] text-slate-300 font-mono-nums px-1">
                  <span>
                    Support:{' '}
                    <strong className="text-emerald-400">
                      {formatCurrency(patternInfo.support, currency, fxRates)}
                    </strong>
                  </span>
                  <span>
                    Resistance:{' '}
                    <strong className="text-rose-400">
                      {formatCurrency(patternInfo.resistance, currency, fxRates)}
                    </strong>
                  </span>
                  <span className="text-amber-300">SMA-3 Yellow · Channel Violet</span>
                </div>
              )}
            </div>

            {/* Pool Sentiment Bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-[#94a3b8]">
                <span className="text-emerald-400 font-semibold">
                  {t(lang, 'buyLong')} <strong className="font-mono-nums">{pool.firstPct}%</strong>
                </span>
                <span className="text-rose-400 font-semibold">
                  {t(lang, 'sellShort')} <strong className="font-mono-nums">{pool.secondPct}%</strong>
                </span>
              </div>
              <div className="h-2 rounded-full bg-rose-500/25 overflow-hidden flex">
                <div
                  className="h-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${pool.firstPct}%` }}
                />
                <div
                  className="h-full bg-rose-500 transition-all duration-300"
                  style={{ width: `${pool.secondPct}%` }}
                />
              </div>
            </div>
          </section>

          {/* Place Trade Order Panel (Supports Multi-Trade Concurrent Orders) */}
          <form
            onSubmit={handlePlaceOrder}
            className={`${orderColCls} rounded-[22px] bg-[#15101f] border border-white/[0.08] p-4 sm:p-5 space-y-4`}
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-bold text-white">Place Trade Order</h2>
              <span className="px-2.5 py-1 rounded-lg bg-[#7c3aed]/20 text-[#a78bfa] text-xs font-extrabold font-mono-nums">
                {activeLeverage}x Leverage
              </span>
            </div>

            {/* Buy / Sell Side Buttons */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setSide('long')}
                className={`btn-press min-h-[46px] rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 border transition-all ${
                  side === 'long'
                    ? 'preserve-white bg-emerald-500 border-emerald-400 text-white shadow-[0_6px_18px_rgba(16,185,129,0.3)]'
                    : 'bg-emerald-500/15 border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/25'
                }`}
              >
                <ArrowUpRight className="w-4 h-4" />
                {t(lang, 'buyLong')}
              </button>
              <button
                type="button"
                onClick={() => setSide('short')}
                className={`btn-press min-h-[46px] rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 border transition-all ${
                  side === 'short'
                    ? 'preserve-white bg-rose-500 border-rose-400 text-white shadow-[0_6px_18px_rgba(239,68,68,0.3)]'
                    : 'bg-rose-500/15 border-rose-500/25 text-rose-400 hover:bg-rose-500/25'
                }`}
              >
                <ArrowDownRight className="w-4 h-4" />
                {t(lang, 'sellShort')}
              </button>
            </div>

            {/* Duration Grid: 15s to 7d */}
            <div>
              <div className="text-xs font-semibold text-[#94a3b8] mb-2">
                Select Duration (Auto-settles at timer end)
              </div>
              <div className="grid grid-cols-5 sm:grid-cols-5 gap-1.5">
                {TIMEFRAMES.map((tf) => {
                  const active = duration === tf.id;
                  return (
                    <button
                      key={tf.id}
                      type="button"
                      onClick={() => setDuration(tf.id)}
                      className={`btn-press py-2 rounded-xl border text-xs font-bold font-mono-nums transition-colors ${
                        active
                          ? 'preserve-white bg-[#7c3aed] border-[#8b5cf6] text-white'
                          : 'bg-[#191928] border-white/[0.08] text-[#94a3b8] hover:text-white'
                      }`}
                    >
                      {tf.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Stake Amount & Quick Amounts */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <label htmlFor="terminal-stake" className="text-[#94a3b8] font-medium">
                  Stake (INR Base)
                </label>
                <span className="font-mono-nums text-[#94a3b8]">
                  Avail: {formatCurrency(state.balance, currency, fxRates)}
                </span>
              </div>
              <input
                id="terminal-stake"
                type="number"
                min={50}
                step={10}
                value={stakeInput}
                onChange={(e) => setStakeInput(e.target.value)}
                className="w-full h-12 px-4 rounded-xl bg-[#0b0814] border border-white/10 text-base font-extrabold font-mono-nums text-white text-center focus:outline-none focus:border-[#7c3aed]"
              />
              <div className="grid grid-cols-4 gap-1.5">
                {QUICK_STAKES.map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setStakeInput(String(amt))}
                    className="btn-press py-2 rounded-xl bg-[#191928] border border-white/[0.08] text-xs font-bold font-mono-nums text-[#cbd5e1] hover:border-[#7c3aed]"
                  >
                    ₹{amt}
                  </button>
                ))}
              </div>
            </div>

            {/* Fee Breakdown */}
            <div className="rounded-xl bg-[#0b0814] border border-white/[0.06] p-3 space-y-1.5 text-xs font-mono-nums">
              <div className="flex justify-between text-[#94a3b8]">
                <span>Commission (2%)</span>
                <span>{formatCurrency(fees.commission, currency, fxRates)}</span>
              </div>
              <div className="flex justify-between text-[#94a3b8]">
                <span>Handling Fee</span>
                <span>{formatCurrency(fees.handlingFee, currency, fxRates)}</span>
              </div>
              <div className="flex justify-between font-extrabold text-white pt-1.5 border-t border-white/[0.06] text-sm">
                <span>Total Debit</span>
                <span>{formatCurrency(fees.totalDebit, currency, fxRates)}</span>
              </div>
            </div>

            {!stakeCheck.valid && numericStake > 0 && (
              <p className="text-xs text-rose-400 font-medium">{stakeCheck.error}</p>
            )}

            <button
              type="submit"
              disabled={!stakeCheck.valid}
              className={`preserve-white btn-press w-full min-h-[48px] rounded-xl font-extrabold text-sm text-white disabled:opacity-45 shadow-md ${
                side === 'long'
                  ? 'bg-emerald-500 hover:bg-emerald-600'
                  : 'bg-rose-500 hover:bg-rose-600'
              }`}
            >
              {side === 'long' ? 'Confirm UP · Buy / Long' : 'Confirm DOWN · Sell / Short'} ·{' '}
              {activeAsset.symbol} ({duration})
            </button>
          </form>
        </div>

        {/* Multi-Trade Live Active Positions & Trade History */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Active Running Trades (Unlimited Concurrent Orders) */}
          <section className="lg:col-span-6 rounded-[22px] bg-[#15101f] border border-white/[0.08] p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-[#7c5cff]/20 border border-[#8b5cf6]/30 text-[#a78bfa] flex items-center justify-center">
                  <Activity className="w-4 h-4" />
                </span>
                <h2 className="text-sm sm:text-base font-bold text-white">
                  Active Running Trades
                </h2>
              </div>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#7c5cff]/20 text-[#a78bfa] font-mono-nums">
                {openPositions.length} running
              </span>
            </div>

            {openPositions.length === 0 ? (
              <p className="text-xs text-[#94a3b8] py-4 text-center rounded-xl bg-[#191928] border border-dashed border-white/[0.08]">
                No running trades yet. Place one or multiple orders above — all active timers track live here.
              </p>
            ) : (
              <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-0.5">
                {openPositions.map((pos) => {
                  const posAsset = state.assets.find((a) => a.id === pos.assetId);
                  const livePrice = posAsset ? posAsset.price : pos.entryPrice;
                  const pnl = calculatePositionPnl(pos, livePrice);
                  const remainingSec =
                    typeof pos.expiresAtMs === 'number' && pos.expiresAtMs > 0
                      ? Math.max(0, Math.ceil((pos.expiresAtMs - effectiveNow) / 1000))
                      : 0;
                  const totalSec = Math.max(1, pos.durationSeconds || 30);
                  const pctLeft = Math.min(100, Math.max(0, (remainingSec / totalSec) * 100));

                  const isMatched = pos.p2pStatus === 'Matched';
                  const isSameSide = pos.matchKind === 'same_side';
                  const p2pBadge = isMatched
                    ? isSameSide
                      ? 'Matched · Same-Side'
                      : 'Matched · Opposite'
                    : 'Pending Peer';

                  return (
                    <div
                      key={pos.id}
                      className="rounded-xl bg-[#191928] border border-white/[0.08] p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                          <span className="text-sm font-extrabold text-white">{pos.symbol}</span>
                          <span
                            className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full ${
                              pos.side === 'long'
                                ? 'bg-emerald-500/15 text-emerald-400'
                                : 'bg-rose-500/15 text-rose-400'
                            }`}
                          >
                            {pos.side === 'long' ? 'UP' : 'DOWN'} · {pos.horizon}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              isMatched
                                ? isSameSide
                                  ? 'bg-amber-500/15 text-amber-300'
                                  : 'bg-[#7c3aed]/20 text-[#c4b5fd]'
                                : 'bg-slate-500/20 text-slate-300'
                            }`}
                          >
                            {p2pBadge}
                          </span>
                        </div>

                        <span className="inline-flex items-center gap-1 text-[11px] font-bold font-mono-nums text-[#c4b5fd]">
                          <Clock className="w-3 h-3 animate-pulse" />
                          {formatTimerClock(remainingSec)} left
                        </span>
                      </div>

                      <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#7c5cff] to-emerald-400 transition-all duration-500"
                          style={{ width: `${pctLeft}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between gap-2 text-xs">
                        <div className="font-mono-nums text-[11px] text-[#94a3b8]">
                          {isMatched && typeof pos.matchAnchorPrice === 'number'
                            ? `Anchor ${formatCurrency(pos.matchAnchorPrice, currency, fxRates)}`
                            : `Entry ${formatCurrency(pos.entryPrice, currency, fxRates)}`}{' '}
                          →{' '}
                          <strong
                            className={pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}
                          >
                            {pnl >= 0 ? '+' : ''}
                            {formatCurrency(pnl, currency, fxRates)}
                          </strong>
                        </div>
                        {onClosePosition && (
                          <button
                            type="button"
                            onClick={() => onClosePosition(pos.id)}
                            className="btn-press px-2.5 py-1 rounded-lg bg-[#1d1d2e] hover:bg-[#2a2a42] border border-white/10 text-[11px] font-bold text-white"
                          >
                            Settle Now
                          </button>
                        )}
                      </div>
                      {pos.outcomeNote && (
                        <div className="text-[10.5px] text-[#94a3b8] truncate">
                          {pos.outcomeNote}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Recent Trades History right inside the Trade Screen */}
          <section className="lg:col-span-6 rounded-[22px] bg-[#15101f] border border-white/[0.08] p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-[#7c5cff]/20 border border-[#8b5cf6]/30 text-[#a78bfa] flex items-center justify-center">
                  <History className="w-4 h-4" />
                </span>
                <h2 className="text-sm sm:text-base font-bold text-white">Recent Trades History</h2>
              </div>

              <div className="inline-flex p-0.5 rounded-lg bg-[#0b0814] border border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setHistoryScope('all')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold ${
                    historyScope === 'all'
                      ? 'preserve-white bg-[#7c3aed] text-white'
                      : 'text-[#94a3b8]'
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryScope('asset')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold ${
                    historyScope === 'asset'
                      ? 'preserve-white bg-[#7c3aed] text-white'
                      : 'text-[#94a3b8]'
                  }`}
                >
                  {activeAsset.symbol}
                </button>
              </div>
            </div>

            {closedPositions.length === 0 && tradeTxHistory.length === 0 ? (
              <p className="text-xs text-[#94a3b8] py-4 text-center rounded-xl bg-[#191928] border border-dashed border-white/[0.08]">
                No completed trade history yet.
              </p>
            ) : (
              <div className="space-y-2 max-h-[340px] overflow-y-auto pr-0.5">
                {closedPositions.map((closed) => {
                  const isRefunded = closed.p2pStatus === 'Cancelled/Refunded';
                  const won = !isRefunded && (closed.realizedPnl ?? 0) > 0;
                  const statusLabel = isRefunded
                    ? 'Cancelled/Refunded'
                    : won
                    ? 'Settled · Won'
                    : 'Settled · Loss';
                  return (
                    <div
                      key={closed.id}
                      className="rounded-xl bg-[#191928] border border-white/[0.06] px-3.5 py-2.5 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white flex items-center gap-1.5 flex-wrap">
                          <Trophy
                            className={`w-3.5 h-3.5 shrink-0 ${
                              isRefunded
                                ? 'text-sky-400'
                                : won
                                ? 'text-emerald-400'
                                : 'text-rose-400'
                            }`}
                          />
                          <span className="truncate">
                            {closed.symbol} {closed.side === 'long' ? 'UP' : 'DOWN'} ({closed.horizon})
                          </span>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                              isRefunded
                                ? 'bg-sky-500/15 text-sky-300'
                                : won
                                ? 'bg-emerald-500/15 text-emerald-300'
                                : 'bg-rose-500/15 text-rose-300'
                            }`}
                          >
                            {statusLabel}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#94a3b8] font-mono-nums truncate mt-0.5">
                          {closed.closedAt ?? closed.openedAt}
                          {closed.outcomeNote ? ` · ${closed.outcomeNote}` : ''}
                        </div>
                      </div>
                      <div
                        className={`text-sm font-extrabold font-mono-nums shrink-0 ${
                          isRefunded
                            ? 'text-sky-300'
                            : (closed.realizedPnl ?? 0) >= 0
                            ? 'text-emerald-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {isRefunded
                          ? `Refund ${formatCurrency(closed.payout ?? closed.stake, currency, fxRates)}`
                          : `${(closed.realizedPnl ?? 0) >= 0 ? '+' : ''}${formatCurrency(
                              closed.realizedPnl ?? 0,
                              currency,
                              fxRates
                            )}`}
                      </div>
                    </div>
                  );
                })}

                {closedPositions.length === 0 &&
                  tradeTxHistory.map((tx) => {
                    const isPos = tx.amount >= 0;
                    return (
                      <div
                        key={tx.id}
                        className="rounded-xl bg-[#191928] border border-white/[0.06] px-3.5 py-2.5 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white truncate">{tx.title}</div>
                          <div className="text-[11px] text-[#94a3b8] font-mono-nums truncate mt-0.5">
                            {tx.timestamp} · {tx.status}
                          </div>
                        </div>
                        <div
                          className={`text-sm font-extrabold font-mono-nums shrink-0 ${
                            isPos ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {isPos ? '+' : ''}
                          {formatCurrency(tx.amount, currency, fxRates)}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </section>
        </div>
      </div>
    );
  }

  // =========================================================================
  // LISTED MARKETS & CHARTS DIRECTORY
  // =========================================================================
  return (
    <div className="space-y-4 animate-fade-up">
      {/* Header + Category Tabs */}
      <section className="rounded-[22px] bg-[#15101f] border border-white/[0.08] p-4 sm:p-5 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              aria-label="Back to home"
              className="btn-press w-10 h-10 rounded-xl bg-[#191928] border border-white/10 flex items-center justify-center text-white shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="font-display text-lg sm:text-xl font-extrabold text-white">
                {t(lang, 'pageTrade')}
              </h1>
              <p className="text-xs text-[#94a3b8]">
                Select any listed stock or asset to inspect Candles, Line &amp; Pattern charts and trade
              </p>
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#7c3aed]/15 text-xs font-bold text-[#a78bfa]">
            <Activity className="w-3.5 h-3.5" />
            <span>{state.assets.length} Listed Markets</span>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`btn-press min-h-[36px] px-4 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                category === cat
                  ? 'preserve-white bg-[#7c3aed] text-white shadow-[0_4px_12px_rgba(124,58,237,0.3)]'
                  : 'bg-[#191928] border border-white/[0.08] text-[#94a3b8] hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </section>

      {/* Search Box */}
      <div className="relative">
        <Search className="w-4 h-4 text-[#94a3b8] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t(lang, 'searchPlaceholder')}
          aria-label="Search listed stocks"
          className="w-full h-12 pl-11 pr-4 rounded-2xl bg-[#15101f] border border-white/[0.08] text-sm text-white placeholder:text-[#94a3b8]/70 focus:outline-none focus:border-[#7c3aed]"
        />
      </div>

      {/* Market Cards (Mobile single-col sleek cards, Desktop 2-3 col grid) */}
      {filteredAssets.length === 0 ? (
        <div className="rounded-2xl bg-[#15101f] border border-white/[0.06] py-12 text-center text-sm text-[#94a3b8]">
          No listed assets match &ldquo;{search}&rdquo;.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredAssets.map((asset) => {
            const up = asset.changePct >= 0;
            return (
              <button
                key={asset.id}
                type="button"
                onClick={() => setSelectedAssetId(asset.id)}
                className="btn-press text-left rounded-[18px] bg-[#15101f] hover:bg-[#1c1529] border border-white/[0.08] p-4 flex items-center justify-between gap-3 transition-all shadow-[0_6px_20px_rgba(0,0,0,0.14)]"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <AssetBadge asset={asset} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] font-bold text-white truncate">
                      {asset.symbol}
                    </div>
                    <div className="text-[11.5px] text-[#94a3b8] truncate">
                      {asset.name}
                    </div>
                    <div className="mt-1.5 hidden sm:block">
                      <MiniCandleBars values={asset.history} />
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0 space-y-1">
                  <div className="text-[15px] font-extrabold font-mono-nums text-white">
                    {formatCurrency(asset.price, currency, fxRates)}
                  </div>
                  <div
                    className={`text-xs font-bold font-mono-nums ${
                      up ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {up ? '+' : ''}
                    {asset.changePct.toFixed(2)}%
                  </div>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#7c3aed]/15 text-[#a78bfa] text-[11px] font-bold">
                    <BarChart2 className="w-3 h-3" />
                    Chart &amp; Trade
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
