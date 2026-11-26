import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpFromLine,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  HelpCircle,
  History,
  Lock,
  Target,
  Trophy,
} from 'lucide-react';
import { AppState, WalletTransaction, TransactionStatus } from '../types/trading';
import { t } from '../utils/i18n';
import {
  calculatePoolPercentages,
  calculatePositionPnl,
  formatCurrency,
} from '../utils/tradingEngine';
import { ActivePositionsIcon } from './BrandMark';

interface PortfolioViewProps {
  state: AppState;
  nowMs?: number;
  onClosePosition: (positionId: string) => void;
  onExploreMarkets: () => void;
  onDeposit?: () => void;
  onWithdraw?: () => void;
  onReportIssue?: (txId: string) => void;
}

type HistoryFilter = 'all' | 'trade' | 'bet' | 'win' | 'loss' | 'deposit' | 'withdraw';

const HISTORY_FILTERS: { id: HistoryFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'trade', label: 'Short Trades' },
  { id: 'bet', label: 'Predictions' },
  { id: 'win', label: 'Wins' },
  { id: 'loss', label: 'Losses' },
  { id: 'deposit', label: 'Deposit' },
  { id: 'withdraw', label: 'Withdraw' },
];

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

function getStatusBadgeClasses(status: TransactionStatus): string {
  switch (status) {
    case 'Pending':
    case 'Under Review':
      return 'bg-amber-500/15 border-amber-500/30 text-amber-400';
    case 'Matched':
      return 'bg-[#7c5cff]/20 border-[#8b5cf6]/35 text-[#c4b5fd]';
    case 'Cancelled/Refunded':
    case 'In Process':
      return 'bg-sky-500/15 border-sky-500/30 text-sky-400';
    case 'Rejected':
      return 'bg-rose-500/15 border-rose-500/35 text-rose-400';
    case 'Completed':
    case 'Settled':
    case 'Credited':
    default:
      return 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400';
  }
}

function isBetTransaction(tx: WalletTransaction): boolean {
  const lower = tx.title.toLowerCase();
  return tx.type === 'bet_place' || lower.includes('prediction') || lower.includes('bet ');
}

function matchesHistoryFilter(tx: WalletTransaction, filter: HistoryFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'trade') {
    return (
      (tx.type === 'trade_open' ||
        tx.type === 'trade_close' ||
        tx.type === 'trade_refund' ||
        tx.type === 'game_bet' ||
        tx.type === 'game_win' ||
        tx.type === 'game_refund') &&
      !isBetTransaction(tx)
    );
  }
  if (filter === 'bet') {
    return isBetTransaction(tx);
  }
  if (filter === 'win') {
    return (
      ((tx.type === 'trade_close' || tx.type === 'game_win') && tx.amount > 0) ||
      tx.status === 'Credited' ||
      (isBetTransaction(tx) && tx.amount > 0)
    );
  }
  if (filter === 'loss') {
    return (
      (tx.type === 'trade_open' ||
        tx.type === 'trade_close' ||
        tx.type === 'bet_place' ||
        tx.type === 'game_bet') &&
      tx.amount <= 0
    );
  }
  if (filter === 'deposit') {
    return (
      tx.type === 'deposit' ||
      tx.type === 'gift_redeem' ||
      tx.type === 'sell_usdt' ||
      tx.type === 'p2p_receive'
    );
  }
  if (filter === 'withdraw') {
    return tx.type === 'withdraw' || tx.type === 'p2p_send';
  }
  return true;
}

export const PortfolioView: React.FC<PortfolioViewProps> = ({
  state,
  nowMs,
  onClosePosition,
  onExploreMarkets,
  onDeposit,
  onWithdraw,
  onReportIssue,
}) => {
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all');
  const [localNow, setLocalNow] = useState(() => nowMs ?? Date.now());

  useEffect(() => {
    if (typeof nowMs === 'number') {
      setLocalNow(nowMs);
      return;
    }
    const id = window.setInterval(() => setLocalNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [nowMs]);

  const effectiveNow = nowMs ?? localNow;
  const openPositions = state.positions.filter((p) => p.status === 'open');
  const recentlyClosedPositions = state.positions.filter((p) => p.status === 'closed').slice(0, 4);
  const openBets = state.bets.filter((b) => b.status === 'open');

  const unrealizedPnl = useMemo(() => {
    return openPositions.reduce((acc, pos) => {
      const asset = state.assets.find((a) => a.id === pos.assetId);
      const currentPrice = asset ? asset.price : pos.entryPrice;
      return acc + calculatePositionPnl(pos, currentPrice);
    }, 0);
  }, [openPositions, state.assets]);

  const totalStakedOpen =
    openPositions.reduce((s, p) => s + p.stake, 0) +
    openBets.reduce((s, b) => s + b.stake, 0);

  const totalPortfolioValue = Math.max(0, state.balance + totalStakedOpen + unrealizedPnl);
  const withdrawableAmount = Math.min(state.balance, Math.max(0, state.withdrawableBalance ?? state.balance));
  const lockedDeposit = Math.max(0, Math.round((state.balance - withdrawableAmount) * 100) / 100);

  const filteredTx = useMemo(() => {
    return state.transactions.filter((tx) => matchesHistoryFilter(tx, historyFilter));
  }, [state.transactions, historyFilter]);

  const currency = state.profile.baseCurrency;
  const fxRates = state.fxRates;
  const lang = state.profile.language;

  return (
    <div className="space-y-5 animate-fade-up">
      {/* Premium Hero Card + Overlapping 3-Column KPI Strip */}
      <div>
        <section
          className="hero-preserve-dark relative overflow-hidden rounded-[24px] p-5 sm:p-6 pb-8 sm:pb-9 border border-white/15 shadow-[0_18px_44px_rgba(46,16,101,0.42)]"
          style={{
            background: 'linear-gradient(155deg, #1e083b 0%, #3b0764 46%, #5b21b6 84%, #6d28d9 100%)',
          }}
        >
          {/* Animated ambient light sweep & 30° wallet sheen behind balance */}
          <div aria-hidden="true" className="profile-light-sweep" />
          <div aria-hidden="true" className="animate-wallet-sheen" />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-12 -right-12 w-48 h-48 rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(196,181,253,0.22) 0%, transparent 70%)',
            }}
          />

          <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-white/80">
                {t(lang, 'totalPortfolioValue')}
              </div>
              <div className="text-3xl sm:text-4xl font-extrabold text-white font-mono-nums tracking-tight mt-1">
                {formatCurrency(totalPortfolioValue, currency, fxRates)}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-mono-nums">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 text-white font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-300" />
                  Withdrawable: {formatCurrency(withdrawableAmount, currency, fxRates)}
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 text-white/95 font-medium">
                  <Lock className="w-3 h-3 text-amber-200" />
                  Play-Locked: {formatCurrency(lockedDeposit, currency, fxRates)}
                </span>
              </div>
            </div>

            {(onWithdraw || onDeposit) && (
              <div className="grid grid-cols-2 gap-2.5 sm:min-w-[270px]">
                {onWithdraw && (
                  <button
                    type="button"
                    onClick={onWithdraw}
                    className="preserve-white btn-press min-h-[44px] px-4 rounded-xl bg-white hover:bg-purple-50 text-[#5a3fd4] text-sm font-bold inline-flex items-center justify-center gap-2 shadow-[0_6px_18px_rgba(0,0,0,0.16)]"
                  >
                    <ArrowUpFromLine className="w-4 h-4" />
                    Withdraw
                  </button>
                )}
                {onDeposit && (
                  <button
                    type="button"
                    onClick={onDeposit}
                    className="preserve-white btn-press min-h-[44px] px-4 rounded-xl bg-white/20 hover:bg-white/25 border border-white/25 text-white text-sm font-bold inline-flex items-center justify-center gap-2 backdrop-blur-sm"
                  >
                    <ArrowDownToLine className="w-4 h-4" />
                    Deposit
                  </button>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Overlapping 3-Column KPI Strip */}
        <section className="relative z-10 -mt-4 px-1 sm:px-3 grid grid-cols-3 gap-2.5 sm:gap-3">
          <div className="rounded-2xl bg-[#15101f] border border-white/[0.08] p-3 sm:p-4 shadow-[0_10px_28px_rgba(0,0,0,0.28)]">
            <div className="text-[11px] font-medium text-slate-400 truncate">
              {t(lang, 'unrealizedPnl')}
            </div>
            <div
              className={`text-sm sm:text-lg font-extrabold font-mono-nums mt-1 truncate ${
                unrealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {unrealizedPnl >= 0 ? '+' : ''}
              {formatCurrency(unrealizedPnl, currency, fxRates)}
            </div>
          </div>

          <div className="rounded-2xl bg-[#15101f] border border-white/[0.08] p-3 sm:p-4 shadow-[0_10px_28px_rgba(0,0,0,0.28)]">
            <div className="text-[11px] font-medium text-slate-400 truncate">
              {t(lang, 'realizedPnl')}
            </div>
            <div
              className={`text-sm sm:text-lg font-extrabold font-mono-nums mt-1 truncate ${
                state.realizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {state.realizedPnl >= 0 ? '+' : ''}
              {formatCurrency(state.realizedPnl, currency, fxRates)}
            </div>
          </div>

          <div className="rounded-2xl bg-[#15101f] border border-white/[0.08] p-3 sm:p-4 shadow-[0_10px_28px_rgba(0,0,0,0.28)]">
            <div className="text-[11px] font-medium text-slate-400 truncate">
              Active Trades
            </div>
            <div className="text-sm sm:text-lg font-extrabold text-white font-mono-nums mt-1">
              {openPositions.length + openBets.length}
            </div>
          </div>
        </section>
      </div>

      {/* Main Content Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left 7 Columns: Live Positions + Active Bets + Spot Vault */}
        <div className="lg:col-span-7 space-y-5">
          {/* Live Timed Trades */}
          <section className="rounded-[22px] bg-[#15101f] border border-white/[0.08] p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-2.5">
                <ActivePositionsIcon className="w-7 h-7 shrink-0" />
                <h2 className="text-[15px] sm:text-base font-bold text-white">
                  {t(lang, 'activePositions')}
                </h2>
              </div>
              <button
                type="button"
                onClick={onExploreMarkets}
                className="btn-press px-3 py-1.5 rounded-xl bg-[#7c5cff]/15 hover:bg-[#7c5cff]/25 border border-[#8b5cf6]/30 text-xs font-bold text-[#a78bfa] whitespace-nowrap"
              >
                + New Trade
              </button>
            </div>

            {openPositions.length === 0 ? (
              <div className="py-8 text-center space-y-3 rounded-2xl bg-[#191928] border border-dashed border-white/[0.08] px-4">
                <p className="text-sm font-semibold text-white">No active timed trades</p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Place a 30s, 1m, or 5m directional trade against opposite pool traders to track its live countdown and automatic settlement here.
                </p>
                <button
                  type="button"
                  onClick={onExploreMarkets}
                  className="preserve-white btn-press min-h-[42px] px-5 rounded-xl bg-[#7c5cfc] hover:bg-[#6a48f5] text-white text-xs font-bold inline-flex items-center gap-1.5"
                >
                  Explore Markets
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {openPositions.map((pos) => {
                  const asset = state.assets.find((a) => a.id === pos.assetId);
                  const livePrice = asset ? asset.price : pos.entryPrice;
                  const pnl = calculatePositionPnl(pos, livePrice);
                  const remainingSec =
                    typeof pos.expiresAtMs === 'number' && pos.expiresAtMs > 0
                      ? Math.max(0, Math.ceil((pos.expiresAtMs - effectiveNow) / 1000))
                      : 0;
                  const totalSec = Math.max(1, pos.durationSeconds || 30);
                  const pctLeft = Math.min(100, Math.max(0, (remainingSec / totalSec) * 100));
                  const pool = asset
                    ? calculatePoolPercentages(asset.longPoolAmount, asset.shortPoolAmount)
                    : { firstPct: 50, secondPct: 50 };
                  const opponentPct = pos.side === 'long' ? pool.secondPct : pool.firstPct;

                  return (
                    <div
                      key={pos.id}
                      className="relative overflow-hidden rounded-2xl bg-[#191928] border border-white/[0.08] p-4 space-y-3"
                    >
                      {/* Top gradient accent rule */}
                      <div className="absolute top-0 inset-x-0 h-[2.5px] bg-gradient-to-r from-[#7c5cff] via-[#a855f7] to-emerald-400" />

                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="space-y-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-base font-extrabold text-white tracking-tight">
                              {pos.symbol}
                            </span>
                            <span
                              className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                                pos.side === 'long'
                                  ? 'bg-emerald-500/15 text-emerald-400'
                                  : 'bg-rose-500/15 text-rose-400'
                              }`}
                            >
                              {pos.side === 'long' ? 'UP · Long' : 'DOWN · Short'}
                            </span>
                            <span
                              className={`text-[10.5px] font-bold px-2.5 py-0.5 rounded-full border ${
                                (pos.p2pStatus ?? 'Pending') === 'Matched'
                                  ? 'bg-[#7c5cff]/20 border-[#8b5cf6]/35 text-[#c4b5fd]'
                                  : 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                              }`}
                            >
                              {(pos.p2pStatus ?? 'Pending') === 'Matched'
                                ? `Matched · ${pos.matchKind === 'same_side' ? 'Same-Side' : 'Opposite'}`
                                : 'Pending Peer'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 font-mono-nums leading-relaxed">
                            Stake {formatCurrency(pos.stake, currency, fxRates)} · Anchor{' '}
                            {formatCurrency(pos.matchAnchorPrice ?? pos.entryPrice, currency, fxRates)} → Live{' '}
                            {formatCurrency(livePrice, currency, fxRates)} · Opposite Pool {opponentPct}%
                          </p>
                          {pos.outcomeNote && (
                            <p className="text-[10.5px] text-slate-400 truncate">
                              {pos.outcomeNote}
                            </p>
                          )}
                        </div>

                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#7c5cff]/20 border border-[#8b5cf6]/35 text-[11px] font-extrabold font-mono-nums text-[#c4b5fd] shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          LIVE • {pos.horizon}
                        </span>
                      </div>

                      {/* Countdown Progress */}
                      <div className="space-y-1.5">
                        <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-[#7c5cff] via-[#a855f7] to-emerald-400 transition-all duration-700"
                            style={{ width: `${pctLeft}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono-nums">
                          <span className="inline-flex items-center gap-1 text-[#c4b5fd] font-bold">
                            <Clock className="w-3 h-3" />
                            {formatTimerClock(remainingSec)} left
                          </span>
                          <span>Ends automatically</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3 pt-2.5 border-t border-white/[0.06]">
                        <div>
                          <div
                            className={`text-base font-extrabold font-mono-nums ${
                              pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {pnl >= 0 ? '+' : ''}
                            {formatCurrency(pnl, currency, fxRates)}
                          </div>
                          <div className="text-[10.5px] text-slate-400">Live Market Delta</div>
                        </div>

                        <button
                          type="button"
                          onClick={() => onClosePosition(pos.id)}
                          className="btn-press min-h-[38px] px-4 rounded-xl bg-[#1d1d2e] hover:bg-[#2a2a42] border border-white/10 text-xs font-bold text-white whitespace-nowrap"
                        >
                          Settle Now
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Recent Settled Results */}
            {recentlyClosedPositions.length > 0 && (
              <div className="mt-4 pt-4 border-t border-white/[0.06] space-y-2.5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Trophy className="w-3.5 h-3.5 text-amber-400" />
                  Recent P2P Results
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {recentlyClosedPositions.map((closed) => {
                    const isRefunded = closed.p2pStatus === 'Cancelled/Refunded';
                    const won = !isRefunded && (closed.realizedPnl ?? 0) > 0;
                    return (
                      <div
                        key={closed.id}
                        className="rounded-xl bg-[#191928] border border-white/[0.06] px-3 py-2.5 space-y-1 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-bold text-white truncate">
                              {closed.symbol} ({closed.side === 'long' ? 'UP' : 'DOWN'} · {closed.horizon})
                            </div>
                            <div className="text-[10.5px] text-slate-400 truncate">
                              {closed.closedAt ?? closed.openedAt}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            {isRefunded ? (
                              <span className="inline-flex px-2 py-0.5 rounded-full bg-sky-500/15 border border-sky-500/30 text-sky-400 text-[10px] font-extrabold">
                                Cancelled/Refunded
                              </span>
                            ) : (
                              <span
                                className={`font-mono-nums font-extrabold ${
                                  won ? 'text-emerald-400' : 'text-rose-400'
                                }`}
                              >
                                {won ? 'WON ' : 'SETTLED '}
                                {(closed.realizedPnl ?? 0) >= 0 ? '+' : ''}
                                {formatCurrency(closed.realizedPnl ?? 0, currency, fxRates)}
                              </span>
                            )}
                          </div>
                        </div>
                        {closed.outcomeNote && (
                          <div className="text-[10px] text-slate-400 truncate">
                            {closed.outcomeNote}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          {/* Active Prediction Bets */}
          <section className="rounded-[22px] bg-[#15101f] border border-white/[0.08] p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-[#7c5cff]/20 border border-[#8b5cf6]/30 text-[#a78bfa] flex items-center justify-center shrink-0">
                  <Target className="w-4 h-4" />
                </span>
                <h2 className="text-[15px] sm:text-base font-bold text-white">
                  {t(lang, 'activeBets')}
                </h2>
              </div>
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#191928] border border-white/[0.08] text-slate-400 font-mono-nums">
                {openBets.length} open
              </span>
            </div>

            {state.bets.length === 0 ? (
              <p className="text-xs text-slate-400 py-2">
                No prediction bets placed yet. Select Bet Yes or Bet No on any event card to participate.
              </p>
            ) : (
              <div className="space-y-2.5">
                {state.bets.map((bet) => (
                  <div
                    key={bet.id}
                    className="rounded-2xl bg-[#191928] border border-white/[0.08] p-3.5 space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold text-white leading-snug">
                        {bet.question}
                      </p>
                      <span
                        className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-md shrink-0 ${
                          bet.choice === 'yes'
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : 'bg-rose-500/15 text-rose-400'
                        }`}
                      >
                        {bet.choice.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                      <span className="font-mono-nums">
                        Stake {formatCurrency(bet.stake, currency, fxRates)} · {bet.multiplier.toFixed(2)}x · Est.{' '}
                        {formatCurrency(bet.stake * bet.multiplier, currency, fxRates)}
                      </span>
                      {bet.status === 'open' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-400 font-semibold text-[11px]">
                          <Clock className="w-3 h-3" />
                          Pending Live Web Result
                        </span>
                      ) : bet.status === 'won' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 font-semibold text-[11px]">
                          <CheckCircle2 className="w-3 h-3" />
                          Won {formatCurrency(bet.payout ?? 0, currency, fxRates)}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-400 font-semibold text-[11px]">
                          Settled ₹0
                        </span>
                      )}
                    </div>
                    {bet.resolutionSummary && (
                      <div className="rounded-xl bg-black/25 border border-white/[0.06] p-2.5 text-[11px] text-slate-300 space-y-1">
                        <p>{bet.resolutionSummary}</p>
                        {bet.resolutionSources && bet.resolutionSources.length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-0.5">
                            {bet.resolutionSources.slice(0, 3).map((src, idx) => (
                              <a
                                key={`${src.uri}-${idx}`}
                                href={src.uri}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10.5px] font-semibold text-[#a78bfa] hover:underline"
                              >
                                {src.title || 'Verified Source'} ↗
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right 5 Columns: Trade, Bet & Wallet History Ledger */}
        <section className="lg:col-span-5 rounded-[22px] bg-[#13131f] border border-white/[0.08] p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#7c5cff]/20 border border-[#8b5cf6]/30 text-[#a78bfa] flex items-center justify-center shrink-0">
                <History className="w-4 h-4" />
              </span>
              <h2 className="text-[15px] sm:text-base font-bold text-white">
                {t(lang, 'walletHistory')}
              </h2>
            </div>
            <span className="text-[11px] text-slate-400 font-mono-nums">
              {filteredTx.length} / {state.transactions.length}
            </span>
          </div>

          {/* 7 Filter Pills */}
          <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar pb-0.5">
            {HISTORY_FILTERS.map((f) => {
              const active = historyFilter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setHistoryFilter(f.id)}
                  className={`btn-press min-h-[34px] px-3.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-colors ${
                    active
                      ? 'preserve-white bg-[#7c5cff] border-[#7c5cff] text-white shadow-[0_4px_12px_rgba(124,92,255,0.3)]'
                      : 'bg-[#191928] border-white/[0.08] text-slate-400 hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          <div className="space-y-2.5">
            {filteredTx.length === 0 ? (
              <p className="text-xs text-slate-400 py-8 text-center rounded-2xl bg-[#191928] border border-dashed border-white/[0.08]">
                No matching ledger entries for this filter.
              </p>
            ) : (
              filteredTx.map((tx) => {
                const isPayment = tx.type === 'deposit' || tx.type === 'withdraw';
                const isPositive = tx.amount >= 0;

                return (
                  <div
                    key={tx.id}
                    className="rounded-2xl bg-[#191928] border border-white/[0.06] px-3.5 py-3 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          isPositive
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : 'bg-rose-500/15 text-rose-400'
                        }`}
                      >
                        {isPositive ? (
                          <ArrowDownLeft className="w-4 h-4" />
                        ) : (
                          <ArrowUpRight className="w-4 h-4" />
                        )}
                      </span>

                      <div className="min-w-0 space-y-1">
                        <div className="text-[13.5px] font-semibold text-white truncate">
                          {tx.title}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono-nums truncate">
                          {tx.timestamp}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-bold ${getStatusBadgeClasses(
                              tx.status
                            )}`}
                          >
                            {tx.status}
                          </span>
                          {tx.utr && (
                            <span className="text-[10px] font-mono-nums text-slate-400">
                              UTR {tx.utr}
                            </span>
                          )}
                          {tx.status === 'Rejected' && tx.rejectionReason && (
                            <span className="text-[10px] text-rose-400 font-medium truncate">
                              Reason: {tx.rejectionReason}
                            </span>
                          )}
                          {isPayment && onReportIssue && (
                            <button
                              type="button"
                              onClick={() => onReportIssue(tx.id)}
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-[#a78bfa] hover:underline ml-0.5"
                            >
                              <HelpCircle className="w-3 h-3" />
                              Help
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div
                      className={`text-sm font-extrabold font-mono-nums shrink-0 ${
                        isPositive ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {isPositive ? '+' : ''}
                      {formatCurrency(tx.amount, currency, fxRates)}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
