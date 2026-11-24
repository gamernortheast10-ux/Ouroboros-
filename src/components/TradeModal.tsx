import React, { useEffect, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, X } from 'lucide-react';
import { BaseCurrency, FxRatesMap, MarketAsset, TimeHorizon, TradeSide } from '../types/trading';
import { calculateTradeFees, formatCurrency, validateTradeStake } from '../utils/tradingEngine';
import { AssetBadge } from './BrandMark';

interface TradeModalProps {
  asset: MarketAsset | null;
  initialSide?: TradeSide;
  balance: number;
  currency?: BaseCurrency;
  fxRates?: FxRatesMap;
  onClose: () => void;
  onConfirm: (params: { assetId: string; side: TradeSide; horizon: TimeHorizon; stake: number }) => void;
}

const HORIZONS: TimeHorizon[] = ['30s', '1m', '5m', '1h', '24h', '7d'];
const PRESET_STAKES = [100, 500, 1000, 5000];

export const TradeModal: React.FC<TradeModalProps> = ({
  asset,
  initialSide = 'long',
  balance,
  currency = 'INR',
  fxRates,
  onClose,
  onConfirm,
}) => {
  const [horizon, setHorizon] = useState<TimeHorizon>('5m');
  const [stakeText, setStakeText] = useState<string>('500');
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    setErrorMsg('');
  }, [asset, stakeText]);

  if (!asset) return null;

  const numericStake = Number(stakeText) || 0;
  const fees = calculateTradeFees(numericStake);

  const handleExecute = (side: TradeSide) => {
    const check = validateTradeStake(numericStake, balance);
    if (!check.valid) {
      setErrorMsg(check.error ?? 'Invalid stake amount.');
      return;
    }
    onConfirm({
      assetId: asset.id,
      side,
      horizon,
      stake: numericStake,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/75 backdrop-blur-sm p-0 md:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="trade-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md bg-[#12121c] border border-white/10 rounded-t-3xl md:rounded-2xl p-5 pb-7 shadow-2xl">
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4 md:hidden" />

        <div className="flex items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-3 min-w-0">
            <AssetBadge asset={asset} size="lg" />
            <div className="min-w-0">
              <h2 id="trade-modal-title" className="text-lg font-bold text-white truncate">
                Trade {asset.symbol}
              </h2>
              <p className="text-xs text-slate-400 font-mono-nums">
                {asset.name} · {formatCurrency(asset.price, currency, fxRates)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close trade modal"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-4">
          <span className="block text-xs font-medium text-slate-400 mb-2">
            Select Time Horizon
          </span>
          <div className="grid grid-cols-6 gap-1.5" role="group" aria-label="Time horizon">
            {HORIZONS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setHorizon(t)}
                className={`min-h-[40px] rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
                  horizon === t
                    ? 'preserve-white bg-[#7c5cfc] text-white'
                    : 'bg-[#1a1a28] text-slate-300 border border-white/[0.08] hover:border-white/20'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="trade-stake-input" className="text-xs font-medium text-slate-400">
              Investment Stake (INR)
            </label>
            <span className="text-xs text-slate-400 font-mono-nums">
              Available: {formatCurrency(balance, currency, fxRates)}
            </span>
          </div>
          <input
            id="trade-stake-input"
            type="number"
            min={50}
            step={10}
            value={stakeText}
            onChange={(e) => setStakeText(e.target.value)}
            className="w-full h-12 px-4 rounded-xl bg-[#181826] border border-white/10 text-white font-mono-nums text-base font-semibold focus:outline-none focus:border-[#7c5cfc]"
          />
          <div className="grid grid-cols-4 gap-2 mt-2.5">
            {PRESET_STAKES.map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => setStakeText(String(amt))}
                className="min-h-[38px] rounded-lg bg-[#181826] border border-white/[0.08] text-xs font-semibold text-slate-200 hover:border-[#7c5cfc] transition-colors font-mono-nums"
              >
                ₹{amt}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-[#181826] border border-white/[0.06] rounded-xl p-3.5 text-xs space-y-1.5 mb-4">
          <div className="flex justify-between text-slate-400">
            <span>Platform Commission (2.0%)</span>
            <span className="font-mono-nums text-slate-200">{formatCurrency(fees.commission, currency, fxRates)}</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Account Handling Fee</span>
            <span className="font-mono-nums text-slate-200">{formatCurrency(fees.handlingFee, currency, fxRates)}</span>
          </div>
          <div className="flex justify-between pt-1.5 border-t border-white/[0.06] font-semibold text-sm text-white">
            <span>Total Wallet Debit</span>
            <span className="font-mono-nums">{formatCurrency(fees.totalDebit, currency, fxRates)}</span>
          </div>
        </div>

        {errorMsg && (
          <p role="alert" className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2 mb-4">
            {errorMsg}
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => handleExecute('long')}
            className={`preserve-white min-h-[48px] rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
              initialSide === 'long' ? 'ring-2 ring-emerald-400/50' : ''
            }`}
          >
            <ArrowUpRight className="w-4 h-4" />
            UP · Buy / Long
          </button>
          <button
            type="button"
            onClick={() => handleExecute('short')}
            className={`preserve-white min-h-[48px] rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
              initialSide === 'short' ? 'ring-2 ring-rose-400/50' : ''
            }`}
          >
            <ArrowDownRight className="w-4 h-4" />
            DOWN · Sell / Short
          </button>
        </div>
      </div>
    </div>
  );
};
