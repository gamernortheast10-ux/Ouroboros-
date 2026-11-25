import React, { useMemo } from 'react';
import { CalendarCheck2, CheckCircle2, Flame, Lock, Sparkles } from 'lucide-react';
import { AppState } from '../types/trading';
import {
  computeDailyCheckInRewardInr,
  formatCurrency,
  getDayKey,
  getEffectivePlatformSettings,
  getEffectiveReferralConfig,
  hasVerifiedDeposit,
} from '../utils/tradingEngine';

interface DailyCheckInCardProps {
  state: AppState;
  onClaimDailyCheckIn: () => void;
  onDepositNow: () => void;
  onSignInPrompt: () => void;
}

export const DailyCheckInCard: React.FC<DailyCheckInCardProps> = ({
  state,
  onClaimDailyCheckIn,
  onDepositNow,
  onSignInPrompt,
}) => {
  const settings = getEffectivePlatformSettings(state);
  const cfg = getEffectiveReferralConfig(state);
  const currency = state.profile.baseCurrency ?? 'INR';
  const fxRates = state.fxRates;

  const isEnabled = settings.dailyCheckInEnabled !== false;
  const requiresDeposit = settings.dailyCheckInRequiresDeposit !== false;
  const baseReward = settings.dailyCheckInBaseReward ?? 10;
  const isAuthed = Boolean(state.isAuthenticated);

  const todayKey = getDayKey();
  const yesterdayKey = getDayKey(Date.now() - 86400000);
  const cleanEmail = state.profile.email.trim().toLowerCase();
  const currentAcc = cleanEmail
    ? (state.registeredAccounts ?? []).find(
        (a) => a.email.trim().toLowerCase() === cleanEmail
      )
    : undefined;

  const lastClaimed = state.profile.lastCheckInDate ?? currentAcc?.lastCheckInDate;
  const currentStreak = state.profile.checkInStreak ?? currentAcc?.checkInStreak ?? 0;
  const claimedToday = isAuthed && lastClaimed === todayKey;
  const activeStreak =
    lastClaimed === todayKey || lastClaimed === yesterdayKey ? currentStreak : 0;

  const hasDeposit = useMemo(() => hasVerifiedDeposit(state), [state]);
  const lockedByDeposit = isAuthed && requiresDeposit && !hasDeposit;

  const nextStreakDay = claimedToday ? currentStreak : activeStreak + 1;
  const todayRewardInr = computeDailyCheckInRewardInr(baseReward, nextStreakDay);

  if (!isEnabled) {
    return null;
  }

  return (
    <section
      id="daily-checkin-card"
      aria-label="Daily Check-In Rewards"
      className="bg-[#15101f] border border-white/[0.08] rounded-[20px] p-4 space-y-3"
    >
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="preserve-white w-9 h-9 rounded-xl bg-gradient-to-br from-[#8b5cf6] to-[#6d28d9] text-white flex items-center justify-center shadow-[0_6px_16px_rgba(124,58,237,0.35)] shrink-0">
            <CalendarCheck2 className="w-4.5 h-4.5" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h2 className="text-[15px] sm:text-base font-bold text-[#f1f5f9] leading-tight">
                Daily Check-In
              </h2>
              {activeStreak > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-[10px] font-bold text-amber-300 font-mono-nums">
                  <Flame className="w-3 h-3" />
                  {activeStreak}d streak
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#94a3b8] mt-0.5">
              Earn ₹{baseReward}–₹50 daily play bonus · Zero-risk deposit gated
            </p>
          </div>
        </div>

        <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-xs font-extrabold text-emerald-300 font-mono-nums shrink-0">
          +{formatCurrency(todayRewardInr, currency, fxRates)}
        </span>
      </div>

      {/* 7-Day Streak Ladder */}
      <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
        {[1, 2, 3, 4, 5, 6, 7].map((day) => {
          const amt = computeDailyCheckInRewardInr(baseReward, day);
          const completed = activeStreak >= day && (claimedToday || day <= activeStreak);
          const isCurrentTarget = !claimedToday && day === Math.min(7, activeStreak + 1);
          return (
            <div
              key={day}
              className={`rounded-xl py-1.5 px-1 text-center border transition-all ${
                completed
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                  : isCurrentTarget
                  ? 'bg-[#7c3aed]/20 border-[#8b5cf6] text-white'
                  : 'bg-white/[0.03] border-white/[0.06] text-[#94a3b8]'
              }`}
            >
              <div className="text-[9px] font-bold uppercase">D{day}</div>
              <div className="text-[10.5px] font-extrabold font-mono-nums mt-0.5">
                ₹{amt}
              </div>
            </div>
          );
        })}
      </div>

      {/* Action / Gate State */}
      {!isAuthed ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
          <div className="text-[11.5px] text-[#c4b5fd] leading-snug">
            Sign in &amp; complete 1 deposit (₹{cfg.minDepositInr}+) to unlock daily check-in rewards.
          </div>
          <button
            type="button"
            onClick={onSignInPrompt}
            className="preserve-white btn-press min-h-[38px] px-4 rounded-xl bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Sign In to Claim
          </button>
        </div>
      ) : lockedByDeposit ? (
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-start gap-2 text-[11.5px] text-amber-200 leading-snug">
            <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>
              Deposit required: Complete at least 1 verified deposit (₹{cfg.minDepositInr}+) to unlock Daily Check-in Rewards.
            </span>
          </div>
          <button
            type="button"
            onClick={onDepositNow}
            className="preserve-white btn-press min-h-[36px] px-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold whitespace-nowrap shrink-0"
          >
            Deposit Now
          </button>
        </div>
      ) : claimedToday ? (
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 flex items-center justify-between gap-2 text-xs text-emerald-300 font-bold">
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            Claimed Today (Day {currentStreak} Streak)
          </span>
          <span className="text-[11px] font-normal text-emerald-200/80">
            Come back tomorrow
          </span>
        </div>
      ) : (
        <button
          type="button"
          id="claim-daily-checkin-btn"
          onClick={onClaimDailyCheckIn}
          className="preserve-white btn-press w-full min-h-[42px] rounded-xl text-white text-xs font-extrabold inline-flex items-center justify-center gap-2 shadow-[0_6px_18px_rgba(124,58,237,0.35)]"
          style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)' }}
        >
          <Sparkles className="w-4 h-4" />
          Claim Day {nextStreakDay} Reward (+{formatCurrency(todayRewardInr, currency, fxRates)})
        </button>
      )}
    </section>
  );
};
