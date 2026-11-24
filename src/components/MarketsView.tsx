import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUpRight,
  Bell,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Gamepad2,
  Play,
  Plus,
  Search,
  ShieldCheck,
  TrendingUp,
  User,
} from 'lucide-react';
import { AppState, MarketAsset, MarketCategory, PredictionMarket, TradeSide } from '../types/trading';
import { t } from '../utils/i18n';
import {
  calculatePoolPercentages,
  formatCurrency,
  getEffectiveReferralConfig,
} from '../utils/tradingEngine';
import {
  AssetBadge,
  BannerFeatureIcon,
  BannerTagBadgeIcon,
  PaymentLogo,
  PaymentMethodType,
  QuickBankIcon,
  QuickBetsIcon,
  QuickNewsIcon,
  QuickSupportAgentIcon,
  QuickTradeIcon,
  SecurityFeatureIcon,
} from './BrandMark';
import { GAMES_CATALOG } from '../data/gamesCatalog';
import { GameBannerArt } from './GamesView';
import { MiniCandleBars } from './SparklineChart';
import { FlagGlobe, FlagGlobeMarker } from './ui/flag-globe';
import { WalletModalMode } from './WalletModal';

interface MarketsViewProps {
  state: AppState;
  unreadNotifications: number;
  onOpenNotifications: () => void;
  onOpenTrade?: (asset: MarketAsset, initialSide?: TradeSide) => void;
  onOpenTradeTerminal: (assetId?: string) => void;
  onOpenGame: (gameId: string) => void;
  onOpenAllGames: () => void;
  onOpenAllBets: () => void;
  onOpenPrediction: (market: PredictionMarket, choice: 'yes' | 'no') => void;
  onOpenWalletModal: (mode: WalletModalMode) => void;
  onNavigateNews: () => void;
  onNavigateGift?: () => void;
}

const CATEGORIES: MarketCategory[] = [
  'All Markets',
  'Mobile Brands',
  'Famous Games',
  'Crypto',
  'Sports',
  'Political',
];

const PAYMENT_CHANNELS: { type: PaymentMethodType; label: string; sub: string; action?: 'topup' | 'withdraw' }[] = [
  { type: 'upi', label: 'UPI', sub: 'Instant Deposit & Withdraw', action: 'topup' },
  { type: 'bank', label: 'Bank', sub: 'IMPS · Instant Dep & WD', action: 'withdraw' },
  { type: 'coming_soon', label: 'Coming Soon', sub: 'Crypto · USDT · Cards & More' },
];

const GLOBAL_MARKET_HUBS: FlagGlobeMarker[] = [
  { code: 'IN', label: 'India Desk' },
  { code: 'US', label: 'United States' },
  { code: 'KR', label: 'South Korea' },
  { code: 'JP', label: 'Japan' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'SG', label: 'Singapore' },
  { code: 'AE', label: 'UAE' },
  { code: 'DE', label: 'Germany' },
  { code: 'BR', label: 'Brazil' },
  { code: 'AU', label: 'Australia' },
];

function formatCountdown(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}h ${String(mins).padStart(2, '0')}m`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')} left`;
}

function getTimeGreetingKey(): 'goodMorning' | 'goodAfternoon' | 'goodEvening' {
  const hr = new Date().getHours();
  if (hr < 12) return 'goodMorning';
  if (hr < 17) return 'goodAfternoon';
  return 'goodEvening';
}

let hasAnimatedIntroBalance = false;

function useAnimatedMoney(target: number, durationMs = 620): number {
  const initialStart = hasAnimatedIntroBalance ? target : 0;
  const [display, setDisplay] = useState<number>(initialStart);
  const currentRef = useRef<number>(initialStart);

  useEffect(() => {
    hasAnimatedIntroBalance = true;
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      currentRef.current = target;
      setDisplay(target);
      return;
    }

    const startVal = currentRef.current;
    const delta = target - startVal;
    if (Math.abs(delta) < 0.01) {
      currentRef.current = target;
      setDisplay(target);
      return;
    }

    let rafId = 0;
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = startVal + delta * eased;
      currentRef.current = next;
      setDisplay(next);
      if (t < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        currentRef.current = target;
        setDisplay(target);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [target, durationMs]);

  return display;
}

export const MarketsView: React.FC<MarketsViewProps> = ({
  state,
  unreadNotifications,
  onOpenNotifications,
  onOpenTradeTerminal,
  onOpenGame,
  onOpenAllGames,
  onOpenAllBets,
  onOpenPrediction,
  onOpenWalletModal,
  onNavigateNews,
  onNavigateGift,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<MarketCategory>('All Markets');
  const [searchQuery, setSearchQuery] = useState('');
  const [tickerState, setTickerState] = useState<{ idx: number; prev: number | null }>({
    idx: 0,
    prev: null,
  });
  const [hideBalance, setHideBalance] = useState(false);
  const [promoIdx, setPromoIdx] = useState(0);
  const [isBannerPaused, setIsBannerPaused] = useState(false);
  const gamesScrollRef = useRef<HTMLDivElement>(null);

  const scrollGamesBy = (delta: number) => {
    gamesScrollRef.current?.scrollBy({ left: delta, behavior: 'smooth' });
  };

  const animatedBalance = useAnimatedMoney(state.balance, 950);

  const filteredAssets = useMemo(() => {
    return state.assets.filter((asset) => {
      const catMatch = selectedCategory === 'All Markets' || asset.category === selectedCategory;
      const q = searchQuery.trim().toLowerCase();
      const queryMatch =
        !q ||
        asset.symbol.toLowerCase().includes(q) ||
        asset.name.toLowerCase().includes(q) ||
        asset.category.toLowerCase().includes(q);
      return catMatch && queryMatch;
    });
  }, [state.assets, selectedCategory, searchQuery]);

  const filteredPredictions = useMemo(() => {
    return state.predictions.filter((p) => {
      const catMatch = selectedCategory === 'All Markets' || p.category === selectedCategory;
      const q = searchQuery.trim().toLowerCase();
      const queryMatch = !q || p.question.toLowerCase().includes(q) || p.subLabel.toLowerCase().includes(q);
      return catMatch && queryMatch;
    });
  }, [state.predictions, selectedCategory, searchQuery]);

  // Loop Global Market ticker name smoothly every 2.8s
  useEffect(() => {
    const id = window.setInterval(() => {
      setTickerState((s) => ({
        idx: (s.idx + 1) % Math.max(1, state.assets.length),
        prev: s.idx,
      }));
    }, 2800);
    return () => window.clearInterval(id);
  }, [state.assets.length]);

  const PROMO_SLIDES_COUNT = 5;

  // Auto-rotate creative promotional banner carousel every 4.2s (pauses on hover)
  useEffect(() => {
    if (isBannerPaused) return;
    const id = window.setInterval(() => {
      setPromoIdx((prev) => (prev + 1) % PROMO_SLIDES_COUNT);
    }, 4200);
    return () => window.clearInterval(id);
  }, [isBannerPaused]);

  const bannerAsset =
    state.assets[tickerState.idx % Math.max(1, state.assets.length)] ?? state.assets[0];

  const globalSpotlightAsset = state.assets[tickerState.idx % Math.max(1, state.assets.length)] ?? state.assets[0];
  const prevSpotlightAsset =
    tickerState.prev !== null
      ? state.assets[tickerState.prev % Math.max(1, state.assets.length)] ?? null
      : null;

  const openP2pCount = state.positions.filter((p) => p.status === 'open').length;
  const lang = state.profile.language;
  const currency = state.profile.baseCurrency;
  const fxRates = state.fxRates;
  const refCfg = getEffectiveReferralConfig(state);

  const promoSlides = [
    {
      id: 'instant-games',
      tag: 'Arcade & Instant',
      title: '16 Interactive Games Ready to Play',
      desc: 'Launch Chicken Road, Mines, Plinko, Color Predict, Crypto Jackpot & more in one tap',
      ctaLabel: 'View More Games',
      gradient: 'linear-gradient(135deg, #2e1065 0%, #5b21b6 48%, #7c3aed 100%)',
      icon: <BannerFeatureIcon kind="chart" className="w-11 h-11" />,
      action: onOpenAllGames,
    },
    {
      id: 'first-deposit',
      tag: 'Instant Wallet',
      title: 'UPI & Bank IMPS Instant Channels',
      desc: `Deposit ₹${refCfg.minDepositInr}+ via GPay, PhonePe, Paytm or BHIM UPI and trade live markets`,
      ctaLabel: 'Deposit Now',
      gradient: 'linear-gradient(135deg, #1a0736 0%, #4c1d95 50%, #7c3aed 100%)',
      icon: <BannerFeatureIcon kind="welcome" className="w-11 h-11" />,
      action: () => onOpenWalletModal('topup'),
    },
    {
      id: 'instant-withdraw',
      tag: '24×7 Settlement',
      title: 'Instant UPI & Bank Withdrawal',
      desc: `Withdraw winning profits from ₹${refCfg.minWithdrawInr} in seconds with GPay, PhonePe & IMPS`,
      ctaLabel: 'Withdraw Winnings',
      gradient: 'linear-gradient(135deg, #0f172a 0%, #312e81 52%, #6d28d9 100%)',
      icon: <BannerFeatureIcon kind="withdraw" className="w-11 h-11" />,
      action: () => onOpenWalletModal('withdraw'),
    },
    {
      id: 'live-arena',
      tag: `${bannerAsset.symbol} Chart`,
      title: `Trade ${bannerAsset.symbol} Live · UP / DOWN`,
      desc: `Live @ ${formatCurrency(bannerAsset.price, currency, fxRates)} (${
        bannerAsset.changePct >= 0 ? '+' : ''
      }${bannerAsset.changePct.toFixed(2)}%) · Open candlestick chart`,
      ctaLabel: 'Open Chart',
      gradient: 'linear-gradient(135deg, #1e1b4b 0%, #4338ca 48%, #7c3aed 100%)',
      icon: <BannerFeatureIcon kind="chart" className="w-11 h-11" />,
      action: () => onOpenTradeTerminal(bannerAsset.id),
    },
    {
      id: 'gift-drops',
      tag: 'Daily Rewards',
      title: 'Claim Bonus Gift Codes & Pools',
      desc: 'Use OURO500, WELCOME250 or VIP1000 in Gift Drop & explore Prediction pools',
      ctaLabel: 'Claim Gift',
      gradient: 'linear-gradient(135deg, #3b0764 0%, #6b21a8 50%, #7c3aed 100%)',
      icon: <BannerFeatureIcon kind="gift" className="w-11 h-11" />,
      action: () => (onNavigateGift ? onNavigateGift() : onNavigateNews()),
    },
  ];
  const activePromo = promoSlides[promoIdx % promoSlides.length];

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Ouroboros Rounded Gradient Header with Wallet 30° Light Flash & Global Market FlagGlobe */}
      <section
        className="hero-preserve-dark relative overflow-hidden -mx-4 md:mx-0 px-4 sm:px-5 pt-4 sm:pt-5 pb-6 rounded-b-[28px] md:rounded-[32px] shadow-xl"
        style={{
          background: 'linear-gradient(160deg, #3b0764 0%, #5b21b6 45%, #7c3aed 100%)',
        }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-20 -right-16 w-[280px] h-[280px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(255,255,255,0.14) 0%, transparent 70%)',
          }}
        />

        {/* Top User Row + Single Notification Bell */}
        <div className="relative z-10 flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-[14px] bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/10 text-white shrink-0">
              <User className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[12px] sm:text-[13px] text-white/85">{t(lang, getTimeGreetingKey())}</div>
              <div className="text-[17px] sm:text-[19px] font-bold tracking-tight text-white leading-tight">
                {state.profile.name}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenNotifications}
            aria-label={`Notifications (${unreadNotifications} unread)`}
            className="relative w-[42px] h-[42px] rounded-[14px] bg-white/15 hover:bg-white/20 backdrop-blur-md border border-white/10 flex items-center justify-center text-white transition-transform active:scale-95"
          >
            <Bell className="w-5 h-5" />
            {unreadNotifications > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#ef4444] text-white text-[10px] font-bold flex items-center justify-center border-2 border-[#5b21b6] font-mono-nums">
                {unreadNotifications > 99 ? '99+' : unreadNotifications}
              </span>
            )}
          </button>
        </div>

        {/* Frosted Wallet Balance Card (30° sheen) + Global Market (FlagGlobe Earth) */}
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-stretch">
          <div className="lg:col-span-6 relative overflow-hidden bg-white/[0.11] backdrop-blur-xl rounded-[22px] p-4 sm:p-5 border border-white/[0.16] shadow-[0_12px_36px_rgba(15,5,35,0.35)] flex flex-col justify-between">
            {/* 30-degree left-to-right light flash animation */}
            <div aria-hidden="true" className="animate-wallet-sheen" />

            <div className="relative z-10">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5 text-[13px] text-white/90">
                  <span>{t(lang, 'totalBalance')}</span>
                  <button
                    type="button"
                    onClick={() => setHideBalance((v) => !v)}
                    aria-label={hideBalance ? 'Show balance' : 'Hide balance'}
                    className="p-1 rounded-lg hover:bg-white/10 transition-colors"
                  >
                    {hideBalance ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <span className="bg-white/20 text-[11px] font-semibold px-2.5 py-0.5 rounded-full text-white tracking-wide">
                  WALLET · {currency}
                </span>
              </div>

              <div className="text-[31px] sm:text-[36px] font-extrabold tracking-tight text-white my-1 mb-4 font-mono-nums leading-tight">
                {hideBalance ? '••••••••' : formatCurrency(animatedBalance, currency, fxRates)}
              </div>

              <div className="flex gap-2.5 sm:gap-3">
                <button
                  type="button"
                  onClick={() => onOpenWalletModal('topup')}
                  className="preserve-white flex-1 min-h-[44px] sm:min-h-[46px] bg-white text-[#7c3aed] hover:bg-purple-50 rounded-[14px] font-bold text-sm flex items-center justify-center gap-2 shadow-[0_6px_20px_rgba(0,0,0,0.18)] transition-transform active:scale-95 whitespace-nowrap"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  {t(lang, 'topUp')}
                </button>
                <button
                  type="button"
                  onClick={() => onOpenWalletModal('withdraw')}
                  aria-label="Withdraw funds"
                  title="Withdraw"
                  className="w-[48px] sm:w-[52px] min-h-[44px] sm:min-h-[46px] bg-white/15 hover:bg-white/25 border border-white/20 rounded-[14px] flex items-center justify-center text-white transition-transform active:scale-95 shrink-0"
                >
                  <ArrowDown className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Global Market Card with Highlighted Title, Smooth Looping Ticker & Interactive 3D FlagGlobe */}
          <div className="lg:col-span-6 bg-white/[0.11] backdrop-blur-md rounded-[22px] p-4 sm:p-5 border border-white/[0.16] shadow-[0_12px_32px_rgba(15,5,35,0.28)] flex items-center justify-between gap-3 overflow-hidden">
            <div className="flex flex-col justify-between min-w-0 flex-1 h-full">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.15] border border-white/25 shadow-[0_0_18px_rgba(167,139,250,0.35)] w-fit">
                <span className="w-2.5 h-2.5 rounded-full bg-[#34d399] animate-pulse shadow-[0_0_8px_#34d399] shrink-0" />
                <span className="text-[14px] sm:text-[15px] font-extrabold tracking-tight bg-gradient-to-r from-white via-[#f3e8ff] to-[#a7f3d0] bg-clip-text text-transparent whitespace-nowrap">
                  {t(lang, 'globalMarket')}
                </span>
              </div>

              <div className="relative h-[68px] my-2 overflow-hidden">
                {prevSpotlightAsset && prevSpotlightAsset.id !== globalSpotlightAsset.id && (
                  <div
                    key={`out-${prevSpotlightAsset.id}-${tickerState.idx}`}
                    aria-hidden="true"
                    className="absolute inset-0 flex flex-col justify-center animate-ticker-out pointer-events-none"
                  >
                    <div className="text-lg sm:text-xl font-extrabold text-white tracking-tight truncate leading-tight">
                      {prevSpotlightAsset.symbol}
                    </div>
                    <div className="text-xs sm:text-[13px] font-mono-nums text-white/95 flex items-center gap-2 mt-0.5">
                      <span className="font-semibold">{formatCurrency(prevSpotlightAsset.price, currency, fxRates)}</span>
                      <span
                        className={`font-bold px-1.5 py-0.5 rounded-md text-[11px] ${
                          prevSpotlightAsset.changePct >= 0
                            ? 'bg-emerald-400/20 text-emerald-200'
                            : 'bg-rose-400/20 text-rose-200'
                        }`}
                      >
                        {prevSpotlightAsset.changePct >= 0 ? '+' : ''}
                        {prevSpotlightAsset.changePct.toFixed(2)}%
                      </span>
                    </div>
                    <div className="text-[11px] text-white/75 truncate mt-0.5">
                      {prevSpotlightAsset.category}
                    </div>
                  </div>
                )}

                <div
                  key={`in-${globalSpotlightAsset.id}-${tickerState.idx}`}
                  className="absolute inset-0 flex flex-col justify-center animate-ticker-in"
                >
                  <div className="text-lg sm:text-xl font-extrabold text-white tracking-tight truncate leading-tight">
                    {globalSpotlightAsset.symbol}
                  </div>
                  <div className="text-xs sm:text-[13px] font-mono-nums text-white/95 flex items-center gap-2 mt-0.5">
                    <span className="font-semibold">{formatCurrency(globalSpotlightAsset.price, currency, fxRates)}</span>
                    <span
                      className={`font-bold px-1.5 py-0.5 rounded-md text-[11px] ${
                        globalSpotlightAsset.changePct >= 0
                          ? 'bg-emerald-400/20 text-emerald-200'
                          : 'bg-rose-400/20 text-rose-200'
                      }`}
                    >
                      {globalSpotlightAsset.changePct >= 0 ? '+' : ''}
                      {globalSpotlightAsset.changePct.toFixed(2)}%
                    </span>
                  </div>
                  <div className="text-[11px] text-white/75 truncate mt-0.5">
                    {globalSpotlightAsset.category}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onOpenTradeTerminal(globalSpotlightAsset.id)}
                className="text-xs sm:text-[13px] font-bold text-white bg-white/15 hover:bg-white/25 border border-white/20 px-3.5 py-2 rounded-xl text-left w-fit transition-all active:scale-95 whitespace-nowrap"
              >
                {t(lang, 'tradeNow')}
              </button>
            </div>

            {/* Interactive FlagGlobe Earth */}
            <div className="shrink-0 flex items-center justify-center">
              <FlagGlobe
                markers={GLOBAL_MARKET_HUBS}
                size={122}
                flagSize={14}
                baseColor="#6d28d9"
                glowColor="#ddd6fe"
                dark={true}
                stars={true}
                autoRotate={true}
                rotationSpeed={0.32}
                altitude={0.07}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Quick Actions (5-button bar: Bind Bank · Trade · All Bets · News · Support) */}
      <section aria-label="Quick actions" className="animate-fade-up">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[17px] font-bold text-[#f1f5f9]">{t(lang, 'quickActions')}</h2>
        </div>
        <div className="grid grid-cols-5 gap-1.5 sm:gap-3">
          <button
            type="button"
            onClick={() => onOpenWalletModal('bind_bank')}
            className="btn-press bg-[#15101f] hover:bg-[#1c1529] border border-white/[0.06] rounded-[16px] sm:rounded-[18px] py-3 sm:py-4 px-1 sm:px-2 text-center transition-all"
          >
            <div
              className="preserve-white w-10 h-10 sm:w-[46px] sm:h-[46px] mx-auto mb-1.5 sm:mb-2 rounded-[13px] sm:rounded-[15px] flex items-center justify-center text-white shadow-[0_6px_16px_rgba(124,58,237,0.35)]"
              style={{ background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)' }}
            >
              <QuickBankIcon className="w-[19px] h-[19px] sm:w-[21px] sm:h-[21px]" />
            </div>
            <p className="text-[10.5px] sm:text-xs font-semibold text-[#f1f5f9] whitespace-nowrap truncate">
              {t(lang, 'bindBank')}
            </p>
            <small className="hidden sm:block text-[10px] text-[#94a3b8] mt-0.5 truncate">
              {t(lang, 'addAccount')}
            </small>
          </button>

          <button
            type="button"
            onClick={() => onOpenTradeTerminal()}
            className="btn-press bg-[#15101f] hover:bg-[#1c1529] border border-white/[0.06] rounded-[16px] sm:rounded-[18px] py-3 sm:py-4 px-1 sm:px-2 text-center transition-all"
          >
            <div
              className="preserve-white w-10 h-10 sm:w-[46px] sm:h-[46px] mx-auto mb-1.5 sm:mb-2 rounded-[13px] sm:rounded-[15px] flex items-center justify-center text-white shadow-[0_6px_16px_rgba(124,58,237,0.35)]"
              style={{ background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)' }}
            >
              <QuickTradeIcon className="w-[19px] h-[19px] sm:w-[21px] sm:h-[21px]" />
            </div>
            <p className="text-[10.5px] sm:text-xs font-semibold text-[#f1f5f9] whitespace-nowrap truncate">
              {t(lang, 'trade')}
            </p>
            <small className="hidden sm:block text-[10px] text-[#94a3b8] mt-0.5 truncate">
              {t(lang, 'liveMarkets')}
            </small>
          </button>

          <button
            type="button"
            onClick={onOpenAllBets}
            className="btn-press bg-[#15101f] hover:bg-[#1c1529] border border-white/[0.06] rounded-[16px] sm:rounded-[18px] py-3 sm:py-4 px-1 sm:px-2 text-center transition-all"
          >
            <div
              className="preserve-white w-10 h-10 sm:w-[46px] sm:h-[46px] mx-auto mb-1.5 sm:mb-2 rounded-[13px] sm:rounded-[15px] flex items-center justify-center text-white shadow-[0_6px_16px_rgba(124,58,237,0.35)]"
              style={{ background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)' }}
            >
              <QuickBetsIcon className="w-[19px] h-[19px] sm:w-[21px] sm:h-[21px]" />
            </div>
            <p className="text-[10.5px] sm:text-xs font-semibold text-[#f1f5f9] whitespace-nowrap truncate">
              {t(lang, 'allBets')}
            </p>
            <small className="hidden sm:block text-[10px] text-[#94a3b8] mt-0.5 truncate">
              {t(lang, 'betPools')}
            </small>
          </button>

          <button
            type="button"
            onClick={onNavigateNews}
            className="btn-press bg-[#15101f] hover:bg-[#1c1529] border border-white/[0.06] rounded-[16px] sm:rounded-[18px] py-3 sm:py-4 px-1 sm:px-2 text-center transition-all"
          >
            <div
              className="preserve-white w-10 h-10 sm:w-[46px] sm:h-[46px] mx-auto mb-1.5 sm:mb-2 rounded-[13px] sm:rounded-[15px] flex items-center justify-center text-white shadow-[0_6px_16px_rgba(124,58,237,0.35)]"
              style={{ background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)' }}
            >
              <QuickNewsIcon className="w-[19px] h-[19px] sm:w-[21px] sm:h-[21px]" />
            </div>
            <p className="text-[10.5px] sm:text-xs font-semibold text-[#f1f5f9] whitespace-nowrap truncate">
              {t(lang, 'newsShort')}
            </p>
            <small className="hidden sm:block text-[10px] text-[#94a3b8] mt-0.5 truncate">
              {t(lang, 'communityShort')}
            </small>
          </button>

          <button
            type="button"
            onClick={() => onOpenWalletModal('support')}
            className="btn-press bg-[#15101f] hover:bg-[#1c1529] border border-white/[0.06] rounded-[16px] sm:rounded-[18px] py-3 sm:py-4 px-1 sm:px-2 text-center transition-all"
          >
            <div
              className="preserve-white w-10 h-10 sm:w-[46px] sm:h-[46px] mx-auto mb-1.5 sm:mb-2 rounded-[13px] sm:rounded-[15px] flex items-center justify-center text-white shadow-[0_6px_16px_rgba(124,58,237,0.35)]"
              style={{ background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)' }}
            >
              <QuickSupportAgentIcon className="w-[20px] h-[20px] sm:w-[22px] sm:h-[22px]" />
            </div>
            <p className="text-[10.5px] sm:text-xs font-semibold text-[#f1f5f9] whitespace-nowrap truncate">
              {t(lang, 'support')}
            </p>
            <small className="hidden sm:block text-[10px] text-[#94a3b8] mt-0.5 truncate">
              {t(lang, 'chatWithUs')}
            </small>
          </button>
        </div>
      </section>

      {/* Overview Cards */}
      <section className="animate-fade-up" style={{ animationDelay: '60ms' }}>
        <div className="flex items-center justify-between mb-3.5">
          <h2 className="text-[17px] font-bold text-[#f1f5f9]">{t(lang, 'overview')}</h2>
          <span className="text-xs font-medium text-[#94a3b8]">{t(lang, 'updatedNow')}</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#15101f] border border-white/[0.06] rounded-[18px] p-4">
            <div className="w-9 h-9 rounded-[11px] bg-[#7c3aed]/15 flex items-center justify-center text-[#a78bfa] mb-3">
              <TrendingUp className="w-[18px] h-[18px]" />
            </div>
            <div className="text-xs text-[#94a3b8] mb-1">{t(lang, 'todayReceive')}</div>
            <div className="text-xl font-bold text-[#f1f5f9] font-mono-nums">
              {formatCurrency(state.todayReceived, currency, fxRates)}
            </div>
          </div>

          <div className="bg-[#15101f] border border-white/[0.06] rounded-[18px] p-4">
            <div className="w-9 h-9 rounded-[11px] bg-[#7c3aed]/15 flex items-center justify-center text-[#a78bfa] mb-3">
              <ShieldCheck className="w-[18px] h-[18px]" />
            </div>
            <div className="text-xs text-[#94a3b8] mb-1">
              {t(lang, 'realizedPnl')} · {openP2pCount} Open
            </div>
            <div
              className={`text-xl font-bold font-mono-nums ${
                state.realizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {state.realizedPnl >= 0 ? '+' : ''}
              {formatCurrency(state.realizedPnl, currency, fxRates)}
            </div>
          </div>
        </div>
      </section>

      {/* Category Filter Tabs + Search */}
      <section className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div
          className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1"
          role="tablist"
          aria-label="Market categories"
        >
          {CATEGORIES.map((category) => {
            const active = selectedCategory === category;
            return (
              <button
                key={category}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSelectedCategory(category)}
                className={`min-h-[38px] px-4 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 transition-all ${
                  active
                    ? 'bg-gradient-to-r from-[#7c3aed] to-[#5b21b6] text-white shadow-[0_4px_16px_rgba(124,58,237,0.4)]'
                    : 'bg-[#15101f] text-[#94a3b8] border border-white/[0.06] hover:text-white'
                }`}
              >
                {category}
              </button>
            );
          })}
        </div>

        <div className="relative w-full md:w-64 shrink-0">
          <Search className="w-4 h-4 text-[#94a3b8] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t(lang, 'searchPlaceholder')}
            aria-label="Search markets and predictions"
            className="w-full h-10 pl-10 pr-3 rounded-xl bg-[#15101f] border border-white/[0.06] text-sm text-[#f1f5f9] placeholder:text-[#94a3b8]/60 focus:outline-none focus:border-[#7c3aed]"
          />
        </div>
      </section>

      {/* Main Responsive 2-Col Desktop / Stacked Mobile Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left 7 Cols: Creative Animated Promo Carousel + Live Asset Trades (opens Chart) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Creative Auto-Sliding Animated Promo Carousel */}
          <section
            id="animated-trade-banner"
            aria-label="Promotional highlights banner"
            onMouseEnter={() => setIsBannerPaused(true)}
            onMouseLeave={() => setIsBannerPaused(false)}
            className="hero-preserve-dark relative overflow-hidden rounded-[22px] p-4 sm:p-5 border border-[#8b5cf6]/35 shadow-[0_14px_34px_rgba(30,8,59,0.45)] transition-all duration-500"
            style={{ background: activePromo.gradient }}
          >
            <div aria-hidden="true" className="profile-light-sweep opacity-85" />
            <div aria-hidden="true" className="animate-wallet-sheen" />

            <div className="relative z-10 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 border border-white/20 text-[10.5px] font-extrabold uppercase tracking-wider text-purple-100">
                  <BannerTagBadgeIcon className="w-3.5 h-3.5 shrink-0" />
                  <span>{activePromo.tag}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setPromoIdx((prev) => (prev - 1 + promoSlides.length) % promoSlides.length)
                    }
                    aria-label="Previous promo banner"
                    className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <div className="flex items-center gap-1" aria-label="Promo banner slides">
                    {promoSlides.map((slide, idx) => {
                      const active = promoIdx % promoSlides.length === idx;
                      return (
                        <button
                          key={slide.id}
                          type="button"
                          onClick={() => setPromoIdx(idx)}
                          aria-label={`Show ${slide.tag}`}
                          className={`h-1.5 rounded-full transition-all ${
                            active ? 'w-5 bg-white' : 'w-1.5 bg-white/30 hover:bg-white/60'
                          }`}
                        />
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={() => setPromoIdx((prev) => (prev + 1) % promoSlides.length)}
                    aria-label="Next promo banner"
                    className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div
                key={activePromo.id}
                className="animate-banner-slide flex flex-col sm:flex-row sm:items-center justify-between gap-3.5"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="shrink-0">{activePromo.icon}</div>
                  <div className="min-w-0">
                    <div className="text-sm sm:text-base font-extrabold text-white tracking-tight leading-snug">
                      {activePromo.title}
                    </div>
                    <p className="text-xs text-purple-100/90 mt-0.5 leading-snug">
                      {activePromo.desc}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={activePromo.action}
                    className="preserve-white btn-press flex-1 sm:flex-initial min-h-[40px] px-4 rounded-xl bg-white text-[#4c1d95] hover:bg-purple-50 text-xs font-extrabold inline-flex items-center justify-center gap-1.5 shadow-[0_6px_18px_rgba(0,0,0,0.22)] whitespace-nowrap shrink-0"
                  >
                    <span>{activePromo.ctaLabel}</span>
                    <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Horizontal Scrollable Games Showcase (directly under banner, above Live Asset Trades) */}
          <section id="home-games-strip" aria-label="Instant Games" className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-7 h-7 rounded-lg bg-[#7c3aed]/20 border border-[#8b5cf6]/30 text-[#a78bfa] flex items-center justify-center shrink-0">
                  <Gamepad2 className="w-4 h-4" />
                </span>
                <h2 className="text-[17px] font-bold text-[#f1f5f9] truncate">Games</h2>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className="hidden sm:flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => scrollGamesBy(-280)}
                    aria-label="Scroll games left"
                    className="w-7 h-7 rounded-lg bg-[#15101f] hover:bg-[#1c1529] border border-white/10 text-[#94a3b8] hover:text-white flex items-center justify-center transition-colors"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollGamesBy(280)}
                    aria-label="Scroll games right"
                    className="w-7 h-7 rounded-lg bg-[#15101f] hover:bg-[#1c1529] border border-white/10 text-[#94a3b8] hover:text-white flex items-center justify-center transition-colors"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={onOpenAllGames}
                  className="text-xs font-semibold text-[#a78bfa] hover:text-[#7c3aed] transition-colors whitespace-nowrap"
                >
                  View more games →
                </button>
              </div>
            </div>

            <div
              ref={gamesScrollRef}
              className="flex items-stretch gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-1"
            >
              {GAMES_CATALOG.map((game) => {
                const isFeatured = Boolean(game.featured);
                return (
                  <button
                    key={game.id}
                    type="button"
                    onClick={() => onOpenGame(game.id)}
                    className={`hero-preserve-dark group relative shrink-0 snap-start rounded-[20px] overflow-hidden border ${
                      isFeatured
                        ? 'w-[214px] sm:w-[244px] h-[140px] sm:h-[152px] border-[#8b5cf6]/50 shadow-[0_12px_28px_rgba(124,58,237,0.22)]'
                        : 'w-[140px] sm:w-[152px] h-[140px] sm:h-[152px] border-white/[0.1] shadow-[0_8px_22px_rgba(0,0,0,0.28)]'
                    } hover:border-[#8b5cf6] bg-[#130f1e] text-left transition-all active:scale-[0.97]`}
                  >
                    <GameBannerArt
                      game={game}
                      className="group-hover:scale-105 transition-transform duration-300"
                    />
                    <div
                      aria-hidden="true"
                      className={`absolute inset-0 ${
                        isFeatured
                          ? 'bg-gradient-to-t from-[#090612]/95 via-[#090612]/45 to-black/10'
                          : 'bg-gradient-to-t from-black/90 via-black/30 to-transparent'
                      }`}
                    />
                    <div className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-black/50 backdrop-blur-md border border-white/25 text-white flex items-center justify-center group-hover:bg-[#7c3aed] group-hover:border-[#a78bfa] transition-colors">
                      <Play className="w-3 h-3 fill-current ml-0.5" />
                    </div>
                    <div className="absolute inset-x-0 bottom-0 p-3">
                      <div className="text-[9.5px] font-bold uppercase tracking-wider text-[#c4b5fd] truncate">
                        {game.tag}
                      </div>
                      <div
                        className={`${
                          isFeatured ? 'text-[14px] sm:text-[15px]' : 'text-xs sm:text-[13px]'
                        } font-extrabold text-white truncate leading-tight mt-0.5`}
                      >
                        {game.title}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Live Asset Trades Cards — clicking any asset or button opens its live chart screen */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-[17px] font-bold text-[#f1f5f9]">{t(lang, 'liveAssetTrades')}</h2>
              <button
                type="button"
                onClick={() => onOpenTradeTerminal()}
                className="text-xs font-semibold text-[#a78bfa] hover:text-[#7c3aed] transition-colors whitespace-nowrap"
              >
                {t(lang, 'tradeTerminal')}
              </button>
            </div>

            {filteredAssets.length === 0 ? (
              <div className="bg-[#15101f] border border-white/[0.06] rounded-[18px] py-10 text-center text-sm text-[#94a3b8]">
                No assets match &ldquo;{searchQuery}&rdquo; in {selectedCategory}.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredAssets.map((asset, idx) => (
                  <div
                    key={asset.id}
                    style={{ animationDelay: `${Math.min(idx, 5) * 45}ms` }}
                    className="bg-[#15101f] hover:bg-[#1c1529] rounded-[18px] p-4 border border-white/[0.06] hover:border-[#7c3aed]/45 flex items-center gap-3 transition-all animate-fade-up"
                  >
                    <button
                      type="button"
                      onClick={() => onOpenTradeTerminal(asset.id)}
                      className="flex items-center gap-3 flex-1 min-w-0 text-left min-h-[44px]"
                      aria-label={`Open ${asset.symbol} chart`}
                    >
                      <AssetBadge asset={asset} />
                      <div className="min-w-0">
                        <div className="text-[15px] font-semibold text-[#f1f5f9] truncate">
                          {asset.symbol}
                        </div>
                        <div className="text-[11px] text-[#94a3b8] truncate">
                          {asset.name}
                        </div>
                      </div>
                    </button>

                    <div className="hidden sm:block shrink-0 mr-1">
                      <MiniCandleBars values={asset.history} />
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-[15px] font-bold text-[#f1f5f9] font-mono-nums">
                        {formatCurrency(asset.price, currency, fxRates)}
                      </div>
                      <div
                        className={`text-xs font-semibold font-mono-nums ${
                          asset.changePct >= 0 ? 'text-[#10b981]' : 'text-[#ef4444]'
                        }`}
                      >
                        {asset.changePct >= 0 ? '+' : ''}
                        {asset.changePct.toFixed(2)}%
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onOpenTradeTerminal(asset.id)}
                      aria-label={`Open ${asset.symbol} trade chart`}
                      className="preserve-white min-h-[38px] px-4 rounded-[11px] bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-[13px] font-semibold shadow-[0_4px_12px_rgba(124,58,237,0.35)] transition-transform active:scale-95 whitespace-nowrap shrink-0 ml-1"
                    >
                      {t(lang, 'trade')}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right 5 Cols: Prediction Bets + Supported By Logos + Ouroboros Trust Section */}
        <div className="lg:col-span-5 space-y-5">
          <section id="prediction-bets-section" className="space-y-3.5 scroll-mt-16">
            <div className="flex items-center justify-between">
              <h2 className="text-[17px] font-bold text-[#f1f5f9]">{t(lang, 'predictionBets')}</h2>
              <button
                type="button"
                onClick={onNavigateNews}
                className="text-xs font-semibold text-[#a78bfa] hover:text-[#6d28d9] transition-colors whitespace-nowrap"
              >
                {t(lang, 'navNews')} →
              </button>
            </div>

            {filteredPredictions.length === 0 ? (
              <div className="bg-[#15101f] border border-white/[0.06] rounded-[20px] py-8 text-center text-sm text-[#94a3b8]">
                No prediction markets found for this filter.
              </div>
            ) : (
              <div className="space-y-3.5">
                {filteredPredictions.map((market, idx) => {
                  const pct = calculatePoolPercentages(market.yesPool, market.noPool);
                  return (
                    <article
                      key={market.id}
                      style={{ animationDelay: `${Math.min(idx, 3) * 80}ms` }}
                      className="bg-[#15101f] border border-white/[0.06] rounded-[20px] p-[18px] animate-fade-up"
                    >
                      <div className="flex items-center justify-between gap-2 mb-3 text-xs text-[#94a3b8]">
                        <span className="font-medium text-[#a78bfa]">{market.subLabel}</span>
                        <span className="bg-[#ef4444]/[0.12] text-[#f87171] px-2.5 py-1 rounded-full font-bold text-xs font-mono-nums">
                          {market.endsInSeconds < 3600
                            ? formatCountdown(market.endsInSeconds)
                            : market.endLabel}
                        </span>
                      </div>

                      <h3 className="text-[15px] font-semibold text-[#f1f5f9] leading-snug mb-4">
                        {market.question}
                      </h3>

                      <div className="mb-3.5">
                        <div className="h-2 bg-[#1e293b] rounded-full overflow-hidden flex mb-2">
                          <div
                            className="h-full transition-all duration-1000"
                            style={{
                              width: `${pct.firstPct}%`,
                              background: 'linear-gradient(90deg, #059669, #34d399)',
                            }}
                          />
                          <div
                            className="h-full"
                            style={{
                              width: `${pct.secondPct}%`,
                              background: 'linear-gradient(90deg, #dc2626, #f87171)',
                            }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-[#94a3b8] font-mono-nums">
                          <span>
                            YES {pct.firstPct}% · {market.yesBettors.toLocaleString('en-IN')} bettors
                          </span>
                          <span>
                            NO {pct.secondPct}% · {market.noBettors.toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5 mt-4">
                        <button
                          type="button"
                          onClick={() => onOpenPrediction(market, 'yes')}
                          className="preserve-white min-h-[44px] rounded-[14px] font-bold text-sm text-white shadow-[0_4px_14px_rgba(16,185,129,0.3)] transition-transform active:scale-95"
                          style={{ background: 'linear-gradient(135deg, #059669, #10b981)' }}
                        >
                          {t(lang, 'betYes')}
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenPrediction(market, 'no')}
                          className="preserve-white min-h-[44px] rounded-[14px] font-bold text-sm text-white shadow-[0_4px_14px_rgba(239,68,68,0.3)] transition-transform active:scale-95"
                          style={{ background: 'linear-gradient(135deg, #dc2626, #ef4444)' }}
                        >
                          {t(lang, 'betNo')}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          {/* Supported Payment Channels with Official UPI & Bank Instant Deposit/Withdraw */}
          <section className="bg-[#15101f] border border-white/[0.06] rounded-[20px] p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-[13px] text-[#94a3b8] font-semibold">
                {t(lang, 'supportedBy')}
              </h4>
              <span className="text-[11px] font-semibold text-[#a78bfa]">{t(lang, 'instantChannels')}</span>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {PAYMENT_CHANNELS.map((ch) => {
                const isInteractive = Boolean(ch.action);
                const cardCls = `flex items-center gap-2.5 rounded-[14px] px-3 py-2.5 border transition-all text-left ${
                  ch.type === 'coming_soon'
                    ? 'col-span-2 bg-[#7c3aed]/[0.08] border-[#7c3aed]/30'
                    : isInteractive
                    ? 'bg-white/[0.04] border-white/[0.08] hover:border-[#8b5cf6]/60 cursor-pointer btn-press'
                    : 'bg-white/[0.04] border-white/[0.06] hover:border-white/[0.14]'
                }`;
                if (isInteractive && ch.action) {
                  return (
                    <button
                      key={ch.type}
                      type="button"
                      onClick={() => onOpenWalletModal(ch.action!)}
                      className={cardCls}
                    >
                      <PaymentLogo type={ch.type} className="w-8 h-8 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-[#f1f5f9] leading-tight">{ch.label}</div>
                        <div className="text-[10px] font-medium text-emerald-400 leading-tight mt-0.5">{ch.sub}</div>
                      </div>
                    </button>
                  );
                }
                return (
                  <div key={ch.type} className={cardCls}>
                    <PaymentLogo type={ch.type} className="w-8 h-8 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-[#f1f5f9] truncate">{ch.label}</div>
                      <div className="text-[10px] text-[#94a3b8] truncate">{ch.sub}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>

      {/* Bottom-most Ouroboros Brand & Security Showcase (transparent official logo) */}
      <section
        className="hero-preserve-dark rounded-[24px] p-5 sm:p-6 border border-[#7c3aed]/25 text-center shadow-[0_10px_32px_rgba(0,0,0,0.3)]"
        style={{ background: 'linear-gradient(155deg, #2e1065 0%, #171124 100%)' }}
      >
        <img
          src="/assets/ouroboros-logo.png"
          alt="Ouroboros"
          className="h-9 sm:h-10 w-auto mx-auto mb-2.5 object-contain select-none"
          draggable={false}
        />
        <p className="text-xs sm:text-[13px] font-semibold text-[#c4b5fd] tracking-wide">
          Secure • Anonymous • Instant
        </p>
        <p className="text-xs text-[#94a3b8] mt-1 mb-4">
          No KYC required for basic trading
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 text-left">
          <div className="flex items-center gap-3 bg-white/[0.04] border border-white/[0.06] p-3.5 rounded-[16px]">
            <SecurityFeatureIcon type="encrypted" className="w-9 h-9 shrink-0" />
            <div className="min-w-0">
              <div className="text-xs font-bold text-[#f1f5f9] leading-snug">
                AES-256 Encrypted Vault
              </div>
              <div className="text-[11px] text-[#94a3b8] mt-0.5 truncate">
                Zero-leak end-to-end TLS
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-white/[0.04] border border-white/[0.06] p-3.5 rounded-[16px]">
            <SecurityFeatureIcon type="anonymous" className="w-9 h-9 shrink-0" />
            <div className="min-w-0">
              <div className="text-xs font-bold text-[#f1f5f9] leading-snug">
                Stealth Anonymous Privacy
              </div>
              <div className="text-[11px] text-[#94a3b8] mt-0.5 truncate">
                Zero-KYC basic trading
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-white/[0.04] border border-white/[0.06] p-3.5 rounded-[16px]">
            <SecurityFeatureIcon type="execution" className="w-9 h-9 shrink-0" />
            <div className="min-w-0">
              <div className="text-xs font-bold text-[#f1f5f9] leading-snug">
                Sub-Second Execution
              </div>
              <div className="text-[11px] text-[#94a3b8] mt-0.5 truncate">
                Live order-book routing
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-white/[0.04] border border-white/[0.06] p-3.5 rounded-[16px]">
            <SecurityFeatureIcon type="settlements" className="w-9 h-9 shrink-0" />
            <div className="min-w-0">
              <div className="text-xs font-bold text-[#f1f5f9] leading-snug">
                24×7 Instant UPI Clearing
              </div>
              <div className="text-[11px] text-[#94a3b8] mt-0.5 truncate">
                Direct bank &amp; wallet payout
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
