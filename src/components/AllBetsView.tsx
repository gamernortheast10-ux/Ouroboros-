import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  History,
  Search,
  Trophy,
  XCircle,
} from 'lucide-react';
import { AppState, MarketCategory, PredictionMarket } from '../types/trading';
import { t } from '../utils/i18n';
import { calculatePoolPercentages, formatCurrency } from '../utils/tradingEngine';

interface AllBetsViewProps {
  state: AppState;
  onBack: () => void;
  onOpenPrediction: (market: PredictionMarket, choice: 'yes' | 'no') => void;
}

type BetsTab = 'live_bets' | 'history';
type HistoryStatusFilter = 'all' | 'open' | 'settled';

const CATEGORIES: MarketCategory[] = [
  'All Markets',
  'Famous Games',
  'Mobile Brands',
  'Crypto',
  'Sports',
  'Political',
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

export const AllBetsView: React.FC<AllBetsViewProps> = ({
  state,
  onBack,
  onOpenPrediction,
}) => {
  const [activeTab, setActiveTab] = useState<BetsTab>('live_bets');
  const [category, setCategory] = useState<MarketCategory>('All Markets');
  const [search, setSearch] = useState('');
  const [historyFilter, setHistoryFilter] = useState<HistoryStatusFilter>('all');

  const currency = state.profile.baseCurrency;
  const fxRates = state.fxRates;
  const lang = state.profile.language;

  const filteredPools = useMemo(() => {
    const q = search.trim().toLowerCase();
    return state.predictions.filter((p) => {
      const catOk = category === 'All Markets' || p.category === category;
      const qOk =
        !q ||
        p.question.toLowerCase().includes(q) ||
        p.subLabel.toLowerCase().includes(q);
      return catOk && qOk;
    });
  }, [state.predictions, category, search]);

  const filteredBets = useMemo(() => {
    return state.bets.filter((b) => {
      if (historyFilter === 'all') return true;
      if (historyFilter === 'open') return b.status === 'open';
      return b.status === 'won' || b.status === 'lost';
    });
  }, [state.bets, historyFilter]);

  const openBetsCount = state.bets.filter((b) => b.status === 'open').length;
  const totalWonPayout = state.bets
    .filter((b) => b.status === 'won')
    .reduce((s, b) => s + (b.payout ?? 0), 0);

  return (
    <div className="space-y-5 animate-fade-up">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to home"
            className="btn-press w-10 h-10 rounded-xl bg-[#15101f] border border-white/10 flex items-center justify-center text-white"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="font-display text-xl font-extrabold text-white">
              {t(lang, 'pageBets')}
            </h1>
            <p className="text-xs text-[#94a3b8]">
              Browse every active bet pool and review your full personal bet history
            </p>
          </div>
        </div>

        {/* Switcher: All Live Bets | My Bet History */}
        <div className="inline-flex p-1 rounded-xl bg-[#15101f] border border-white/[0.08]">
          <button
            type="button"
            onClick={() => setActiveTab('live_bets')}
            className={`btn-press min-h-[36px] px-3.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 ${
              activeTab === 'live_bets'
                ? 'preserve-white bg-[#7c3aed] text-white'
                : 'text-[#94a3b8] hover:text-white'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            All Bets ({state.predictions.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`btn-press min-h-[36px] px-3.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 ${
              activeTab === 'history'
                ? 'preserve-white bg-[#7c3aed] text-white'
                : 'text-[#94a3b8] hover:text-white'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            My Bet History ({state.bets.length})
          </button>
        </div>
      </div>

      {/* Summary KPI Row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl bg-[#15101f] border border-white/[0.06] p-3.5">
          <div className="text-[11px] text-[#94a3b8]">Live Pools</div>
          <div className="text-lg sm:text-xl font-extrabold font-mono-nums text-white mt-0.5">
            {state.predictions.length}
          </div>
        </div>
        <div className="rounded-2xl bg-[#15101f] border border-white/[0.06] p-3.5">
          <div className="text-[11px] text-[#94a3b8]">Open Bets</div>
          <div className="text-lg sm:text-xl font-extrabold font-mono-nums text-[#a78bfa] mt-0.5">
            {openBetsCount}
          </div>
        </div>
        <div className="rounded-2xl bg-[#15101f] border border-white/[0.06] p-3.5">
          <div className="text-[11px] text-[#94a3b8]">Won Payouts</div>
          <div className="text-lg sm:text-xl font-extrabold font-mono-nums text-emerald-400 mt-0.5">
            {formatCurrency(totalWonPayout, currency, fxRates)}
          </div>
        </div>
      </div>

      {/* TAB 1: ALL LIVE BETS */}
      {activeTab === 'live_bets' && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`btn-press min-h-[36px] px-3.5 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 ${
                    category === cat
                      ? 'preserve-white bg-[#7c3aed] text-white'
                      : 'bg-[#15101f] border border-white/[0.06] text-[#94a3b8] hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="relative w-full md:w-64 shrink-0">
              <Search className="w-4 h-4 text-[#94a3b8] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search bet pools..."
                aria-label="Search bet pools"
                className="w-full h-10 pl-9 pr-3 rounded-xl bg-[#15101f] border border-white/[0.08] text-sm text-white placeholder:text-[#94a3b8]/60 focus:outline-none focus:border-[#7c3aed]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredPools.map((market) => {
              const pct = calculatePoolPercentages(market.yesPool, market.noPool);
              return (
                <article
                  key={market.id}
                  className="bg-[#15101f] border border-white/[0.06] rounded-[20px] p-5 flex flex-col justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2.5 text-xs">
                      <span className="font-semibold text-[#a78bfa]">{market.subLabel}</span>
                      <span className="bg-[#ef4444]/[0.12] text-[#f87171] px-2.5 py-0.5 rounded-full font-bold font-mono-nums">
                        {market.endsInSeconds < 3600
                          ? formatCountdown(market.endsInSeconds)
                          : market.endLabel}
                      </span>
                    </div>
                    <h2 className="text-[15px] font-bold text-white leading-snug">
                      {market.question}
                    </h2>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <div className="h-2 bg-[#1e293b] rounded-full overflow-hidden flex mb-2">
                        <div
                          className="h-full bg-emerald-500"
                          style={{ width: `${pct.firstPct}%` }}
                        />
                        <div
                          className="h-full bg-rose-500"
                          style={{ width: `${pct.secondPct}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-[#94a3b8] font-mono-nums">
                        <span>
                          YES {pct.firstPct}% · Pool{' '}
                          {formatCurrency(market.yesPool, currency, fxRates)}
                        </span>
                        <span>
                          NO {pct.secondPct}% · Pool{' '}
                          {formatCurrency(market.noPool, currency, fxRates)}
                        </span>
                      </div>
                    </div>

                    {market.resolvedOutcome ? (
                      <div className="space-y-2 pt-1">
                        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-xs font-bold text-emerald-300">
                          <span>Settled via Live Web: {market.resolvedOutcome.toUpperCase()}</span>
                          {market.resolvedAt && (
                            <span className="text-[10px] font-mono-nums text-emerald-200/80">
                              {market.resolvedAt}
                            </span>
                          )}
                        </div>
                        {market.resolutionSummary && (
                          <p className="text-[11px] text-slate-300 leading-relaxed">
                            {market.resolutionSummary}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2.5">
                        <button
                          type="button"
                          onClick={() => onOpenPrediction(market, 'yes')}
                          className="preserve-white btn-press min-h-[42px] rounded-xl font-bold text-xs text-white bg-emerald-600 hover:bg-emerald-500"
                        >
                          {t(lang, 'betYes')}
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenPrediction(market, 'no')}
                          className="preserve-white btn-press min-h-[42px] rounded-xl font-bold text-xs text-white bg-rose-600 hover:bg-rose-500"
                        >
                          {t(lang, 'betNo')}
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: MY BET HISTORY */}
      {activeTab === 'history' && (
        <section className="rounded-[22px] bg-[#15101f] border border-white/[0.08] p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-bold text-white">Your Bet History</h2>
            <div className="flex gap-1.5">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'open', label: 'Pending' },
                  { id: 'settled', label: 'Settled' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setHistoryFilter(f.id)}
                  className={`btn-press px-3 py-1.5 rounded-lg text-xs font-bold ${
                    historyFilter === f.id
                      ? 'preserve-white bg-[#7c3aed] text-white'
                      : 'bg-[#0b0814] text-[#94a3b8] hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {filteredBets.length === 0 ? (
            <div className="py-10 text-center space-y-3">
              <p className="text-sm font-semibold text-white">No bets recorded yet</p>
              <p className="text-xs text-[#94a3b8]">
                Place a Yes or No bet on any active pool to track your full bet history here.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('live_bets')}
                className="preserve-white btn-press min-h-[40px] px-4 rounded-xl bg-[#7c3aed] text-white text-xs font-bold"
              >
                Browse Live Bets
              </button>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.06]">
              {filteredBets.map((bet) => (
                <div key={bet.id} className="py-3.5 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white leading-snug">
                        {bet.question}
                      </p>
                      <p className="text-[11px] text-[#94a3b8] mt-0.5 font-mono-nums">
                        Placed {bet.placedAt} · Stake{' '}
                        {formatCurrency(bet.stake, currency, fxRates)} ·{' '}
                        {bet.multiplier.toFixed(2)}x
                      </p>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-bold shrink-0 ${
                        bet.choice === 'yes'
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : 'bg-rose-500/15 text-rose-400'
                      }`}
                    >
                      {bet.choice.toUpperCase()}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-mono-nums text-[#94a3b8]">
                      Est. Return:{' '}
                      <strong className="text-white">
                        {formatCurrency(bet.stake * bet.multiplier, currency, fxRates)}
                      </strong>
                    </span>

                    {bet.status === 'open' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 font-semibold text-[11px]">
                        <Clock className="w-3.5 h-3.5" />
                        Pending Live Web Result
                      </span>
                    ) : bet.status === 'won' ? (
                      <span className="inline-flex items-center gap-1 text-emerald-400 font-bold font-mono-nums">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Won {formatCurrency(bet.payout ?? 0, currency, fxRates)}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-rose-400 font-bold font-mono-nums">
                        <XCircle className="w-3.5 h-3.5" />
                        Lost ({formatCurrency(0, currency, fxRates)})
                      </span>
                    )}
                  </div>
                  {bet.resolutionSummary && (
                    <div className="rounded-xl bg-[#0b0814]/80 border border-white/[0.06] p-2.5 text-[11px] text-slate-300 space-y-1">
                      <p>{bet.resolutionSummary}</p>
                      {bet.resolutionSources && bet.resolutionSources.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-0.5">
                          {bet.resolutionSources.slice(0, 3).map((src, i) => (
                            <a
                              key={`${src.uri}-${i}`}
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
      )}
    </div>
  );
};
