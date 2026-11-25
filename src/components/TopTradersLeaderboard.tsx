import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { AppState } from '../types/trading';
import {
  buildTopTradersLeaderboard,
  formatCurrency,
  getEffectivePlatformSettings,
} from '../utils/tradingEngine';

interface TopTradersLeaderboardProps {
  state: AppState;
  onTradeNow?: () => void;
  embeddedInModal?: boolean;
}

export const LeaderboardPodiumIcon: React.FC<{ className?: string }> = ({
  className = 'w-4 h-4',
}) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <rect x="3" y="12" width="5" height="9" rx="1" />
    <rect x="9.5" y="5" width="5" height="16" rx="1" />
    <rect x="16" y="9" width="5" height="12" rx="1" />
  </svg>
);

const RankMedalCrest: React.FC<{ rank: 1 | 2 | 3 }> = ({ rank }) => {
  const palette =
    rank === 1
      ? {
          bg: 'bg-amber-400/15 border-amber-400/45 text-amber-300',
          label: '01',
        }
      : rank === 2
      ? {
          bg: 'bg-slate-300/15 border-slate-300/40 text-slate-200',
          label: '02',
        }
      : {
          bg: 'bg-orange-400/15 border-orange-400/40 text-orange-300',
          label: '03',
        };

  return (
    <span
      className={`w-8 h-7 rounded-lg border font-mono-nums font-extrabold text-[11px] tracking-tight inline-flex items-center justify-center shrink-0 ${palette.bg}`}
    >
      #{palette.label}
    </span>
  );
};

export const TopTradersLeaderboard: React.FC<TopTradersLeaderboardProps> = ({
  state,
  onTradeNow,
  embeddedInModal = false,
}) => {
  const [expanded, setExpanded] = useState(true);
  const settings = getEffectivePlatformSettings(state);
  const currency = state.profile.baseCurrency ?? 'INR';
  const fxRates = state.fxRates;

  const { entries, currentUserEntry } = useMemo(
    () => buildTopTradersLeaderboard(state, 10),
    [state]
  );

  if (settings.leaderboardEnabled === false) {
    return null;
  }

  const getRankBadge = (rank: number) => {
    if (rank === 1 || rank === 2 || rank === 3) {
      return <RankMedalCrest rank={rank} />;
    }
    return (
      <span className="w-8 h-7 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[#94a3b8] font-mono-nums font-bold text-[11px] inline-flex items-center justify-center shrink-0">
        #{String(rank).padStart(2, '0')}
      </span>
    );
  };

  const listContent = (
    <div className="space-y-1.5">
      {entries.map((trader) => (
        <div
          key={`${trader.rank}-${trader.uid}`}
          className={`flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl border transition-colors ${
            trader.isCurrentUser
              ? 'bg-[#7c3aed]/15 border-[#8b5cf6]/50'
              : trader.rank <= 3
              ? 'bg-white/[0.04] border-white/[0.09]'
              : 'bg-white/[0.02] border-white/[0.05]'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {getRankBadge(trader.rank)}

            <div className="w-8 h-8 rounded-full bg-[#7c3aed]/20 border border-[#8b5cf6]/30 flex items-center justify-center text-xs font-extrabold text-[#c4b5fd] shrink-0">
              {trader.name.charAt(0).toUpperCase()}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs sm:text-[13px] font-bold text-[#f1f5f9] truncate">
                  {trader.name}
                </span>
                {trader.isCurrentUser && (
                  <span className="px-1.5 py-0.5 rounded bg-[#7c3aed] text-[9px] font-extrabold text-white uppercase shrink-0">
                    You
                  </span>
                )}
                {trader.rank === 1 && (
                  <span className="px-1.5 py-0.5 rounded bg-amber-400/15 border border-amber-400/35 text-[9px] font-extrabold text-amber-300 uppercase shrink-0">
                    Leader
                  </span>
                )}
              </div>
              <div className="text-[10.5px] text-[#94a3b8] font-mono-nums flex items-center gap-1.5 truncate">
                <span className="text-[#a78bfa] font-semibold">{trader.tierName}</span>
                <span>·</span>
                <span>{trader.winRatePct}% Win</span>
                <span>·</span>
                <span>{trader.tradesWon}W</span>
              </div>
            </div>
          </div>

          <div className="text-right shrink-0">
            <div
              className={`text-xs sm:text-[13px] font-extrabold font-mono-nums ${
                trader.realizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {trader.realizedPnl >= 0 ? '+' : ''}
              {formatCurrency(trader.realizedPnl, currency, fxRates)}
            </div>
            <div className="text-[9.5px] text-[#94a3b8] uppercase tracking-wider">
              Realized PnL
            </div>
          </div>
        </div>
      ))}

      {currentUserEntry && currentUserEntry.rank > 10 && (
        <div className="mt-2 pt-2.5 border-t border-white/[0.08] flex items-center justify-between gap-2 px-2 text-xs">
          <div className="flex items-center gap-2 text-[#c4b5fd] font-semibold">
            <span className="px-2 py-0.5 rounded bg-[#7c3aed]/20 border border-[#8b5cf6]/30 font-mono-nums text-[11px] font-bold">
              #{currentUserEntry.rank}
            </span>
            <span>Your Position</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`font-mono-nums font-bold ${
                currentUserEntry.realizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {currentUserEntry.realizedPnl >= 0 ? '+' : ''}
              {formatCurrency(currentUserEntry.realizedPnl, currency, fxRates)}
            </span>
            {onTradeNow && (
              <button
                type="button"
                onClick={onTradeNow}
                className="preserve-white btn-press px-2.5 py-1 rounded-lg bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-[11px] font-bold"
              >
                Climb Rank
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );

  if (embeddedInModal) {
    return (
      <section id="top-traders-leaderboard" aria-label="Top Traders Leaderboard">
        {listContent}
      </section>
    );
  }

  return (
    <section
      id="top-traders-leaderboard"
      aria-label="Top Traders Leaderboard"
      className="bg-[#15101f] border border-white/[0.06] rounded-[20px] p-4 space-y-3"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-8 h-8 rounded-xl bg-[#7c3aed]/15 border border-[#8b5cf6]/30 text-[#a78bfa] flex items-center justify-center shrink-0">
            <LeaderboardPodiumIcon className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <h2 className="text-[15px] sm:text-base font-bold text-[#f1f5f9] leading-tight truncate">
              Top Traders
            </h2>
            <p className="text-[11px] text-[#94a3b8] truncate">
              Top 10 ranked by Realized PnL
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-label={expanded ? 'Collapse top traders leaderboard' : 'Expand top traders leaderboard'}
          className="btn-press inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-[11px] font-semibold text-[#c4b5fd] shrink-0"
        >
          <span>{expanded ? 'Hide' : 'Show Top 10'}</span>
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {expanded && listContent}
    </section>
  );
};
