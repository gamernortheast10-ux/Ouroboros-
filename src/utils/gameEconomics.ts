export type GameId =
  | 'aviator'
  | 'stairs'
  | 'rps'
  | 'treasure'
  | 'hilo'
  | 'tower'
  | 'mines'
  | 'lucky-wheel'
  | 'balloon'
  | 'plinko'
  | 'chicken-road'
  | 'coinflip'
  | 'dragon-tiger'
  | 'roulette'
  | 'color-predict'
  | 'crypto-jackpot'
  | 'trade-live';

export interface BetValidationResult {
  valid: boolean;
  error?: string;
}

export const GAME_MIN_BETS: Record<GameId, number> = {
  aviator: 10,
  stairs: 10,
  rps: 10,
  treasure: 10,
  hilo: 10,
  tower: 10,
  mines: 10,
  'lucky-wheel': 10,
  balloon: 10,
  plinko: 10,
  'chicken-road': 10,
  coinflip: 10,
  'dragon-tiger': 10,
  roulette: 10,
  'color-predict': 10,
  'crypto-jackpot': 10,
  'trade-live': 10,
};

export function roundInr(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export function validateGameBet(
  gameId: GameId,
  betAmount: number,
  balance: number
): BetValidationResult {
  const minBet = GAME_MIN_BETS[gameId] ?? 10;
  if (!Number.isFinite(betAmount) || betAmount < minBet) {
    return {
      valid: false,
      error: `Minimum bet for ${gameId} is ₹${minBet}.`,
    };
  }
  if (!Number.isFinite(balance) || betAmount > balance + 1e-6) {
    return {
      valid: false,
      error: `Insufficient wallet balance. Need ₹${betAmount.toFixed(2)}, available ₹${Math.max(
        0,
        balance
      ).toFixed(2)}.`,
    };
  }
  return { valid: true };
}

// ===== 1. STAIRS =====
export const STAIRS_CHANCES = [
  0.90, 0.85, 0.80, 0.75, 0.70, 0.65, 0.60, 0.55, 0.50, 0.45, 0.40, 0.35,
] as const;

export const STAIRS_MULTS = [
  1.10, 1.20, 1.45, 1.95, 2.80, 4.30, 7.10, 12.80, 25.50, 56.00, 138.00, 390.00,
] as const;

export const STAIRS_MIN_CASHOUT_STEP = 5;

export function canCashOutStairs(step: number): boolean {
  return step >= STAIRS_MIN_CASHOUT_STEP && step <= STAIRS_MULTS.length;
}

export function getStairsStepEv(targetStep: number): number {
  if (targetStep < 1 || targetStep > STAIRS_MULTS.length) return 0;
  let cumSurv = 1;
  for (let i = 0; i < targetStep; i++) {
    cumSurv *= STAIRS_CHANCES[i];
  }
  return cumSurv * STAIRS_MULTS[targetStep - 1];
}

// ===== 2. ROCK PAPER SCISSORS =====
export const RPS_HOUSE_EDGE_LOSS_PROB = 0.25;
export const RPS_STREAK_BASE = 1.80;
export const RPS_MAX_STREAK = 10;

export function getRpsStreakMultiplier(streak: number): number {
  if (streak <= 0) return 1;
  const clamped = Math.min(RPS_MAX_STREAK, Math.floor(streak));
  return Number(Math.pow(RPS_STREAK_BASE, clamped).toFixed(2));
}

export function resolveRpsRound(
  playerChoice: 'rock' | 'paper' | 'scissors',
  roll: number,
  cpuRandomIdx: number
): 'win' | 'draw' | 'lose' {
  if (roll < RPS_HOUSE_EDGE_LOSS_PROB) return 'lose';
  const choices: Array<'rock' | 'paper' | 'scissors'> = ['rock', 'paper', 'scissors'];
  const cpu = choices[Math.abs(cpuRandomIdx) % 3];
  if (cpu === playerChoice) return 'draw';
  const beats: Record<'rock' | 'paper' | 'scissors', 'rock' | 'paper' | 'scissors'> = {
    rock: 'scissors',
    paper: 'rock',
    scissors: 'paper',
  };
  return beats[playerChoice] === cpu ? 'win' : 'lose';
}

export function getRpsSingleDecisiveWinProb(): number {
  const nonForced = 1 - RPS_HOUSE_EDGE_LOSS_PROB;
  const winProb = nonForced * (1 / 3);
  const loseProb = RPS_HOUSE_EDGE_LOSS_PROB + nonForced * (1 / 3);
  return winProb / (winProb + loseProb);
}

// ===== 3. TREASURE BOXES =====
export const TREASURE_GRID_SIZE = 6;
export const TREASURE_BOMB_OPTIONS = [2, 3, 4] as const;
export const TREASURE_RTP_FACTOR = 0.91;
export const TREASURE_EARLY_CASHOUT_MIN_OPENED = 3;
export const TREASURE_EARLY_CASHOUT_PENALTY_RATE = 0.05;

export function calcTreasureMultiplier(opened: number, bombCount: number): number {
  const safe = TREASURE_GRID_SIZE - bombCount;
  if (opened <= 0 || bombCount <= 0 || bombCount >= TREASURE_GRID_SIZE) return 1;
  const clampedOpened = Math.min(opened, safe);
  let prob = 1;
  for (let i = 0; i < clampedOpened; i++) {
    prob *= (safe - i) / (TREASURE_GRID_SIZE - i);
  }
  return Math.max(1.05, Math.floor((TREASURE_RTP_FACTOR / prob) * 100) / 100);
}

export function calcTreasureCashout(
  betAmount: number,
  opened: number,
  bombCount: number
): { multiplier: number; penaltyInr: number; payout: number; earlyPenaltyApplied: boolean } {
  const multiplier = calcTreasureMultiplier(opened, bombCount);
  const safe = TREASURE_GRID_SIZE - bombCount;
  const isFullBoardClear = opened >= safe;
  const earlyPenaltyApplied =
    opened > 0 && opened < TREASURE_EARLY_CASHOUT_MIN_OPENED && !isFullBoardClear;
  const gross = roundInr(betAmount * multiplier);
  const penaltyInr = earlyPenaltyApplied
    ? roundInr(betAmount * TREASURE_EARLY_CASHOUT_PENALTY_RATE)
    : 0;
  const payout = Math.max(0, roundInr(gross - penaltyInr));
  return { multiplier, penaltyInr, payout, earlyPenaltyApplied };
}

// ===== 4. HI-LO =====
export const HILO_RTP_FACTOR = 0.86;
export const HILO_HOUSE_BIAS_RATE = 0.16;
export const HILO_MAX_MULT = 25;
export const HILO_RETAINED_BONUS_CAP = 0.15;

export function calcHiLoOdds(val: number): { hi: number; lo: number; same: number } {
  const higher = Math.max(0, 13 - val);
  const lower = Math.max(0, val - 1);
  const hi =
    higher > 0
      ? Math.min(11.18, Math.max(1.03, Math.floor(((13 / higher) * HILO_RTP_FACTOR) * 100) / 100))
      : 0;
  const lo =
    lower > 0
      ? Math.min(11.18, Math.max(1.03, Math.floor(((13 / lower) * HILO_RTP_FACTOR) * 100) / 100))
      : 0;
  const same = Math.min(11.18, Math.floor((13 * HILO_RTP_FACTOR) * 100) / 100);
  return { hi, lo, same };
}

export function calcHiLoNextMultiplier(currentMult: number, stepOdds: number): number {
  if (stepOdds <= 0) return currentMult;
  return Math.min(HILO_MAX_MULT, Math.floor(currentMult * stepOdds * 100) / 100);
}

export function calcHiLoRetainedBonus(lostAtMultiplier: number): number {
  if (lostAtMultiplier <= 1) return 0;
  return Math.min(
    HILO_RETAINED_BONUS_CAP,
    Math.floor((lostAtMultiplier - 1) * 0.2 * 100) / 100
  );
}

// ===== 5. TOWER CLIMB =====
export type TowerDifficulty = 'easy' | 'medium' | 'hard';
export const TOWER_FLOORS = 8;
export const TOWER_HIGH_FLOOR_START_INDEX = 5; // 1-based floors 6..8
export const TOWER_HIGH_FLOOR_MIN_BET = 50;

export const TOWER_TILE_COUNT: Record<TowerDifficulty, number> = {
  easy: 3,
  medium: 3,
  hard: 4,
};

export const TOWER_MULTS: Record<TowerDifficulty, readonly number[]> = {
  easy: [1.36, 2.04, 3.07, 4.60, 6.90, 18.50, 48.00, 110.00],
  medium: [2.70, 8.10, 24.30, 72.00, 215.00, 580.00, 1400.00, 3200.00],
  hard: [3.60, 14.40, 56.00, 220.00, 820.00, 2600.00, 9500.00, 45000.00],
};

export function getTowerFloorTrapCount(
  diff: TowerDifficulty,
  floorIndex: number
): number {
  if (diff === 'easy') {
    return floorIndex >= TOWER_HIGH_FLOOR_START_INDEX ? 2 : 1;
  }
  if (diff === 'medium') {
    return 2;
  }
  return 3; // out of 4 tiles in hard mode
}

export function getTowerHighFloorExtraHazard(
  diff: TowerDifficulty,
  floorIndex: number
): number {
  // Adds subtle extra trap pressure on high floors 6-8 for medium & hard (easy already steps from 1 to 2 traps)
  if (floorIndex < TOWER_HIGH_FLOOR_START_INDEX) return 0;
  if (diff === 'medium') return 0.16; // effective pass prob drops from 1/3 -> ~0.28
  if (diff === 'hard') return 0.20; // effective pass prob drops from 1/4 -> 0.20
  return 0;
}

export function isTowerFloorUnlocked(floorIndex: number, betAmount: number): boolean {
  if (floorIndex < TOWER_HIGH_FLOOR_START_INDEX) return true;
  return betAmount >= TOWER_HIGH_FLOOR_MIN_BET;
}

export function getTowerMaxAccessibleFloorCount(betAmount: number): number {
  return betAmount >= TOWER_HIGH_FLOOR_MIN_BET ? TOWER_FLOORS : TOWER_HIGH_FLOOR_START_INDEX;
}

export function getTowerFloorEv(diff: TowerDifficulty, floorNumber: number): number {
  if (floorNumber < 1 || floorNumber > TOWER_FLOORS) return 0;
  let cumSurv = 1;
  for (let idx = 0; idx < floorNumber; idx++) {
    const tiles = TOWER_TILE_COUNT[diff];
    const traps = getTowerFloorTrapCount(diff, idx);
    const baseSurv = (tiles - traps) / tiles;
    const extraHazard = getTowerHighFloorExtraHazard(diff, idx);
    cumSurv *= baseSurv * (1 - extraHazard);
  }
  return cumSurv * TOWER_MULTS[diff][floorNumber - 1];
}

// ===== 6. MINES =====
export const MINES_GRID_SIZE = 25;
export const MINES_RTP_FACTOR = 0.93;

export function calcMinesMultiplier(gemsFound: number, mineCount: number): number {
  if (gemsFound <= 0 || mineCount <= 0 || mineCount >= MINES_GRID_SIZE) return 1;
  const safe = MINES_GRID_SIZE - mineCount;
  const clampedGems = Math.min(gemsFound, safe);
  let prob = 1;
  for (let i = 0; i < clampedGems; i++) {
    prob *= (safe - i) / (MINES_GRID_SIZE - i);
  }
  return Math.max(1.01, Math.floor((MINES_RTP_FACTOR / prob) * 100) / 100);
}

// ===== 7. LUCKY WHEEL =====
export const LUCKY_WHEEL_MULTS = [
  0.2, 0.5, 1.2, 0.0, 1.5, 0.4, 2.0, 0.0, 0.8, 3.8, 0.2, 0.4,
] as const;

export function getLuckyWheelEv(): number {
  const sum = LUCKY_WHEEL_MULTS.reduce<number>((acc, m) => acc + m, 0);
  return sum / LUCKY_WHEEL_MULTS.length;
}

// ===== 8. BALLOON POP =====
export const BALLOON_RTP_FACTOR = 0.92;

export function getBalloonPumpPopChance(pumpNumber: number): number {
  if (pumpNumber <= 0) return 0;
  return Math.min(0.85, 0.16 + (pumpNumber - 1) * 0.05);
}

export function calcBalloonMultiplier(pumps: number): number {
  if (pumps <= 0) return 1;
  let cumSurv = 1;
  for (let p = 1; p <= pumps; p++) {
    cumSurv *= 1 - getBalloonPumpPopChance(p);
  }
  return Math.max(1.08, Math.floor((BALLOON_RTP_FACTOR / cumSurv) * 100) / 100);
}

export function getBalloonPumpEv(pumps: number): number {
  if (pumps <= 0) return 0;
  let cumSurv = 1;
  for (let p = 1; p <= pumps; p++) {
    cumSurv *= 1 - getBalloonPumpPopChance(p);
  }
  return cumSurv * calcBalloonMultiplier(pumps);
}

// ===== 9. PLINKO =====
export type PlinkoRisk = 'low' | 'medium' | 'high';
export const PLINKO_ROWS = 10;

export const PLINKO_MULTS: Record<PlinkoRisk, readonly number[]> = {
  low: [3.5, 2.0, 1.4, 1.1, 0.85, 0.65, 0.85, 1.1, 1.4, 2.0, 3.5],
  medium: [8.0, 4.0, 2.1, 1.15, 0.7, 0.35, 0.7, 1.15, 2.1, 4.0, 8.0],
  high: [18.0, 7.0, 2.8, 1.2, 0.4, 0.2, 0.4, 1.2, 2.8, 7.0, 18.0],
};

function nCr(n: number, r: number): number {
  let num = 1;
  let den = 1;
  for (let i = 0; i < r; i++) {
    num *= n - i;
    den *= i + 1;
  }
  return num / den;
}

export function getPlinkoEv(risk: PlinkoRisk): number {
  const mults = PLINKO_MULTS[risk];
  const totalWays = Math.pow(2, PLINKO_ROWS);
  let ev = 0;
  for (let k = 0; k <= PLINKO_ROWS; k++) {
    ev += (nCr(PLINKO_ROWS, k) / totalWays) * mults[k];
  }
  return ev;
}

// ===== 10. CHICKEN ROAD =====
export const CHICKEN_ROAD_RISK = [
  0.16, 0.20, 0.25, 0.32, 0.40, 0.48, 0.56, 0.65,
] as const;

export const CHICKEN_ROAD_MULTS = [
  1.09, 1.36, 1.82, 2.65, 4.30, 8.20, 16.50, 36.00,
] as const;

export function getChickenRoadLaneEv(laneNumber: number): number {
  if (laneNumber < 1 || laneNumber > CHICKEN_ROAD_MULTS.length) return 0;
  let cumSurv = 1;
  for (let i = 0; i < laneNumber; i++) {
    cumSurv *= 1 - CHICKEN_ROAD_RISK[i];
  }
  return cumSurv * CHICKEN_ROAD_MULTS[laneNumber - 1];
}

// ===== 11. COLOR PREDICT =====
export const COLOR_PREDICT_MULTS = {
  greenRedFull: 2.0,
  greenRedSplit: 1.5,
  violet: 4.5,
  number: 9.0,
  size: 1.92, // Big / Small (50% outcome -> 96% RTP)
} as const;

// ===== 12. CRYPTO JACKPOT =====
export interface JackpotSymbol {
  id: string;
  w: number;
  mult3: number;
  pairMult: number;
}

export const CRYPTO_JACKPOT_SYMS: readonly JackpotSymbol[] = [
  { id: 'doge', w: 20, mult3: 6, pairMult: 1.8 },
  { id: 'ada', w: 16, mult3: 10, pairMult: 2.2 },
  { id: 'xrp', w: 14, mult3: 15, pairMult: 3.0 },
  { id: 'sol', w: 12, mult3: 25, pairMult: 0 },
  { id: 'link', w: 10, mult3: 40, pairMult: 0 },
  { id: 'avax', w: 8, mult3: 65, pairMult: 0 },
  { id: 'eth', w: 6, mult3: 100, pairMult: 0 },
  { id: 'btc', w: 4, mult3: 200, pairMult: 0 },
  { id: 'matic', w: 7, mult3: 0, pairMult: 0 }, // 2+ => free spins
  { id: 'bnb', w: 3, mult3: 0, pairMult: 0 }, // 3x => mega jackpot (capped at 1000x bet)
];

export const CRYPTO_JACKPOT_MAX_BET_MULT = 1000;

export function resolveCryptoJackpotSpin(
  ids: [string, string, string],
  bet: number,
  currentJackpotPool: number
): { win: number; freeSpinsAwarded: number; isJackpot: boolean } {
  if (ids.every((id) => id === 'bnb')) {
    const win = Math.min(currentJackpotPool, bet * CRYPTO_JACKPOT_MAX_BET_MULT);
    return { win: roundInr(win), freeSpinsAwarded: 0, isJackpot: true };
  }
  const maticCount = ids.filter((id) => id === 'matic').length;
  if (maticCount >= 2) {
    return {
      win: 0,
      freeSpinsAwarded: maticCount === 3 ? 10 : 5,
      isJackpot: false,
    };
  }
  if (ids[0] === ids[1] && ids[1] === ids[2]) {
    const sym = CRYPTO_JACKPOT_SYMS.find((s) => s.id === ids[0]);
    if (sym && sym.mult3 > 0) {
      return {
        win: roundInr(bet * sym.mult3),
        freeSpinsAwarded: 0,
        isJackpot: false,
      };
    }
  }
  const pairs: Array<[string, string]> = [
    [ids[0], ids[1]],
    [ids[1], ids[2]],
    [ids[0], ids[2]],
  ];
  for (const [a, b] of pairs) {
    if (a === b) {
      const sym = CRYPTO_JACKPOT_SYMS.find((s) => s.id === a);
      if (sym && sym.pairMult > 0) {
        return {
          win: roundInr(bet * sym.pairMult),
          freeSpinsAwarded: 0,
          isJackpot: false,
        };
      }
    }
  }
  return { win: 0, freeSpinsAwarded: 0, isJackpot: false };
}

// ===== 13. TRADE LIVE =====
export const TRADE_LIVE_COMMISSION = 0.04;
export const TRADE_LIVE_GROSS_PAYOUT = 2.0;
export const TRADE_LIVE_NET_MULT = Number(
  (TRADE_LIVE_GROSS_PAYOUT * (1 - TRADE_LIVE_COMMISSION)).toFixed(2)
); // 1.92x

export function resolveTradeLivePosition(
  dir: 'up' | 'down',
  entry: number,
  exit: number,
  stake: number
): { status: 'win' | 'lose' | 'refund'; credit: number } {
  if (exit === entry) {
    return { status: 'refund', credit: roundInr(stake) };
  }
  const won = (dir === 'up' && exit > entry) || (dir === 'down' && exit < entry);
  if (!won) return { status: 'lose', credit: 0 };
  const credit = roundInr(stake * TRADE_LIVE_GROSS_PAYOUT * (1 - TRADE_LIVE_COMMISSION));
  return { status: 'win', credit };
}

// ===== DETERMINISTIC PRNG + MONTE CARLO SIMULATION HARNESS =====
export function createSeededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function simulateGameRtp(
  gameId: GameId,
  rounds = 10000,
  seed = 1337
): { wagered: number; returned: number; rtp: number } {
  const rng = createSeededRng(seed);
  const bet = 100;
  let wagered = 0;
  let returned = 0;

  if (gameId === 'stairs') {
    for (let r = 0; r < rounds; r++) {
      wagered += bet;
      let alive = true;
      for (let step = 0; step < STAIRS_MIN_CASHOUT_STEP; step++) {
        if (rng() >= STAIRS_CHANCES[step]) {
          alive = false;
          break;
        }
      }
      if (alive) {
        returned += roundInr(bet * STAIRS_MULTS[STAIRS_MIN_CASHOUT_STEP - 1]);
      }
    }
  } else if (gameId === 'rps') {
    for (let r = 0; r < rounds; r++) {
      wagered += bet;
      while (true) {
        const res = resolveRpsRound('rock', rng(), Math.floor(rng() * 3));
        if (res === 'draw') continue;
        if (res === 'win') {
          returned += roundInr(bet * getRpsStreakMultiplier(1));
        }
        break;
      }
    }
  } else if (gameId === 'treasure') {
    for (let r = 0; r < rounds; r++) {
      wagered += bet;
      // 2 bombs on 6 boxes, cash out at 2 opened (early penalty) or 3 opened
      const targetOpened = r % 2 === 0 ? 2 : 3;
      const bombCount = 2;
      let alive = true;
      for (let i = 0; i < targetOpened; i++) {
        const pSafe = (TREASURE_GRID_SIZE - bombCount - i) / (TREASURE_GRID_SIZE - i);
        if (rng() >= pSafe) {
          alive = false;
          break;
        }
      }
      if (alive) {
        returned += calcTreasureCashout(bet, targetOpened, bombCount).payout;
      }
    }
  } else if (gameId === 'hilo') {
    for (let r = 0; r < rounds; r++) {
      wagered += bet;
      const curVal = 1 + Math.floor(rng() * 13);
      const odds = calcHiLoOdds(curVal);
      const dir = curVal <= 7 ? 'hi' : 'lo';
      let nextVal = 1 + Math.floor(rng() * 13);
      if (rng() < HILO_HOUSE_BIAS_RATE) {
        // bias draw toward adverse card
        nextVal = dir === 'hi' ? 1 : 13;
      }
      const won = dir === 'hi' ? nextVal > curVal : nextVal < curVal;
      if (won) {
        const stepOdds = dir === 'hi' ? odds.hi : odds.lo;
        returned += roundInr(bet * calcHiLoNextMultiplier(1, stepOdds));
      }
    }
  } else if (gameId === 'tower') {
    for (let r = 0; r < rounds; r++) {
      wagered += bet;
      const diff: TowerDifficulty = r % 3 === 0 ? 'easy' : r % 3 === 1 ? 'medium' : 'hard';
      const targetFloor = 3;
      let alive = true;
      for (let f = 0; f < targetFloor; f++) {
        const tiles = TOWER_TILE_COUNT[diff];
        const traps = getTowerFloorTrapCount(diff, f);
        const pickSafe = rng() < (tiles - traps) / tiles;
        const noExtraHazard = rng() >= getTowerHighFloorExtraHazard(diff, f);
        if (!pickSafe || !noExtraHazard) {
          alive = false;
          break;
        }
      }
      if (alive) {
        returned += roundInr(bet * TOWER_MULTS[diff][targetFloor - 1]);
      }
    }
  } else if (gameId === 'mines') {
    for (let r = 0; r < rounds; r++) {
      wagered += bet;
      const mineCount = 3;
      const clicks = 3;
      let alive = true;
      for (let i = 0; i < clicks; i++) {
        const pSafe = (MINES_GRID_SIZE - mineCount - i) / (MINES_GRID_SIZE - i);
        if (rng() >= pSafe) {
          alive = false;
          break;
        }
      }
      if (alive) {
        returned += roundInr(bet * calcMinesMultiplier(clicks, mineCount));
      }
    }
  } else if (gameId === 'lucky-wheel') {
    for (let r = 0; r < rounds; r++) {
      wagered += bet;
      const mult = LUCKY_WHEEL_MULTS[Math.floor(rng() * LUCKY_WHEEL_MULTS.length)];
      returned += roundInr(bet * mult);
    }
  } else if (gameId === 'balloon') {
    for (let r = 0; r < rounds; r++) {
      wagered += bet;
      const targetPumps = 1 + (r % 4);
      let alive = true;
      for (let p = 1; p <= targetPumps; p++) {
        if (rng() < getBalloonPumpPopChance(p)) {
          alive = false;
          break;
        }
      }
      if (alive) {
        returned += roundInr(bet * calcBalloonMultiplier(targetPumps));
      }
    }
  } else if (gameId === 'plinko') {
    for (let r = 0; r < rounds; r++) {
      wagered += bet;
      const risk: PlinkoRisk = r % 3 === 0 ? 'low' : r % 3 === 1 ? 'medium' : 'high';
      let slot = 0;
      for (let step = 0; step < PLINKO_ROWS; step++) {
        if (rng() < 0.5) slot++;
      }
      returned += roundInr(bet * PLINKO_MULTS[risk][slot]);
    }
  } else if (gameId === 'chicken-road') {
    for (let r = 0; r < rounds; r++) {
      wagered += bet;
      const targetLane = 1 + (r % 4);
      let alive = true;
      for (let l = 0; l < targetLane; l++) {
        if (rng() < CHICKEN_ROAD_RISK[l]) {
          alive = false;
          break;
        }
      }
      if (alive) {
        returned += roundInr(bet * CHICKEN_ROAD_MULTS[targetLane - 1]);
      }
    }
  } else if (gameId === 'coinflip') {
    for (let r = 0; r < rounds; r++) {
      wagered += bet;
      if (rng() < 0.49) {
        returned += roundInr(bet * 1.96);
      }
    }
  } else if (gameId === 'dragon-tiger') {
    for (let r = 0; r < rounds; r++) {
      wagered += bet;
      const d = 1 + Math.floor(rng() * 13);
      const t = 1 + Math.floor(rng() * 13);
      if (d > t) returned += bet * 2;
    }
  } else if (gameId === 'roulette') {
    for (let r = 0; r < rounds; r++) {
      wagered += bet;
      const pocket = Math.floor(rng() * 37);
      if (pocket > 0 && pocket <= 18) returned += bet * 2;
    }
  } else if (gameId === 'color-predict') {
    for (let r = 0; r < rounds; r++) {
      wagered += bet;
      const num = Math.floor(rng() * 10);
      if (num >= 5) returned += roundInr(bet * COLOR_PREDICT_MULTS.size);
    }
  } else if (gameId === 'crypto-jackpot') {
    const totalW = CRYPTO_JACKPOT_SYMS.reduce((s, x) => s + x.w, 0);
    const pick = () => {
      let roll = rng() * totalW;
      for (const s of CRYPTO_JACKPOT_SYMS) {
        roll -= s.w;
        if (roll <= 0) return s.id;
      }
      return CRYPTO_JACKPOT_SYMS[0].id;
    };
    let freeSpins = 0;
    let jackpotPool = 50000;
    let spinsDone = 0;
    while (spinsDone < rounds) {
      if (freeSpins > 0) {
        freeSpins--;
      } else {
        wagered += bet;
        jackpotPool += Math.floor(bet * 0.05);
        spinsDone++;
      }
      const res = resolveCryptoJackpotSpin([pick(), pick(), pick()], bet, jackpotPool);
      if (res.isJackpot) jackpotPool = 50000;
      freeSpins += res.freeSpinsAwarded;
      returned += res.win;
    }
  } else if (gameId === 'trade-live') {
    for (let r = 0; r < rounds; r++) {
      wagered += bet;
      const delta = rng() < 0.5 ? 1 : -1;
      returned += resolveTradeLivePosition('up', 100, 100 + delta, bet).credit;
    }
  } else if (gameId === 'aviator') {
    for (let r = 0; r < rounds; r++) {
      const stake = r % 3 === 0 ? 250 : 25;
      wagered += stake;
      const crash = generateAviatorCrashPoint({
        hasRealBet: true,
        totalBetInr: stake,
        roll: rng(),
        smallBetRoll: rng(),
      });
      const targetCashout = stake <= AVIATOR_SMALL_BET_THRESHOLD ? 1.45 : 1.35;
      if (crash >= targetCashout) {
        returned += roundInr(stake * targetCashout);
      }
    }
  }

  return {
    wagered: roundInr(wagered),
    returned: roundInr(returned),
    rtp: wagered > 0 ? returned / wagered : 0,
  };
}

// ===== 14. AVIATOR CRASH FLIGHT =====
export const AVIATOR_SMALL_BET_THRESHOLD = 100;
export const AVIATOR_SMALL_BET_MAX_MULT = 3.0;
export const AVIATOR_LARGE_BET_MAX_MULT = 1.85;

export function generateAviatorCrashPoint(params: {
  hasRealBet: boolean;
  totalBetInr: number;
  roll: number;
  smallBetRoll?: number;
}): number {
  const r = Math.min(0.999999, Math.max(0, Number(params.roll) || 0));
  const sub = Math.min(0.999999, Math.max(0, Number(params.smallBetRoll ?? params.roll) || 0));

  // No real user bet active: plane climbs high & dramatically to build excitement
  if (!params.hasRealBet || params.totalBetInr <= 0) {
    const idleMult = 5.5 + Math.pow(r, 1.35) * 36.5;
    return Math.round(idleMult * 100) / 100;
  }

  // Small user stake (<= ₹100): modest fun profits frequently without allowing runaway wins
  if (params.totalBetInr <= AVIATOR_SMALL_BET_THRESHOLD) {
    if (r < 0.34) {
      // Early house crash (1.00x - 1.18x)
      return Math.round((1.0 + sub * 0.18) * 100) / 100;
    }
    if (r < 0.88) {
      // Modest profit zone (1.24x - 2.25x)
      return Math.round((1.24 + sub * 1.01) * 100) / 100;
    }
    // Occasional exciting mid-flight capped at 3.00x
    return Math.min(
      AVIATOR_SMALL_BET_MAX_MULT,
      Math.round((2.25 + sub * 0.7) * 100) / 100
    );
  }

  // Larger stake (> ₹100): tight crash ceiling & high early-crash rate protecting house profit
  if (r < 0.62) {
    return Math.round((1.0 + sub * 0.24) * 100) / 100;
  }
  if (r < 0.95) {
    return Math.round((1.24 + sub * 0.41) * 100) / 100;
  }
  return Math.min(
    AVIATOR_LARGE_BET_MAX_MULT,
    Math.round((1.65 + sub * 0.2) * 100) / 100
  );
}

