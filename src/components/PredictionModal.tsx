import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { BaseCurrency, FxRatesMap, PredictionMarket } from '../types/trading';
import { MIN_BET_STAKE_INR, formatCurrency } from '../utils/tradingEngine';

interface PredictionModalProps {
  market: PredictionMarket | null;
  choice: 'yes' | 'no';
  balance: number;
  currency?: BaseCurrency;
  fxRates?: FxRatesMap;
  onClose: () => void;
  onConfirm: (params: { marketId: string; choice: 'yes' | 'no'; stake: number }) => void;
}

const PRESET_BETS = [50, 200, 500, 1000];

export const PredictionModal: React.FC<PredictionModalProps> = ({
  market,
  choice,
  balance,
  currency = 'INR',
  fxRates,
  onClose,
  onConfirm,
}) => {
  const [selectedChoice, setSelectedChoice] = useState<'yes' | 'no'>(choice);
  const [stakeText, setStakeText] = useState<string>('200');
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    setSelectedChoice(choice);
    setErrorMsg('');
  }, [market, choice]);

  if (!market) return null;

  const numericStake = Number(stakeText) || 0;
  const totalPool = market.yesPool + market.noPool + numericStake;
  const sidePool = (selectedChoice === 'yes' ? market.yesPool : market.noPool) + numericStake;
  const estMultiplier = sidePool > 0 ? Math.max(1.15, Math.min(4.5, totalPool / sidePool)) : 1.5;
  const estPayout = Math.round(numericStake * estMultiplier * 100) / 100;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!Number.isFinite(numericStake) || numericStake < MIN_BET_STAKE_INR) {
      setErrorMsg(`Minimum bet stake is ₹${MIN_BET_STAKE_INR}.`);
      return;
    }
    if (numericStake > balance) {
      setErrorMsg(`Insufficient wallet balance (available ₹${balance.toFixed(2)}).`);
      return;
    }
    onConfirm({ marketId: market.id, choice: selectedChoice, stake: numericStake });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/75 backdrop-blur-sm p-0 md:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="prediction-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md bg-[#12121c] border border-white/10 rounded-t-3xl md:rounded-2xl p-5 pb-7 shadow-2xl"
      >
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4 md:hidden" />
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <p className="text-xs text-slate-400 mb-1">
              {market.subLabel} · {market.endLabel}
            </p>
            <h2 id="prediction-modal-title" className="text-base font-bold text-white leading-snug">
              {market.question}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close prediction modal"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-white/5 shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2.5 mb-4">
          <button
            type="button"
            onClick={() => setSelectedChoice('yes')}
            className={`min-h-[44px] rounded-xl font-bold text-sm border transition-colors ${
              selectedChoice === 'yes'
                ? 'preserve-white bg-emerald-600 border-emerald-500 text-white'
                : 'bg-[#181826] border-white/10 text-slate-300'
            }`}
          >
            Bet YES
          </button>
          <button
            type="button"
            onClick={() => setSelectedChoice('no')}
            className={`min-h-[44px] rounded-xl font-bold text-sm border transition-colors ${
              selectedChoice === 'no'
                ? 'preserve-white bg-rose-600 border-rose-500 text-white'
                : 'bg-[#181826] border-white/10 text-slate-300'
            }`}
          >
            Bet NO
          </button>
        </div>

        <div className="mb-4">
          <div className="flex justify-between text-xs text-slate-400 mb-2">
            <label htmlFor="bet-stake-input">Bet Stake (INR)</label>
            <span className="font-mono-nums">
              Balance: {formatCurrency(balance, currency, fxRates)}
            </span>
          </div>
          <input
            id="bet-stake-input"
            type="number"
            min={20}
            step={10}
            value={stakeText}
            onChange={(e) => {
              setStakeText(e.target.value);
              setErrorMsg('');
            }}
            className="w-full h-12 px-4 rounded-xl bg-[#181826] border border-white/10 text-white font-mono-nums text-base font-semibold focus:outline-none focus:border-[#7c5cfc]"
          />
          <div className="grid grid-cols-4 gap-2 mt-2.5">
            {PRESET_BETS.map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => {
                  setStakeText(String(amt));
                  setErrorMsg('');
                }}
                className="min-h-[38px] rounded-lg bg-[#181826] border border-white/[0.08] text-xs font-semibold text-slate-200 hover:border-[#7c5cfc] font-mono-nums"
              >
                ₹{amt}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-[#181826] border border-white/[0.06] rounded-xl p-3.5 text-xs space-y-1.5 mb-4">
          <div className="flex justify-between text-slate-400">
            <span>Estimated Multiplier</span>
            <span className="font-mono-nums text-white">{estMultiplier.toFixed(2)}x</span>
          </div>
          <div className="flex justify-between font-semibold text-sm text-emerald-400">
            <span>Projected Payout</span>
            <span className="font-mono-nums">{formatCurrency(estPayout, currency, fxRates)}</span>
          </div>
        </div>

        {errorMsg && (
          <p role="alert" className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2 mb-4">
            {errorMsg}
          </p>
        )}

        <button
          type="submit"
          className={`preserve-white w-full min-h-[48px] rounded-xl font-bold text-sm text-white transition-colors ${
            selectedChoice === 'yes' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-rose-600 hover:bg-rose-500'
          }`}
        >
          Confirm {selectedChoice.toUpperCase()} Bet · {formatCurrency(numericStake, currency, fxRates)}
        </button>
      </form>
    </div>
  );
};
