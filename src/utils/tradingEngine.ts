import {
  ADMIN_OWNER_EMAIL,
  ADMIN_OWNER_PASSWORD,
  DEFAULT_MERCHANT_UPIS,
  DEFAULT_PLATFORM_SETTINGS,
  DEFAULT_REFERRAL_CONFIG,
  SEED_OWNER_ACCOUNT,
} from '../data/seedData';
import {
  ActiveBet,
  ActivePosition,
  AppState,
  BaseCurrency,
  CommissionLedgerEntry,
  FxRatesMap,
  MarketAsset,
  MerchantUpiConfig,
  P2PMatchKind,
  P2PTradeStatus,
  PendingTransferAnimation,
  PlatformSettings,
  PlayerLevelDefinition,
  PlayerLevelInfo,
  PredictionMarket,
  ReferralConfig,
  RegisteredAccount,
  SettledPositionSummary,
  TimeHorizon,
  TradeSide,
  WalletTransaction,
} from '../types/trading';

export const PLATFORM_COMMISSION_RATE = 0.02;
export const HANDLING_FEE_INR = 5;
export const MIN_TRADE_STAKE_INR = 50;
export const MIN_BET_STAKE_INR = 20;
export const MIN_TOPUP_INR = 100;
export const MAX_TOPUP_INR = 100000;
export const MIN_WITHDRAW_INR = 100;
export const MAX_WITHDRAW_INR = 100000;

const HORIZON_LEVERAGE: Record<TimeHorizon, number> = {
  '15s': 15,
  '30s': 12,
  '1m': 10,
  '5m': 8,
  '15m': 6,
  '1h': 5,
  '4h': 4,
  '1d': 3,
  '24h': 3,
  '7d': 2,
};

const HORIZON_DURATION_SECONDS: Record<TimeHorizon, number> = {
  '15s': 15,
  '30s': 30,
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '1h': 3600,
  '4h': 14400,
  '1d': 86400,
  '24h': 86400,
  '7d': 604800,
};

export function getHorizonLeverage(horizon: TimeHorizon): number {
  return HORIZON_LEVERAGE[horizon] ?? 8;
}

export function getHorizonDurationSeconds(horizon: TimeHorizon): number {
  return HORIZON_DURATION_SECONDS[horizon] ?? 300;
}

export function formatExactDateTime(ms = Date.now()): string {
  const d = new Date(ms);
  const datePart = d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
  });
  const timePart = d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  return `${datePart}, ${timePart}`;
}

export interface FeeBreakdown {
  stake: number;
  commission: number;
  handlingFee: number;
  totalDebit: number;
}

export function calculateTradeFees(stake: number): FeeBreakdown {
  const cleanStake = Number.isFinite(stake) && stake > 0 ? stake : 0;
  const commission = Math.round(cleanStake * PLATFORM_COMMISSION_RATE * 100) / 100;
  const handlingFee = cleanStake > 0 ? HANDLING_FEE_INR : 0;
  const totalDebit = Math.round((cleanStake + commission + handlingFee) * 100) / 100;
  return {
    stake: cleanStake,
    commission,
    handlingFee,
    totalDebit,
  };
}

export function validateTradeStake(
  stake: number,
  balance: number
): { valid: boolean; error?: string; fees: FeeBreakdown } {
  const fees = calculateTradeFees(stake);
  if (!Number.isFinite(stake) || stake < MIN_TRADE_STAKE_INR) {
    return {
      valid: false,
      error: `Minimum trade stake is ₹${MIN_TRADE_STAKE_INR}.`,
      fees,
    };
  }
  if (fees.totalDebit > balance) {
    return {
      valid: false,
      error: `Insufficient balance. Need ₹${fees.totalDebit.toFixed(2)}, available ₹${balance.toFixed(2)}.`,
      fees,
    };
  }
  return { valid: true, fees };
}

export function calculatePositionPnl(
  position: Pick<ActivePosition, 'side' | 'entryPrice' | 'stake' | 'horizon'>,
  currentPrice: number
): number {
  if (!position.entryPrice || position.entryPrice <= 0) return 0;
  const leverage = HORIZON_LEVERAGE[position.horizon] ?? 5;
  const priceDeltaRatio = (currentPrice - position.entryPrice) / position.entryPrice;
  const directionalRatio = position.side === 'long' ? priceDeltaRatio : -priceDeltaRatio;
  const rawPnl = position.stake * directionalRatio * leverage;
  return Math.round(rawPnl * 100) / 100;
}

export function calculatePoolPercentages(
  firstPool: number,
  secondPool: number
): { firstPct: number; secondPct: number } {
  const total = firstPool + secondPool;
  if (total <= 0) return { firstPct: 50, secondPct: 50 };
  const firstPct = Math.round((firstPool / total) * 100);
  return { firstPct, secondPct: 100 - firstPct };
}

export function computeDebitBreakdown(
  balance: number,
  withdrawableBalance: number,
  debitAmount: number
): { nextBalance: number; nextWithdrawable: number } {
  const cleanWithdrawable = Math.min(balance, Math.max(0, withdrawableBalance));
  const lockedDeposit = Math.max(0, balance - cleanWithdrawable);
  // Consume locked deposit funds first before reducing withdrawable winnings
  const excessOverLocked = Math.max(0, debitAmount - lockedDeposit);
  const nextBalance = Math.max(0, Math.round((balance - debitAmount) * 100) / 100);
  const nextWithdrawable = Math.min(
    nextBalance,
    Math.max(0, Math.round((cleanWithdrawable - excessOverLocked) * 100) / 100)
  );
  return { nextBalance, nextWithdrawable };
}

export function getCurrentUserRestriction(state: AppState): {
  restricted: boolean;
  banned: boolean;
  frozen: boolean;
  withdrawalsBlocked: boolean;
  tradingBlocked: boolean;
  reason?: string;
} {
  const cleanEmail = state.profile.email.trim().toLowerCase();
  if (!cleanEmail) {
    return {
      restricted: false,
      banned: false,
      frozen: false,
      withdrawalsBlocked: false,
      tradingBlocked: false,
    };
  }
  const acc = (state.registeredAccounts ?? []).find(
    (a) => a.email.trim().toLowerCase() === cleanEmail
  );
  if (!acc) {
    return {
      restricted: false,
      banned: false,
      frozen: false,
      withdrawalsBlocked: false,
      tradingBlocked: false,
    };
  }
  const banned = Boolean(acc.banned);
  const frozen = Boolean(acc.frozen);
  return {
    restricted: banned || frozen,
    banned,
    frozen,
    withdrawalsBlocked: Boolean(acc.withdrawalsBlocked),
    tradingBlocked: Boolean(acc.tradingBlocked),
    reason: banned ? acc.banReason || acc.freezeReason : acc.freezeReason,
  };
}

export function isCurrentUserFrozen(state: AppState): { frozen: boolean; reason?: string } {
  const res = getCurrentUserRestriction(state);
  return { frozen: res.restricted, reason: res.reason };
}

export function getEffectivePlatformSettings(
  state?: Pick<AppState, 'platformSettings'>
): PlatformSettings {
  return {
    ...DEFAULT_PLATFORM_SETTINGS,
    ...(state?.platformSettings ?? {}),
  };
}

export function getActiveMerchantUpis(
  state?: Pick<AppState, 'merchantUpiPool'>
): MerchantUpiConfig[] {
  const pool =
    Array.isArray(state?.merchantUpiPool) && state.merchantUpiPool.length > 0
      ? state.merchantUpiPool
      : DEFAULT_MERCHANT_UPIS;
  const active = pool.filter((u) => u.active && u.upiId.trim());
  const source = active.length > 0 ? active : pool.filter((u) => u.upiId.trim());
  if (source.length === 0) return DEFAULT_MERCHANT_UPIS;
  return [...source].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));
}

export function getPrimaryMerchantUpi(
  state?: Pick<AppState, 'merchantUpiPool'>,
  preferredId?: string
): MerchantUpiConfig {
  const active = getActiveMerchantUpis(state);
  if (preferredId) {
    const match = active.find((u) => u.id === preferredId);
    if (match) return match;
  }
  return active.find((u) => u.isPrimary) ?? active[0] ?? DEFAULT_MERCHANT_UPIS[0];
}

export function executeTradeOrder(
  state: AppState,
  params: {
    assetId: string;
    side: TradeSide;
    horizon: TimeHorizon;
    stake: number;
  },
  nowMs = Date.now()
): { ok: true; nextState: AppState; position: ActivePosition } | { ok: false; error: string } {
  const restriction = getCurrentUserRestriction(state);
  if (restriction.restricted) {
    return {
      ok: false,
      error: `${restriction.banned ? 'Account banned' : 'Account is currently frozen'}${
        restriction.reason ? `: ${restriction.reason}` : '. Contact Admin support.'
      }`,
    };
  }
  if (restriction.tradingBlocked) {
    return {
      ok: false,
      error: 'Trading is temporarily paused on your account by Owner Console.',
    };
  }
  const asset = state.assets.find((a) => a.id === params.assetId);
  if (!asset) {
    return { ok: false, error: 'Selected market asset was not found.' };
  }

  const check = validateTradeStake(params.stake, state.balance);
  if (!check.valid) {
    return { ok: false, error: check.error ?? 'Invalid stake amount.' };
  }

  const cleanEmail = state.profile.email.trim().toLowerCase();
  const cleanName = state.profile.name.trim() || cleanEmail || 'Trader';
  const cleanWithdrawable = Math.min(state.balance, Math.max(0, state.withdrawableBalance ?? state.balance));
  const lockedDeposit = Math.max(0, state.balance - cleanWithdrawable);
  const lockedDebitUsed = roundMoney(Math.min(check.fees.totalDebit, lockedDeposit));
  const withdrawableDebitUsed = roundMoney(Math.max(0, check.fees.totalDebit - lockedDebitUsed));

  const durationSeconds = getHorizonDurationSeconds(params.horizon);
  const posId = `pos-${nowMs}-${Math.random().toString(36).slice(2, 6)}`;
  const feePaid = roundMoney(check.fees.commission + check.fees.handlingFee);

  const pool = state.platformPositions ?? state.positions;
  const canMatchUser = (p: ActivePosition) => {
    const pEmail = (p.userEmail ?? '').trim().toLowerCase();
    if (!cleanEmail && !pEmail) return false;
    return pEmail !== cleanEmail;
  };

  // Priority 1: Opposite prediction peer match (UP vs DOWN on same asset)
  let partner = pool.find(
    (p) =>
      p.status === 'open' &&
      (p.p2pStatus ?? 'Pending') === 'Pending' &&
      p.assetId === asset.id &&
      p.side !== params.side &&
      canMatchUser(p)
  );
  let matchKind: P2PMatchKind = 'opposite';

  // Priority 2: Same-side prediction peer match (Both UP or Both DOWN on same asset)
  if (!partner) {
    partner = pool.find(
      (p) =>
        p.status === 'open' &&
        (p.p2pStatus ?? 'Pending') === 'Pending' &&
        p.assetId === asset.id &&
        p.side === params.side &&
        canMatchUser(p)
    );
    matchKind = partner ? 'same_side' : 'none';
  }

  const pairId = partner
    ? `pair-${nowMs}-${Math.random().toString(36).slice(2, 6)}`
    : undefined;
  const p2pStatus: P2PTradeStatus = partner ? 'Matched' : 'Pending';
  const matchAnchorPrice = partner ? asset.price : undefined;
  const sideLabel = params.side === 'long' ? 'UP (Long)' : 'DOWN (Short)';
  const partnerSideLabel = partner?.side === 'long' ? 'UP' : 'DOWN';

  const position: ActivePosition = {
    id: posId,
    assetId: asset.id,
    symbol: asset.symbol,
    side: params.side,
    horizon: params.horizon,
    durationSeconds,
    expiresAtMs: nowMs + durationSeconds * 1000,
    stake: check.fees.stake,
    feePaid,
    entryPrice: asset.price,
    openedAt: formatExactDateTime(nowMs),
    status: 'open',
    userEmail: cleanEmail || undefined,
    userName: cleanName,
    p2pStatus,
    matchKind,
    pairId,
    counterpartyPositionId: partner?.id,
    counterpartyEmail: partner?.userEmail,
    counterpartyName: partner?.userName,
    matchAnchorPrice,
    lockedDebitUsed,
    withdrawableDebitUsed,
    outcomeNote: partner
      ? `Matched (${matchKind === 'opposite' ? 'Opposite' : 'Same-Side'}) vs ${
          partner.userName || 'Peer'
        } (${partnerSideLabel}) @ ${asset.price.toFixed(2)}`
      : 'Pending peer match · Full 100% refund if unmatched at expiry',
  };

  const patchPartnerPosition = (p: ActivePosition): ActivePosition => {
    if (!partner || p.id !== partner.id) return p;
    return {
      ...p,
      p2pStatus: 'Matched',
      matchKind,
      pairId,
      counterpartyPositionId: posId,
      counterpartyEmail: cleanEmail || undefined,
      counterpartyName: cleanName,
      matchAnchorPrice,
      outcomeNote: `Matched (${matchKind === 'opposite' ? 'Opposite' : 'Same-Side'}) vs ${cleanName} (${
        params.side === 'long' ? 'UP' : 'DOWN'
      }) @ ${asset.price.toFixed(2)}`,
    };
  };

  const updatedPool = partner ? pool.map(patchPartnerPosition) : pool;
  const nextPlatformPositions = [position, ...updatedPool].slice(0, 200);

  const nextAssets: MarketAsset[] = state.assets.map((a) => {
    if (a.id !== asset.id) return a;
    return {
      ...a,
      longPoolAmount: params.side === 'long' ? a.longPoolAmount + check.fees.stake : a.longPoolAmount,
      shortPoolAmount: params.side === 'short' ? a.shortPoolAmount + check.fees.stake : a.shortPoolAmount,
    };
  });

  const { nextBalance, nextWithdrawable } = computeDebitBreakdown(
    state.balance,
    state.withdrawableBalance ?? state.balance,
    check.fees.totalDebit
  );

  const openTx: WalletTransaction = {
    id: `tx-${nowMs}-${Math.random().toString(36).slice(2, 6)}`,
    type: 'trade_open',
    title: `${asset.symbol} ${sideLabel} (${params.horizon})`,
    amount: -check.fees.totalDebit,
    timestamp: formatExactDateTime(nowMs),
    status: partner ? 'Matched' : 'Pending',
    meta: partner
      ? `P2P ${matchKind === 'opposite' ? 'Opposite' : 'Same-Side'} Match @ ${asset.price.toFixed(2)} · Timer ${params.horizon}`
      : `Pending peer match @ ${asset.price.toFixed(2)} · Timer ${params.horizon}`,
    createdAtMs: nowMs,
  };

  const nextRegistered = (state.registeredAccounts ?? []).map((acc) => {
    const accEmail = acc.email.trim().toLowerCase();
    if (cleanEmail && accEmail === cleanEmail) {
      return {
        ...acc,
        balance: nextBalance,
        withdrawableBalance: nextWithdrawable,
        positions: [position, ...state.positions],
        transactions: [openTx, ...state.transactions],
      };
    }
    if (partner && accEmail === (partner.userEmail ?? '').trim().toLowerCase()) {
      return {
        ...acc,
        positions: (acc.positions ?? []).map(patchPartnerPosition),
      };
    }
    return acc;
  });

  const baseState: AppState = {
    ...state,
    balance: nextBalance,
    withdrawableBalance: nextWithdrawable,
    assets: nextAssets,
    positions: [position, ...state.positions],
    platformPositions: nextPlatformPositions,
    registeredAccounts: nextRegistered,
    transactions: [openTx, ...state.transactions],
  };

  const { nextState } = applyReferralRewardOnFirstBet(baseState, nowMs);
  return { ok: true, nextState, position };
}

interface LegSettlementDelta {
  pos: ActivePosition;
  updatedPos: ActivePosition;
  deltaBalance: number;
  deltaWithdrawable: number;
  deltaRealizedPnl: number;
  deltaTodayReceived: number;
  tx: WalletTransaction;
}

function applyLegDeltasToState(
  state: AppState,
  deltas: LegSettlementDelta[]
): AppState {
  let nextState = state;
  for (const d of deltas) {
    const targetEmail = (d.pos.userEmail ?? '').trim().toLowerCase();
    const isCurrentSession =
      nextState.positions.some((p) => p.id === d.pos.id) ||
      (Boolean(targetEmail) && nextState.profile.email.trim().toLowerCase() === targetEmail);

    const nextPlatformPositions = (nextState.platformPositions ?? nextState.positions).map((p) =>
      p.id === d.pos.id ? d.updatedPos : p
    );

    const nextRegistered = (nextState.registeredAccounts ?? []).map((acc) => {
      const accEmail = acc.email.trim().toLowerCase();
      const ownsPos = (acc.positions ?? []).some((p) => p.id === d.pos.id);
      if (!ownsPos && (!targetEmail || accEmail !== targetEmail)) {
        return acc;
      }
      const nextAccBal = roundMoney((acc.balance ?? 0) + d.deltaBalance);
      const nextAccWithdraw = Math.min(
        nextAccBal,
        roundMoney(Math.max(0, (acc.withdrawableBalance ?? 0) + d.deltaWithdrawable))
      );
      return {
        ...acc,
        balance: nextAccBal,
        withdrawableBalance: nextAccWithdraw,
        realizedPnl: roundMoney((acc.realizedPnl ?? 0) + d.deltaRealizedPnl),
        todayReceived:
          d.deltaTodayReceived > 0
            ? roundMoney((acc.todayReceived ?? 0) + d.deltaTodayReceived)
            : acc.todayReceived ?? 0,
        positions: (acc.positions ?? []).map((p) =>
          p.id === d.pos.id ? d.updatedPos : p
        ),
        transactions: [d.tx, ...(acc.transactions ?? [])],
      };
    });

    if (isCurrentSession) {
      const nextBalance = roundMoney(nextState.balance + d.deltaBalance);
      const currentWithdrawable = Math.max(0, nextState.withdrawableBalance ?? 0);
      const nextWithdrawable = Math.min(
        nextBalance,
        roundMoney(currentWithdrawable + d.deltaWithdrawable)
      );
      nextState = {
        ...nextState,
        balance: nextBalance,
        withdrawableBalance: nextWithdrawable,
        realizedPnl: roundMoney(nextState.realizedPnl + d.deltaRealizedPnl),
        todayReceived:
          d.deltaTodayReceived > 0
            ? roundMoney(nextState.todayReceived + d.deltaTodayReceived)
            : nextState.todayReceived,
        positions: nextState.positions.map((p) => (p.id === d.pos.id ? d.updatedPos : p)),
        platformPositions: nextPlatformPositions,
        registeredAccounts: nextRegistered,
        transactions: [d.tx, ...nextState.transactions],
      };
    } else {
      nextState = {
        ...nextState,
        platformPositions: nextPlatformPositions,
        registeredAccounts: nextRegistered,
      };
    }
  }
  return nextState;
}

export function closeTradePosition(
  state: AppState,
  positionId: string,
  nowMs = Date.now()
):
  | {
      ok: true;
      nextState: AppState;
      pnl: number;
      payout: number;
      p2pStatus: 'Settled' | 'Cancelled/Refunded';
      outcomeNote: string;
    }
  | { ok: false; error: string } {
  const pool = state.platformPositions ?? state.positions;
  const position = pool.find((p) => p.id === positionId && p.status === 'open');
  if (!position) {
    return { ok: false, error: 'Open position not found.' };
  }

  const asset = state.assets.find((a) => a.id === position.assetId);
  const exitPrice = asset ? asset.price : position.entryPrice;
  const settledAt = formatExactDateTime(nowMs);
  const cfg = getEffectiveReferralConfig(state);
  const feePct = Math.max(0, cfg.platformFeePct ?? 5);

  const partner =
    position.p2pStatus === 'Matched' && position.counterpartyPositionId
      ? pool.find(
          (p) =>
            p.id === position.counterpartyPositionId &&
            p.status === 'open'
        )
      : undefined;

  const buildRefundDelta = (
    p: ActivePosition,
    reasonNote: string,
    txTitleSuffix: string
  ): LegSettlementDelta => {
    const refundAmount = roundMoney(p.stake + p.feePaid);
    const restoreWithdrawable = Math.min(refundAmount, p.withdrawableDebitUsed ?? 0);
    const updatedPos: ActivePosition = {
      ...p,
      status: 'closed',
      p2pStatus: 'Cancelled/Refunded',
      exitPrice,
      realizedPnl: 0,
      payout: refundAmount,
      refundAmount,
      commissionApplied: 0,
      closedAt: settledAt,
      outcomeNote: reasonNote,
    };
    const sideLabel = p.side === 'long' ? 'UP (Long)' : 'DOWN (Short)';
    return {
      pos: p,
      updatedPos,
      deltaBalance: refundAmount,
      deltaWithdrawable: restoreWithdrawable,
      deltaRealizedPnl: 0,
      deltaTodayReceived: 0,
      tx: {
        id: `tx-ref-${nowMs}-${p.id.slice(-4)}`,
        type: 'trade_refund',
        title: `${p.symbol} ${sideLabel} ${txTitleSuffix}`,
        amount: refundAmount,
        timestamp: settledAt,
        status: 'Cancelled/Refunded',
        meta: reasonNote,
        createdAtMs: nowMs,
      },
    };
  };

  // Rule 2: No-Match Scenario -> 100% full refund, ₹0 commission
  if (!partner || position.matchKind === 'none' || !position.matchKind) {
    const note = 'No peer match found before expiry · 100% Refunded (₹0 commission)';
    const delta = buildRefundDelta(position, note, 'Cancelled (No Match)');
    const nextState = applyLegDeltasToState(state, [delta]);
    return {
      ok: true,
      nextState,
      pnl: 0,
      payout: delta.deltaBalance,
      p2pStatus: 'Cancelled/Refunded',
      outcomeNote: note,
    };
  }

  const anchor = position.matchAnchorPrice ?? partner.matchAnchorPrice ?? position.entryPrice;

  // Rule 1: Opposite Predictions (UP vs DOWN)
  if (position.matchKind === 'opposite') {
    if (exitPrice === anchor) {
      const tieNote = `Price unchanged at anchor (${anchor.toFixed(2)}) · Cancelled & 100% refunded to both peers`;
      const d1 = buildRefundDelta(position, tieNote, 'Cancelled (Flat Price)');
      const d2 = buildRefundDelta(partner, tieNote, 'Cancelled (Flat Price)');
      const nextState = applyLegDeltasToState(state, [d1, d2]);
      return {
        ok: true,
        nextState,
        pnl: 0,
        payout: d1.deltaBalance,
        p2pStatus: 'Cancelled/Refunded',
        outcomeNote: tieNote,
      };
    }

    const winningSide: TradeSide = exitPrice > anchor ? 'long' : 'short';
    const winner = position.side === winningSide ? position : partner;
    const loser = winner.id === position.id ? partner : position;
    const matchedStake = roundMoney(Math.min(winner.stake, loser.stake));
    const settlementCommission = roundMoney(matchedStake * (feePct / 100));
    const netProfit = roundMoney(matchedStake - settlementCommission);
    const winnerPayout = roundMoney(winner.stake + netProfit);
    const loserExcessRefund = roundMoney(Math.max(0, loser.stake - matchedStake));
    const loserRealized = -matchedStake;
    const entryFeesTotal = roundMoney(winner.feePaid + loser.feePaid);
    const ownerCredit = roundMoney(settlementCommission + entryFeesTotal);

    const winDirLabel = exitPrice > anchor ? 'UP' : 'DOWN';
    const winnerNote = `Opposite P2P Won (Price went ${winDirLabel}: ${exitPrice.toFixed(2)} vs ${anchor.toFixed(
      2
    )}) · Net +₹${netProfit.toFixed(2)} after ${feePct}% fee`;
    const loserNote = `Opposite P2P Settled (Price went ${winDirLabel}: ${exitPrice.toFixed(2)} vs ${anchor.toFixed(
      2
    )}) · Loss -₹${matchedStake.toFixed(2)}${
      loserExcessRefund > 0 ? ` · Excess ₹${loserExcessRefund.toFixed(2)} refunded` : ''
    }`;

    const winnerDelta: LegSettlementDelta = {
      pos: winner,
      updatedPos: {
        ...winner,
        status: 'closed',
        p2pStatus: 'Settled',
        exitPrice,
        realizedPnl: netProfit,
        payout: winnerPayout,
        commissionApplied: roundMoney(winner.feePaid + settlementCommission),
        closedAt: settledAt,
        outcomeNote: winnerNote,
      },
      deltaBalance: winnerPayout,
      deltaWithdrawable: winnerPayout,
      deltaRealizedPnl: netProfit,
      deltaTodayReceived: netProfit,
      tx: {
        id: `tx-win-${nowMs}-${winner.id.slice(-4)}`,
        type: 'trade_close',
        title: `${winner.symbol} ${winner.side === 'long' ? 'UP (Long)' : 'DOWN (Short)'} P2P Won`,
        amount: winnerPayout,
        timestamp: settledAt,
        status: 'Settled',
        meta: winnerNote,
        createdAtMs: nowMs,
      },
    };

    const loserRestoreWithdrawable =
      loserExcessRefund > 0
        ? Math.min(loserExcessRefund, loser.withdrawableDebitUsed ?? 0)
        : 0;

    const loserDelta: LegSettlementDelta = {
      pos: loser,
      updatedPos: {
        ...loser,
        status: 'closed',
        p2pStatus: 'Settled',
        exitPrice,
        realizedPnl: loserRealized,
        payout: loserExcessRefund,
        refundAmount: loserExcessRefund > 0 ? loserExcessRefund : 0,
        commissionApplied: loser.feePaid,
        closedAt: settledAt,
        outcomeNote: loserNote,
      },
      deltaBalance: loserExcessRefund,
      deltaWithdrawable: loserRestoreWithdrawable,
      deltaRealizedPnl: loserRealized,
      deltaTodayReceived: 0,
      tx: {
        id: `tx-loss-${nowMs}-${loser.id.slice(-4)}`,
        type: 'trade_close',
        title: `${loser.symbol} ${loser.side === 'long' ? 'UP (Long)' : 'DOWN (Short)'} P2P Settled`,
        amount: loserExcessRefund,
        timestamp: settledAt,
        status: 'Settled',
        meta: loserNote,
        createdAtMs: nowMs,
      },
    };

    const ledgerEntry: CommissionLedgerEntry = {
      id: `cl-p2p-${nowMs}-${position.id.slice(-4)}`,
      timestamp: settledAt,
      createdAtMs: nowMs,
      actorEmail: winner.userEmail || position.userEmail || 'p2p-desk',
      actorName: `${winner.userName || 'Winner'} vs ${loser.userName || 'Peer'}`,
      kind: 'matched_opposite',
      grossAmountInr: roundMoney(winner.stake + loser.stake),
      platformFeeInr: ownerCredit,
      ownerNetRevenueInr: ownerCredit,
      note: `Matched Opposite ${winner.symbol} (${winDirLabel} won @ ${exitPrice.toFixed(
        2
      )}) · ${feePct}% Commission ₹${settlementCommission.toFixed(2)} + Entry Fees ₹${entryFeesTotal.toFixed(2)}`,
    };

    const updatedState = applyLegDeltasToState(state, [winnerDelta, loserDelta]);
    const finalState: AppState = {
      ...updatedState,
      ownerFeeRevenue: roundMoney((updatedState.ownerFeeRevenue ?? 0) + ownerCredit),
      commissionLedger: [ledgerEntry, ...(updatedState.commissionLedger ?? [])].slice(0, 80),
    };

    const targetIsWinner = position.id === winner.id;
    return {
      ok: true,
      nextState: finalState,
      pnl: targetIsWinner ? netProfit : loserRealized,
      payout: targetIsWinner ? winnerPayout : loserExcessRefund,
      p2pStatus: 'Settled',
      outcomeNote: targetIsWinner ? winnerNote : loserNote,
    };
  }

  // Rule 3: Same-Side Predictions (Both UP or Both DOWN)
  const isOppositeMoveLoss =
    (position.side === 'long' && exitPrice < anchor) ||
    (position.side === 'short' && exitPrice > anchor);
  const predictedLabel = position.side === 'long' ? 'UP' : 'DOWN';
  const movedLabel = exitPrice > anchor ? 'UP' : exitPrice < anchor ? 'DOWN' : 'FLAT';

  if (isOppositeMoveLoss) {
    // Case 3A: Both users lose; entire invested pool goes to Platform Owner
    const poolTotal = roundMoney(
      position.stake + position.feePaid + partner.stake + partner.feePaid
    );
    const forfeitNote = `Same-Side ${predictedLabel} Loss (Price moved ${movedLabel}: ${exitPrice.toFixed(
      2
    )} vs ${anchor.toFixed(2)}) · Invested pool credited to Platform Owner`;

    const makeForfeitDelta = (p: ActivePosition): LegSettlementDelta => ({
      pos: p,
      updatedPos: {
        ...p,
        status: 'closed',
        p2pStatus: 'Settled',
        exitPrice,
        realizedPnl: -p.stake,
        payout: 0,
        commissionApplied: roundMoney(p.stake + p.feePaid),
        closedAt: settledAt,
        outcomeNote: forfeitNote,
      },
      deltaBalance: 0,
      deltaWithdrawable: 0,
      deltaRealizedPnl: -p.stake,
      deltaTodayReceived: 0,
      tx: {
        id: `tx-ssloss-${nowMs}-${p.id.slice(-4)}`,
        type: 'trade_close',
        title: `${p.symbol} Both ${predictedLabel} · Same-Side Settled`,
        amount: 0,
        timestamp: settledAt,
        status: 'Settled',
        meta: forfeitNote,
        createdAtMs: nowMs,
      },
    });

    const d1 = makeForfeitDelta(position);
    const d2 = makeForfeitDelta(partner);

    const ledgerEntry: CommissionLedgerEntry = {
      id: `cl-ssf-${nowMs}-${position.id.slice(-4)}`,
      timestamp: settledAt,
      createdAtMs: nowMs,
      actorEmail: position.userEmail || 'same-side-pool',
      actorName: `${position.userName || 'User A'} + ${partner.userName || 'User B'}`,
      kind: 'same_side_forfeiture',
      grossAmountInr: roundMoney(position.stake + partner.stake),
      platformFeeInr: poolTotal,
      ownerNetRevenueInr: poolTotal,
      note: `Same-Side Forfeiture (${position.symbol} Both ${predictedLabel}, price went ${movedLabel}) · Pool ₹${poolTotal.toFixed(
        2
      )} → Platform Owner`,
    };

    const updatedState = applyLegDeltasToState(state, [d1, d2]);
    const finalState: AppState = {
      ...updatedState,
      ownerFeeRevenue: roundMoney((updatedState.ownerFeeRevenue ?? 0) + poolTotal),
      commissionLedger: [ledgerEntry, ...(updatedState.commissionLedger ?? [])].slice(0, 80),
    };

    return {
      ok: true,
      nextState: finalState,
      pnl: -position.stake,
      payout: 0,
      p2pStatus: 'Settled',
      outcomeNote: forfeitNote,
    };
  }

  // Case 3B: Both predicted UP & price went UP/flat, OR Both predicted DOWN & price went DOWN/flat -> Cancelled & 100% Refunded
  const refundNote = `Same-Side Both ${predictedLabel} · Price moved ${movedLabel} (${exitPrice.toFixed(
    2
  )} vs ${anchor.toFixed(2)}) · Trade cancelled & 100% refunded to both users`;
  const d1 = buildRefundDelta(position, refundNote, 'Cancelled (Same-Side Refund)');
  const d2 = buildRefundDelta(partner, refundNote, 'Cancelled (Same-Side Refund)');
  const nextState = applyLegDeltasToState(state, [d1, d2]);
  return {
    ok: true,
    nextState,
    pnl: 0,
    payout: d1.deltaBalance,
    p2pStatus: 'Cancelled/Refunded',
    outcomeNote: refundNote,
  };
}

export function settleExpiredPositions(
  state: AppState,
  nowMs = Date.now()
): { nextState: AppState; settled: SettledPositionSummary[] } {
  const pool = state.platformPositions ?? state.positions;
  const expired = pool.filter(
    (p) => p.status === 'open' && typeof p.expiresAtMs === 'number' && p.expiresAtMs > 0 && nowMs >= p.expiresAtMs
  );
  if (expired.length === 0) {
    return { nextState: state, settled: [] };
  }

  const activeUserIdsBefore = new Set(state.positions.map((p) => p.id));
  let runningState = state;
  const settled: SettledPositionSummary[] = [];

  for (const pos of expired) {
    // If settling its counterparty already closed this leg atomically, skip
    const stillOpen = (runningState.platformPositions ?? runningState.positions).some(
      (p) => p.id === pos.id && p.status === 'open'
    );
    if (!stillOpen) continue;

    const partnerId = pos.counterpartyPositionId;
    const res = closeTradePosition(runningState, pos.id, nowMs);
    if (res.ok) {
      runningState = res.nextState;

      // Record summary for active session user positions settled (either pos or its partner)
      for (const legId of partnerId ? [pos.id, partnerId] : [pos.id]) {
        if (!activeUserIdsBefore.has(legId)) continue;
        const closedLeg = runningState.positions.find((p) => p.id === legId);
        if (!closedLeg) continue;
        const legPnl = closedLeg.realizedPnl ?? 0;
        const legPayout = closedLeg.payout ?? 0;
        settled.push({
          id: closedLeg.id,
          symbol: closedLeg.symbol,
          side: closedLeg.side,
          stake: closedLeg.stake,
          entryPrice: closedLeg.entryPrice,
          exitPrice: closedLeg.exitPrice ?? closedLeg.entryPrice,
          pnl: legPnl,
          payout: legPayout,
          won: (closedLeg.p2pStatus ?? 'Settled') === 'Settled' && legPnl > 0,
          settledAt: closedLeg.closedAt ?? formatExactDateTime(nowMs),
          p2pStatus:
            closedLeg.p2pStatus === 'Cancelled/Refunded' ? 'Cancelled/Refunded' : 'Settled',
          matchKind: closedLeg.matchKind,
          outcomeNote: closedLeg.outcomeNote,
        });
      }
    }
  }

  return { nextState: runningState, settled };
}

export function placePredictionBet(
  state: AppState,
  params: {
    marketId: string;
    choice: 'yes' | 'no';
    stake: number;
  },
  nowMs = Date.now()
): { ok: true; nextState: AppState; bet: ActiveBet } | { ok: false; error: string } {
  const restriction = getCurrentUserRestriction(state);
  if (restriction.restricted) {
    return {
      ok: false,
      error: `${restriction.banned ? 'Account banned' : 'Account is currently frozen'}${
        restriction.reason ? `: ${restriction.reason}` : '. Contact Admin support.'
      }`,
    };
  }
  if (restriction.tradingBlocked) {
    return {
      ok: false,
      error: 'Trading and prediction bets are temporarily paused on your account.',
    };
  }
  const market = state.predictions.find((m) => m.id === params.marketId);
  if (!market) {
    return { ok: false, error: 'Prediction market not found.' };
  }
  if (market.resolvedOutcome) {
    return { ok: false, error: 'This prediction market has already settled.' };
  }
  if (!Number.isFinite(params.stake) || params.stake < MIN_BET_STAKE_INR) {
    return { ok: false, error: `Minimum prediction bet is ₹${MIN_BET_STAKE_INR}.` };
  }
  if (params.stake > state.balance) {
    return {
      ok: false,
      error: `Insufficient wallet balance (available ₹${state.balance.toFixed(2)}).`,
    };
  }

  const totalPool = market.yesPool + market.noPool + params.stake;
  const chosenPool = (params.choice === 'yes' ? market.yesPool : market.noPool) + params.stake;
  const multiplier = Math.max(1.15, Math.min(4.5, Math.round((totalPool / chosenPool) * 100) / 100));

  const bet: ActiveBet = {
    id: `bet-${nowMs}-${Math.random().toString(36).slice(2, 6)}`,
    marketId: market.id,
    question: market.question,
    choice: params.choice,
    stake: params.stake,
    multiplier,
    placedAt: formatExactDateTime(nowMs),
    status: 'open',
  };

  const nextPredictions: PredictionMarket[] = state.predictions.map((m) => {
    if (m.id !== market.id) return m;
    return {
      ...m,
      yesPool: params.choice === 'yes' ? m.yesPool + params.stake : m.yesPool,
      noPool: params.choice === 'no' ? m.noPool + params.stake : m.noPool,
      yesBettors: params.choice === 'yes' ? m.yesBettors + 1 : m.yesBettors,
      noBettors: params.choice === 'no' ? m.noBettors + 1 : m.noBettors,
    };
  });

  const { nextBalance, nextWithdrawable } = computeDebitBreakdown(
    state.balance,
    state.withdrawableBalance ?? state.balance,
    params.stake
  );

  const baseState: AppState = {
    ...state,
    balance: nextBalance,
    withdrawableBalance: nextWithdrawable,
    predictions: nextPredictions,
    bets: [bet, ...state.bets],
    transactions: [
      {
        id: `tx-${nowMs}`,
        type: 'bet_place',
        title: `Prediction ${params.choice.toUpperCase()} · ${market.subLabel}`,
        amount: -params.stake,
        timestamp: formatExactDateTime(nowMs),
        status: 'Completed',
        meta: `${multiplier.toFixed(2)}x Est. Payout`,
        createdAtMs: nowMs,
      },
      ...state.transactions,
    ],
  };

  const { nextState } = applyReferralRewardOnFirstBet(baseState, nowMs);
  return { ok: true, nextState, bet };
}

export function computeGiftCodeClaimAmount(
  gift: {
    amount: number;
    initialAmount?: number;
    minAmount?: number;
    stepDecreaseInr?: number;
    claimsCount?: number;
  },
  claimIndex?: number
): number {
  const initialAmt = Math.max(1, Number(gift.initialAmount ?? gift.amount) || 1);
  const stepDec = Math.max(0, Number(gift.stepDecreaseInr ?? 0) || 0);
  const minAmt = Math.max(1, Math.min(initialAmt, Number(gift.minAmount ?? 1) || 1));
  const idx = Math.max(0, Math.floor(claimIndex ?? gift.claimsCount ?? 0));
  return roundMoney(Math.max(minAmt, initialAmt - idx * stepDec));
}

export function redeemGiftCode(
  state: AppState,
  rawCode: string,
  nowMs = Date.now()
): { ok: true; nextState: AppState; amount: number; code: string } | { ok: false; error: string } {
  const code = rawCode.trim().toUpperCase();
  if (!code) {
    return { ok: false, error: 'Please enter a gift code.' };
  }

  const customList = state.customGiftCodes ?? [];
  const customMatch = customList.find((g) => g.code.trim().toUpperCase() === code);
  if (!customMatch) {
    return {
      ok: false,
      error: 'No active gift code matches that entry. Gift codes are issued exclusively by Owner Desk.',
    };
  }
  if (!customMatch.active) {
    return {
      ok: false,
      error: `Gift code ${code} is currently paused or exhausted.`,
    };
  }

  const cleanEmail = state.profile.email.trim().toLowerCase();
  const claimsCount = Math.max(0, Math.floor(customMatch.claimsCount ?? 0));
  const maxClaims = Math.max(0, Math.floor(customMatch.maxClaims ?? 0));
  if (maxClaims > 0 && claimsCount >= maxClaims) {
    return {
      ok: false,
      error: `Gift code ${code} has reached its maximum ${maxClaims}-user claim limit.`,
    };
  }

  const alreadyClaimedByEmail =
    Boolean(cleanEmail) &&
    (customMatch.claimedByEmails ?? []).some((e) => e.trim().toLowerCase() === cleanEmail);
  if (alreadyClaimedByEmail || state.redeemedGifts.some((g) => g.code === code)) {
    return { ok: false, error: `Gift code ${code} has already been redeemed.` };
  }

  const claimAmount = computeGiftCodeClaimAmount(customMatch, claimsCount);
  const nextClaimsCount = claimsCount + 1;
  const stillAvailable = maxClaims === 0 || nextClaimsCount < maxClaims;
  const nextPreviewAmount = computeGiftCodeClaimAmount(customMatch, nextClaimsCount);
  const stamp = formatExactDateTime(nowMs);

  const giftTx: WalletTransaction = {
    id: `tx-${nowMs}`,
    type: 'gift_redeem',
    title: `Gift Code ${code}`,
    amount: claimAmount,
    timestamp: stamp,
    status: 'Credited',
    meta: `${customMatch.label} (${nextClaimsCount}${maxClaims > 0 ? `/${maxClaims}` : ''} claimed)`,
    createdAtMs: nowMs,
    userEmail: cleanEmail || undefined,
    userName: state.profile.name,
    userUid: state.profile.uid,
  };

  const nextBalance = roundMoney(state.balance + claimAmount);
  const nextTodayReceived = roundMoney(state.todayReceived + claimAmount);
  const nextRedeemedGifts = [
    {
      id: `gift-${nowMs}`,
      code,
      amount: claimAmount,
      redeemedAt: stamp,
      label: customMatch.label,
    },
    ...state.redeemedGifts,
  ];
  const nextTransactions = [giftTx, ...state.transactions];

  const nextCustomGiftCodes = customList.map((g) => {
    if (g.code.trim().toUpperCase() !== code) return g;
    return {
      ...g,
      amount: nextPreviewAmount,
      claimsCount: nextClaimsCount,
      active: g.active && stillAvailable,
      claimedByEmails: cleanEmail
        ? Array.from(new Set([...(g.claimedByEmails ?? []), cleanEmail]))
        : g.claimedByEmails ?? [],
    };
  });

  const nextRegistered = (state.registeredAccounts ?? []).map((acc) => {
    if (!cleanEmail || acc.email.trim().toLowerCase() !== cleanEmail) return acc;
    return {
      ...acc,
      balance: nextBalance,
      todayReceived: nextTodayReceived,
      redeemedGifts: nextRedeemedGifts,
      transactions: nextTransactions,
    };
  });

  const nextState: AppState = {
    ...state,
    balance: nextBalance,
    todayReceived: nextTodayReceived,
    redeemedGifts: nextRedeemedGifts,
    customGiftCodes: nextCustomGiftCodes,
    transactions: nextTransactions,
    platformTransactions: [giftTx, ...(state.platformTransactions ?? [])].slice(0, 300),
    registeredAccounts: nextRegistered,
  };

  return { ok: true, nextState, amount: claimAmount, code };
}

export function validateUpiId(raw: string): { valid: boolean; cleaned: string; error?: string } {
  const cleaned = raw.trim().toLowerCase();
  if (!cleaned) {
    return { valid: false, cleaned, error: 'Please enter a valid UPI ID (e.g. name@okicici).' };
  }
  const upiRegex = /^[a-z0-9._-]{2,64}@[a-z0-9.-]{2,32}$/i;
  if (!upiRegex.test(cleaned)) {
    return {
      valid: false,
      cleaned,
      error: 'Enter a valid UPI ID format like name@okicici or mobile@ybl.',
    };
  }
  return { valid: true, cleaned };
}

export function validateUtr12Digits(raw: string): { valid: boolean; cleaned: string; error?: string } {
  const cleaned = raw.replace(/\D/g, '');
  if (raw.trim() !== cleaned || cleaned.length !== 12) {
    return {
      valid: false,
      cleaned,
      error: 'UTR must be a strictly 12-digit number (e.g. 412345678901).',
    };
  }
  return { valid: true, cleaned };
}

export function applyTopUp(
  state: AppState,
  amount: number,
  method: string,
  utr?: string,
  nowMs = Date.now(),
  options?: { instantCredit?: boolean }
): { ok: true; nextState: AppState; transaction: WalletTransaction } | { ok: false; error: string } {
  const restriction = getCurrentUserRestriction(state);
  if (restriction.restricted) {
    return {
      ok: false,
      error: `${restriction.banned ? 'Account banned' : 'Account is frozen'}${
        restriction.reason ? `: ${restriction.reason}` : '. Contact Admin support.'
      }`,
    };
  }

  const platformSettings = getEffectivePlatformSettings(state);
  if (platformSettings.depositsPaused) {
    return {
      ok: false,
      error:
        platformSettings.maintenanceNotice.trim() ||
        'Deposits are temporarily paused for gateway maintenance.',
    };
  }

  const cfg = getEffectiveReferralConfig(state);
  const minDeposit = cfg.minDepositInr || MIN_TOPUP_INR;
  const maxDeposit = platformSettings.maxDepositInr || MAX_TOPUP_INR;
  if (!Number.isFinite(amount) || amount < minDeposit) {
    return { ok: false, error: `Minimum deposit amount is ₹${minDeposit}.` };
  }
  if (amount > maxDeposit) {
    return {
      ok: false,
      error: `Maximum single deposit amount is ₹${maxDeposit.toLocaleString('en-IN')}.`,
    };
  }

  let cleanUtr: string | undefined;
  if (utr !== undefined) {
    const utrCheck = validateUtr12Digits(utr);
    if (!utrCheck.valid) {
      return { ok: false, error: utrCheck.error ?? 'UTR must be exactly 12 digits.' };
    }
    cleanUtr = utrCheck.cleaned;
  }

  const cleanAmount = Math.round(amount * 100) / 100;
  const stamp = formatExactDateTime(nowMs);
  const instantCredit = Boolean(options?.instantCredit);

  const tx: WalletTransaction = {
    id: `tx-dep-${nowMs}-${Math.random().toString(36).slice(2, 6)}`,
    type: 'deposit',
    title: `${method} Top Up`,
    amount: cleanAmount,
    timestamp: stamp,
    status: instantCredit ? 'Credited' : 'Under Review',
    credited: instantCredit,
    meta: cleanUtr
      ? `UTR ${cleanUtr} · ${instantCredit ? 'Verified & Credited' : 'Pending Owner UTR Check'}`
      : instantCredit
      ? 'Verified & Credited'
      : 'Pending Owner Verification · UPI Rail',
    utr: cleanUtr,
    createdAtMs: nowMs,
    userEmail: state.profile.email || undefined,
    userName: state.profile.name,
    userUid: state.profile.uid,
  };

  return {
    ok: true,
    transaction: tx,
    nextState: {
      ...state,
      balance: instantCredit
        ? Math.round((state.balance + cleanAmount) * 100) / 100
        : state.balance,
      // Deposited funds remain locked for play until won; withdrawableBalance is NOT incremented directly here.
      withdrawableBalance: state.withdrawableBalance ?? 0,
      todayReceived: instantCredit
        ? Math.round((state.todayReceived + cleanAmount) * 100) / 100
        : state.todayReceived,
      transactions: [tx, ...state.transactions],
      platformTransactions: [tx, ...(state.platformTransactions ?? [])].slice(0, 150),
    },
  };
}

export function applyWithdraw(
  state: AppState,
  amount: number,
  destinationId: string,
  nowMs = Date.now()
): { ok: true; nextState: AppState; channelLabel: string; transaction: WalletTransaction } | { ok: false; error: string } {
  const restriction = getCurrentUserRestriction(state);
  if (restriction.restricted) {
    return {
      ok: false,
      error: `Withdrawals blocked — ${restriction.banned ? 'account is banned' : 'account is frozen'}${
        restriction.reason ? `: ${restriction.reason}` : '.'
      }`,
    };
  }
  if (restriction.withdrawalsBlocked) {
    return {
      ok: false,
      error: 'Withdrawals are paused on your account. Please contact Owner Support.',
    };
  }
  const platformSettings = getEffectivePlatformSettings(state);
  if (platformSettings.withdrawalsPaused) {
    return {
      ok: false,
      error:
        platformSettings.maintenanceNotice.trim() ||
        'Withdrawals are temporarily paused for settlement maintenance.',
    };
  }

  const bank = state.bankAccounts.find((b) => b.id === destinationId);
  const upiAcc = (state.upiAccounts ?? []).find((u) => u.id === destinationId);
  const inlineUpiRaw = destinationId.startsWith('upi:') ? destinationId.slice(4) : '';

  let title = '';
  let meta = '';
  let channelLabel = '';
  let destinationSummary = '';
  let destinationCopyValue = '';

  if (bank) {
    const acctDisplay = bank.accountNumber
      ? bank.accountNumber
      : `••••${bank.accountLast4}`;
    title = `Withdraw to ${bank.bankName} ••••${bank.accountLast4}`;
    meta = bank.ifsc;
    channelLabel = `${bank.bankName} ••••${bank.accountLast4}`;
    destinationSummary = `${bank.holderName} · ${bank.bankName} (${acctDisplay}, IFSC ${bank.ifsc})`;
    destinationCopyValue = `${bank.bankName} | Acc: ${acctDisplay} | IFSC: ${bank.ifsc} | Holder: ${bank.holderName}`;
  } else if (upiAcc) {
    title = `Withdraw to UPI · ${upiAcc.upiId}`;
    meta = `${upiAcc.appName} Instant`;
    channelLabel = `${upiAcc.appName} (${upiAcc.upiId})`;
    destinationSummary = `${upiAcc.appName} · ${upiAcc.upiId} (${upiAcc.holderName})`;
    destinationCopyValue = upiAcc.upiId;
  } else if (inlineUpiRaw) {
    const check = validateUpiId(inlineUpiRaw);
    if (!check.valid) {
      return { ok: false, error: check.error ?? 'Invalid UPI ID.' };
    }
    title = `Withdraw to UPI · ${check.cleaned}`;
    meta = 'Instant UPI Payout';
    channelLabel = check.cleaned;
    destinationSummary = `UPI · ${check.cleaned}`;
    destinationCopyValue = check.cleaned;
  } else {
    return { ok: false, error: 'Please bind a bank account or UPI ID before withdrawing.' };
  }

  const cfg = getEffectiveReferralConfig(state);
  const minWithdraw = cfg.minWithdrawInr || MIN_WITHDRAW_INR;
  const maxWithdraw = platformSettings.maxWithdrawInr || MAX_WITHDRAW_INR;
  if (!Number.isFinite(amount) || amount < minWithdraw) {
    return { ok: false, error: `Minimum withdrawal is ₹${minWithdraw}.` };
  }
  if (amount > maxWithdraw) {
    return {
      ok: false,
      error: `Maximum withdrawal per request is ₹${maxWithdraw.toLocaleString('en-IN')}.`,
    };
  }
  if (amount > state.balance) {
    return {
      ok: false,
      error: `Withdrawal exceeds available balance (₹${state.balance.toFixed(2)}).`,
    };
  }

  const withdrawableCap = Math.min(state.balance, Math.max(0, state.withdrawableBalance ?? state.balance));
  if (amount > withdrawableCap) {
    return {
      ok: false,
      error: `Only winning amounts are withdrawable (Unlocked: ₹${withdrawableCap.toFixed(2)}). Play & win to unlock deposited funds.`,
    };
  }

  const cleanAmount = Math.round(amount * 100) / 100;
  const stamp = formatExactDateTime(nowMs);

  const tx: WalletTransaction = {
    id: `tx-wd-${nowMs}-${Math.random().toString(36).slice(2, 6)}`,
    type: 'withdraw',
    title,
    amount: -cleanAmount,
    timestamp: stamp,
    status: 'In Process',
    meta: `${meta} · Processing Payout`,
    createdAtMs: nowMs,
    userEmail: state.profile.email || undefined,
    userName: state.profile.name,
    userUid: state.profile.uid,
    destinationSummary,
    destinationCopyValue,
  };

  return {
    ok: true,
    channelLabel,
    transaction: tx,
    nextState: {
      ...state,
      balance: Math.round((state.balance - cleanAmount) * 100) / 100,
      withdrawableBalance: Math.max(0, Math.round((withdrawableCap - cleanAmount) * 100) / 100),
      transactions: [tx, ...state.transactions],
      platformTransactions: [tx, ...(state.platformTransactions ?? [])].slice(0, 150),
    },
  };
}

export function sellUsdtToInr(
  state: AppState,
  usdtAmount: number,
  nowMs = Date.now()
): { ok: true; nextState: AppState; inrCredited: number } | { ok: false; error: string } {
  if (!Number.isFinite(usdtAmount) || usdtAmount <= 0) {
    return { ok: false, error: 'Enter a valid USDT amount to sell.' };
  }
  if (usdtAmount > state.usdtHoldings) {
    return {
      ok: false,
      error: `Insufficient USDT balance (available ${state.usdtHoldings.toFixed(2)} USDT).`,
    };
  }
  const inrCredited = Math.round(usdtAmount * state.usdtRateInr * 100) / 100;
  const stamp = formatExactDateTime(nowMs);
  return {
    ok: true,
    inrCredited,
    nextState: {
      ...state,
      usdtHoldings: Math.round((state.usdtHoldings - usdtAmount) * 100) / 100,
      balance: Math.round((state.balance + inrCredited) * 100) / 100,
      withdrawableBalance: Math.round(((state.withdrawableBalance ?? 0) + inrCredited) * 100) / 100,
      todayReceived: Math.round((state.todayReceived + inrCredited) * 100) / 100,
      transactions: [
        {
          id: `tx-${nowMs}`,
          type: 'sell_usdt',
          title: `Sold ${usdtAmount.toFixed(2)} USDT @ ₹${state.usdtRateInr.toFixed(2)}`,
          amount: inrCredited,
          timestamp: stamp,
          status: 'Credited',
          meta: 'USDT/INR Desk',
          createdAtMs: nowMs,
        },
        ...state.transactions,
      ],
    },
  };
}

export function tickMarketPrices(assets: MarketAsset[], seedStep: number): MarketAsset[] {
  return assets.map((asset, idx) => {
    const wave = Math.sin(seedStep * 0.8 + idx * 1.7) * 0.0045 + Math.cos(seedStep * 0.3 + idx) * 0.002;
    const nextPrice = Math.max(1, Math.round(asset.price * (1 + wave) * 100) / 100);
    const nextChange = Math.round((asset.changePct + wave * 100) * 100) / 100;
    const nextHistory = [...asset.history.slice(1), nextPrice];
    return {
      ...asset,
      price: nextPrice,
      changePct: nextChange,
      history: nextHistory,
    };
  });
}

export interface CurrencyMeta {
  code: BaseCurrency;
  symbol: string;
  name: string;
  shortLabel: string;
}

export const SUPPORTED_CURRENCIES: CurrencyMeta[] = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee', shortLabel: 'INR ₹' },
  { code: 'USD', symbol: '$', name: 'US Dollar', shortLabel: 'USD $' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen', shortLabel: 'JPY ¥' },
  { code: 'EUR', symbol: '€', name: 'Euro', shortLabel: 'EUR €' },
  { code: 'GBP', symbol: '£', name: 'British Pound', shortLabel: 'GBP £' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham', shortLabel: 'AED' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', shortLabel: 'SGD S$' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', shortLabel: 'AUD A$' },
];

export const DEFAULT_FX_RATES: FxRatesMap = {
  INR: 1,
  USD: 0.01183,
  JPY: 1.825,
  EUR: 0.01118,
  GBP: 0.00934,
  AED: 0.04345,
  SGD: 0.01586,
  AUD: 0.01816,
};

export function getCurrencyMeta(code: BaseCurrency): CurrencyMeta {
  return SUPPORTED_CURRENCIES.find((c) => c.code === code) ?? SUPPORTED_CURRENCIES[0];
}

export function convertFromInr(
  amountInInr: number,
  targetCurrency: BaseCurrency,
  fxRates?: Partial<FxRatesMap>
): number {
  const rate =
    targetCurrency === 'INR'
      ? 1
      : fxRates?.[targetCurrency] ?? DEFAULT_FX_RATES[targetCurrency] ?? 1;
  return amountInInr * rate;
}

export function convertCurrency(
  amount: number,
  from: BaseCurrency,
  to: BaseCurrency,
  fxRates?: Partial<FxRatesMap>
): number {
  if (!Number.isFinite(amount)) return 0;
  if (from === to) return amount;
  const fromRate = from === 'INR' ? 1 : fxRates?.[from] ?? DEFAULT_FX_RATES[from] ?? 1;
  const toRate = to === 'INR' ? 1 : fxRates?.[to] ?? DEFAULT_FX_RATES[to] ?? 1;
  if (fromRate <= 0) return 0;
  const inInr = amount / fromRate;
  return inInr * toRate;
}

export function tickFxRates(current: FxRatesMap, step: number): FxRatesMap {
  const next: FxRatesMap = { ...current, INR: 1 };
  const keys: BaseCurrency[] = ['USD', 'JPY', 'EUR', 'GBP', 'AED', 'SGD', 'AUD'];
  keys.forEach((code, idx) => {
    const base = current[code] ?? DEFAULT_FX_RATES[code];
    const anchor = DEFAULT_FX_RATES[code];
    const wave = Math.sin(step * 0.65 + idx * 1.3) * 0.0009;
    const meanRevert = (anchor - base) * 0.12;
    const updated = Math.max(anchor * 0.96, Math.min(anchor * 1.04, base * (1 + wave) + meanRevert));
    next[code] = Number(updated.toFixed(6));
  });
  return next;
}

export function formatCurrency(
  amountInInr: number,
  currency: BaseCurrency,
  fxRatesOrUsdRate?: number | Partial<FxRatesMap>
): string {
  const meta = getCurrencyMeta(currency);
  let converted = amountInInr;
  if (currency !== 'INR') {
    if (typeof fxRatesOrUsdRate === 'number' && currency === 'USD') {
      converted = amountInInr / fxRatesOrUsdRate;
    } else if (fxRatesOrUsdRate && typeof fxRatesOrUsdRate === 'object') {
      converted = convertFromInr(amountInInr, currency, fxRatesOrUsdRate);
    } else {
      converted = convertFromInr(amountInInr, currency, DEFAULT_FX_RATES);
    }
  }
  const sign = converted < 0 ? '-' : '';
  const abs = Math.abs(converted);
  const useZeroDecimals = currency === 'JPY' && abs >= 100;
  const symbolPrefix = currency === 'AED' ? 'AED ' : meta.symbol;
  return `${sign}${symbolPrefix}${abs.toLocaleString('en-IN', {
    minimumFractionDigits: useZeroDecimals ? 0 : 2,
    maximumFractionDigits: useZeroDecimals ? 0 : 2,
  })}`;
}

export const PLAYER_LEVELS: PlayerLevelDefinition[] = [
  {
    tier: 1,
    name: 'New Player',
    minSpent: 0,
    accentColor: '#94a3b8',
    perk: 'Standard UPI & Market Access',
  },
  {
    tier: 2,
    name: 'Normal',
    minSpent: 500,
    accentColor: '#38bdf8',
    perk: 'Priority Settlement Queue',
  },
  {
    tier: 3,
    name: 'Ordinary',
    minSpent: 2000,
    accentColor: '#34d399',
    perk: 'Lower Slippage Execution',
  },
  {
    tier: 4,
    name: 'Extraordinary',
    minSpent: 5000,
    accentColor: '#a78bfa',
    perk: '0.2% Fee Rebate Credit',
  },
  {
    tier: 5,
    name: 'VIP',
    minSpent: 15000,
    accentColor: '#c084fc',
    perk: 'VIP Liquidity Drop Access',
  },
  {
    tier: 6,
    name: 'VVIP',
    minSpent: 35000,
    accentColor: '#f472b6',
    perk: 'Zero Handling Fee Desk',
  },
  {
    tier: 7,
    name: 'MVP',
    minSpent: 75000,
    accentColor: '#fbbf24',
    perk: 'Dedicated Instant Clearing',
  },
  {
    tier: 8,
    name: 'Sovereign',
    minSpent: 150000,
    accentColor: '#f59e0b',
    perk: 'Maximum Rank · Sovereign Vault',
  },
];

export function calculateTotalSpent(
  state: Pick<AppState, 'transactions'>
): number {
  const spent = state.transactions.reduce((sum, tx) => {
    if (
      tx.type === 'trade_open' ||
      tx.type === 'bet_place' ||
      (tx.type === 'trade_close' && tx.amount < 0)
    ) {
      return sum + Math.abs(tx.amount);
    }
    return sum;
  }, 0);
  return Math.round(spent * 100) / 100;
}

export function calculatePlayerLevel(totalSpentInr: number): PlayerLevelInfo {
  const cleanSpent = Number.isFinite(totalSpentInr) && totalSpentInr > 0 ? totalSpentInr : 0;
  let currentIdx = 0;
  for (let i = PLAYER_LEVELS.length - 1; i >= 0; i--) {
    if (cleanSpent >= PLAYER_LEVELS[i].minSpent) {
      currentIdx = i;
      break;
    }
  }
  const current = PLAYER_LEVELS[currentIdx];
  const next = currentIdx < PLAYER_LEVELS.length - 1 ? PLAYER_LEVELS[currentIdx + 1] : null;
  if (!next) {
    return {
      current,
      next: null,
      totalSpent: cleanSpent,
      progressPct: 100,
      remainingToNext: 0,
    };
  }
  const span = Math.max(1, next.minSpent - current.minSpent);
  const progressRaw = ((cleanSpent - current.minSpent) / span) * 100;
  const progressPct = Math.max(0, Math.min(100, Math.round(progressRaw * 10) / 10));
  const remainingToNext = Math.max(0, Math.round((next.minSpent - cleanSpent) * 100) / 100);
  return {
    current,
    next,
    totalSpent: cleanSpent,
    progressPct,
    remainingToNext,
  };
}

export function isOwnerAdmin(email?: string): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === ADMIN_OWNER_EMAIL;
}

export function verifyOwnerAdminLogin(email?: string, password?: string): boolean {
  return isOwnerAdmin(email) && password === ADMIN_OWNER_PASSWORD;
}

export function ensureOwnerAdminAccount(
  accounts: RegisteredAccount[] = []
): RegisteredAccount[] {
  const existingIdx = accounts.findIndex((a) => isOwnerAdmin(a.email));
  if (existingIdx < 0) {
    return [{ ...SEED_OWNER_ACCOUNT }, ...accounts];
  }
  return accounts.map((acc, idx) =>
    idx === existingIdx
      ? {
          ...SEED_OWNER_ACCOUNT,
          ...acc,
          email: ADMIN_OWNER_EMAIL,
          password: ADMIN_OWNER_PASSWORD,
          frozen: false,
          freezeReason: undefined,
          banned: false,
          banReason: undefined,
          deactivated: false,
          deactivatedAtMs: undefined,
          deactivatedReason: undefined,
          deactivatedBy: undefined,
          withdrawalsBlocked: false,
          tradingBlocked: false,
          lastLoginAtMs: acc.lastLoginAtMs ?? Date.now(),
        }
      : acc
  );
}

export function getEffectiveReferralConfig(
  state?: Pick<AppState, 'referralConfig'>
): Required<ReferralConfig> {
  const raw = state?.referralConfig;
  return {
    platformFeePct: Math.max(
      0,
      Number(raw?.platformFeePct ?? DEFAULT_REFERRAL_CONFIG.platformFeePct)
    ),
    minDepositInr: Math.max(
      10,
      Number(raw?.minDepositInr ?? DEFAULT_REFERRAL_CONFIG.minDepositInr)
    ),
    minWithdrawInr: Math.max(
      10,
      Number(raw?.minWithdrawInr ?? DEFAULT_REFERRAL_CONFIG.minWithdrawInr)
    ),
    referrerBonusInr: Math.min(
      25,
      Math.max(
        0,
        Number(raw?.referrerBonusInr ?? DEFAULT_REFERRAL_CONFIG.referrerBonusInr)
      )
    ),
    refereeBonusInr: Math.min(
      20,
      Math.max(
        0,
        Number(raw?.refereeBonusInr ?? DEFAULT_REFERRAL_CONFIG.refereeBonusInr)
      )
    ),
    maxReferralsPerUser: Math.max(
      1,
      Math.floor(
        Number(raw?.maxReferralsPerUser ?? DEFAULT_REFERRAL_CONFIG.maxReferralsPerUser)
      )
    ),
    referralBonusCapInr: Math.max(
      0,
      Number(raw?.referralBonusCapInr ?? DEFAULT_REFERRAL_CONFIG.referralBonusCapInr)
    ),
  };
}

export function generateReferralCode(
  seedNameOrEmail: string,
  existingCodes: Array<string | undefined> = []
): string {
  const used = new Set(
    existingCodes
      .filter((c): c is string => Boolean(c && c.trim()))
      .map((c) => c.trim().toUpperCase())
  );
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const cleanSeed = seedNameOrEmail.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  let hash = 2166136261;
  for (let i = 0; i < seedNameOrEmail.length; i++) {
    hash ^= seedNameOrEmail.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const makeCandidate = (salt: number) => {
    const prefix = (cleanSeed.slice(0, 2) || 'OB').padEnd(2, 'X');
    let h = (hash ^ salt) >>> 0;
    let suffix = '';
    for (let i = 0; i < 4; i++) {
      suffix += alphabet[h % alphabet.length];
      h = Math.floor(h / alphabet.length) + (i + 7) * 13;
    }
    return `OURO-${prefix}${suffix}`;
  };
  for (let attempt = 0; attempt < 25; attempt++) {
    const code = makeCandidate(attempt * 7919);
    if (!used.has(code)) return code;
  }
  return `OURO-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export function validateAndResolveReferralCode(
  accounts: RegisteredAccount[] = [],
  rawCode?: string,
  selfEmail?: string
):
  | { ok: true; normalizedCode?: string; referrerEmail?: string; referrerName?: string }
  | { ok: false; error: string } {
  const trimmed = (rawCode ?? '').trim().toUpperCase();
  if (!trimmed) return { ok: true, normalizedCode: undefined };
  const referrer = accounts.find(
    (acc) => (acc.referralCode ?? '').trim().toUpperCase() === trimmed
  );
  if (!referrer) {
    return {
      ok: false,
      error: 'Invalid referral code. Check the invite code or leave blank.',
    };
  }
  if (
    selfEmail &&
    referrer.email.trim().toLowerCase() === selfEmail.trim().toLowerCase()
  ) {
    return {
      ok: false,
      error: 'Self-referral is not allowed.',
    };
  }
  if (referrer.banned) {
    return {
      ok: false,
      error: 'This referral code belongs to a restricted account.',
    };
  }
  return {
    ok: true,
    normalizedCode: trimmed,
    referrerEmail: referrer.email,
    referrerName: referrer.name,
  };
}

export function applyReferralRewardOnFirstBet(
  state: AppState,
  nowMs = Date.now()
): {
  nextState: AppState;
  awarded: boolean;
  refereeBonus: number;
  referrerBonus: number;
} {
  const cleanEmail = state.profile.email.trim().toLowerCase();
  if (!cleanEmail) {
    return { nextState: state, awarded: false, refereeBonus: 0, referrerBonus: 0 };
  }
  const accounts = state.registeredAccounts ?? [];
  const refereeIdx = accounts.findIndex(
    (a) => a.email.trim().toLowerCase() === cleanEmail
  );
  if (refereeIdx < 0) {
    return { nextState: state, awarded: false, refereeBonus: 0, referrerBonus: 0 };
  }
  const refereeAcc = accounts[refereeIdx];
  const refCode = (refereeAcc.referredByCode ?? '').trim().toUpperCase();
  if (!refCode || refereeAcc.referralRewardSettled) {
    return { nextState: state, awarded: false, refereeBonus: 0, referrerBonus: 0 };
  }
  const referrerIdx = accounts.findIndex(
    (a) =>
      (a.referralCode ?? '').trim().toUpperCase() === refCode &&
      a.email.trim().toLowerCase() !== cleanEmail
  );
  if (referrerIdx < 0 || accounts[referrerIdx].banned) {
    return { nextState: state, awarded: false, refereeBonus: 0, referrerBonus: 0 };
  }

  const referrerAcc = accounts[referrerIdx];
  const cfg = getEffectiveReferralConfig(state);
  const stamp = formatExactDateTime(nowMs);
  const refereeBonus = roundMoney(Math.min(20, Math.max(0, cfg.refereeBonusInr)));

  const currentRefCount = Math.max(0, referrerAcc.rewardedReferralsCount ?? 0);
  const currentRefEarned = Math.max(0, referrerAcc.referralEarnedInr ?? 0);
  const remainingCap = Math.max(0, roundMoney(cfg.referralBonusCapInr - currentRefEarned));
  const underCountCap = currentRefCount < cfg.maxReferralsPerUser;
  const referrerBonus =
    underCountCap && remainingCap > 0
      ? roundMoney(Math.min(25, cfg.referrerBonusInr, remainingCap))
      : 0;

  const refereeTx: WalletTransaction | null =
    refereeBonus > 0
      ? {
          id: `tx-ref-ee-${nowMs}-${Math.random().toString(36).slice(2, 6)}`,
          type: 'referral_bonus',
          title: 'Referral Welcome Play Bonus',
          amount: refereeBonus,
          timestamp: stamp,
          status: 'Credited',
          meta: `Play-only ₹${refereeBonus} bonus · Code ${refCode}`,
          createdAtMs: nowMs,
          credited: true,
          userEmail: refereeAcc.email,
          userName: refereeAcc.name,
          userUid: refereeAcc.uid,
        }
      : null;

  const referrerTx: WalletTransaction | null =
    referrerBonus > 0
      ? {
          id: `tx-ref-er-${nowMs}-${Math.random().toString(36).slice(2, 6)}`,
          type: 'referral_bonus',
          title: `Invite Share Reward · ${refereeAcc.name || cleanEmail}`,
          amount: referrerBonus,
          timestamp: stamp,
          status: 'Credited',
          meta: `Capped referral ${currentRefCount + 1}/${cfg.maxReferralsPerUser}`,
          createdAtMs: nowMs,
          credited: true,
          userEmail: referrerAcc.email,
          userName: referrerAcc.name,
          userUid: referrerAcc.uid,
        }
      : null;

  const nextBalance = roundMoney(state.balance + refereeBonus);
  const nextTodayReceived = roundMoney(state.todayReceived + refereeBonus);
  const nextTransactions = refereeTx
    ? [refereeTx, ...state.transactions]
    : state.transactions;

  const platformExtras = [refereeTx, referrerTx].filter(
    (t): t is WalletTransaction => Boolean(t)
  );
  const nextPlatformTransactions = [
    ...platformExtras,
    ...(state.platformTransactions ?? []),
  ].slice(0, 300);

  const nextAccounts = accounts.map((acc, idx) => {
    if (idx === refereeIdx) {
      return {
        ...acc,
        balance: nextBalance,
        todayReceived: nextTodayReceived,
        referralRewardSettled: true,
        transactions: nextTransactions,
      };
    }
    if (idx === referrerIdx) {
      return {
        ...acc,
        balance: roundMoney((acc.balance ?? 0) + referrerBonus),
        todayReceived: roundMoney((acc.todayReceived ?? 0) + referrerBonus),
        rewardedReferralsCount: currentRefCount + (referrerBonus > 0 ? 1 : 0),
        referralEarnedInr: roundMoney(currentRefEarned + referrerBonus),
        transactions: referrerTx
          ? [referrerTx, ...(acc.transactions ?? [])]
          : acc.transactions ?? [],
      };
    }
    return acc;
  });

  return {
    nextState: {
      ...state,
      balance: nextBalance,
      todayReceived: nextTodayReceived,
      transactions: nextTransactions,
      platformTransactions: nextPlatformTransactions,
      registeredAccounts: nextAccounts,
    },
    awarded: refereeBonus > 0 || referrerBonus > 0,
    refereeBonus,
    referrerBonus,
  };
}

export function applyReferralBonusOnSignup(
  state: AppState,
  nowMs = Date.now()
): {
  nextState: AppState;
  awarded: boolean;
  refereeBonus: number;
  referrerBonus: number;
} {
  return applyReferralRewardOnFirstBet(state, nowMs);
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export function adminVerifyAndCreditDeposit(
  state: AppState,
  txId: string,
  nowMs = Date.now()
):
  | {
      ok: true;
      nextState: AppState;
      targetEmail: string;
      creditedAmount: number;
      firstDepositBonusInr: number;
    }
  | { ok: false; error: string } {
  const pool = [...(state.platformTransactions ?? []), ...state.transactions];
  const tx = pool.find((t) => t.id === txId && t.type === 'deposit');
  if (!tx) {
    return { ok: false, error: 'Deposit request not found.' };
  }
  if (tx.credited || tx.status === 'Credited' || tx.status === 'Completed') {
    return { ok: false, error: 'This deposit has already been verified and credited.' };
  }
  if (tx.status === 'Rejected') {
    return { ok: false, error: 'Cannot credit a rejected deposit.' };
  }

  const targetEmail = (tx.userEmail ?? state.profile.email).trim().toLowerCase();
  const isCurrentSession =
    state.profile.email.trim().toLowerCase() === targetEmail;
  const amount = roundMoney(Math.max(0, tx.amount));

  const targetAcc = (state.registeredAccounts ?? []).find(
    (a) => a.email.trim().toLowerCase() === targetEmail
  );
  const allKnownTxsForUser = [
    ...(targetAcc?.transactions ?? []),
    ...(isCurrentSession ? state.transactions : []),
    ...(state.platformTransactions ?? []),
  ];
  const hasPriorVerifiedDeposit =
    (targetAcc?.totalDepositedInr ?? 0) > 0 ||
    allKnownTxsForUser.some(
      (item) =>
        item.id !== txId &&
        item.type === 'deposit' &&
        (item.userEmail ?? state.profile.email).trim().toLowerCase() === targetEmail &&
        (item.credited === true || item.status === 'Credited' || item.status === 'Completed') &&
        item.amount > 0
    );

  const settings = getEffectivePlatformSettings(state);
  const bonusPct = Math.max(0, Number(settings.firstDepositBonusPct ?? 5) || 0);
  const bonusMaxInr = Math.max(0, Number(settings.firstDepositBonusMaxInr ?? 100) || 0);
  const firstDepositBonusInr =
    !hasPriorVerifiedDeposit &&
    settings.firstDepositBonusEnabled !== false &&
    bonusPct > 0 &&
    amount > 0
      ? roundMoney(
          bonusMaxInr > 0
            ? Math.min(bonusMaxInr, (amount * bonusPct) / 100)
            : (amount * bonusPct) / 100
        )
      : 0;
  const totalWalletCredit = roundMoney(amount + firstDepositBonusInr);

  const updatedMeta = tx.utr
    ? `UTR ${tx.utr} · Verified & Credited`
    : 'Verified & Credited by Owner';

  const bonusTx: WalletTransaction | null =
    firstDepositBonusInr > 0
      ? {
          id: `tx-dep-bonus-${txId}-${nowMs}`,
          type: 'deposit',
          title: 'New User First-Deposit Bonus',
          amount: firstDepositBonusInr,
          timestamp: formatExactDateTime(nowMs),
          status: 'Credited',
          meta: `${bonusPct}% Welcome Deposit Bonus · Play-Only`,
          createdAtMs: nowMs,
          credited: true,
          userEmail: targetEmail || undefined,
          userName: tx.userName ?? targetAcc?.name ?? state.profile.name,
          userUid: tx.userUid ?? targetAcc?.uid ?? state.profile.uid,
        }
      : null;

  const patchTx = (list: WalletTransaction[]) => {
    const mapped = list.map((item) =>
      item.id === txId
        ? { ...item, status: 'Credited' as const, credited: true, meta: updatedMeta }
        : item
    );
    return bonusTx ? [bonusTx, ...mapped] : mapped;
  };

  const nextRegistered = (state.registeredAccounts ?? []).map((acc) => {
    if (acc.email.trim().toLowerCase() !== targetEmail) return acc;
    return {
      ...acc,
      balance: roundMoney((acc.balance ?? 0) + totalWalletCredit),
      todayReceived: roundMoney((acc.todayReceived ?? 0) + totalWalletCredit),
      totalDepositedInr: roundMoney((acc.totalDepositedInr ?? 0) + amount),
      transactions: patchTx(acc.transactions ?? []),
    };
  });

  const channelLabel = tx.title.replace(/\s*Top Up$/i, '').trim() || 'UPI Gateway';
  const pendingAnim: PendingTransferAnimation | null = targetEmail
    ? {
        id: `ptx-dep-${txId}-${nowMs}`,
        targetEmail,
        direction: 'deposit',
        amountInr: amount,
        channelLabel,
        createdAtMs: nowMs,
      }
    : null;

  const baseState: AppState = {
    ...state,
    balance: isCurrentSession
      ? roundMoney(state.balance + totalWalletCredit)
      : state.balance,
    todayReceived: isCurrentSession
      ? roundMoney(state.todayReceived + totalWalletCredit)
      : state.todayReceived,
    transactions: patchTx(state.transactions),
    platformTransactions: patchTx(state.platformTransactions ?? []),
    registeredAccounts: nextRegistered,
    pendingTransferAnimations: pendingAnim
      ? [...(state.pendingTransferAnimations ?? []), pendingAnim]
      : state.pendingTransferAnimations,
  };

  return {
    ok: true,
    nextState: baseState,
    targetEmail,
    creditedAmount: amount,
    firstDepositBonusInr,
  };
}

export function adminRejectDeposit(
  state: AppState,
  txId: string,
  reason = 'UTR mismatch or payment not received'
): { ok: true; nextState: AppState; targetEmail: string } | { ok: false; error: string } {
  const pool = [...(state.platformTransactions ?? []), ...state.transactions];
  const tx = pool.find((t) => t.id === txId && t.type === 'deposit');
  if (!tx) return { ok: false, error: 'Deposit request not found.' };
  if (tx.credited || tx.status === 'Credited' || tx.status === 'Completed') {
    return { ok: false, error: 'Already credited deposit cannot be rejected.' };
  }

  const cleanReason = reason.trim() || 'UTR verification failed';
  const targetEmail = (tx.userEmail ?? state.profile.email).trim().toLowerCase();
  const updatedMeta = tx.utr
    ? `UTR ${tx.utr} · Rejected: ${cleanReason}`
    : `Rejected: ${cleanReason}`;

  const patchTx = (list: WalletTransaction[]) =>
    list.map((item) =>
      item.id === txId
        ? {
            ...item,
            status: 'Rejected' as const,
            credited: false,
            rejectionReason: cleanReason,
            meta: updatedMeta,
          }
        : item
    );

  return {
    ok: true,
    targetEmail,
    nextState: {
      ...state,
      transactions: patchTx(state.transactions),
      platformTransactions: patchTx(state.platformTransactions ?? []),
      registeredAccounts: (state.registeredAccounts ?? []).map((acc) =>
        acc.email.trim().toLowerCase() === targetEmail
          ? { ...acc, transactions: patchTx(acc.transactions ?? []) }
          : acc
      ),
    },
  };
}

export function adminApproveWithdrawal(
  state: AppState,
  txId: string,
  nowMs = Date.now()
): { ok: true; nextState: AppState; targetEmail: string; amount: number } | { ok: false; error: string } {
  const pool = [...(state.platformTransactions ?? []), ...state.transactions];
  const tx = pool.find((t) => t.id === txId && t.type === 'withdraw');
  if (!tx) return { ok: false, error: 'Withdrawal request not found.' };
  if (tx.status === 'Completed') return { ok: false, error: 'Withdrawal already completed.' };
  if (tx.status === 'Rejected') return { ok: false, error: 'Rejected withdrawal cannot be approved.' };

  const targetEmail = (tx.userEmail ?? state.profile.email).trim().toLowerCase();
  const payoutAmount = roundMoney(Math.abs(tx.amount));
  const updatedMeta = `${tx.destinationSummary ?? tx.meta ?? 'Payout'} · Paid & Completed`;

  const patchTx = (list: WalletTransaction[]) =>
    list.map((item) =>
      item.id === txId
        ? { ...item, status: 'Completed' as const, meta: updatedMeta }
        : item
    );

  const channelLabel = tx.destinationSummary || tx.title.replace(/^Withdraw to\s*/i, '').trim() || 'Bank / UPI';
  const pendingAnim: PendingTransferAnimation | null = targetEmail
    ? {
        id: `ptx-wd-${txId}-${nowMs}`,
        targetEmail,
        direction: 'withdraw',
        amountInr: payoutAmount,
        channelLabel,
        createdAtMs: nowMs,
      }
    : null;

  return {
    ok: true,
    targetEmail,
    amount: payoutAmount,
    nextState: {
      ...state,
      transactions: patchTx(state.transactions),
      platformTransactions: patchTx(state.platformTransactions ?? []),
      pendingTransferAnimations: pendingAnim
        ? [...(state.pendingTransferAnimations ?? []), pendingAnim]
        : state.pendingTransferAnimations,
      registeredAccounts: (state.registeredAccounts ?? []).map((acc) =>
        acc.email.trim().toLowerCase() === targetEmail
          ? {
              ...acc,
              totalWithdrawnInr: roundMoney((acc.totalWithdrawnInr ?? 0) + payoutAmount),
              transactions: patchTx(acc.transactions ?? []),
            }
          : acc
      ),
    },
  };
}

export function adminRejectAndRefundWithdrawal(
  state: AppState,
  txId: string,
  reason = 'Invalid bank/UPI details',
  nowMs = Date.now()
): { ok: true; nextState: AppState; targetEmail: string; refundedAmount: number } | { ok: false; error: string } {
  const pool = [...(state.platformTransactions ?? []), ...state.transactions];
  const tx = pool.find((t) => t.id === txId && t.type === 'withdraw');
  if (!tx) return { ok: false, error: 'Withdrawal request not found.' };
  if (tx.status === 'Completed') return { ok: false, error: 'Already completed withdrawal cannot be rejected.' };
  if (tx.status === 'Rejected') return { ok: false, error: 'Withdrawal was already rejected and refunded.' };

  const cleanReason = reason.trim() || 'Rejected by Owner Desk';
  const targetEmail = (tx.userEmail ?? state.profile.email).trim().toLowerCase();
  const isCurrentSession =
    state.profile.email.trim().toLowerCase() === targetEmail;
  const refundAmount = roundMoney(Math.abs(tx.amount));
  const updatedMeta = `Rejected & Refunded (${cleanReason})`;

  const patchTx = (list: WalletTransaction[]) =>
    list.map((item) =>
      item.id === txId
        ? {
            ...item,
            status: 'Rejected' as const,
            rejectionReason: cleanReason,
            meta: updatedMeta,
          }
        : item
    );

  const refundTx: WalletTransaction = {
    id: `tx-refwd-${nowMs}-${Math.random().toString(36).slice(2, 5)}`,
    type: 'trade_refund',
    title: `Withdrawal Refund (${cleanReason})`,
    amount: refundAmount,
    timestamp: formatExactDateTime(nowMs),
    status: 'Credited',
    meta: 'Refunded to withdrawable winnings',
    createdAtMs: nowMs,
    userEmail: targetEmail || undefined,
    userName: tx.userName,
    userUid: tx.userUid,
  };

  return {
    ok: true,
    targetEmail,
    refundedAmount: refundAmount,
    nextState: {
      ...state,
      balance: isCurrentSession ? roundMoney(state.balance + refundAmount) : state.balance,
      withdrawableBalance: isCurrentSession
        ? roundMoney((state.withdrawableBalance ?? 0) + refundAmount)
        : state.withdrawableBalance,
      transactions: isCurrentSession
        ? [refundTx, ...patchTx(state.transactions)]
        : patchTx(state.transactions),
      platformTransactions: patchTx(state.platformTransactions ?? []),
      registeredAccounts: (state.registeredAccounts ?? []).map((acc) =>
        acc.email.trim().toLowerCase() === targetEmail
          ? {
              ...acc,
              balance: roundMoney((acc.balance ?? 0) + refundAmount),
              withdrawableBalance: roundMoney(
                (acc.withdrawableBalance ?? 0) + refundAmount
              ),
              transactions: [refundTx, ...patchTx(acc.transactions ?? [])],
            }
          : acc
      ),
    },
  };
}

export function consumePendingTransferForUser(
  state: AppState,
  userEmail: string
): { nextState: AppState; transfer: PendingTransferAnimation | null } {
  const cleanEmail = userEmail.trim().toLowerCase();
  if (!cleanEmail) return { nextState: state, transfer: null };
  const queue = state.pendingTransferAnimations ?? [];
  const idx = queue.findIndex(
    (item) => item.targetEmail.trim().toLowerCase() === cleanEmail
  );
  if (idx < 0) return { nextState: state, transfer: null };
  const transfer = queue[idx];
  return {
    transfer,
    nextState: {
      ...state,
      pendingTransferAnimations: queue.filter((_, i) => i !== idx),
    },
  };
}

export interface AdminPlatformSummary {
  ownerFeeRevenue: number;
  verifiedDepositsTotalInr: number;
  verifiedDepositsCount: number;
  pendingDepositsTotalInr: number;
  pendingDepositsCount: number;
  completedWithdrawalsTotalInr: number;
  completedWithdrawalsCount: number;
  pendingWithdrawalsTotalInr: number;
  pendingWithdrawalsCount: number;
  netPlatformFloatInr: number;
  totalUserWalletHoldingsInr: number;
  totalUsersCount: number;
  activeUsersCount: number;
  deactivatedUsersCount: number;
  frozenUsersCount: number;
  bannedUsersCount: number;
}

export function computeAdminPlatformSummary(
  state: AppState,
  nowMs = Date.now()
): AdminPlatformSummary {
  const txMap = new Map<string, WalletTransaction>();
  for (const tx of state.platformTransactions ?? []) {
    txMap.set(tx.id, tx);
  }
  for (const tx of state.transactions) {
    if (!txMap.has(tx.id)) txMap.set(tx.id, tx);
  }

  let verifiedDepositsTotalInr = 0;
  let verifiedDepositsCount = 0;
  let pendingDepositsTotalInr = 0;
  let pendingDepositsCount = 0;
  let completedWithdrawalsTotalInr = 0;
  let completedWithdrawalsCount = 0;
  let pendingWithdrawalsTotalInr = 0;
  let pendingWithdrawalsCount = 0;

  for (const tx of txMap.values()) {
    if (tx.type === 'deposit') {
      if (tx.credited || tx.status === 'Credited' || tx.status === 'Completed') {
        verifiedDepositsTotalInr += Math.max(0, tx.amount);
        verifiedDepositsCount += 1;
      } else if (tx.status !== 'Rejected') {
        pendingDepositsTotalInr += Math.max(0, tx.amount);
        pendingDepositsCount += 1;
      }
    } else if (tx.type === 'withdraw') {
      const absAmt = Math.abs(tx.amount);
      if (tx.status === 'Completed') {
        completedWithdrawalsTotalInr += absAmt;
        completedWithdrawalsCount += 1;
      } else if (tx.status === 'In Process' || tx.status === 'Under Review') {
        pendingWithdrawalsTotalInr += absAmt;
        pendingWithdrawalsCount += 1;
      }
    }
  }

  const accounts = state.registeredAccounts ?? [];
  const activeEmail = state.profile.email.trim().toLowerCase();
  let totalUserWalletHoldingsInr = 0;
  let activeUsersCount = 0;
  let deactivatedUsersCount = 0;
  let frozenUsersCount = 0;
  let bannedUsersCount = 0;

  for (const acc of accounts) {
    const isCurr =
      Boolean(state.isAuthenticated) &&
      acc.email.trim().toLowerCase() === activeEmail;
    totalUserWalletHoldingsInr += isCurr ? state.balance : acc.balance ?? 0;
    const isInactiveDeactivated =
      !isOwnerAdmin(acc.email) &&
      (Boolean(acc.deactivated) || isAccountInactive60Days(acc, nowMs));
    if (acc.banned) bannedUsersCount += 1;
    else if (acc.frozen) frozenUsersCount += 1;
    else if (isInactiveDeactivated) deactivatedUsersCount += 1;
    else activeUsersCount += 1;
  }

  return {
    ownerFeeRevenue: roundMoney(state.ownerFeeRevenue ?? 0),
    verifiedDepositsTotalInr: roundMoney(verifiedDepositsTotalInr),
    verifiedDepositsCount,
    pendingDepositsTotalInr: roundMoney(pendingDepositsTotalInr),
    pendingDepositsCount,
    completedWithdrawalsTotalInr: roundMoney(completedWithdrawalsTotalInr),
    completedWithdrawalsCount,
    pendingWithdrawalsTotalInr: roundMoney(pendingWithdrawalsTotalInr),
    pendingWithdrawalsCount,
    netPlatformFloatInr: roundMoney(verifiedDepositsTotalInr - completedWithdrawalsTotalInr),
    totalUserWalletHoldingsInr: roundMoney(totalUserWalletHoldingsInr),
    totalUsersCount: accounts.length,
    activeUsersCount,
    deactivatedUsersCount,
    frozenUsersCount,
    bannedUsersCount,
  };
}

export interface GameWalletTxParams {
  txId?: string;
  gameId: string;
  gameTitle: string;
  kind: 'bet' | 'win' | 'refund';
  amountInr: number;
  meta?: string;
}

export function applyGameWalletTransaction(
  state: AppState,
  params: GameWalletTxParams,
  nowMs = Date.now()
): { ok: true; nextState: AppState; tx: WalletTransaction } | { ok: false; error: string } {
  const amount = roundMoney(params.amountInr);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: 'Invalid game transaction amount.' };
  }

  const txId =
    params.txId?.trim() ||
    `gtx-${nowMs}-${Math.random().toString(36).slice(2, 7)}`;

  // Idempotency guard against duplicate bridge messages
  const existingTx = state.transactions.find((t) => t.id === txId);
  if (existingTx) {
    return { ok: true, nextState: state, tx: existingTx };
  }

  if (params.kind === 'bet') {
    const restriction = getCurrentUserRestriction(state);
    if (restriction.restricted) {
      return {
        ok: false,
        error: `${restriction.banned ? 'Account banned' : 'Account is currently frozen'}${
          restriction.reason ? `: ${restriction.reason}` : '. Contact Admin support.'
        }`,
      };
    }
    if (restriction.tradingBlocked) {
      return {
        ok: false,
        error: 'Gaming & trading is temporarily paused on your account.',
      };
    }
    if (amount > state.balance) {
      return {
        ok: false,
        error: `Insufficient wallet balance. Need ₹${amount.toFixed(2)}, available ₹${state.balance.toFixed(2)}.`,
      };
    }
  }

  const cleanEmail = state.profile.email.trim().toLowerCase();
  const cleanName = state.profile.name.trim() || cleanEmail || 'Trader';
  const cleanUid = state.profile.uid;
  const stamp = formatExactDateTime(nowMs);

  let nextBalance = state.balance;
  let nextWithdrawable = Math.min(
    state.balance,
    Math.max(0, state.withdrawableBalance ?? state.balance)
  );
  let nextRealizedPnl = state.realizedPnl;
  let nextTodayReceived = state.todayReceived;

  if (params.kind === 'bet') {
    const debit = computeDebitBreakdown(state.balance, nextWithdrawable, amount);
    nextBalance = debit.nextBalance;
    nextWithdrawable = debit.nextWithdrawable;
    nextRealizedPnl = roundMoney(state.realizedPnl - amount);
  } else if (params.kind === 'win') {
    nextBalance = roundMoney(state.balance + amount);
    nextWithdrawable = Math.min(nextBalance, roundMoney(nextWithdrawable + amount));
    nextRealizedPnl = roundMoney(state.realizedPnl + amount);
    nextTodayReceived = roundMoney(state.todayReceived + amount);
  } else {
    // refund
    nextBalance = roundMoney(state.balance + amount);
    nextWithdrawable = Math.min(nextBalance, roundMoney(nextWithdrawable + amount));
    nextRealizedPnl = roundMoney(state.realizedPnl + amount);
  }

  const txType: WalletTransaction['type'] =
    params.kind === 'bet'
      ? 'game_bet'
      : params.kind === 'win'
      ? 'game_win'
      : 'game_refund';

  const txTitle =
    params.kind === 'bet'
      ? `${params.gameTitle} Stake`
      : params.kind === 'win'
      ? `${params.gameTitle} Payout`
      : `${params.gameTitle} Refund`;

  const tx: WalletTransaction = {
    id: txId,
    type: txType,
    title: txTitle,
    amount: params.kind === 'bet' ? -amount : amount,
    timestamp: stamp,
    status:
      params.kind === 'refund'
        ? 'Cancelled/Refunded'
        : params.kind === 'win'
        ? 'Settled'
        : 'Completed',
    meta: params.meta?.trim() || params.gameId,
    createdAtMs: nowMs,
    userEmail: cleanEmail || undefined,
    userName: cleanName,
    userUid: cleanUid,
  };

  const nextTransactions = [tx, ...state.transactions];
  const nextPlatformTransactions = [tx, ...(state.platformTransactions ?? [])].slice(0, 300);

  const nextRegistered = (state.registeredAccounts ?? []).map((acc) => {
    if (cleanEmail && acc.email.trim().toLowerCase() === cleanEmail) {
      return {
        ...acc,
        balance: nextBalance,
        withdrawableBalance: nextWithdrawable,
        realizedPnl: nextRealizedPnl,
        todayReceived: nextTodayReceived,
        transactions: nextTransactions,
      };
    }
    return acc;
  });

  const baseState: AppState = {
    ...state,
    balance: nextBalance,
    withdrawableBalance: nextWithdrawable,
    realizedPnl: nextRealizedPnl,
    todayReceived: nextTodayReceived,
    transactions: nextTransactions,
    platformTransactions: nextPlatformTransactions,
    registeredAccounts: nextRegistered,
  };

  const nextState =
    params.kind === 'bet'
      ? applyReferralRewardOnFirstBet(baseState, nowMs).nextState
      : baseState;

  return { ok: true, nextState, tx };
}

export function getDayKey(nowMs = Date.now()): string {
  return new Date(nowMs).toISOString().slice(0, 10);
}

export function hasVerifiedDeposit(state: AppState): boolean {
  const txHasVerifiedDeposit = (txs: WalletTransaction[] | undefined): boolean =>
    (txs ?? []).some(
      (tx) =>
        tx.type === 'deposit' &&
        (tx.credited === true || tx.status === 'Credited' || tx.status === 'Completed') &&
        tx.amount > 0
    );

  if (txHasVerifiedDeposit(state.transactions)) {
    return true;
  }

  const cleanEmail = state.profile.email.trim().toLowerCase();
  if (!cleanEmail) return false;
  const acc = (state.registeredAccounts ?? []).find(
    (a) => a.email.trim().toLowerCase() === cleanEmail
  );
  if (!acc) return false;
  if ((acc.totalDepositedInr ?? 0) > 0) return true;
  return txHasVerifiedDeposit(acc.transactions);
}

export function computeDailyCheckInRewardInr(
  baseReward = 10,
  nextStreak = 1
): number {
  const cleanBase = Number.isFinite(baseReward) ? Math.max(1, Math.round(baseReward)) : 10;
  const streakStepBonuses = [0, 5, 10, 15, 20, 30, 40];
  const idx = Math.min(streakStepBonuses.length - 1, Math.max(0, nextStreak - 1));
  const cap = Math.max(50, cleanBase);
  return Math.min(cap, cleanBase + streakStepBonuses[idx]);
}

export type DailyCheckInFailReason =
  | 'unauthenticated'
  | 'disabled'
  | 'restricted'
  | 'deposit_required'
  | 'already_claimed';

export function claimDailyCheckIn(
  state: AppState,
  nowMs = Date.now()
):
  | { ok: true; nextState: AppState; rewardInr: number; streak: number }
  | { ok: false; reason: DailyCheckInFailReason; error: string } {
  if (!state.isAuthenticated) {
    return {
      ok: false,
      reason: 'unauthenticated',
      error: 'Please sign in to claim your daily check-in reward.',
    };
  }

  const restriction = getCurrentUserRestriction(state);
  if (restriction.restricted) {
    return {
      ok: false,
      reason: 'restricted',
      error: `${restriction.banned ? 'Account banned' : 'Account is currently frozen'}${
        restriction.reason ? `: ${restriction.reason}` : '. Contact Admin support.'
      }`,
    };
  }

  const settings = getEffectivePlatformSettings(state);
  if (settings.dailyCheckInEnabled === false) {
    return {
      ok: false,
      reason: 'disabled',
      error: 'Daily check-in rewards are temporarily paused by Owner Desk.',
    };
  }

  if (settings.dailyCheckInRequiresDeposit !== false && !hasVerifiedDeposit(state)) {
    const cfg = getEffectiveReferralConfig(state);
    return {
      ok: false,
      reason: 'deposit_required',
      error: `Complete at least 1 verified deposit (₹${cfg.minDepositInr}+) to unlock Daily Check-in Rewards.`,
    };
  }

  const todayKey = getDayKey(nowMs);
  const yesterdayKey = getDayKey(nowMs - 86400000);
  const cleanEmail = state.profile.email.trim().toLowerCase();
  const currentAcc = cleanEmail
    ? (state.registeredAccounts ?? []).find(
        (a) => a.email.trim().toLowerCase() === cleanEmail
      )
    : undefined;

  const lastClaimed = state.profile.lastCheckInDate ?? currentAcc?.lastCheckInDate;
  if (lastClaimed === todayKey) {
    return {
      ok: false,
      reason: 'already_claimed',
      error: "Today's daily check-in reward has already been claimed. Come back tomorrow!",
    };
  }

  const prevStreak = state.profile.checkInStreak ?? currentAcc?.checkInStreak ?? 0;
  const nextStreak = lastClaimed === yesterdayKey ? prevStreak + 1 : 1;
  const rewardInr = computeDailyCheckInRewardInr(
    settings.dailyCheckInBaseReward ?? 10,
    nextStreak
  );

  const stamp = formatExactDateTime(nowMs);
  const tx: WalletTransaction = {
    id: `tx-checkin-${nowMs}-${Math.random().toString(36).slice(2, 5)}`,
    type: 'daily_checkin',
    title: `Daily Check-In (Day ${nextStreak})`,
    amount: rewardInr,
    timestamp: stamp,
    status: 'Credited',
    meta: 'Play-only daily reward · Deposit-verified',
    createdAtMs: nowMs,
    userEmail: cleanEmail || undefined,
    userName: state.profile.name,
    userUid: state.profile.uid,
  };

  const nextBalance = roundMoney(state.balance + rewardInr);
  const nextTodayReceived = roundMoney(state.todayReceived + rewardInr);
  const nextTransactions = [tx, ...state.transactions];
  const nextPlatformTransactions = [tx, ...(state.platformTransactions ?? [])].slice(
    0,
    300
  );

  const nextRegistered = (state.registeredAccounts ?? []).map((acc) => {
    if (cleanEmail && acc.email.trim().toLowerCase() === cleanEmail) {
      return {
        ...acc,
        balance: nextBalance,
        todayReceived: nextTodayReceived,
        lastCheckInDate: todayKey,
        checkInStreak: nextStreak,
        transactions: nextTransactions,
      };
    }
    return acc;
  });

  return {
    ok: true,
    rewardInr,
    streak: nextStreak,
    nextState: {
      ...state,
      balance: nextBalance,
      // Bonus credits remain locked for play/trading (withdrawableBalance unchanged) so owner never takes free-cash loss.
      withdrawableBalance: Math.min(nextBalance, state.withdrawableBalance ?? 0),
      todayReceived: nextTodayReceived,
      transactions: nextTransactions,
      platformTransactions: nextPlatformTransactions,
      registeredAccounts: nextRegistered,
      profile: {
        ...state.profile,
        lastCheckInDate: todayKey,
        checkInStreak: nextStreak,
      },
    },
  };
}

export function changeAccountPassword(
  state: AppState,
  params: { currentPassword: string; newPassword: string }
): { ok: true; nextState: AppState } | { ok: false; error: string } {
  if (!state.isAuthenticated || !state.profile.email.trim()) {
    return { ok: false, error: 'You must be signed in to change your password.' };
  }
  const cleanEmail = state.profile.email.trim().toLowerCase();
  if (isOwnerAdmin(cleanEmail)) {
    return {
      ok: false,
      error: 'Owner Admin login credentials are locked for security.',
    };
  }
  const accounts = state.registeredAccounts ?? [];
  const target = accounts.find((a) => a.email.trim().toLowerCase() === cleanEmail);
  if (!target) {
    return { ok: false, error: 'Registered account record not found.' };
  }
  if (target.password !== params.currentPassword) {
    return { ok: false, error: 'Current password is incorrect.' };
  }
  if (params.newPassword.length < 6) {
    return { ok: false, error: 'New password must be at least 6 characters.' };
  }
  if (params.newPassword === params.currentPassword) {
    return { ok: false, error: 'New password must be different from your current password.' };
  }

  return {
    ok: true,
    nextState: {
      ...state,
      registeredAccounts: accounts.map((acc) =>
        acc.email.trim().toLowerCase() === cleanEmail
          ? { ...acc, password: params.newPassword }
          : acc
      ),
    },
  };
}

export interface TopTraderEntry {
  rank: number;
  name: string;
  uid: string;
  realizedPnl: number;
  winRatePct: number;
  tradesWon: number;
  isCurrentUser: boolean;
  tierName: string;
}

const SEED_TOP_TRADERS: Omit<TopTraderEntry, 'rank' | 'isCurrentUser'>[] = [
  { name: 'Vikram_FX', uid: 'UID-8412-VIKRA', realizedPnl: 48250, winRatePct: 78, tradesWon: 142, tierName: 'Sovereign' },
  { name: 'Riya_Trades', uid: 'UID-7721-RIYAT', realizedPnl: 39640, winRatePct: 74, tradesWon: 118, tierName: 'MVP' },
  { name: 'Kabir_Alpha', uid: 'UID-6509-KABIR', realizedPnl: 31890, winRatePct: 71, tradesWon: 96, tierName: 'VVIP' },
  { name: 'Neha_Desk', uid: 'UID-5930-NEHAD', realizedPnl: 26420, winRatePct: 69, tradesWon: 84, tierName: 'VVIP' },
  { name: 'Arjun99', uid: 'UID-4481-ARJUN', realizedPnl: 21150, winRatePct: 67, tradesWon: 73, tierName: 'VIP' },
  { name: 'Siddharth_IN', uid: 'UID-3902-SIDDH', realizedPnl: 16800, winRatePct: 65, tradesWon: 61, tierName: 'VIP' },
  { name: 'Ananya_Pro', uid: 'UID-3124-ANANY', realizedPnl: 12950, winRatePct: 64, tradesWon: 54, tierName: 'Extraordinary' },
  { name: 'Devansh_X', uid: 'UID-2845-DEVAN', realizedPnl: 9420, winRatePct: 62, tradesWon: 43, tierName: 'Extraordinary' },
  { name: 'Meera_Quant', uid: 'UID-2190-MEERA', realizedPnl: 6850, winRatePct: 61, tradesWon: 37, tierName: 'Ordinary' },
  { name: 'Rohan_V', uid: 'UID-1840-ROHAN', realizedPnl: 4320, winRatePct: 59, tradesWon: 29, tierName: 'Ordinary' },
];

export function buildTopTradersLeaderboard(
  state: AppState,
  limit = 10
): { entries: TopTraderEntry[]; currentUserEntry: TopTraderEntry | null } {
  const activeEmail = state.isAuthenticated
    ? state.profile.email.trim().toLowerCase()
    : '';

  const candidates = new Map<string, Omit<TopTraderEntry, 'rank'>>();

  for (const seed of SEED_TOP_TRADERS) {
    candidates.set(seed.uid, { ...seed, isCurrentUser: false });
  }

  for (const acc of state.registeredAccounts ?? []) {
    if (acc.banned) continue;
    const accEmail = acc.email.trim().toLowerCase();
    const isCurrent = Boolean(activeEmail && accEmail === activeEmail);
    const pnl = roundMoney(isCurrent ? state.realizedPnl : acc.realizedPnl ?? 0);
    const positions = isCurrent ? state.positions : acc.positions ?? [];
    const bets = isCurrent ? state.bets : acc.bets ?? [];
    const closedPos = positions.filter((p) => p.status === 'closed');
    const settledBets = bets.filter((b) => b.status === 'won' || b.status === 'lost');
    const wonPos = closedPos.filter((p) => (p.realizedPnl ?? 0) > 0).length;
    const wonBets = settledBets.filter((b) => b.status === 'won').length;
    const totalSettled = closedPos.length + settledBets.length;
    const tradesWon = wonPos + wonBets;
    const winRatePct =
      totalSettled > 0 ? Math.round((tradesWon / totalSettled) * 100) : pnl > 0 ? 60 : 0;

    const spent = isCurrent
      ? calculateTotalSpent(state)
      : Math.max(0, Math.abs(pnl));
    const tierName = calculatePlayerLevel(spent).current.name;

    const key = acc.uid || accEmail || acc.name;
    candidates.set(key, {
      name: isCurrent ? state.profile.name : acc.name,
      uid: acc.uid || key,
      realizedPnl: pnl,
      winRatePct,
      tradesWon,
      isCurrentUser: isCurrent,
      tierName,
    });
  }

  // Also include active authenticated session if not yet in registeredAccounts
  if (activeEmail && !Array.from(candidates.values()).some((c) => c.isCurrentUser)) {
    const key = state.profile.uid || activeEmail;
    const closedPos = state.positions.filter((p) => p.status === 'closed');
    const settledBets = state.bets.filter((b) => b.status === 'won' || b.status === 'lost');
    const tradesWon =
      closedPos.filter((p) => (p.realizedPnl ?? 0) > 0).length +
      settledBets.filter((b) => b.status === 'won').length;
    const totalSettled = closedPos.length + settledBets.length;
    candidates.set(key, {
      name: state.profile.name,
      uid: state.profile.uid,
      realizedPnl: roundMoney(state.realizedPnl),
      winRatePct: totalSettled > 0 ? Math.round((tradesWon / totalSettled) * 100) : 0,
      tradesWon,
      isCurrentUser: true,
      tierName: calculatePlayerLevel(calculateTotalSpent(state)).current.name,
    });
  }

  const sorted: TopTraderEntry[] = Array.from(candidates.values())
    .sort((a, b) => b.realizedPnl - a.realizedPnl || b.tradesWon - a.tradesWon)
    .map((entry, idx) => ({
      ...entry,
      rank: idx + 1,
    }));

  const currentUserEntry = sorted.find((e) => e.isCurrentUser) ?? null;
  return {
    entries: sorted.slice(0, Math.max(1, limit)),
    currentUserEntry,
  };
}

export interface OwnerPredictionDraft {
  question: string;
  category: PredictionMarket['category'];
  subLabel: string;
  endLabel: string;
  endsInSeconds: number;
  resolutionCriteria?: string;
  yesPoolSeed?: number;
  noPoolSeed?: number;
}

export function parseVoiceCommandLocally(transcript: string): OwnerPredictionDraft {
  const raw = transcript.trim().replace(/\s+/g, ' ');
  const lower = raw.toLowerCase();

  let category: PredictionMarket['category'] = 'Political';
  let subLabel = 'Owner Desk · India';

  if (
    /\b(btc|eth|sol|doge|xrp|bnb|ada|crypto|bitcoin|ethereum|solana|coin|usdt|token)\b/i.test(
      lower
    )
  ) {
    category = 'Crypto';
    subLabel = 'Crypto Live Desk';
  } else if (
    /\b(cricket|ipl|match|india|kohli|rohit|bumrah|t20|odi|world cup|football|goal|valorant|esports|winner|trophy)\b/i.test(
      lower
    )
  ) {
    category = 'Sports';
    subLabel = 'Sports & Cricket';
  } else if (
    /\b(gta|bgmi|free fire|aviator|game|gaming|launch|console|pubg|minecraft)\b/i.test(
      lower
    )
  ) {
    category = 'Famous Games';
    subLabel = 'Famous Games';
  } else if (
    /\b(apple|iphone|samsung|xiaomi|oneplus|pixel|nothing|mobile|phone|smartphone)\b/i.test(
      lower
    )
  ) {
    category = 'Mobile Brands';
    subLabel = 'Mobile Brands';
  } else if (
    /\b(pm|pradhanmantri|prime minister|election|chunav|bjp|congress|modi|amit shah|rahul|rbi|policy|parliament|govt|minister)\b/i.test(
      lower
    )
  ) {
    category = 'Political';
    subLabel = 'India Elections & Policy';
  }

  // Extract timeframe hints if spoken
  let endsInSeconds = 86400;
  let endLabel = 'Ends in 24h';
  if (/\b(1\s*hour|1h|ek ghanta|one hour)\b/i.test(lower)) {
    endsInSeconds = 3600;
    endLabel = 'Ends in 1h';
  } else if (/\b(7\s*days|7d|week|hafte|next week|election)\b/i.test(lower)) {
    endsInSeconds = 604800;
    endLabel = 'Ends in 7d';
  } else if (/\b(today|aaj|tonight|raat)\b/i.test(lower)) {
    endsInSeconds = 43200;
    endLabel = 'Today Result';
  }

  // Strip trailing "yes ya no" / "yes or no" / "haan ya naa" filler for clean question text
  const stripped = raw
    .replace(/\b(yes\s*(ya|or|\/)\s*no|haan\s*(ya|or)\s*naa?)\b[.?!,\s]*/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  const baseText = stripped || raw;
  let question = baseText;

  // Smartly rewrite popular Hindi/Hinglish election/PM pattern into crisp Yes/No English/Hinglish question
  if (
    /pradhanmantri|prime minister|\bpm\b/i.test(lower) &&
    /(amit shah|narendra modi|modi|rahul gandhi|yogi)/i.test(lower)
  ) {
    const candidateMatch = baseText.match(
      /(amit shah|narendra modi|modi|rahul gandhi|yogi adityanath|yogi)/i
    );
    const candidate = candidateMatch
      ? candidateMatch[1].replace(/\b\w/g, (c) => c.toUpperCase())
      : 'the named candidate';
    question = `Will ${candidate} become the next Prime Minister in the upcoming election?`;
  } else {
    const capitalized =
      baseText.charAt(0).toUpperCase() + baseText.slice(1);
    question = capitalized.endsWith('?') ? capitalized : `${capitalized} (Yes / No)?`;
  }

  return {
    question,
    category,
    subLabel,
    endLabel,
    endsInSeconds,
    resolutionCriteria:
      'Settle based on verified official announcement or authoritative news reports.',
    yesPoolSeed: 5000,
    noPoolSeed: 5000,
  };
}

export function createOwnerPredictionMarket(
  state: AppState,
  ownerEmail: string,
  draft: OwnerPredictionDraft,
  nowMs = Date.now()
): { ok: true; nextState: AppState; market: PredictionMarket } | { ok: false; error: string } {
  if (!isOwnerAdmin(ownerEmail)) {
    return {
      ok: false,
      error: 'Unauthorized: Only the platform owner can launch new prediction bets.',
    };
  }
  const question = draft.question.trim();
  if (question.length < 5) {
    return { ok: false, error: 'Prediction question must be at least 5 characters.' };
  }

  const market: PredictionMarket = {
    id: `pred-owner-${nowMs}-${Math.random().toString(36).slice(2, 5)}`,
    category: draft.category,
    subLabel: draft.subLabel.trim() || `${draft.category} · Owner Desk`,
    question,
    endsInSeconds: Math.max(300, Math.floor(Number(draft.endsInSeconds) || 86400)),
    endLabel: draft.endLabel.trim() || 'Live Web Settled',
    yesPool: Math.max(1000, roundMoney(Number(draft.yesPoolSeed) || 5000)),
    noPool: Math.max(1000, roundMoney(Number(draft.noPoolSeed) || 5000)),
    yesBettors: 0,
    noBettors: 0,
    createdByOwner: true,
    createdAt: formatExactDateTime(nowMs),
    resolutionCriteria: draft.resolutionCriteria?.trim() || undefined,
  };

  return {
    ok: true,
    market,
    nextState: {
      ...state,
      predictions: [market, ...state.predictions],
    },
  };
}

export function settlePredictionMarketByOutcome(
  state: AppState,
  params: {
    ownerEmail: string;
    marketId: string;
    outcome: 'yes' | 'no';
    summary: string;
    sources?: Array<{ title: string; uri: string }>;
    nowMs?: number;
  }
):
  | {
      ok: true;
      nextState: AppState;
      settledCount: number;
      winnersCount: number;
      totalPayoutInr: number;
      totalCommissionInr: number;
    }
  | { ok: false; error: string } {
  if (!isOwnerAdmin(params.ownerEmail)) {
    return {
      ok: false,
      error: 'Unauthorized: Only the platform owner can settle prediction outcomes.',
    };
  }

  const market = state.predictions.find((m) => m.id === params.marketId);
  if (!market) {
    return { ok: false, error: 'Prediction market not found.' };
  }
  if (market.resolvedOutcome) {
    return { ok: false, error: 'Prediction market has already been settled.' };
  }

  const nowMs = params.nowMs ?? Date.now();
  const stamp = formatExactDateTime(nowMs);
  const feePct = getEffectiveReferralConfig(state).platformFeePct;
  const cleanSessionEmail = state.profile.email.trim().toLowerCase();
  const settledBetIds = new Set<string>();
  const newLedgerEntries: CommissionLedgerEntry[] = [];
  const newPlatformTxs: WalletTransaction[] = [];

  let settledCount = 0;
  let winnersCount = 0;
  let totalPayoutInr = 0;
  let totalCommissionInr = 0;
  let ownerRevenueDelta = 0;

  const computeBetSettlement = (
    bet: ActiveBet,
    actorEmail: string,
    actorName: string,
    actorUid: string
  ): {
    updatedBet: ActiveBet;
    netPayout: number;
    pnlDelta: number;
    profitCredit: number;
    tx: WalletTransaction;
  } => {
    const won = bet.choice === params.outcome;
    const grossPayout = won ? roundMoney(bet.stake * bet.multiplier) : 0;
    const grossProfit = won ? roundMoney(Math.max(0, grossPayout - bet.stake)) : 0;
    const commissionFee = won ? roundMoney((grossProfit * feePct) / 100) : 0;
    const netPayout = won ? roundMoney(Math.max(0, grossPayout - commissionFee)) : 0;
    const pnlDelta = roundMoney(netPayout - bet.stake);
    const profitCredit = won ? roundMoney(Math.max(0, netPayout - bet.stake)) : 0;

    if (!settledBetIds.has(bet.id)) {
      settledBetIds.add(bet.id);
      settledCount += 1;
      if (won) {
        winnersCount += 1;
        totalPayoutInr = roundMoney(totalPayoutInr + netPayout);
        totalCommissionInr = roundMoney(totalCommissionInr + commissionFee);
        ownerRevenueDelta = roundMoney(ownerRevenueDelta + commissionFee);
      }
      newLedgerEntries.push({
        id: `led-pred-${bet.id}-${nowMs}`,
        timestamp: stamp,
        createdAtMs: nowMs,
        actorEmail,
        actorName,
        kind: 'bet',
        grossAmountInr: won ? grossPayout : bet.stake,
        platformFeeInr: commissionFee,
        ownerNetRevenueInr: won ? commissionFee : bet.stake,
        note: `${won ? 'WIN' : 'LOSS'} (${params.outcome.toUpperCase()}) · ${market.question.slice(0, 48)}`,
      });
    }

    const tx: WalletTransaction = {
      id: `tx-pred-res-${bet.id}-${nowMs}`,
      type: 'trade_close',
      title: `Live Web Result (${params.outcome.toUpperCase()}) · ${market.subLabel}`,
      amount: netPayout,
      timestamp: stamp,
      status: 'Settled',
      meta: won
        ? `Won ${bet.multiplier.toFixed(2)}x · Net after ${feePct}% fee`
        : 'Settled via Live Web Result',
      createdAtMs: nowMs,
      userEmail: actorEmail || undefined,
      userName: actorName,
      userUid: actorUid,
    };

    return {
      updatedBet: {
        ...bet,
        status: won ? 'won' : 'lost',
        payout: netPayout,
        settledAt: stamp,
        resolutionSummary: params.summary,
        resolutionSources: params.sources,
      },
      netPayout,
      pnlDelta,
      profitCredit,
      tx,
    };
  };

  // Settle bets in registered accounts (using active state.bets if acc matches active session)
  const nextRegistered: RegisteredAccount[] = (state.registeredAccounts ?? []).map((acc) => {
    const accEmail = acc.email.trim().toLowerCase();
    const isSession = Boolean(cleanSessionEmail && accEmail === cleanSessionEmail);
    const sourceBets = isSession ? state.bets : acc.bets ?? [];
    const matchingOpen = sourceBets.filter(
      (b) => b.marketId === params.marketId && b.status === 'open'
    );
    if (matchingOpen.length === 0) return acc;

    let bal = isSession ? state.balance : acc.balance ?? 0;
    let wd = isSession ? state.withdrawableBalance : acc.withdrawableBalance ?? 0;
    let pnl = isSession ? state.realizedPnl : acc.realizedPnl ?? 0;
    let today = isSession ? state.todayReceived : acc.todayReceived ?? 0;
    const accTxs = [...(isSession ? state.transactions : acc.transactions ?? [])];

    const updatedBets = sourceBets.map((b) => {
      if (b.marketId !== params.marketId || b.status !== 'open') return b;
      const res = computeBetSettlement(b, accEmail, acc.name, acc.uid);
      bal = roundMoney(bal + res.netPayout);
      if (res.netPayout > 0) {
        wd = Math.min(bal, roundMoney(wd + res.netPayout));
      } else {
        wd = Math.min(bal, wd);
      }
      pnl = roundMoney(pnl + res.pnlDelta);
      today = roundMoney(today + res.profitCredit);
      accTxs.unshift(res.tx);
      newPlatformTxs.push(res.tx);
      return res.updatedBet;
    });

    return {
      ...acc,
      balance: bal,
      withdrawableBalance: wd,
      realizedPnl: pnl,
      todayReceived: today,
      bets: updatedBets,
      transactions: accTxs,
    };
  });

  // Also update active session state (including when session account is not in registeredAccounts)
  let nextSessionBalance = state.balance;
  let nextSessionWd = state.withdrawableBalance;
  let nextSessionPnl = state.realizedPnl;
  let nextSessionToday = state.todayReceived;
  const sessionTxsToPrepend: WalletTransaction[] = [];

  const nextSessionBets = state.bets.map((b) => {
    if (b.marketId !== params.marketId || b.status !== 'open') return b;
    const res = computeBetSettlement(
      b,
      cleanSessionEmail || 'session',
      state.profile.name,
      state.profile.uid
    );
    nextSessionBalance = roundMoney(nextSessionBalance + res.netPayout);
    if (res.netPayout > 0) {
      nextSessionWd = Math.min(
        nextSessionBalance,
        roundMoney(nextSessionWd + res.netPayout)
      );
    } else {
      nextSessionWd = Math.min(nextSessionBalance, nextSessionWd);
    }
    nextSessionPnl = roundMoney(nextSessionPnl + res.pnlDelta);
    nextSessionToday = roundMoney(nextSessionToday + res.profitCredit);
    sessionTxsToPrepend.push(res.tx);
    if (!newPlatformTxs.some((t) => t.id === res.tx.id)) {
      newPlatformTxs.push(res.tx);
    }
    return res.updatedBet;
  });

  const nextPredictions = state.predictions.map((m) => {
    if (m.id !== params.marketId) return m;
    return {
      ...m,
      endsInSeconds: 0,
      endLabel: params.outcome === 'yes' ? 'Settled: YES' : 'Settled: NO',
      resolvedOutcome: params.outcome,
      resolvedAt: stamp,
      resolutionSummary: params.summary,
      resolutionSources: params.sources,
    };
  });

  return {
    ok: true,
    settledCount,
    winnersCount,
    totalPayoutInr: roundMoney(totalPayoutInr),
    totalCommissionInr: roundMoney(totalCommissionInr),
    nextState: {
      ...state,
      balance: nextSessionBalance,
      withdrawableBalance: nextSessionWd,
      realizedPnl: nextSessionPnl,
      todayReceived: nextSessionToday,
      bets: nextSessionBets,
      predictions: nextPredictions,
      transactions: [...sessionTxsToPrepend, ...state.transactions],
      platformTransactions: [...newPlatformTxs, ...(state.platformTransactions ?? [])].slice(
        0,
        300
      ),
      registeredAccounts: nextRegistered,
      ownerFeeRevenue: roundMoney((state.ownerFeeRevenue ?? 0) + ownerRevenueDelta),
      commissionLedger: [...newLedgerEntries, ...(state.commissionLedger ?? [])].slice(
        0,
        300
      ),
    },
  };
}

// ============================================================================
// P2P WALLET QR & PROFILE ID TRANSFER ENGINE
// ============================================================================

export const MIN_P2P_WALLET_TRANSFER_INR = 10;
export const MAX_P2P_WALLET_TRANSFER_INR = 100000;

export interface WalletQrPayload {
  uid: string;
  name: string;
  amountInr?: number;
}

export interface WalletRecipientLookupResult {
  uid: string;
  name: string;
  email?: string;
  source: 'registered' | 'directory';
  tierName?: string;
}

export function buildWalletQrPayload(params: WalletQrPayload): string {
  const cleanUid = params.uid.trim().toUpperCase();
  const cleanName = (params.name || 'Trader').trim();
  const qp = new URLSearchParams();
  qp.set('uid', cleanUid);
  if (cleanName) qp.set('name', cleanName);
  const amt = Number(params.amountInr);
  if (Number.isFinite(amt) && amt > 0) {
    qp.set('am', String(roundMoney(amt)));
  }
  return `ouroboros://wallet-pay?${qp.toString()}`;
}

export function parseWalletQrOrProfileInput(rawText: string):
  | {
      ok: true;
      uid: string;
      nameHint?: string;
      amountInr?: number;
    }
  | {
      ok: false;
      error: string;
    } {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return { ok: false, error: 'Scan a valid Ouroboros QR code or enter a Profile ID.' };
  }

  // 1. Standard Ouroboros QR URI: ouroboros://wallet-pay?uid=...&name=...&am=...
  if (/^ouroboros:\/\//i.test(trimmed)) {
    try {
      const normalized = trimmed.replace(/^ouroboros:\/\//i, 'https://ouroboros.local/');
      const url = new URL(normalized);
      const uid = (url.searchParams.get('uid') || '').trim().toUpperCase();
      if (!uid) {
        return { ok: false, error: 'QR code does not contain a valid Profile ID.' };
      }
      const nameHint = url.searchParams.get('name')?.trim() || undefined;
      const rawAmt = Number(url.searchParams.get('am'));
      const amountInr =
        Number.isFinite(rawAmt) && rawAmt > 0 ? roundMoney(rawAmt) : undefined;
      return { ok: true, uid, nameHint, amountInr };
    } catch {
      return { ok: false, error: 'Could not read Ouroboros payment QR code.' };
    }
  }

  // 2. JSON QR payload fallback
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed) as {
        uid?: unknown;
        name?: unknown;
        amount?: unknown;
        am?: unknown;
      };
      const uid = typeof parsed.uid === 'string' ? parsed.uid.trim().toUpperCase() : '';
      if (!uid) {
        return { ok: false, error: 'QR payload is missing a recipient Profile ID.' };
      }
      const rawAmt = Number(parsed.amount ?? parsed.am);
      return {
        ok: true,
        uid,
        nameHint: typeof parsed.name === 'string' ? parsed.name.trim() : undefined,
        amountInr:
          Number.isFinite(rawAmt) && rawAmt > 0 ? roundMoney(rawAmt) : undefined,
      };
    } catch {
      return { ok: false, error: 'Invalid QR payload format.' };
    }
  }

  // 3. Direct Profile ID (e.g. UID-8412-VIKRA)
  const cleanUid = trimmed.toUpperCase();
  if (!/^UID-[A-Z0-9-]{3,28}$/i.test(cleanUid)) {
    return {
      ok: false,
      error: 'Enter a valid Profile ID (for example, UID-8412-VIKRA) or scan an Ouroboros QR.',
    };
  }
  return { ok: true, uid: cleanUid };
}

export function findWalletRecipientByUid(
  state: AppState,
  rawUid: string
):
  | { ok: true; recipient: WalletRecipientLookupResult }
  | { ok: false; error: string } {
  const cleanUid = rawUid.trim().toUpperCase();
  if (!cleanUid) {
    return { ok: false, error: 'Please enter or scan a recipient Profile ID.' };
  }

  const selfUid = (state.profile.uid || '').trim().toUpperCase();
  if (selfUid && cleanUid === selfUid) {
    return { ok: false, error: 'You cannot send money to your own Profile ID.' };
  }

  const selfEmail = (state.profile.email || '').trim().toLowerCase();
  const regAcc = (state.registeredAccounts ?? []).find(
    (acc) => (acc.uid || '').trim().toUpperCase() === cleanUid
  );
  if (regAcc) {
    if (selfEmail && regAcc.email.trim().toLowerCase() === selfEmail) {
      return { ok: false, error: 'You cannot send money to your own wallet.' };
    }
    if (regAcc.banned || regAcc.frozen) {
      return { ok: false, error: 'Recipient wallet is currently restricted and cannot receive transfers.' };
    }
    return {
      ok: true,
      recipient: {
        uid: regAcc.uid.trim().toUpperCase(),
        name: regAcc.name,
        email: regAcc.email,
        source: 'registered',
      },
    };
  }

  const directoryAcc = SEED_TOP_TRADERS.find(
    (t) => t.uid.trim().toUpperCase() === cleanUid
  );
  if (directoryAcc) {
    return {
      ok: true,
      recipient: {
        uid: directoryAcc.uid.trim().toUpperCase(),
        name: directoryAcc.name,
        source: 'directory',
        tierName: directoryAcc.tierName,
      },
    };
  }

  return {
    ok: false,
    error: `No Ouroboros wallet found for Profile ID "${cleanUid}". Check the ID or scan their QR code again.`,
  };
}

export function transferWalletByProfileId(
  state: AppState,
  params: {
    recipientUid: string;
    amountInr: number;
    note?: string;
    via?: 'qr' | 'id';
    nowMs?: number;
  }
):
  | {
      ok: true;
      nextState: AppState;
      recipient: WalletRecipientLookupResult;
      amountInr: number;
      txId: string;
    }
  | { ok: false; error: string } {
  if (!state.isAuthenticated) {
    return { ok: false, error: 'Please sign in to send money from your wallet.' };
  }

  const restriction = getCurrentUserRestriction(state);
  if (restriction.restricted) {
    return {
      ok: false,
      error: `${restriction.banned ? 'Account banned' : 'Account is currently frozen'}${restriction.reason ? `: ${restriction.reason}` : '.'}`,
    };
  }
  if (restriction.withdrawalsBlocked) {
    return {
      ok: false,
      error: 'Transfers & withdrawals are currently paused for your account.',
    };
  }

  const parsed = parseWalletQrOrProfileInput(params.recipientUid);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error };
  }

  const lookup = findWalletRecipientByUid(state, parsed.uid);
  if (!lookup.ok) {
    return { ok: false, error: lookup.error };
  }

  const amountInr = roundMoney(Number(params.amountInr));
  if (!Number.isFinite(amountInr) || amountInr < MIN_P2P_WALLET_TRANSFER_INR) {
    return {
      ok: false,
      error: `Minimum wallet transfer is ₹${MIN_P2P_WALLET_TRANSFER_INR}.`,
    };
  }
  if (amountInr > MAX_P2P_WALLET_TRANSFER_INR) {
    return {
      ok: false,
      error: `Maximum single wallet transfer is ₹${MAX_P2P_WALLET_TRANSFER_INR.toLocaleString('en-IN')}.`,
    };
  }
  if (state.balance < amountInr) {
    return {
      ok: false,
      error: `Insufficient balance. Available ₹${state.balance.toFixed(2)}.`,
    };
  }

  const nowMs = params.nowMs ?? Date.now();
  const stamp = formatExactDateTime(nowMs);
  const cleanNote = params.note?.trim() || '';
  const channelLabel = params.via === 'qr' ? 'QR Scan' : 'Profile ID';
  const senderUid = (state.profile.uid || 'UID-TRADER').trim().toUpperCase();
  const senderEmail = (state.profile.email || '').trim().toLowerCase();
  const senderName = (state.profile.name || 'Trader').trim();
  const recipient = lookup.recipient;

  const currentWithdrawable = Math.min(
    state.balance,
    Math.max(0, state.withdrawableBalance ?? state.balance)
  );
  // Preserve owner bonus-gate: only withdrawable portion carries withdrawable status to recipient.
  const withdrawableTransferred = roundMoney(Math.min(amountInr, currentWithdrawable));
  const nextSenderBalance = roundMoney(state.balance - amountInr);
  const nextSenderWithdrawable = Math.min(
    nextSenderBalance,
    roundMoney(currentWithdrawable - withdrawableTransferred)
  );

  const txId = `tx-p2p-${nowMs}-${Math.random().toString(36).slice(2, 6)}`;
  const senderTx: WalletTransaction = {
    id: txId,
    type: 'p2p_send',
    title: `Sent to ${recipient.name}`,
    amount: -amountInr,
    timestamp: stamp,
    status: 'Completed',
    meta: `${channelLabel} · ${recipient.uid}${cleanNote ? ` · ${cleanNote}` : ''}`,
    createdAtMs: nowMs,
    userEmail: senderEmail || undefined,
    userName: senderName,
    userUid: senderUid,
    destinationSummary: `${recipient.name} (${recipient.uid})`,
    destinationCopyValue: recipient.uid,
  };

  const recipientTx: WalletTransaction = {
    id: `tx-p2p-rx-${nowMs}-${Math.random().toString(36).slice(2, 6)}`,
    type: 'p2p_receive',
    title: `Received from ${senderName}`,
    amount: amountInr,
    timestamp: stamp,
    status: 'Credited',
    meta: `${channelLabel} · From ${senderUid}${cleanNote ? ` · ${cleanNote}` : ''}`,
    createdAtMs: nowMs,
    credited: true,
    userEmail: recipient.email,
    userName: recipient.name,
    userUid: recipient.uid,
    destinationSummary: `${senderName} (${senderUid})`,
    destinationCopyValue: senderUid,
  };

  const nextSenderTransactions = [senderTx, ...state.transactions];
  const nextRegistered = (state.registeredAccounts ?? []).map((acc) => {
    const accEmail = acc.email.trim().toLowerCase();
    const accUid = (acc.uid || '').trim().toUpperCase();
    if (senderEmail && accEmail === senderEmail) {
      return {
        ...acc,
        balance: nextSenderBalance,
        withdrawableBalance: nextSenderWithdrawable,
        transactions: nextSenderTransactions,
      };
    }
    if (accUid === recipient.uid) {
      const recBal = roundMoney((acc.balance ?? 0) + amountInr);
      const recWd = Math.min(
        recBal,
        roundMoney((acc.withdrawableBalance ?? 0) + withdrawableTransferred)
      );
      return {
        ...acc,
        balance: recBal,
        withdrawableBalance: recWd,
        todayReceived: roundMoney((acc.todayReceived ?? 0) + amountInr),
        transactions: [recipientTx, ...(acc.transactions ?? [])],
      };
    }
    return acc;
  });

  const nextPlatformTxs = [senderTx, ...(state.platformTransactions ?? [])].slice(
    0,
    300
  );

  return {
    ok: true,
    recipient,
    amountInr,
    txId,
    nextState: {
      ...state,
      balance: nextSenderBalance,
      withdrawableBalance: nextSenderWithdrawable,
      transactions: nextSenderTransactions,
      platformTransactions: nextPlatformTxs,
      registeredAccounts: nextRegistered,
    },
  };
}

export const INACTIVITY_DEACTIVATION_DAYS = 60;
export const INACTIVITY_DEACTIVATION_MS =
  INACTIVITY_DEACTIVATION_DAYS * 24 * 60 * 60 * 1000;

export function getAccountInactiveDays(
  acc: Pick<RegisteredAccount, 'lastLoginAtMs' | 'createdAt'>,
  nowMs = Date.now()
): number {
  const refMs =
    typeof acc.lastLoginAtMs === 'number' && Number.isFinite(acc.lastLoginAtMs)
      ? acc.lastLoginAtMs
      : acc.createdAt && Number.isFinite(Date.parse(acc.createdAt))
      ? Date.parse(acc.createdAt)
      : nowMs;
  if (nowMs <= refMs) return 0;
  return Math.floor((nowMs - refMs) / (24 * 60 * 60 * 1000));
}

export function isAccountInactive60Days(
  acc: Pick<RegisteredAccount, 'email' | 'lastLoginAtMs' | 'createdAt'>,
  nowMs = Date.now()
): boolean {
  if (isOwnerAdmin(acc.email)) return false;
  if (
    typeof acc.lastLoginAtMs !== 'number' ||
    !Number.isFinite(acc.lastLoginAtMs)
  ) {
    return false;
  }
  return nowMs - acc.lastLoginAtMs >= INACTIVITY_DEACTIVATION_MS;
}

export function enforce60DayInactivityDeactivation(
  accounts: RegisteredAccount[] = [],
  nowMs = Date.now()
): {
  accounts: RegisteredAccount[];
  changed: boolean;
  deactivatedEmails: string[];
} {
  let changed = false;
  const deactivatedEmails: string[] = [];

  const nextAccounts = accounts.map((acc) => {
    if (isOwnerAdmin(acc.email)) {
      if (acc.deactivated) {
        changed = true;
        return {
          ...acc,
          deactivated: false,
          deactivatedAtMs: undefined,
          deactivatedReason: undefined,
          deactivatedBy: undefined,
        };
      }
      return acc;
    }

    if (
      !acc.deactivated &&
      typeof acc.lastLoginAtMs === 'number' &&
      Number.isFinite(acc.lastLoginAtMs) &&
      nowMs - acc.lastLoginAtMs >= INACTIVITY_DEACTIVATION_MS
    ) {
      changed = true;
      deactivatedEmails.push(acc.email.trim().toLowerCase());
      return {
        ...acc,
        deactivated: true,
        deactivatedAtMs: nowMs,
        deactivatedBy: 'inactivity_60d' as const,
        deactivatedReason: 'Inactive for 60+ days (auto-deactivated)',
      };
    }

    return acc;
  });

  return { accounts: nextAccounts, changed, deactivatedEmails };
}

export function adminToggleDeactivateAccount(
  state: AppState,
  targetEmail: string,
  deactivate: boolean,
  reason = '',
  nowMs = Date.now()
): AppState {
  const cleanTarget = targetEmail.trim().toLowerCase();
  if (!cleanTarget || isOwnerAdmin(cleanTarget)) return state;
  const stamp = formatExactDateTime(nowMs);

  return {
    ...state,
    registeredAccounts: (state.registeredAccounts ?? []).map((acc) => {
      if (acc.email.trim().toLowerCase() !== cleanTarget) return acc;
      if (deactivate) {
        return {
          ...acc,
          deactivated: true,
          deactivatedAtMs: nowMs,
          deactivatedBy: 'admin' as const,
          deactivatedReason:
            reason.trim() || 'Deactivated from Owner Admin Panel',
        };
      }
      return {
        ...acc,
        deactivated: false,
        deactivatedAtMs: undefined,
        deactivatedBy: undefined,
        deactivatedReason: undefined,
        lastLoginAtMs: nowMs,
        lastLoginAt: stamp,
      };
    }),
  };
}

export interface CloudUserDirectoryRecord {
  firebaseUid: string;
  appUid?: string;
  email: string;
  name: string;
  phone?: string;
  balance: number;
  withdrawableBalance: number;
  realizedPnl: number;
  referralCode: string;
  referredByCode?: string;
  referralRewardSettled?: boolean;
  lastLoginAtMs?: number;
  deactivated?: boolean;
  deactivatedAtMs?: number;
  deactivatedReason?: string;
  deactivatedBy?: 'inactivity_60d' | 'admin';
  frozen?: boolean;
  banned?: boolean;
  withdrawalsBlocked?: boolean;
  tradingBlocked?: boolean;
  totalDepositedInr?: number;
  totalWithdrawnInr?: number;
}

export function mergeCloudUsersIntoAccounts(
  localAccounts: RegisteredAccount[] = [],
  cloudUsers: CloudUserDirectoryRecord[] = [],
  nowMs = Date.now()
): RegisteredAccount[] {
  const byEmail = new Map<string, RegisteredAccount>();
  for (const acc of localAccounts) {
    byEmail.set(acc.email.trim().toLowerCase(), acc);
  }

  for (const cloud of cloudUsers) {
    const cleanEmail = cloud.email.trim().toLowerCase();
    if (!cleanEmail) continue;
    const existing = byEmail.get(cleanEmail);
    if (existing) {
      const mergedLastLoginMs =
        typeof cloud.lastLoginAtMs === 'number' &&
        (!existing.lastLoginAtMs || cloud.lastLoginAtMs >= existing.lastLoginAtMs)
          ? cloud.lastLoginAtMs
          : existing.lastLoginAtMs;

      const cloudNewer =
        typeof cloud.lastLoginAtMs === 'number' &&
        (!existing.lastLoginAtMs || cloud.lastLoginAtMs >= existing.lastLoginAtMs);

      const mergedDeactivated = isOwnerAdmin(cleanEmail)
        ? false
        : cloudNewer && typeof cloud.deactivated === 'boolean'
        ? cloud.deactivated
        : existing.deactivated ?? cloud.deactivated ?? false;

      byEmail.set(cleanEmail, {
        ...existing,
        firebaseUid: cloud.firebaseUid || existing.firebaseUid,
        uid: cloud.appUid || existing.uid,
        name: cloud.name || existing.name,
        phone: cloud.phone ?? existing.phone,
        referralCode: cloud.referralCode || existing.referralCode,
        referredByCode: cloud.referredByCode ?? existing.referredByCode,
        lastLoginAtMs: mergedLastLoginMs,
        lastLoginAt: mergedLastLoginMs
          ? formatExactDateTime(mergedLastLoginMs)
          : existing.lastLoginAt,
        deactivated: mergedDeactivated,
        deactivatedAtMs: mergedDeactivated
          ? cloud.deactivatedAtMs ?? existing.deactivatedAtMs
          : undefined,
        deactivatedReason: mergedDeactivated
          ? cloud.deactivatedReason ?? existing.deactivatedReason
          : undefined,
        deactivatedBy: mergedDeactivated
          ? cloud.deactivatedBy ?? existing.deactivatedBy
          : undefined,
        frozen:
          typeof cloud.frozen === 'boolean' ? cloud.frozen : existing.frozen,
        banned:
          typeof cloud.banned === 'boolean' ? cloud.banned : existing.banned,
        withdrawalsBlocked:
          typeof cloud.withdrawalsBlocked === 'boolean'
            ? cloud.withdrawalsBlocked
            : existing.withdrawalsBlocked,
        tradingBlocked:
          typeof cloud.tradingBlocked === 'boolean'
            ? cloud.tradingBlocked
            : existing.tradingBlocked,
        totalDepositedInr:
          typeof cloud.totalDepositedInr === 'number'
            ? Math.max(existing.totalDepositedInr ?? 0, cloud.totalDepositedInr)
            : existing.totalDepositedInr,
        totalWithdrawnInr:
          typeof cloud.totalWithdrawnInr === 'number'
            ? Math.max(existing.totalWithdrawnInr ?? 0, cloud.totalWithdrawnInr)
            : existing.totalWithdrawnInr,
      });
    } else {
      const loginMs =
        typeof cloud.lastLoginAtMs === 'number' ? cloud.lastLoginAtMs : nowMs;
      byEmail.set(cleanEmail, {
        email: cleanEmail,
        password: '',
        name: cloud.name || cleanEmail.split('@')[0] || 'Trader',
        uid:
          cloud.appUid ||
          `UID-${cloud.firebaseUid.slice(0, 6).toUpperCase()}`,
        firebaseUid: cloud.firebaseUid,
        phone: cloud.phone,
        balance: Number(cloud.balance) || 0,
        withdrawableBalance: Number(cloud.withdrawableBalance) || 0,
        usdtHoldings: 0,
        todayReceived: 0,
        realizedPnl: Number(cloud.realizedPnl) || 0,
        totalDepositedInr: Number(cloud.totalDepositedInr) || 0,
        totalWithdrawnInr: Number(cloud.totalWithdrawnInr) || 0,
        positions: [],
        bets: [],
        transactions: [],
        bankAccounts: [],
        upiAccounts: [],
        redeemedGifts: [],
        supportTickets: [],
        frozen: Boolean(cloud.frozen),
        banned: Boolean(cloud.banned),
        withdrawalsBlocked: Boolean(cloud.withdrawalsBlocked),
        tradingBlocked: Boolean(cloud.tradingBlocked),
        referralCode: cloud.referralCode || 'OURO-USER1',
        referredByCode: cloud.referredByCode,
        referralRewardSettled: Boolean(cloud.referralRewardSettled),
        lastLoginAtMs: loginMs,
        lastLoginAt: formatExactDateTime(loginMs),
        deactivated: Boolean(cloud.deactivated),
        deactivatedAtMs: cloud.deactivatedAtMs,
        deactivatedReason: cloud.deactivatedReason,
        deactivatedBy: cloud.deactivatedBy,
        createdAt: formatExactDateTime(loginMs),
      });
    }
  }

  return enforce60DayInactivityDeactivation(
    ensureOwnerAdminAccount(Array.from(byEmail.values())),
    nowMs
  ).accounts;
}





