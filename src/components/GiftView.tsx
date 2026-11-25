import React, { useState } from 'react';
import {
  ArrowRight,
  Check,
  ClipboardPaste,
  Copy,
  Gift,
  Share2,
  Ticket,
  Users,
} from 'lucide-react';
import { AppState } from '../types/trading';
import {
  formatCurrency,
  generateReferralCode,
  getEffectiveReferralConfig,
} from '../utils/tradingEngine';

interface GiftViewProps {
  state: AppState;
  onRedeemCode: (code: string) => { ok: boolean; error?: string; amount?: number };
}

export const GiftView: React.FC<GiftViewProps> = ({ state, onRedeemCode }) => {
  const [codeInput, setCodeInput] = useState('');
  const [typingPulse, setTypingPulse] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedKey, setCopiedKey] = useState<'code' | 'link' | null>(null);

  const totalFromGifts = state.redeemedGifts.reduce((sum, g) => sum + g.amount, 0);
  const cfg = getEffectiveReferralConfig(state);
  const cleanEmail = state.profile.email.trim().toLowerCase();
  const currentAcc = (state.registeredAccounts ?? []).find(
    (a) => a.email.trim().toLowerCase() === cleanEmail
  );
  const myReferralCode =
    currentAcc?.referralCode ||
    state.profile.referralCode ||
    generateReferralCode(cleanEmail || state.profile.uid || 'OURO');
  const invitedCount = currentAcc?.rewardedReferralsCount ?? 0;
  const referralEarned = currentAcc?.referralEarnedInr ?? 0;
  const capPct =
    cfg.referralBonusCapInr > 0
      ? Math.min(100, Math.round((referralEarned / cfg.referralBonusCapInr) * 100))
      : 100;
  const inviteLink =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname.replace(/\/index\.html$/, '').replace(/\/+$/, '')}/?ref=${encodeURIComponent(myReferralCode)}`
      : `/?ref=${encodeURIComponent(myReferralCode)}`;

  const handleCopy = async (text: string, key: 'code' | 'link') => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard fallback
    }
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey((c) => (c === key ? null : c)), 1800);
  };

  const handleShareInvite = async () => {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: 'Join Ouroboros Trading & Games',
          text: `Use my invite code ${myReferralCode} — unlock ₹${cfg.refereeBonusInr} after your 1st bet or trade!`,
          url: inviteLink,
        });
        return;
      } catch {
        // Fallback to copy link
      }
    }
    await handleCopy(inviteLink, 'link');
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setCodeInput(text.trim().toUpperCase());
        setFeedback(null);
        return;
      }
    } catch {
      // Clipboard access unavailable
    }
    setFeedback({
      type: 'error',
      text: 'Paste from clipboard is unavailable — enter your Owner-issued gift code manually.',
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = onRedeemCode(codeInput);
    if (res.ok) {
      const creditFormatted = formatCurrency(res.amount ?? 0, state.profile.baseCurrency, state.fxRates);
      setFeedback({
        type: 'success',
        text: `Credited +${creditFormatted} to your wallet balance.`,
      });
      setCodeInput('');
    } else {
      setFeedback({
        type: 'error',
        text: res.error ?? 'Could not redeem gift code.',
      });
    }
  };

  return (
    <div className="space-y-3.5 sm:space-y-5 animate-fade-up">
      {/* Compact Hero Banner matching Gift Code Reference */}
      <section
        className="hero-preserve-dark relative overflow-hidden rounded-[22px] sm:rounded-[26px] p-3.5 sm:p-5 md:p-6 border border-white/15 shadow-[0_14px_38px_rgba(76,29,149,0.32)]"
        style={{
          background: 'linear-gradient(155deg, #2b1055 0%, #5b21b6 48%, #7c3aed 100%)',
        }}
      >
        <div aria-hidden="true" className="profile-header-shine" />

        <div className="relative z-10 flex items-center justify-between gap-3">
          <div className="space-y-1 sm:space-y-2 max-w-xl min-w-0">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-white/15 border border-white/20 text-[10px] font-extrabold uppercase tracking-[0.14em] text-purple-100">
              REWARDS &amp; INVITES
            </span>
            <h1 className="font-display text-xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight">
              Unlock gifts &amp; referral perks
            </h1>
            <p className="text-[11px] sm:text-sm text-purple-100/85 leading-snug max-w-md">
              Redeem promo drops or invite friends with your personal code to earn capped first-bet rewards.
            </p>
          </div>

          <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0 shadow-inner">
            <svg viewBox="0 0 64 64" className="w-10 h-10 sm:w-14 sm:h-14" fill="none">
              <rect x="12" y="28" width="40" height="26" rx="5" fill="#e9d5ff" fillOpacity="0.22" stroke="#ffffff" strokeWidth="2.2" />
              <rect x="9" y="20" width="46" height="10" rx="4" fill="#c4b5fd" fillOpacity="0.35" stroke="#ffffff" strokeWidth="2.2" />
              <path d="M32 20v34" stroke="#ffffff" strokeWidth="2.4" />
              <path d="M32 20c-3-7-12-9-12-3s9 3 12 3zm0 0c3-7 12-9 12-3s-9 3-12 3z" stroke="#fde68a" strokeWidth="2.2" fill="#fde68a" fillOpacity="0.25" />
            </svg>
          </div>
        </div>

        {/* Frosted Dual Stat Bar: YOUR BALANCE | FROM GIFTS & INVITES */}
        <div className="relative z-10 mt-3.5 sm:mt-5 rounded-xl sm:rounded-2xl bg-white/[0.12] backdrop-blur-md border border-white/20 p-3 sm:p-4 grid grid-cols-2 divide-x divide-white/15">
          <div className="pr-2.5 sm:pr-3">
            <div className="text-[9.5px] sm:text-[10px] font-bold uppercase tracking-wider text-purple-100/80">
              Your Balance
            </div>
            <div className="text-lg sm:text-2xl font-extrabold text-white font-mono-nums mt-0.5 leading-tight">
              {formatCurrency(state.balance, state.profile.baseCurrency, state.fxRates)}
            </div>
          </div>
          <div className="pl-3 sm:pl-4">
            <div className="text-[9.5px] sm:text-[10px] font-bold uppercase tracking-wider text-purple-100/80">
              Gifts &amp; Invites
            </div>
            <div className="text-lg sm:text-2xl font-extrabold text-emerald-300 font-mono-nums mt-0.5 leading-tight">
              +{formatCurrency(totalFromGifts + referralEarned, state.profile.baseCurrency, state.fxRates)}
            </div>
          </div>
        </div>
      </section>

      {/* Capped Invite & Earn Card */}
      <section className="rounded-[20px] sm:rounded-[24px] bg-[#13131f] border border-white/[0.08] p-3.5 sm:p-5 space-y-3.5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#7c3aed] to-[#5b21b6] text-white flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-extrabold text-white leading-tight">
                Invite &amp; Earn (Capped)
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-400">
                Friend gets <strong className="text-emerald-400">₹{cfg.refereeBonusInr}</strong> &amp; you earn{' '}
                <strong className="text-emerald-400">₹{cfg.referrerBonusInr}</strong> once after their 1st bet or trade.
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-[#1d1d2e] border border-white/10 text-[11px] font-mono-nums font-bold text-[#c4b5fd] whitespace-nowrap">
            {invitedCount}/{cfg.maxReferralsPerUser} friends · ₹{referralEarned.toFixed(0)}/₹{cfg.referralBonusCapInr} cap
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-2xl bg-[#191928] border border-white/[0.08] p-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Your Invite Code
              </div>
              <div className="text-base font-extrabold font-mono-nums tracking-wider text-white truncate mt-0.5">
                {myReferralCode}
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleCopy(myReferralCode, 'code')}
              className="btn-press px-3 py-2 rounded-xl bg-[#242438] hover:bg-[#2f2f47] text-xs font-bold text-slate-100 inline-flex items-center gap-1.5 shrink-0"
            >
              {copiedKey === 'code' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-[#a78bfa]" />
                  Copy Code
                </>
              )}
            </button>
          </div>

          <div className="rounded-2xl bg-[#191928] border border-white/[0.08] p-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Invite Link
              </div>
              <div className="text-xs font-mono-nums text-slate-300 truncate mt-0.5">
                {inviteLink}
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => handleCopy(inviteLink, 'link')}
                className="btn-press px-2.5 py-2 rounded-xl bg-[#242438] hover:bg-[#2f2f47] text-xs font-bold text-slate-100 inline-flex items-center gap-1"
              >
                {copiedKey === 'link' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-[#a78bfa]" />
                    Copy
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleShareInvite}
                aria-label="Share invite link"
                className="preserve-white btn-press px-2.5 py-2 rounded-xl bg-[#7c3aed] hover:bg-[#6d28d9] text-xs font-bold text-white inline-flex items-center gap-1"
              >
                <Share2 className="w-3.5 h-3.5" />
                Share
              </button>
            </div>
          </div>
        </div>

        {/* Cap Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>Lifetime Referral Bonus Cap Progress</span>
            <span className="font-mono-nums font-bold text-slate-200">
              {capPct}% used
            </span>
          </div>
          <div className="h-2 rounded-full bg-white/[0.07] overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#8b5cf6] to-emerald-400 transition-all duration-300"
              style={{ width: `${capPct}%` }}
            />
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-start">
        {/* Have a gift code? */}
        <section className="lg:col-span-7 rounded-[20px] sm:rounded-[24px] bg-[#13131f] border border-white/[0.08] p-3.5 sm:p-5">
          <h2 className="text-base sm:text-lg font-extrabold text-white mb-0.5">Have a gift code?</h2>
          <p className="text-[11px] sm:text-xs text-slate-400 mb-3 sm:mb-4 leading-snug">
            Enter the code exactly as you received it. The amount credits to your wallet right away.
          </p>

          <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
            <div
              className={`flex items-center gap-2 p-1.5 sm:p-2 rounded-2xl bg-[#191928] border-2 border-dashed transition-all ${
                typingPulse
                  ? 'border-[#8b5cf6] shadow-[0_0_0_3px_rgba(139,92,246,0.2)]'
                  : 'border-white/15 focus-within:border-[#8b5cf6]'
              }`}
            >
              <div className="preserve-white w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-[#8b5cf6] to-[#6d28d9] flex items-center justify-center shrink-0 shadow-[0_6px_14px_rgba(124,58,237,0.35)]">
                <Ticket className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <input
                type="text"
                value={codeInput}
                onChange={(e) => {
                  setCodeInput(e.target.value.toUpperCase());
                  setFeedback(null);
                  setTypingPulse(true);
                  window.setTimeout(() => setTypingPulse(false), 260);
                }}
                placeholder="ENTER CODE"
                aria-label="Gift code input"
                className="flex-1 min-w-0 bg-transparent text-white font-mono-nums font-bold text-xs sm:text-sm tracking-widest placeholder:text-slate-500 focus:outline-none px-1.5"
              />
              <button
                type="button"
                onClick={handlePaste}
                className="btn-press min-h-[34px] sm:min-h-[38px] px-2.5 sm:px-3 rounded-xl bg-[#242438] hover:bg-[#2f2f47] text-[11px] sm:text-xs font-bold text-slate-200 inline-flex items-center gap-1 shrink-0"
              >
                <ClipboardPaste className="w-3.5 h-3.5 text-[#a78bfa]" />
                Paste
              </button>
            </div>

            {feedback && (
              <p
                role="alert"
                className={`text-xs rounded-xl px-3.5 py-2 border ${
                  feedback.type === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                    : 'bg-rose-500/10 border-rose-500/25 text-rose-400'
                }`}
              >
                {feedback.text}
              </p>
            )}

            <button
              type="submit"
              className="preserve-white btn-press w-full min-h-[44px] sm:min-h-[50px] rounded-xl sm:rounded-2xl text-white font-extrabold text-sm inline-flex items-center justify-center gap-2 shadow-[0_10px_26px_rgba(124,58,237,0.4)]"
              style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)' }}
            >
              <span>Redeem now</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="grid grid-cols-3 gap-2 pt-3.5 mt-3.5 sm:pt-5 sm:mt-5 border-t border-white/[0.06] text-center text-[11px] sm:text-xs">
            <div className="space-y-1">
              <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-[#7c3aed]/20 text-[#a78bfa] mx-auto flex items-center justify-center font-extrabold font-mono-nums">
                1
              </span>
              <div className="font-semibold text-slate-300">Get a code</div>
            </div>
            <div className="space-y-1">
              <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-[#7c3aed]/20 text-[#a78bfa] mx-auto flex items-center justify-center font-extrabold font-mono-nums">
                2
              </span>
              <div className="font-semibold text-slate-300">Enter here</div>
            </div>
            <div className="space-y-1">
              <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-[#7c3aed]/20 text-[#a78bfa] mx-auto flex items-center justify-center font-extrabold font-mono-nums">
                3
              </span>
              <div className="font-semibold text-slate-300">Get money</div>
            </div>
          </div>
        </section>

        {/* Redeemed List */}
        <section className="lg:col-span-5 rounded-[20px] sm:rounded-[24px] bg-[#13131f] border border-white/[0.08] p-3.5 sm:p-5">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h2 className="text-sm sm:text-base font-bold text-white">Redeemed</h2>
            <span className="text-xs font-mono-nums text-[#a78bfa] font-bold">
              {state.redeemedGifts.length} claimed
            </span>
          </div>

          {state.redeemedGifts.length === 0 ? (
            <div className="py-6 sm:py-10 text-center space-y-2 rounded-2xl bg-[#191928] border border-white/[0.06] px-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-[#7c3aed]/20 text-[#a78bfa] mx-auto flex items-center justify-center">
                <Gift className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <p className="text-sm font-bold text-white">No gift codes redeemed yet</p>
              <p className="text-[11px] sm:text-xs text-slate-400">
                Gift drops appear here when issued by the Owner Desk.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.06]">
              {state.redeemedGifts.map((gift) => (
                <div key={gift.id} className="py-2.5 sm:py-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold text-white font-mono-nums">{gift.code}</div>
                    <div className="text-xs text-slate-400">
                      {gift.label} · {gift.redeemedAt}
                    </div>
                  </div>
                  <div className="text-sm font-bold text-emerald-400 font-mono-nums">
                    +{formatCurrency(gift.amount, state.profile.baseCurrency, state.fxRates)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
