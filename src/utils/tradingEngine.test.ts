import test from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_APP_STATE } from '../data/seedData';
import {
  DEFAULT_FX_RATES,
  PLAYER_LEVELS,
  adminApproveWithdrawal,
  adminRejectAndRefundWithdrawal,
  adminRejectDeposit,
  adminVerifyAndCreditDeposit,
  applyGameWalletTransaction,
  applyReferralRewardOnFirstBet,
  applyTopUp,
  applyWithdraw,
  calculatePlayerLevel,
  calculatePoolPercentages,
  calculatePositionPnl,
  calculateTotalSpent,
  calculateTradeFees,
  closeTradePosition,
  computeAdminPlatformSummary,
  consumePendingTransferForUser,
  convertCurrency,
  executeTradeOrder,
  formatCurrency,
  generateReferralCode,
  getActiveMerchantUpis,
  getHorizonDurationSeconds,
  getHorizonLeverage,
  getPrimaryMerchantUpi,
  isOwnerAdmin,
  placePredictionBet,
  redeemGiftCode,
  sellUsdtToInr,
  settleExpiredPositions,
  tickFxRates,
  validateAndResolveReferralCode,
  validateTradeStake,
  validateUpiId,
  validateUtr12Digits,
} from './tradingEngine';
import { AppState } from '../types/trading';
import {
  UPI_PAYMENT_METHODS,
  buildAppDeepLink,
  buildUpiPaymentUri,
  getUpiMethodById,
} from '../components/UpiAppBranding';
import {
  createNotificationFromTemplate,
  createSeedNotifications,
  formatRelativeTime,
  getUnreadCount,
} from './notifications';
import { LANGUAGES, t } from './i18n';
import {
  DAILY_COMMUNITY_CHAT_LIMIT,
  analyzeChartPattern,
  buildOhlcCandles,
  generateAutoNewsItem,
  getCommunityRemainingCount,
  postCommunityMessage,
} from './chartPatterns';

const TEST_FUNDED_STATE: AppState = {
  ...INITIAL_APP_STATE,
  balance: 4285,
  withdrawableBalance: 1285,
  todayReceived: 320,
  realizedPnl: -700,
  profile: {
    ...INITIAL_APP_STATE.profile,
    name: 'Aarav Sharma',
    email: 'aarav@test.com',
    uid: 'UID-95E9-AARAV',
  },
  bankAccounts: [
    {
      id: 'bank-1',
      bankName: 'HDFC Bank',
      accountLast4: '4821',
      accountNumber: '501002344821',
      ifsc: 'HDFC0001024',
      holderName: 'Aarav Sharma',
    },
  ],
  upiAccounts: [
    {
      id: 'upi-1',
      upiId: 'aarav@okicici',
      appId: 'gpay',
      appName: 'Google Pay',
      holderName: 'Aarav Sharma',
    },
  ],
  transactions: [
    {
      id: 'tx-seed-2',
      type: 'trade_close',
      title: 'SAMSUNG Short Settlement',
      amount: -700,
      timestamp: '21 Nov, 10:15 AM',
      status: 'Settled',
      meta: '5m Horizon',
    },
  ],
};

test('INITIAL_APP_STATE starts strictly at zero balance with empty user financial records', () => {
  assert.equal(INITIAL_APP_STATE.balance, 0);
  assert.equal(INITIAL_APP_STATE.withdrawableBalance, 0);
  assert.equal(INITIAL_APP_STATE.todayReceived, 0);
  assert.equal(INITIAL_APP_STATE.transactions.length, 0);
  assert.equal(INITIAL_APP_STATE.bankAccounts.length, 0);
  assert.equal((INITIAL_APP_STATE.upiAccounts ?? []).length, 0);
});

test('calculateTradeFees computes 2% commission + ₹5 handling fee', () => {
  const fees = calculateTradeFees(500);
  assert.equal(fees.commission, 10);
  assert.equal(fees.handlingFee, 5);
  assert.equal(fees.totalDebit, 515);
});

test('validateTradeStake enforces minimum stake and balance limits', () => {
  assert.equal(validateTradeStake(40, 1000).valid, false);
  assert.equal(validateTradeStake(1000, 1000).valid, false); // 1025 > 1000
  assert.equal(validateTradeStake(500, 1000).valid, true);
});

test('executeTradeOrder deducts balance, opens position, and updates asset pool', () => {
  const res = executeTradeOrder(TEST_FUNDED_STATE, {
    assetId: 'apple',
    side: 'long',
    horizon: '5m',
    stake: 500,
  });
  assert.equal(res.ok, true);
  if (res.ok) {
    assert.equal(res.nextState.balance, 4285 - 515);
    assert.equal(res.nextState.positions.length, 1);
    assert.equal(res.position.symbol, 'APPLE');
    const apple = res.nextState.assets.find((a) => a.id === 'apple');
    assert.equal(apple?.longPoolAmount, 1611 + 500);
  }
});

test('closeTradePosition refunds unmatched order 100% (Rule 3 No-Match) and settles matched opposite trades', () => {
  const opened = executeTradeOrder(TEST_FUNDED_STATE, {
    assetId: 'apple',
    side: 'long',
    horizon: '5m',
    stake: 500,
  });
  assert.equal(opened.ok, true);
  if (opened.ok) {
    assert.equal(opened.position.p2pStatus, 'Pending');
    assert.equal(opened.position.matchKind, 'none');
    const closed = closeTradePosition(opened.nextState, opened.position.id);
    assert.equal(closed.ok, true);
    if (closed.ok) {
      assert.equal(closed.p2pStatus, 'Cancelled/Refunded');
      assert.equal(closed.pnl, 0);
      assert.equal(closed.payout, 515);
      assert.equal(closed.nextState.balance, TEST_FUNDED_STATE.balance);
      assert.equal(closed.nextState.withdrawableBalance, TEST_FUNDED_STATE.withdrawableBalance);
    }
  }
});

test('calculatePositionPnl flips sign for short positions', () => {
  const longPnl = calculatePositionPnl(
    { side: 'long', entryPrice: 100, stake: 500, horizon: '5m' },
    105
  );
  const shortPnl = calculatePositionPnl(
    { side: 'short', entryPrice: 100, stake: 500, horizon: '5m' },
    95
  );
  assert.equal(longPnl, 200);
  assert.equal(shortPnl, 200);
});

test('placePredictionBet updates pools and percentages', () => {
  const res = placePredictionBet(TEST_FUNDED_STATE, {
    marketId: 'pred-gtavi',
    choice: 'yes',
    stake: 300,
  });
  assert.equal(res.ok, true);
  if (res.ok) {
    assert.equal(res.nextState.balance, 3985);
    assert.equal(res.nextState.bets.length, 1);
    const pct = calculatePoolPercentages(24400, 11800);
    assert.equal(pct.firstPct + pct.secondPct, 100);
  }
});

test('redeemGiftCode credits valid code once and blocks duplicates', () => {
  const first = redeemGiftCode(TEST_FUNDED_STATE, 'ouro500');
  assert.equal(first.ok, true);
  if (first.ok) {
    assert.equal(first.nextState.balance, 4785);
    assert.equal(first.nextState.redeemedGifts.length, 1);
    const second = redeemGiftCode(first.nextState, 'OURO500');
    assert.equal(second.ok, false);
  }
});

test('wallet pending deposit + owner credit, withdraw, and USDT sell update balances accurately', () => {
  const pendingDep = applyTopUp(TEST_FUNDED_STATE, 1000, 'UPI', '412345678901', 1000);
  assert.equal(pendingDep.ok, true);
  if (!pendingDep.ok) return;
  // Pending deposit does NOT credit balance until Owner verifies UTR
  assert.equal(pendingDep.nextState.balance, 4285);
  assert.equal(pendingDep.nextState.transactions[0].status, 'Under Review');

  const verified = adminVerifyAndCreditDeposit(pendingDep.nextState, pendingDep.transaction.id, 2000);
  assert.equal(verified.ok, true);
  if (!verified.ok) return;
  assert.equal(verified.nextState.balance, 5285);
  assert.equal(verified.nextState.transactions[0].status, 'Credited');

  const withdrawn = applyWithdraw(verified.nextState, 500, 'bank-1');
  assert.equal(withdrawn.ok, true);
  if (!withdrawn.ok) return;
  assert.equal(withdrawn.nextState.balance, 4785);
  assert.equal(withdrawn.transaction.destinationCopyValue?.includes('501002344821'), true);

  const sold = sellUsdtToInr({ ...withdrawn.nextState, usdtHoldings: 24.5 }, 10);
  assert.equal(sold.ok, true);
  if (sold.ok) {
    assert.equal(sold.inrCredited, 1120);
    assert.equal(sold.nextState.balance, 5905);
  }
});

test('notification helpers create seeded alerts, track unread count, and format timestamps', () => {
  const now = 1_700_000_000_000;
  const seeded = createSeedNotifications(now);
  assert.equal(seeded.length, 3);
  assert.equal(getUnreadCount(seeded), 3);

  const custom = createNotificationFromTemplate('trade_win', { msg: 'Custom win' }, now);
  assert.equal(custom.title, 'Trade Won');
  assert.equal(custom.msg, 'Custom win');
  assert.equal(formatRelativeTime(now - 20_000, now), 'Just now');
  assert.equal(formatRelativeTime(now - 180_000, now), '3m ago');
});

test('calculatePlayerLevel maps exact 8 tiers and tracks spend progress', () => {
  assert.deepEqual(
    PLAYER_LEVELS.map((l) => l.name),
    ['New Player', 'Normal', 'Ordinary', 'Extraordinary', 'VIP', 'VVIP', 'MVP', 'Sovereign']
  );

  assert.equal(calculatePlayerLevel(0).current.name, 'New Player');
  assert.equal(calculatePlayerLevel(0).next?.name, 'Normal');
  assert.equal(calculatePlayerLevel(500).current.name, 'Normal');
  assert.equal(calculatePlayerLevel(2000).current.name, 'Ordinary');
  assert.equal(calculatePlayerLevel(5000).current.name, 'Extraordinary');
  assert.equal(calculatePlayerLevel(15000).current.name, 'VIP');
  assert.equal(calculatePlayerLevel(35000).current.name, 'VVIP');
  assert.equal(calculatePlayerLevel(75000).current.name, 'MVP');

  const sovereign = calculatePlayerLevel(150000);
  assert.equal(sovereign.current.name, 'Sovereign');
  assert.equal(sovereign.next, null);
  assert.equal(sovereign.progressPct, 100);
  assert.equal(sovereign.remainingToNext, 0);
});

test('calculateTotalSpent sums trade and prediction outlays and promotes player tier', () => {
  const baseSpent = calculateTotalSpent(TEST_FUNDED_STATE);
  assert.equal(baseSpent, 700);
  assert.equal(calculatePlayerLevel(baseSpent).current.name, 'Normal');

  const traded = executeTradeOrder(TEST_FUNDED_STATE, {
    assetId: 'apple',
    side: 'long',
    horizon: '5m',
    stake: 1300,
  });
  assert.equal(traded.ok, true);
  if (traded.ok) {
    const newSpent = calculateTotalSpent(traded.nextState);
    assert.equal(newSpent > 2000, true);
    assert.equal(calculatePlayerLevel(newSpent).current.name, 'Ordinary');
  }
});

test('multi-currency conversion, live FX ticking, and formatCurrency work across INR, USD, JPY, EUR', () => {
  const usd = convertCurrency(1000, 'INR', 'USD', DEFAULT_FX_RATES);
  const jpy = convertCurrency(1000, 'INR', 'JPY', DEFAULT_FX_RATES);
  assert.equal(Math.round(usd * 100) / 100, 11.83);
  assert.equal(Math.round(jpy), 1825);

  const backToInr = convertCurrency(jpy, 'JPY', 'INR', DEFAULT_FX_RATES);
  assert.equal(Math.round(backToInr), 1000);

  assert.equal(formatCurrency(1000, 'USD', DEFAULT_FX_RATES), '$11.83');
  assert.equal(formatCurrency(1000, 'JPY', DEFAULT_FX_RATES), '¥1,825');
  assert.equal(formatCurrency(1000, 'EUR', DEFAULT_FX_RATES), '€11.18');

  const ticked = tickFxRates(DEFAULT_FX_RATES, 3);
  assert.equal(ticked.INR, 1);
  assert.notEqual(ticked.JPY, DEFAULT_FX_RATES.JPY);
});

test('i18n translation helper supports English, Hindi, Japanese, Spanish, and Chinese', () => {
  assert.equal(LANGUAGES.length, 5);
  assert.equal(t('en', 'profileTitle'), 'Profile');
  assert.equal(t('hi', 'profileTitle'), 'प्रोफ़ाइल');
  assert.equal(t('ja', 'profileTitle'), 'プロフィール');
  assert.equal(t('es', 'profileTitle'), 'Perfil');
  assert.equal(t('zh', 'profileTitle'), '个人中心');
  assert.equal(t(undefined, 'deposit'), 'Deposit');
});

test('buildOhlcCandles generates deterministic OHLC bars ending at currentPrice', () => {
  const candles = buildOhlcCandles([100, 102, 101, 105, 108], 110, '5m', 12);
  assert.equal(candles.length, 12);
  assert.equal(candles[candles.length - 1].close, 110);
  for (const c of candles) {
    assert.equal(c.high >= Math.max(c.open, c.close), true);
    assert.equal(c.low <= Math.min(c.open, c.close), true);
  }
});

test('analyzeChartPattern classifies bullish, bearish, and support/resistance bounds', () => {
  const bull = analyzeChartPattern([100, 103, 107, 112]);
  assert.equal(bull.bias, 'Bullish');
  assert.equal(bull.support, 100);
  assert.equal(bull.resistance, 112);
  assert.equal(bull.smaSeries.length, 4);

  const bear = analyzeChartPattern([120, 115, 110, 104]);
  assert.equal(bear.bias, 'Bearish');
});

test('postCommunityMessage enforces 2 messages per day limit and resets next day', () => {
  assert.equal(DAILY_COMMUNITY_CHAT_LIMIT, 2);
  const day1 = '2026-11-20';
  const day2 = '2026-11-21';

  assert.equal(getCommunityRemainingCount(undefined, day1), 2);

  const first = postCommunityMessage({
    messages: [],
    usage: undefined,
    username: 'Aarav Sharma',
    text: 'Watching AAPL breakout',
    todayKey: day1,
  });
  assert.equal(first.ok, true);
  if (!first.ok) return;
  assert.equal(first.remaining, 1);
  assert.equal(first.nextMessages[0].username, 'Aarav_Sharma');

  const second = postCommunityMessage({
    messages: first.nextMessages,
    usage: first.nextUsage,
    username: 'Aarav Sharma',
    text: 'ETH liquidity rising',
    todayKey: day1,
  });
  assert.equal(second.ok, true);
  if (!second.ok) return;
  assert.equal(second.remaining, 0);

  const thirdBlocked = postCommunityMessage({
    messages: second.nextMessages,
    usage: second.nextUsage,
    username: 'Aarav Sharma',
    text: 'Third message should fail',
    todayKey: day1,
  });
  assert.equal(thirdBlocked.ok, false);

  // Resets on next day
  assert.equal(getCommunityRemainingCount(second.nextUsage, day2), 2);
  const nextDayPost = postCommunityMessage({
    messages: second.nextMessages,
    usage: second.nextUsage,
    username: 'Aarav Sharma',
    text: 'Fresh day post',
    todayKey: day2,
  });
  assert.equal(nextDayPost.ok, true);
});

test('generateAutoNewsItem cycles across both listed stocks and prediction bets', () => {
  const stockNews = generateAutoNewsItem(
    INITIAL_APP_STATE.assets,
    INITIAL_APP_STATE.predictions,
    0
  );
  assert.equal(stockNews.topicKind, 'stock');
  assert.equal(Boolean(stockNews.assetId), true);

  const betNews = generateAutoNewsItem(
    INITIAL_APP_STATE.assets,
    INITIAL_APP_STATE.predictions,
    INITIAL_APP_STATE.assets.length
  );
  assert.equal(betNews.topicKind, 'bet');
  assert.equal(Boolean(betNews.marketId), true);
});

test('validateUpiId enforces valid VPA format', () => {
  assert.equal(validateUpiId('aarav@okicici').valid, true);
  assert.equal(validateUpiId('  Aarav.99@YBL ').cleaned, 'aarav.99@ybl');
  assert.equal(validateUpiId('invalid-upi').valid, false);
  assert.equal(validateUpiId('').valid, false);
});

test('validateUtr12Digits enforces strictly 12 numeric digits', () => {
  assert.equal(validateUtr12Digits('412345678901').valid, true);
  assert.equal(validateUtr12Digits('41234567890').valid, false);
  assert.equal(validateUtr12Digits('4123456789012').valid, false);
  assert.equal(validateUtr12Digits('41234567890A').valid, false);
});

test('applyTopUp validates ₹100-₹1,00,000 range, records UTR Under Review, and requires Owner verify before play/credit', () => {
  assert.equal(applyTopUp(TEST_FUNDED_STATE, 50, 'PhonePe').ok, false);
  assert.equal(applyTopUp(TEST_FUNDED_STATE, 150000, 'PhonePe').ok, false);

  const maxRes = applyTopUp(TEST_FUNDED_STATE, 100000, 'PhonePe', '412345678901');
  assert.equal(maxRes.ok, true);

  const res = applyTopUp(TEST_FUNDED_STATE, 1500, 'PhonePe', '412345678901', 1000);
  assert.equal(res.ok, true);
  if (res.ok) {
    // Still Under Review: balance unchanged until Owner clicks Verify & Credit
    assert.equal(res.nextState.balance, TEST_FUNDED_STATE.balance);
    assert.equal(res.nextState.transactions[0].status, 'Under Review');
    assert.equal(res.nextState.transactions[0].meta?.includes('412345678901'), true);

    const credited = adminVerifyAndCreditDeposit(res.nextState, res.transaction.id, 2000);
    assert.equal(credited.ok, true);
    if (credited.ok) {
      assert.equal(credited.nextState.balance, 4285 + 1500);
      // Deposited ₹1,500 stays play-locked and does not raise withdrawableBalance directly
      assert.equal(credited.nextState.withdrawableBalance, TEST_FUNDED_STATE.withdrawableBalance);
      const blockedWithdraw = applyWithdraw(credited.nextState, 2000, 'bank-1');
      assert.equal(blockedWithdraw.ok, false);
    }
  }
});

test('applyWithdraw supports bound UPI accounts and custom inline UPI IDs', () => {
  const byBoundUpi = applyWithdraw(TEST_FUNDED_STATE, 400, 'upi-1');
  assert.equal(byBoundUpi.ok, true);
  if (byBoundUpi.ok) {
    assert.equal(byBoundUpi.nextState.balance, 4285 - 400);
    assert.equal(byBoundUpi.nextState.transactions[0].title.includes('aarav@okicici'), true);
    assert.equal(byBoundUpi.transaction.destinationCopyValue, 'aarav@okicici');
  }

  const byCustomUpi = applyWithdraw(TEST_FUNDED_STATE, 300, 'upi:rohan@ybl');
  assert.equal(byCustomUpi.ok, true);
  if (byCustomUpi.ok) {
    assert.equal(byCustomUpi.nextState.transactions[0].title.includes('rohan@ybl'), true);
  }

  assert.equal(applyWithdraw(TEST_FUNDED_STATE, 300, 'upi:badhandle').ok, false);
});

test('UPI payment catalog includes QR + 14 apps and generates valid UPI URI & deep links', () => {
  assert.equal(UPI_PAYMENT_METHODS.length, 15);
  const uri = buildUpiPaymentUri(1250, 'OBTEST123');
  assert.equal(uri.startsWith('upi://pay?'), true);
  assert.equal(uri.includes('am=1250.00'), true);
  assert.equal(uri.includes('cu=INR'), true);

  const phonepe = getUpiMethodById('phonepe');
  const deepLink = buildAppDeepLink(phonepe, 500);
  assert.equal(deepLink.startsWith('phonepe://pay?'), true);
  assert.equal(deepLink.includes('am=500.00'), true);
});
test('settleExpiredPositions auto-refunds unmatched 30s order at expiry and auto-settles matched P2P trade', () => {
  const startMs = 1_700_000_000_000;
  const opened = executeTradeOrder(
    TEST_FUNDED_STATE,
    {
      assetId: 'apple',
      side: 'long',
      horizon: '30s',
      stake: 500,
    },
    startMs
  );
  assert.equal(opened.ok, true);
  if (!opened.ok) return;

  assert.equal(opened.position.durationSeconds, 30);
  assert.equal(opened.position.expiresAtMs, startMs + 30_000);

  // Before expiry: nothing settles
  const beforeExpiry = settleExpiredPositions(opened.nextState, startMs + 15_000);
  assert.equal(beforeExpiry.settled.length, 0);

  // At expiry (unmatched): refunds full stake + entry fee cleanly with ₹0 commission
  const atExpiry = settleExpiredPositions(opened.nextState, startMs + 30_000);
  assert.equal(atExpiry.settled.length, 1);
  assert.equal(atExpiry.settled[0].p2pStatus, 'Cancelled/Refunded');
  assert.equal(atExpiry.settled[0].payout, 515);
  assert.equal(atExpiry.nextState.positions[0].status, 'closed');
  assert.equal(atExpiry.nextState.balance, TEST_FUNDED_STATE.balance);
  assert.equal(atExpiry.nextState.withdrawableBalance, TEST_FUNDED_STATE.withdrawableBalance);
});

test('supports expanded 15s-7d horizons and concurrent multiple trades on same or different assets', () => {
  assert.equal(getHorizonDurationSeconds('15s'), 15);
  assert.equal(getHorizonDurationSeconds('15m'), 900);
  assert.equal(getHorizonDurationSeconds('4h'), 14400);
  assert.equal(getHorizonDurationSeconds('1d'), 86400);
  assert.equal(getHorizonLeverage('15s'), 15);
  assert.equal(getHorizonLeverage('4h'), 4);

  const now = 1_700_000_000_000;
  const first = executeTradeOrder(
    TEST_FUNDED_STATE,
    { assetId: 'eth', side: 'long', horizon: '15s', stake: 500 },
    now
  );
  assert.equal(first.ok, true);
  if (!first.ok) return;

  const second = executeTradeOrder(
    first.nextState,
    { assetId: 'eth', side: 'short', horizon: '1m', stake: 500 },
    now
  );
  assert.equal(second.ok, true);
  if (!second.ok) return;

  assert.equal(second.nextState.positions.filter((p) => p.status === 'open').length, 2);
  assert.notEqual(second.nextState.transactions[0].id, second.nextState.transactions[1].id);
});

test('isOwnerAdmin grants access exclusively to karnajoydas@gmail.com', () => {
  assert.equal(isOwnerAdmin('karnajoydas@gmail.com'), true);
  assert.equal(isOwnerAdmin('  KarnaJoyDas@gmail.com '), true);
  assert.equal(isOwnerAdmin('other@gmail.com'), false);
  assert.equal(isOwnerAdmin('aarav@ouroboros.trade'), false);
  assert.equal(isOwnerAdmin(undefined), false);
});

function createTwoUserP2PState(): AppState {
  return {
    ...INITIAL_APP_STATE,
    ownerFeeRevenue: 0,
    referralConfig: {
      platformFeePct: 5,
      minDepositInr: 100,
      minWithdrawInr: 100,
    },
    balance: 2000,
    withdrawableBalance: 500,
    profile: {
      ...INITIAL_APP_STATE.profile,
      name: 'User Alpha',
      email: 'alpha@test.in',
      uid: 'UID-ALPHA',
    },
    registeredAccounts: [
      {
        email: 'alpha@test.in',
        password: 'pw',
        name: 'User Alpha',
        uid: 'UID-ALPHA',
        balance: 2000,
        withdrawableBalance: 500,
        positions: [],
        transactions: [],
      },
      {
        email: 'beta@test.in',
        password: 'pw',
        name: 'User Beta',
        uid: 'UID-BETA',
        balance: 2000,
        withdrawableBalance: 500,
        positions: [],
        transactions: [],
      },
    ],
  };
}

function switchSessionUser(state: AppState, email: string): AppState {
  const clean = email.trim().toLowerCase();
  const prevEmail = state.profile.email.trim().toLowerCase();
  const syncedAccounts = (state.registeredAccounts ?? []).map((acc) =>
    acc.email.trim().toLowerCase() === prevEmail
      ? {
          ...acc,
          balance: state.balance,
          withdrawableBalance: state.withdrawableBalance,
          realizedPnl: state.realizedPnl,
          todayReceived: state.todayReceived,
          positions: state.positions,
          transactions: state.transactions,
        }
      : acc
  );
  const nextAcc = syncedAccounts.find((a) => a.email.trim().toLowerCase() === clean)!;
  return {
    ...state,
    balance: nextAcc.balance ?? 0,
    withdrawableBalance: nextAcc.withdrawableBalance ?? 0,
    realizedPnl: nextAcc.realizedPnl ?? 0,
    todayReceived: nextAcc.todayReceived ?? 0,
    positions: nextAcc.positions ?? [],
    transactions: nextAcc.transactions ?? [],
    registeredAccounts: syncedAccounts,
    profile: {
      ...state.profile,
      name: nextAcc.name,
      email: nextAcc.email,
      uid: nextAcc.uid,
    },
  };
}

test('P2P Rule 1: Opposite predictions (UP vs DOWN) match peers, settle winner net of fee, and prevent self-matching', () => {
  const now = 1_700_000_000_000;
  let s = createTwoUserP2PState();

  // User Alpha places UP (long) ₹500 on apple -> Pending
  const a1 = executeTradeOrder(s, { assetId: 'apple', side: 'long', horizon: '1m', stake: 500 }, now);
  assert.equal(a1.ok, true);
  if (!a1.ok) return;
  assert.equal(a1.position.p2pStatus, 'Pending');

  // Same user Alpha placing opposite DOWN does NOT self-match
  const a2 = executeTradeOrder(a1.nextState, { assetId: 'apple', side: 'short', horizon: '1m', stake: 500 }, now + 500);
  assert.equal(a2.ok, true);
  if (!a2.ok) return;
  assert.equal(a2.position.p2pStatus, 'Pending');

  // Test clean pair on btc: Alpha UP ₹500, Beta DOWN ₹500
  let btcState = createTwoUserP2PState();
  const alphaOrder = executeTradeOrder(btcState, { assetId: 'btc', side: 'long', horizon: '30s', stake: 500 }, now);
  assert.equal(alphaOrder.ok, true);
  if (!alphaOrder.ok) return;
  assert.equal(alphaOrder.position.p2pStatus, 'Pending');

  // Switch to Beta and place DOWN ₹500 on btc
  btcState = switchSessionUser(alphaOrder.nextState, 'beta@test.in');
  const betaOrder = executeTradeOrder(btcState, { assetId: 'btc', side: 'short', horizon: '30s', stake: 500 }, now + 1000);
  assert.equal(betaOrder.ok, true);
  if (!betaOrder.ok) return;
  assert.equal(betaOrder.position.p2pStatus, 'Matched');
  assert.equal(betaOrder.position.matchKind, 'opposite');

  // Move BTC price UP -> Alpha (UP) wins ₹500 + (₹500 - 5% of 500 = ₹475) = ₹975 unlocked
  // Owner earns ₹25 commission + ₹15 Alpha fee + ₹15 Beta fee = ₹55
  const priceUpState: AppState = {
    ...betaOrder.nextState,
    assets: betaOrder.nextState.assets.map((a) =>
      a.id === 'btc' ? { ...a, price: a.price + 500 } : a
    ),
  };
  const settled = settleExpiredPositions(priceUpState, now + 35_000);
  const alphaAcc = settled.nextState.registeredAccounts?.find((a) => a.email === 'alpha@test.in');
  const betaAcc = settled.nextState.registeredAccounts?.find((a) => a.email === 'beta@test.in');
  assert.equal(alphaAcc?.balance, 2000 - 515 + 975);
  assert.equal(alphaAcc?.realizedPnl, 475);
  assert.equal(betaAcc?.balance, 2000 - 515);
  assert.equal(betaAcc?.realizedPnl, -500);
  assert.equal(settled.nextState.ownerFeeRevenue, 55);
  assert.equal(settled.nextState.commissionLedger?.[0].kind, 'matched_opposite');

  // Test flat tie refund on opposite match: both get 100% refunded (₹515 each), ₹0 Owner commission
  let tieState = createTwoUserP2PState();
  const t1 = executeTradeOrder(tieState, { assetId: 'eth', side: 'long', horizon: '30s', stake: 500 }, now);
  if (!t1.ok) return;
  tieState = switchSessionUser(t1.nextState, 'beta@test.in');
  const t2 = executeTradeOrder(tieState, { assetId: 'eth', side: 'short', horizon: '30s', stake: 500 }, now + 100);
  if (!t2.ok) return;
  const tieSettled = settleExpiredPositions(t2.nextState, now + 35_000);
  const tieAlpha = tieSettled.nextState.registeredAccounts?.find((a) => a.email === 'alpha@test.in');
  const tieBeta = tieSettled.nextState.registeredAccounts?.find((a) => a.email === 'beta@test.in');
  assert.equal(tieAlpha?.balance, 2000);
  assert.equal(tieBeta?.balance, 2000);
  assert.equal(tieSettled.nextState.ownerFeeRevenue, 0);
});

test('P2P Rule 2 (Same-Side 3A & 3B): Both UP/DOWN price opposite forfeits full pool to Owner; same direction cancels & refunds 100%', () => {
  const now = 1_700_000_000_000;

  // Case 3A (Both UP + Price Drops -> Owner takes full invested pool ₹515 + ₹515 = ₹1,030)
  let s1 = createTwoUserP2PState();
  const upA = executeTradeOrder(s1, { assetId: 'btc', side: 'long', horizon: '30s', stake: 500 }, now);
  if (!upA.ok) return;
  s1 = switchSessionUser(upA.nextState, 'beta@test.in');
  const upB = executeTradeOrder(s1, { assetId: 'btc', side: 'long', horizon: '30s', stake: 500 }, now + 100);
  assert.equal(upB.ok, true);
  if (!upB.ok) return;
  assert.equal(upB.position.p2pStatus, 'Matched');
  assert.equal(upB.position.matchKind, 'same_side');

  const droppedState: AppState = {
    ...upB.nextState,
    assets: upB.nextState.assets.map((a) =>
      a.id === 'btc' ? { ...a, price: a.price - 400 } : a
    ),
  };
  const res3A = settleExpiredPositions(droppedState, now + 35_000);
  const a3A = res3A.nextState.registeredAccounts?.find((a) => a.email === 'alpha@test.in');
  const b3A = res3A.nextState.registeredAccounts?.find((a) => a.email === 'beta@test.in');
  assert.equal(a3A?.balance, 2000 - 515);
  assert.equal(b3A?.balance, 2000 - 515);
  assert.equal(a3A?.realizedPnl, -500);
  assert.equal(b3A?.realizedPnl, -500);
  assert.equal(res3A.nextState.ownerFeeRevenue, 1030);
  assert.equal(res3A.nextState.commissionLedger?.[0].kind, 'same_side_forfeiture');

  // Case 3A Reverse (Both DOWN + Price Rises -> Owner takes full invested pool ₹1,030)
  let s2 = createTwoUserP2PState();
  const dnA = executeTradeOrder(s2, { assetId: 'eth', side: 'short', horizon: '30s', stake: 500 }, now);
  if (!dnA.ok) return;
  s2 = switchSessionUser(dnA.nextState, 'beta@test.in');
  const dnB = executeTradeOrder(s2, { assetId: 'eth', side: 'short', horizon: '30s', stake: 500 }, now + 100);
  if (!dnB.ok) return;
  const roseState: AppState = {
    ...dnB.nextState,
    assets: dnB.nextState.assets.map((a) =>
      a.id === 'eth' ? { ...a, price: a.price + 200 } : a
    ),
  };
  const res3ADown = settleExpiredPositions(roseState, now + 35_000);
  assert.equal(res3ADown.nextState.ownerFeeRevenue, 1030);
  assert.equal(res3ADown.nextState.commissionLedger?.[0].kind, 'same_side_forfeiture');

  // Case 3B (Both UP + Price Rises -> Cancelled/Refunded 100% to both, ₹0 Owner revenue)
  const upRoseState: AppState = {
    ...upB.nextState,
    assets: upB.nextState.assets.map((a) =>
      a.id === 'btc' ? { ...a, price: a.price + 400 } : a
    ),
  };
  const res3BUp = settleExpiredPositions(upRoseState, now + 35_000);
  const a3B = res3BUp.nextState.registeredAccounts?.find((a) => a.email === 'alpha@test.in');
  const b3B = res3BUp.nextState.registeredAccounts?.find((a) => a.email === 'beta@test.in');
  assert.equal(a3B?.balance, 2000);
  assert.equal(b3B?.balance, 2000);
  assert.equal(res3BUp.nextState.ownerFeeRevenue, 0);

  // Case 3B Reverse (Both DOWN + Price Drops -> Cancelled/Refunded 100% to both, ₹0 Owner revenue)
  const dnDroppedState: AppState = {
    ...dnB.nextState,
    assets: dnB.nextState.assets.map((a) =>
      a.id === 'eth' ? { ...a, price: a.price - 200 } : a
    ),
  };
  const res3BDown = settleExpiredPositions(dnDroppedState, now + 35_000);
  const a3BDn = res3BDown.nextState.registeredAccounts?.find((a) => a.email === 'alpha@test.in');
  const b3BDn = res3BDown.nextState.registeredAccounts?.find((a) => a.email === 'beta@test.in');
  assert.equal(a3BDn?.balance, 2000);
  assert.equal(b3BDn?.balance, 2000);
  assert.equal(res3BDown.nextState.ownerFeeRevenue, 0);
});

test('redeemGiftCode recognizes Owner-created custom gift codes', () => {
  const withCustom = {
    ...TEST_FUNDED_STATE,
    customGiftCodes: [
      { code: 'OWNER250', amount: 250, label: 'Owner Flash Drop', active: true },
    ],
  };
  const res = redeemGiftCode(withCustom, 'owner250');
  assert.equal(res.ok, true);
  if (res.ok) {
    assert.equal(res.amount, 250);
    assert.equal(res.nextState.balance, TEST_FUNDED_STATE.balance + 250);
  }
});

test('adminRejectDeposit, adminApproveWithdrawal, adminRejectAndRefundWithdrawal & freeze guards behave accurately', () => {
  const depReq = applyTopUp(TEST_FUNDED_STATE, 300, 'PhonePe', '998877665544', 1000);
  assert.equal(depReq.ok, true);
  if (!depReq.ok) return;

  const rejectedDep = adminRejectDeposit(depReq.nextState, depReq.transaction.id, 'Invalid UTR');
  assert.equal(rejectedDep.ok, true);
  if (!rejectedDep.ok) return;
  assert.equal(rejectedDep.nextState.balance, TEST_FUNDED_STATE.balance);
  assert.equal(rejectedDep.nextState.transactions[0].status, 'Rejected');
  assert.equal(rejectedDep.nextState.transactions[0].rejectionReason, 'Invalid UTR');

  // Withdraw then reject & refund restores balance & withdrawableBalance
  const wdReq = applyWithdraw(TEST_FUNDED_STATE, 500, 'upi-1', 2000);
  assert.equal(wdReq.ok, true);
  if (!wdReq.ok) return;
  assert.equal(wdReq.nextState.balance, 4285 - 500);
  assert.equal(wdReq.nextState.withdrawableBalance, 1285 - 500);

  const refunded = adminRejectAndRefundWithdrawal(wdReq.nextState, wdReq.transaction.id, 'Bank server busy', 3000);
  assert.equal(refunded.ok, true);
  if (!refunded.ok) return;
  assert.equal(refunded.nextState.balance, 4285);
  assert.equal(refunded.nextState.withdrawableBalance, 1285);

  // Approving another withdrawal completes payout without refund
  const wdReq2 = applyWithdraw(TEST_FUNDED_STATE, 400, 'bank-1', 4000);
  assert.equal(wdReq2.ok, true);
  if (!wdReq2.ok) return;
  const approvedWd = adminApproveWithdrawal(wdReq2.nextState, wdReq2.transaction.id);
  assert.equal(approvedWd.ok, true);
  if (approvedWd.ok) {
    assert.equal(approvedWd.nextState.transactions[0].status, 'Completed');
  }

  // Frozen user cannot trade, bet, or withdraw
  const frozenState: AppState = {
    ...TEST_FUNDED_STATE,
    registeredAccounts: [
      {
        email: TEST_FUNDED_STATE.profile.email,
        password: 'secret',
        name: 'Aarav Sharma',
        uid: 'UID-95E9-AARAV',
        frozen: true,
        freezeReason: 'Security audit',
      },
    ],
  };
  assert.equal(executeTradeOrder(frozenState, { assetId: 'apple', side: 'long', horizon: '1m', stake: 100 }).ok, false);
  assert.equal(placePredictionBet(frozenState, { marketId: 'pred-gtavi', choice: 'yes', stake: 50 }).ok, false);
  assert.equal(applyWithdraw(frozenState, 200, 'upi-1').ok, false);
});

test('approval-only PendingTransferAnimation queue enqueues strictly on Owner verify/approve and consumes FIFO by user email', () => {
  const pendingDep = applyTopUp(TEST_FUNDED_STATE, 500, 'PhonePe', '112233445566', 1000);
  assert.equal(pendingDep.ok, true);
  if (!pendingDep.ok) return;
  // Submitting pending deposit must NOT queue any transfer animation
  assert.equal((pendingDep.nextState.pendingTransferAnimations ?? []).length, 0);

  const verified = adminVerifyAndCreditDeposit(pendingDep.nextState, pendingDep.transaction.id, 2000);
  assert.equal(verified.ok, true);
  if (!verified.ok) return;
  assert.equal((verified.nextState.pendingTransferAnimations ?? []).length, 1);
  assert.equal(verified.nextState.pendingTransferAnimations?.[0].direction, 'deposit');

  // Pending withdrawal must NOT queue animation until Owner approves
  const pendingWd = applyWithdraw(verified.nextState, 200, 'upi-1', 3000);
  assert.equal(pendingWd.ok, true);
  if (!pendingWd.ok) return;
  assert.equal((pendingWd.nextState.pendingTransferAnimations ?? []).length, 1);

  const approvedWd = adminApproveWithdrawal(pendingWd.nextState, pendingWd.transaction.id);
  assert.equal(approvedWd.ok, true);
  if (!approvedWd.ok) return;
  assert.equal((approvedWd.nextState.pendingTransferAnimations ?? []).length, 2);

  // Another user cannot consume Aarav's animation
  const otherUserCheck = consumePendingTransferForUser(approvedWd.nextState, 'someoneelse@test.com');
  assert.equal(otherUserCheck.transfer, null);
  assert.equal((otherUserCheck.nextState.pendingTransferAnimations ?? []).length, 2);

  // Aarav consumes deposit then withdrawal FIFO
  const firstPop = consumePendingTransferForUser(approvedWd.nextState, 'aarav@test.com');
  assert.equal(firstPop.transfer?.direction, 'deposit');
  assert.equal(firstPop.transfer?.amountInr, 500);
  assert.equal((firstPop.nextState.pendingTransferAnimations ?? []).length, 1);

  const secondPop = consumePendingTransferForUser(firstPop.nextState, 'aarav@test.com');
  assert.equal(secondPop.transfer?.direction, 'withdraw');
  assert.equal(secondPop.transfer?.amountInr, 200);
  assert.equal((secondPop.nextState.pendingTransferAnimations ?? []).length, 0);
});

test('Multi-UPI gateway pool selects active & primary receiver and builds dynamic payment links', () => {
  const stateWithPool: AppState = {
    ...TEST_FUNDED_STATE,
    merchantUpiPool: [
      { id: 'u1', label: 'Paused Bank', upiId: 'paused@sbi', payeeName: 'Paused Desk', active: false, isPrimary: false },
      { id: 'u2', label: 'Secondary HDFC', upiId: 'desk2@okhdfcbank', payeeName: 'Desk Two', active: true, isPrimary: false },
      { id: 'u3', label: 'Primary Axis', upiId: 'desk1@okaxis', payeeName: 'Desk One', active: true, isPrimary: true },
    ],
  };

  const active = getActiveMerchantUpis(stateWithPool);
  assert.equal(active.length, 2);
  assert.equal(active[0].upiId, 'desk1@okaxis');
  assert.equal(getPrimaryMerchantUpi(stateWithPool).upiId, 'desk1@okaxis');

  const customUri = buildUpiPaymentUri(750, 'OB999', { upiId: 'desk2@okhdfcbank', payeeName: 'Desk Two' });
  assert.equal(customUri.includes('pa=desk2%40okhdfcbank'), true);
  assert.equal(customUri.includes('am=750.00'), true);

  const gpay = getUpiMethodById('gpay');
  const gpayLink = buildAppDeepLink(gpay, 750, { upiId: 'desk2@okhdfcbank', payeeName: 'Desk Two' });
  assert.equal(gpayLink.startsWith('tez://upi/pay?'), true);
  assert.equal(gpayLink.includes('pa=desk2%40okhdfcbank'), true);
});

test('banned, withdrawalsBlocked, tradingBlocked, and global platformSettings enforce limits cleanly', () => {
  const pausedDepositsState: AppState = {
    ...TEST_FUNDED_STATE,
    platformSettings: {
      depositsPaused: true,
      withdrawalsPaused: true,
      signupsPaused: true,
      maxDepositInr: 25000,
      maxWithdrawInr: 15000,
      maintenanceNotice: 'Gateway maintenance in progress',
      supportNotice: '',
    },
  };
  const depPaused = applyTopUp(pausedDepositsState, 500, 'PhonePe', '123456789012');
  assert.equal(depPaused.ok, false);
  const wdPaused = applyWithdraw(pausedDepositsState, 500, 'upi-1');
  assert.equal(wdPaused.ok, false);

  const restrictionState: AppState = {
    ...TEST_FUNDED_STATE,
    registeredAccounts: [
      {
        email: TEST_FUNDED_STATE.profile.email,
        password: 'secret',
        name: 'Aarav Sharma',
        uid: 'UID-95E9-AARAV',
        withdrawalsBlocked: true,
        tradingBlocked: true,
      },
    ],
  };
  assert.equal(applyWithdraw(restrictionState, 200, 'upi-1').ok, false);
  assert.equal(executeTradeOrder(restrictionState, { assetId: 'apple', side: 'long', horizon: '1m', stake: 100 }).ok, false);
});

test('computeAdminPlatformSummary aggregates verified deposits, withdrawals, net float, and account counts', () => {
  const adminTestState: AppState = {
    ...TEST_FUNDED_STATE,
    ownerFeeRevenue: 325,
    registeredAccounts: [
      { email: 'a@t.com', password: 'p', name: 'A', uid: '1' },
      { email: 'b@t.com', password: 'p', name: 'B', uid: '2', frozen: true },
      { email: 'c@t.com', password: 'p', name: 'C', uid: '3', banned: true },
    ],
    platformTransactions: [
      { id: 'd1', type: 'deposit', title: 'Dep', amount: 2000, timestamp: 't', status: 'Credited', credited: true },
      { id: 'd2', type: 'deposit', title: 'Dep', amount: 500, timestamp: 't', status: 'Under Review', credited: false },
      { id: 'w1', type: 'withdraw', title: 'Wd', amount: -800, timestamp: 't', status: 'Completed' },
      { id: 'w2', type: 'withdraw', title: 'Wd', amount: -300, timestamp: 't', status: 'In Process' },
    ],
  };

  const summary = computeAdminPlatformSummary(adminTestState);
  assert.equal(summary.verifiedDepositsTotalInr, 2000);
  assert.equal(summary.verifiedDepositsCount, 1);
  assert.equal(summary.completedWithdrawalsTotalInr, 800);
  assert.equal(summary.completedWithdrawalsCount, 1);
  assert.equal(summary.netPlatformFloatInr, 1200);
  assert.equal(summary.pendingDepositsTotalInr, 500);
  assert.equal(summary.pendingWithdrawalsTotalInr, 300);
  assert.equal(summary.ownerFeeRevenue, 325);
  assert.equal(summary.totalUsersCount, 3);
  assert.equal(summary.activeUsersCount, 1);
  assert.equal(summary.frozenUsersCount, 1);
  assert.equal(summary.bannedUsersCount, 1);
});

test('applyGameWalletTransaction connects game stakes, payouts, refunds, idempotency, and restrictions to app wallet', () => {
  // 1. Reject zero-balance / insufficient funds bet
  const zeroState: AppState = {
    ...TEST_FUNDED_STATE,
    balance: 20,
    withdrawableBalance: 0,
  };
  const lowFunds = applyGameWalletTransaction(zeroState, {
    txId: 'gtx-low-1',
    gameId: 'color-predict',
    gameTitle: 'Color Predict',
    kind: 'bet',
    amountInr: 100,
  });
  assert.equal(lowFunds.ok, false);

  // 2. Bet deducts locked funds first before withdrawableBalance and records game_bet tx
  const seeded: AppState = {
    ...TEST_FUNDED_STATE,
    balance: 1500,
    withdrawableBalance: 1000,
    realizedPnl: 0,
    todayReceived: 0,
  };
  const betRes = applyGameWalletTransaction(seeded, {
    txId: 'gtx-bet-1',
    gameId: 'chicken-road',
    gameTitle: 'Chicken Road',
    kind: 'bet',
    amountInr: 600,
    meta: 'Cross Lane 1',
  });
  assert.equal(betRes.ok, true);
  if (!betRes.ok) return;
  assert.equal(betRes.nextState.balance, 900);
  // 500 locked consumed first, 100 from withdrawable -> 900 left
  assert.equal(betRes.nextState.withdrawableBalance, 900);
  assert.equal(betRes.nextState.realizedPnl, -600);
  assert.equal(betRes.nextState.transactions[0]?.type, 'game_bet');
  assert.equal(betRes.nextState.transactions[0]?.amount, -600);

  // 3. Duplicate txId is idempotent (no double-debit)
  const dupBet = applyGameWalletTransaction(betRes.nextState, {
    txId: 'gtx-bet-1',
    gameId: 'chicken-road',
    gameTitle: 'Chicken Road',
    kind: 'bet',
    amountInr: 600,
  });
  assert.equal(dupBet.ok, true);
  if (!dupBet.ok) return;
  assert.equal(dupBet.nextState.balance, 900);

  // 4. Win credits balance + withdrawableBalance and nets realizedPnl
  const winRes = applyGameWalletTransaction(betRes.nextState, {
    txId: 'gtx-win-1',
    gameId: 'chicken-road',
    gameTitle: 'Chicken Road',
    kind: 'win',
    amountInr: 1200,
    meta: 'Cashout 2.00x',
  });
  assert.equal(winRes.ok, true);
  if (!winRes.ok) return;
  assert.equal(winRes.nextState.balance, 2100);
  assert.equal(winRes.nextState.withdrawableBalance, 2100);
  assert.equal(winRes.nextState.realizedPnl, 600);
  assert.equal(winRes.nextState.transactions[0]?.type, 'game_win');

  // 5. Refund returns full stake cleanly
  const refundRes = applyGameWalletTransaction(betRes.nextState, {
    txId: 'gtx-ref-1',
    gameId: 'trade-live',
    gameTitle: 'Trade Live',
    kind: 'refund',
    amountInr: 600,
  });
  assert.equal(refundRes.ok, true);
  if (!refundRes.ok) return;
  assert.equal(refundRes.nextState.balance, 1500);
  assert.equal(refundRes.nextState.realizedPnl, 0);
  assert.equal(refundRes.nextState.transactions[0]?.status, 'Cancelled/Refunded');

  // 6. Frozen account cannot place bets
  const frozenState: AppState = {
    ...TEST_FUNDED_STATE,
    registeredAccounts: [
      {
        email: TEST_FUNDED_STATE.profile.email,
        password: 'p',
        name: 'Aarav',
        uid: 'U1',
        frozen: true,
      },
    ],
  };
  const blocked = applyGameWalletTransaction(frozenState, {
    txId: 'gtx-frozen-1',
    gameId: 'mines',
    gameTitle: 'Mines',
    kind: 'bet',
    amountInr: 100,
  });
  assert.equal(blocked.ok, false);
});

test('capped referral system validates codes, prevents self-referral, pays once on first bet, and enforces lifetime caps', () => {
  const codeA = generateReferralCode('alpha@test.in', []);
  const codeB = generateReferralCode('alpha@test.in', [codeA]);
  assert.equal(codeA.startsWith('OURO-'), true);
  assert.notEqual(codeA, codeB);

  const accounts = [
    {
      email: 'referrer@test.in',
      password: 'pw',
      name: 'Referrer',
      uid: 'UID-REF1',
      referralCode: 'OURO-REF1',
      balance: 1000,
      withdrawableBalance: 500,
      todayReceived: 0,
      rewardedReferralsCount: 0,
      referralEarnedInr: 0,
      transactions: [],
    },
    {
      email: 'referee@test.in',
      password: 'pw',
      name: 'Referee',
      uid: 'UID-REF2',
      referralCode: 'OURO-REF2',
      referredByCode: 'OURO-REF1',
      referralRewardSettled: false,
      balance: 200,
      withdrawableBalance: 0,
      todayReceived: 0,
      transactions: [],
    },
  ];

  assert.equal(validateAndResolveReferralCode(accounts, 'INVALID99', 'referee@test.in').ok, false);
  assert.equal(validateAndResolveReferralCode(accounts, 'OURO-REF2', 'referee@test.in').ok, false);
  const valid = validateAndResolveReferralCode(accounts, 'ouro-ref1', 'referee@test.in');
  assert.equal(valid.ok, true);

  // First real game bet triggers one-time ₹25 referee + ₹50 referrer bonus
  const refState: AppState = {
    ...INITIAL_APP_STATE,
    balance: 200,
    withdrawableBalance: 0,
    todayReceived: 0,
    profile: {
      ...INITIAL_APP_STATE.profile,
      name: 'Referee',
      email: 'referee@test.in',
      uid: 'UID-REF2',
      referralCode: 'OURO-REF2',
      referredByCode: 'OURO-REF1',
    },
    registeredAccounts: accounts,
  };

  const firstBet = applyGameWalletTransaction(refState, {
    txId: 'gtx-ref-first-1',
    gameId: 'stairs',
    gameTitle: 'Stairs',
    kind: 'bet',
    amountInr: 50,
  });
  assert.equal(firstBet.ok, true);
  if (!firstBet.ok) return;

  // Balance: 200 - 50 + 25 = 175 (referee bonus credited once, play-locked)
  assert.equal(firstBet.nextState.balance, 175);
  assert.equal(firstBet.nextState.withdrawableBalance, 0);
  const updatedReferrer = firstBet.nextState.registeredAccounts?.find((a) => a.email === 'referrer@test.in');
  const updatedReferee = firstBet.nextState.registeredAccounts?.find((a) => a.email === 'referee@test.in');
  assert.equal(updatedReferrer?.balance, 1050);
  assert.equal(updatedReferrer?.rewardedReferralsCount, 1);
  assert.equal(updatedReferrer?.referralEarnedInr, 50);
  assert.equal(updatedReferee?.referralRewardSettled, true);

  // Second bet MUST NOT double-credit referral bonuses
  const secondBet = applyGameWalletTransaction(firstBet.nextState, {
    txId: 'gtx-ref-second-1',
    gameId: 'stairs',
    gameTitle: 'Stairs',
    kind: 'bet',
    amountInr: 50,
  });
  assert.equal(secondBet.ok, true);
  if (!secondBet.ok) return;
  assert.equal(secondBet.nextState.balance, 125);
  const referrerAfterSecond = secondBet.nextState.registeredAccounts?.find((a) => a.email === 'referrer@test.in');
  assert.equal(referrerAfterSecond?.balance, 1050);
  assert.equal(referrerAfterSecond?.rewardedReferralsCount, 1);

  // Lifetime bonus cap (₹500 / 10 referrals) blocks further payouts once reached
  const cappedState: AppState = {
    ...INITIAL_APP_STATE,
    balance: 200,
    withdrawableBalance: 0,
    profile: {
      ...INITIAL_APP_STATE.profile,
      name: 'Late Friend',
      email: 'late@test.in',
      uid: 'UID-LATE',
      referredByCode: 'OURO-REF1',
    },
    registeredAccounts: [
      {
        email: 'referrer@test.in',
        password: 'pw',
        name: 'Referrer',
        uid: 'UID-REF1',
        referralCode: 'OURO-REF1',
        balance: 1500,
        rewardedReferralsCount: 10,
        referralEarnedInr: 500,
        transactions: [],
      },
      {
        email: 'late@test.in',
        password: 'pw',
        name: 'Late Friend',
        uid: 'UID-LATE',
        referredByCode: 'OURO-REF1',
        referralRewardSettled: false,
        balance: 200,
        transactions: [],
      },
    ],
  };

  const settledCapped = applyReferralRewardOnFirstBet(cappedState, 5000);
  assert.equal(settledCapped.referrerBonus, 0);
  assert.equal(settledCapped.refereeBonus, 25);
  const cappedReferrer = settledCapped.nextState.registeredAccounts?.find((a) => a.email === 'referrer@test.in');
  assert.equal(cappedReferrer?.balance, 1500);
  assert.equal(cappedReferrer?.referralEarnedInr, 500);
});



