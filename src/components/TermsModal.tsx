import React, { useEffect } from 'react';
import { AlertTriangle, FileText, ShieldCheck, X } from 'lucide-react';

interface TermsModalProps {
  open: boolean;
  onClose: () => void;
  onAccept?: () => void;
}

const PLATFORM_RULES_SECTIONS: {
  title: string;
  badge: string;
  body: string;
  example?: string;
  tone?: 'default' | 'emerald' | 'amber' | 'rose';
}[] = [
  {
    title: '1. Voluntary Participation & User Discretion',
    badge: 'VOLUNTARY',
    tone: 'emerald',
    body: 'Participation on Ouroboros is 100% voluntary ("apni marzi se khele"). Every user decides on their own whether to trade, play instant games, or enter prediction pools, and assumes full responsibility for their stake amounts and outcomes.',
  },
  {
    title: '2. Matched Betting & Live-Web Prediction Settlement',
    badge: 'SETTLEMENT',
    tone: 'default',
    body: 'P2P UP/DOWN trades settle automatically at timer expiry using live asset pricing (100% refund on unmatched timeout; same-side same-direction refund or opposite-direction forfeiture per market rules). Prediction markets can only be settled by the Platform Owner Desk via verified live web outcomes; winning payouts automatically deduct the configured platform commission.',
  },
  {
    title: '3. Aviator & Instant Game Rules',
    badge: 'GAMES',
    tone: 'amber',
    body: 'In Aviator and all instant games, rounds have a minimum ₹10 stake and dynamic crash/multiplier ceilings. Players must cash out before the plane flies away or a round ends; uncashed stakes forfeit upon crash.',
  },
  {
    title: '4. Wallet Deposits, First-Deposit Bonus & Gift Codes',
    badge: 'WALLET',
    tone: 'default',
    body: 'Deposits (₹100 – ₹1,00,000) require 12-digit UPI UTR verification by the Owner Desk. Eligible new accounts receive a capped first-deposit play bonus upon their initial verified deposit. Gift codes are issued exclusively by the Owner Desk with configurable user limits and progressive payout steps.',
  },
  {
    title: '5. Financial Risk & 18+ Compliance Disclaimer',
    badge: 'RISK',
    tone: 'rose',
    body: 'Trading short-horizon assets, crash games, and prediction markets involves real risk of financial loss. Users must be 18+, play responsibly within personal limits, and accept that settled wins, losses, and commissions are final.',
  },
];

export const TermsModal: React.FC<TermsModalProps> = ({ open, onClose, onAccept }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-end md:items-center justify-center p-0 md:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="terms-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-[560px] bg-[#130f1e] border border-white/10 rounded-t-[28px] md:rounded-[24px] max-h-[86vh] flex flex-col shadow-[0_-12px_40px_rgba(0,0,0,0.5)] animate-notif-in">
        <div className="w-10 h-1 bg-white/15 rounded-full mx-auto mt-3 mb-1 md:hidden" />

        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#7c3aed]/20 border border-[#7c3aed]/35 flex items-center justify-center text-[#c4b5fd] shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 id="terms-modal-title" className="text-base font-bold text-white truncate">
                Platform Rules &amp; Risk Disclaimer
              </h2>
              <p className="text-[11px] text-[#94a3b8]">
                Ouroboros P2P Prediction &amp; Settlement Policy
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Platform Rules and Terms"
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-[#94a3b8] hover:text-white transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 text-left">
          {PLATFORM_RULES_SECTIONS.map((sec) => {
            const badgeClass =
              sec.tone === 'emerald'
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                : sec.tone === 'amber'
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                : sec.tone === 'rose'
                ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                : 'bg-[#7c3aed]/20 text-[#c4b5fd] border-[#8b5cf6]/30';
            return (
              <div
                key={sec.title}
                className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-3.5 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs sm:text-[13px] font-bold text-[#e9d5ff] leading-snug">
                    {sec.title}
                  </h3>
                  <span
                    className={`px-2 py-0.5 rounded-full border text-[9.5px] font-extrabold tracking-wider shrink-0 ${badgeClass}`}
                  >
                    {sec.badge}
                  </span>
                </div>
                <p className="text-xs text-[#cbd5e1] leading-relaxed">{sec.body}</p>
                {sec.example && (
                  <div className="rounded-xl bg-[#1a1529] border border-white/[0.06] px-3 py-2 text-[11px] text-[#e2e8f0] leading-relaxed">
                    {sec.example}
                  </div>
                )}
              </div>
            );
          })}

          <div className="rounded-2xl bg-amber-500/10 border border-amber-500/25 p-3 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-200/90 leading-relaxed">
              Every P2P order clearly displays whether it is <strong>Pending</strong>,{' '}
              <strong>Matched</strong>, <strong>Settled</strong>, or{' '}
              <strong>Cancelled/Refunded</strong> along with exact exit price and fee breakdown.
            </p>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-white/[0.08] flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 text-[11px] text-emerald-300 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            Transparent P2P Rules · Updated Nov 2026
          </span>
          <button
            type="button"
            onClick={() => {
              if (onAccept) onAccept();
              onClose();
            }}
            className="preserve-white btn-press min-h-[40px] px-5 rounded-xl bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-xs font-bold transition-colors"
          >
            {onAccept ? 'Accept & Continue' : 'I Understand'}
          </button>
        </div>
      </div>
    </div>
  );
};
