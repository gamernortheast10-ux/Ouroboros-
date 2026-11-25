import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AVIATOR_LARGE_BET_MAX_MULT,
  AVIATOR_SMALL_BET_MAX_MULT,
  AVIATOR_SMALL_BET_THRESHOLD,
  BALLOON_RTP_FACTOR,
  CHICKEN_ROAD_MULTS,
  CHICKEN_ROAD_RISK,
  COLOR_PREDICT_MULTS,
  CRYPTO_JACKPOT_MAX_BET_MULT,
  GAME_MIN_BETS,
  GameId,
  HILO_MAX_MULT,
  HILO_RETAINED_BONUS_CAP,
  LUCKY_WHEEL_MULTS,
  MINES_RTP_FACTOR,
  PLINKO_MULTS,
  PlinkoRisk,
  RPS_HOUSE_EDGE_LOSS_PROB,
  RPS_MAX_STREAK,
  RPS_STREAK_BASE,
  STAIRS_CHANCES,
  STAIRS_MIN_CASHOUT_STEP,
  STAIRS_MULTS,
  TOWER_FLOORS,
  TOWER_HIGH_FLOOR_MIN_BET,
  TOWER_TILE_COUNT,
  TRADE_LIVE_NET_MULT,
  TREASURE_EARLY_CASHOUT_MIN_OPENED,
  TREASURE_EARLY_CASHOUT_PENALTY_RATE,
  TREASURE_GRID_SIZE,
  calcBalloonMultiplier,
  calcHiLoNextMultiplier,
  calcHiLoOdds,
  calcHiLoRetainedBonus,
  calcMinesMultiplier,
  calcTreasureCashout,
  calcTreasureMultiplier,
  canCashOutStairs,
  generateAviatorCrashPoint,
  getBalloonPumpEv,
  getBalloonPumpPopChance,
  getChickenRoadLaneEv,
  getLuckyWheelEv,
  getPlinkoEv,
  getRpsSingleDecisiveWinProb,
  getRpsStreakMultiplier,
  getStairsStepEv,
  getTowerFloorEv,
  getTowerFloorTrapCount,
  getTowerMaxAccessibleFloorCount,
  isTowerFloorUnlocked,
  resolveCryptoJackpotSpin,
  resolveRpsRound,
  resolveTradeLivePosition,
  simulateGameRtp,
  validateGameBet,
} from './gameEconomics';

test('minimum bet enforcement rejects < minBet and > balance across all 17 games', () => {
  const allGames = Object.keys(GAME_MIN_BETS) as GameId[];
  assert.equal(allGames.length, 17);

  for (const id of allGames) {
    const min = GAME_MIN_BETS[id];
    assert.ok(min >= 10, `${id} min bet must be >= ₹10`);
    assert.equal(validateGameBet(id, min - 1, 1000).valid, false);
    assert.equal(validateGameBet(id, 0, 1000).valid, false);
    assert.equal(validateGameBet(id, -10, 1000).valid, false);
    assert.equal(validateGameBet(id, min, min - 0.5).valid, false);
    assert.equal(validateGameBet(id, min, min).valid, true);
  }
});

test('Stairs enforces Step 5 cashout gate, 0.90 -> 0.35 probabilities, and < 0.96 EV on all cashable steps', () => {
  assert.equal(STAIRS_CHANCES[0], 0.90);
  assert.equal(STAIRS_CHANCES[STAIRS_CHANCES.length - 1], 0.35);
  assert.equal(STAIRS_MULTS[0], 1.10);
  assert.equal(STAIRS_MULTS[1], 1.20);

  for (let s = 0; s < STAIRS_MIN_CASHOUT_STEP; s++) {
    assert.equal(canCashOutStairs(s), false);
  }
  for (let s = STAIRS_MIN_CASHOUT_STEP; s <= 12; s++) {
    assert.equal(canCashOutStairs(s), true);
    const ev = getStairsStepEv(s);
    assert.ok(ev > 0.80 && ev < 0.95, `Stairs step ${s} EV=${ev.toFixed(4)} out of bounds`);
  }
});

test('RPS uses 0.25 forced house loss, 1.80^streak multiplier, and caps max streak at 10', () => {
  assert.equal(RPS_HOUSE_EDGE_LOSS_PROB, 0.25);
  assert.equal(RPS_STREAK_BASE, 1.80);
  assert.equal(RPS_MAX_STREAK, 10);

  assert.equal(resolveRpsRound('rock', 0.10, 2), 'lose');
  assert.equal(resolveRpsRound('rock', 0.249, 2), 'lose');
  assert.equal(resolveRpsRound('rock', 0.50, 0), 'draw');
  assert.equal(resolveRpsRound('rock', 0.50, 2), 'win');

  assert.equal(getRpsStreakMultiplier(1), 1.80);
  assert.equal(getRpsStreakMultiplier(2), 3.24);
  assert.equal(getRpsStreakMultiplier(15), getRpsStreakMultiplier(10));

  const pWin = getRpsSingleDecisiveWinProb();
  const ev = pWin * getRpsStreakMultiplier(1);
  assert.ok(ev < 0.85, `RPS EV=${ev.toFixed(4)} must give clear house edge`);
});

test('Treasure uses 6-box grid, tight calcMult, and 5% penalty on early cashouts (<3 opened)', () => {
  assert.equal(TREASURE_GRID_SIZE, 6);
  assert.equal(TREASURE_EARLY_CASHOUT_MIN_OPENED, 3);
  assert.equal(TREASURE_EARLY_CASHOUT_PENALTY_RATE, 0.05);

  const m1 = calcTreasureMultiplier(1, 2);
  const ev1 = (4 / 6) * m1;
  assert.ok(ev1 <= 0.92, `Treasure 1-open 2-bomb EV=${ev1}`);

  const early = calcTreasureCashout(100, 2, 2);
  assert.equal(early.earlyPenaltyApplied, true);
  assert.equal(early.penaltyInr, 5);
  assert.equal(early.payout, Math.round((100 * early.multiplier - 5) * 100) / 100);

  const normal = calcTreasureCashout(100, 3, 2);
  assert.equal(normal.earlyPenaltyApplied, false);
  assert.equal(normal.penaltyInr, 0);

  // Full board clear on 4 bombs (2 safe boxes) should not suffer early cashout penalty
  const clear4 = calcTreasureCashout(100, 2, 4);
  assert.equal(clear4.earlyPenaltyApplied, false);
  assert.equal(clear4.penaltyInr, 0);
});

test('Hi-Lo calcOdds removes >100% EV exploit and caps retained streak bonus at +0.15x', () => {
  // Rank 2 has 11 cards higher out of 13; fair ratio = 13/11 = 1.18, discounted by 0.86 => ~1.03x
  const odds2 = calcHiLoOdds(2);
  assert.ok((11 / 13) * odds2.hi < 0.92, `Hi-Lo rank 2 Higher EV=${(11 / 13) * odds2.hi}`);
  assert.ok((1 / 13) * odds2.lo < 0.92, `Hi-Lo rank 2 Lower EV=${(1 / 13) * odds2.lo}`);
  assert.ok((1 / 13) * odds2.same < 0.92, `Hi-Lo Same EV=${(1 / 13) * odds2.same}`);

  assert.equal(calcHiLoNextMultiplier(20, 2), HILO_MAX_MULT);
  assert.equal(calcHiLoRetainedBonus(1), 0);
  assert.equal(calcHiLoRetainedBonus(1.5), 0.1);
  assert.equal(calcHiLoRetainedBonus(10), HILO_RETAINED_BONUS_CAP);
});

test('Tower fixes hard mode tile count, enforces ₹50+ floor 6-8 lock, and maintains < 0.94 EV', () => {
  assert.equal(TOWER_TILE_COUNT.hard, 4);
  assert.equal(getTowerFloorTrapCount('hard', 0), 3); // 1 safe out of 4
  assert.equal(getTowerFloorTrapCount('easy', 5), 2); // escalated traps on high floors

  assert.equal(isTowerFloorUnlocked(4, 10), true); // Floor 5 accessible with ₹10
  assert.equal(isTowerFloorUnlocked(5, 10), false); // Floor 6 locked for ₹10
  assert.equal(isTowerFloorUnlocked(5, TOWER_HIGH_FLOOR_MIN_BET), true);
  assert.equal(getTowerMaxAccessibleFloorCount(25), 5);
  assert.equal(getTowerMaxAccessibleFloorCount(50), TOWER_FLOORS);

  for (const diff of ['easy', 'medium', 'hard'] as const) {
    for (let f = 1; f <= TOWER_FLOORS; f++) {
      const ev = getTowerFloorEv(diff, f);
      assert.ok(ev > 0.25 && ev < 0.94, `Tower ${diff} floor ${f} EV=${ev.toFixed(4)}`);
    }
  }
});

test('Mines, Lucky Wheel, Balloon, Plinko, Chicken Road, Color Predict, Crypto Jackpot & Trade Live have strict < 0.97 analytical EV', () => {
  // Mines
  for (const mineCount of [1, 3, 5, 10, 20]) {
    const safe = 25 - mineCount;
    let p = 1;
    for (let click = 1; click <= Math.min(5, safe); click++) {
      p *= (safe - (click - 1)) / (25 - (click - 1));
      const m = calcMinesMultiplier(click, mineCount);
      assert.ok(p * m < 0.97, `Mines ${mineCount} click ${click} EV=${p * m}`);
    }
  }

  // Lucky Wheel
  const wheelEv = getLuckyWheelEv();
  assert.ok(wheelEv > 0.85 && wheelEv < 0.94, `Lucky Wheel EV=${wheelEv}`);
  assert.equal(LUCKY_WHEEL_MULTS.length, 12);

  // Balloon (Pump 1 has real pop risk!)
  assert.ok(getBalloonPumpPopChance(1) >= 0.15);
  for (let p = 1; p <= 10; p++) {
    const ev = getBalloonPumpEv(p);
    assert.ok(ev <= BALLOON_RTP_FACTOR + 0.01, `Balloon pump ${p} EV=${ev}`);
    assert.ok(calcBalloonMultiplier(p) > 1.0);
  }

  // Plinko (center must be lowest, edges highest)
  for (const risk of ['low', 'medium', 'high'] as PlinkoRisk[]) {
    const mults = PLINKO_MULTS[risk];
    assert.ok(mults[0] > mults[5] && mults[10] > mults[5], `Plinko ${risk} center must be < edges`);
    const ev = getPlinkoEv(risk);
    assert.ok(ev > 0.85 && ev < 0.95, `Plinko ${risk} EV=${ev}`);
  }

  // Chicken Road
  assert.equal(CHICKEN_ROAD_RISK.length, 8);
  assert.equal(CHICKEN_ROAD_MULTS.length, 8);
  for (let lane = 1; lane <= 8; lane++) {
    const ev = getChickenRoadLaneEv(lane);
    assert.ok(ev < 0.94, `Chicken Road lane ${lane} EV=${ev}`);
  }

  // Color Predict Big/Small
  assert.equal(COLOR_PREDICT_MULTS.size, 1.92);
  assert.ok(0.5 * COLOR_PREDICT_MULTS.size < 0.97);

  // Crypto Jackpot caps mega payout relative to stake
  const jp = resolveCryptoJackpotSpin(['bnb', 'bnb', 'bnb'], 10, 100000);
  assert.equal(jp.isJackpot, true);
  assert.equal(jp.win, 10 * CRYPTO_JACKPOT_MAX_BET_MULT);

  // Trade Live flat tie refunds stake, win pays 1.92x
  assert.equal(TRADE_LIVE_NET_MULT, 1.92);
  assert.deepEqual(resolveTradeLivePosition('up', 100, 100, 100), { status: 'refund', credit: 100 });
  assert.deepEqual(resolveTradeLivePosition('up', 100, 101, 100), { status: 'win', credit: 192 });
  assert.deepEqual(resolveTradeLivePosition('up', 100, 99, 100), { status: 'lose', credit: 0 });
});

test('10,000-round Monte Carlo simulation confirms house profitability (RTP < 1.00) on every single game', () => {
  const games = Object.keys(GAME_MIN_BETS) as GameId[];
  for (const id of games) {
    const res = simulateGameRtp(id, 10000, 2026);
    assert.ok(
      res.rtp >= 0.45 && res.rtp <= 0.985,
      `${id} Monte Carlo 10k RTP=${(res.rtp * 100).toFixed(2)}% expected between 45% and 98.5%`
    );
  }
});

test('Aviator flies high when no real user bets exist and caps payouts under active real stakes', () => {
  for (let i = 0; i < 10; i += 1) {
    const r = (i + 0.5) / 10;
    const noBetCrash = generateAviatorCrashPoint({
      hasRealBet: false,
      totalBetInr: 0,
      roll: r,
    });
    assert.ok(noBetCrash >= 5.5 && noBetCrash <= 42.0, `Expected high flight, got ${noBetCrash}`);

    const smallBetCrash = generateAviatorCrashPoint({
      hasRealBet: true,
      totalBetInr: AVIATOR_SMALL_BET_THRESHOLD,
      roll: r,
      smallBetRoll: r,
    });
    assert.ok(
      smallBetCrash >= 1.0 && smallBetCrash <= AVIATOR_SMALL_BET_MAX_MULT,
      `Small bet crash ${smallBetCrash} exceeded max ${AVIATOR_SMALL_BET_MAX_MULT}`
    );

    const largeBetCrash = generateAviatorCrashPoint({
      hasRealBet: true,
      totalBetInr: 500,
      roll: r,
      smallBetRoll: r,
    });
    assert.ok(
      largeBetCrash >= 1.0 && largeBetCrash <= AVIATOR_LARGE_BET_MAX_MULT,
      `Large bet crash ${largeBetCrash} exceeded max ${AVIATOR_LARGE_BET_MAX_MULT}`
    );
  }
});
