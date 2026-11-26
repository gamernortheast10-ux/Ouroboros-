export type MarketCategory =
  | 'All Markets'
  | 'Mobile Brands'
  | 'Famous Games'
  | 'Crypto'
  | 'Sports'
  | 'Political';

export type NavSection =
  | 'markets'
  | 'games'
  | 'trade'
  | 'bets'
  | 'portfolio'
  | 'gift'
  | 'feed'
  | 'profile'
  | 'admin';

export type TradeSide = 'long' | 'short';
export type P2PTradeStatus = 'Pending' | 'Matched' | 'Settled' | 'Cancelled/Refunded';
export type P2PMatchKind = 'opposite' | 'same_side' | 'none';
export type TimeHorizon = '15s' | '30s' | '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '24h' | '7d';
export type BaseCurrency = 'INR' | 'USD' | 'JPY' | 'EUR' | 'GBP' | 'AED' | 'SGD' | 'AUD';
export type LanguageCode = 'en' | 'hi' | 'ja' | 'es' | 'zh';
export type FxRatesMap = Record<BaseCurrency, number>;

export interface MarketAsset {
  id: string;
  symbol: string;
  name: string;
  subtitle: string;
  category: Exclude<MarketCategory, 'All Markets'>;
  price: number;
  changePct: number;
  longPoolAmount: number;
  shortPoolAmount: number;
  history: number[];
  brandColor: string;
  brandText: string;
  brandGlyph: string;
  logoUrl?: string;
  fallbackLogoUrl?: string;
  logoBg?: string;
}

export interface PredictionMarket {
  id: string;
  category: Exclude<MarketCategory, 'All Markets'>;
  subLabel: string;
  question: string;
  endsInSeconds: number;
  endLabel: string;
  yesPool: number;
  noPool: number;
  yesBettors: number;
  noBettors: number;
  createdByOwner?: boolean;
  createdAt?: string;
  resolutionCriteria?: string;
  resolvedOutcome?: 'yes' | 'no';
  resolvedAt?: string;
  resolutionSummary?: string;
  resolutionSources?: Array<{ title: string; uri: string }>;
}

export interface ActivePosition {
  id: string;
  assetId: string;
  symbol: string;
  side: TradeSide;
  horizon: TimeHorizon;
  durationSeconds: number;
  expiresAtMs: number;
  stake: number;
  feePaid: number;
  entryPrice: number;
  openedAt: string;
  status: 'open' | 'closed';
  userEmail?: string;
  userName?: string;
  p2pStatus?: P2PTradeStatus;
  matchKind?: P2PMatchKind;
  pairId?: string;
  counterpartyPositionId?: string;
  counterpartyEmail?: string;
  counterpartyName?: string;
  matchAnchorPrice?: number;
  outcomeNote?: string;
  refundAmount?: number;
  commissionApplied?: number;
  lockedDebitUsed?: number;
  withdrawableDebitUsed?: number;
  exitPrice?: number;
  realizedPnl?: number;
  payout?: number;
  closedAt?: string;
}

export interface SettledPositionSummary {
  id: string;
  symbol: string;
  side: TradeSide;
  stake: number;
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  payout: number;
  won: boolean;
  settledAt: string;
  p2pStatus?: 'Settled' | 'Cancelled/Refunded';
  matchKind?: P2PMatchKind;
  outcomeNote?: string;
}

export interface ActiveBet {
  id: string;
  marketId: string;
  question: string;
  choice: 'yes' | 'no';
  stake: number;
  multiplier: number;
  placedAt: string;
  status: 'open' | 'won' | 'lost';
  payout?: number;
  settledAt?: string;
  resolutionSummary?: string;
  resolutionSources?: Array<{ title: string; uri: string }>;
}

export interface BankAccount {
  id: string;
  bankName: string;
  accountLast4: string;
  accountNumber?: string;
  ifsc: string;
  holderName: string;
}

export interface UpiAccount {
  id: string;
  upiId: string;
  appId: string;
  appName: string;
  holderName: string;
}

export type TransactionStatus =
  | 'Pending'
  | 'Matched'
  | 'In Process'
  | 'Under Review'
  | 'Completed'
  | 'Settled'
  | 'Credited'
  | 'Rejected'
  | 'Cancelled/Refunded';

export interface WalletTransaction {
  id: string;
  type:
    | 'deposit'
    | 'withdraw'
    | 'sell_usdt'
    | 'trade_open'
    | 'trade_close'
    | 'trade_refund'
    | 'bet_place'
    | 'gift_redeem'
    | 'referral_bonus'
    | 'game_bet'
    | 'game_win'
    | 'game_refund'
    | 'daily_checkin'
    | 'p2p_send'
    | 'p2p_receive';
  title: string;
  amount: number; // positive credit, negative debit
  timestamp: string;
  status: TransactionStatus;
  meta?: string;
  utr?: string;
  createdAtMs?: number;
  credited?: boolean;
  userEmail?: string;
  userName?: string;
  userUid?: string;
  destinationSummary?: string;
  destinationCopyValue?: string;
  rejectionReason?: string;
}

export interface GiftRedemption {
  id: string;
  code: string;
  amount: number;
  redeemedAt: string;
  label: string;
}

export interface CustomGiftCode {
  code: string;
  amount: number;
  label: string;
  active: boolean;
  initialAmount?: number;
  minAmount?: number;
  stepDecreaseInr?: number;
  maxClaims?: number;
  claimsCount?: number;
  claimedByEmails?: string[];
}

export interface PlatformFeeConfig {
  platformFeePct: number;
  minDepositInr: number;
  minWithdrawInr: number;
  referrerBonusInr?: number;
  refereeBonusInr?: number;
  maxReferralsPerUser?: number;
  referralBonusCapInr?: number;
}

export type ReferralConfig = PlatformFeeConfig;

export interface CommissionLedgerEntry {
  id: string;
  timestamp: string;
  createdAtMs: number;
  actorEmail: string;
  actorName: string;
  kind: 'matched_opposite' | 'same_side_forfeiture' | 'bet' | 'trade';
  grossAmountInr: number;
  platformFeeInr: number;
  ownerNetRevenueInr: number;
  note: string;
}

export interface NewsComment {
  id: string;
  author: string;
  text: string;
  timestamp: string;
}

export interface NewsItem {
  id: string;
  ticker: string;
  assetId?: string;
  marketId?: string;
  topicKind?: 'stock' | 'bet';
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  date: string;
  title: string;
  summary: string;
  comments: NewsComment[];
}

export interface CommunityMessage {
  id: string;
  username: string;
  text: string;
}

export interface CommunityChatUsage {
  date: string;
  count: number;
}

export type ThemeMode = 'dark' | 'light';

export type PlayerLevelName =
  | 'New Player'
  | 'Normal'
  | 'Ordinary'
  | 'Extraordinary'
  | 'VIP'
  | 'VVIP'
  | 'MVP'
  | 'Sovereign';

export interface PlayerLevelDefinition {
  tier: number;
  name: PlayerLevelName;
  minSpent: number;
  accentColor: string;
  perk: string;
}

export interface PlayerLevelInfo {
  current: PlayerLevelDefinition;
  next: PlayerLevelDefinition | null;
  totalSpent: number;
  progressPct: number;
  remainingToNext: number;
}

export interface SupportTicket {
  id: string;
  uid?: string;
  userEmail?: string;
  subject: string;
  message: string;
  transactionId?: string;
  paymentDateTime?: string;
  whatsapp?: string;
  screenshotDataUrl?: string;
  status: 'Open' | 'In Review' | 'Resolved';
  createdAt: string;
}

export type BroadcastCategory = 'promo' | 'wallet' | 'market' | 'system' | 'gift';

export interface PlatformBroadcastNotification {
  id: string;
  title: string;
  msg: string;
  category: BroadcastCategory;
  targetEmail: string; // 'ALL' or specific user email
  createdAtMs: number;
  timestamp: string;
}

export interface UserProfile {
  name: string;
  email: string;
  uid: string;
  phone?: string;
  twoFactorEnabled: boolean;
  baseCurrency: BaseCurrency;
  priceAlertsEnabled: boolean;
  language?: LanguageCode;
  referralCode?: string;
  referredByCode?: string;
  lastCheckInDate?: string;
  checkInStreak?: number;
}

export interface MerchantUpiConfig {
  id: string;
  label: string;
  upiId: string;
  payeeName: string;
  active: boolean;
  isPrimary: boolean;
}

export interface PlatformSettings {
  depositsPaused: boolean;
  withdrawalsPaused: boolean;
  signupsPaused: boolean;
  maintenanceNotice: string;
  maxDepositInr: number;
  maxWithdrawInr: number;
  supportNotice: string;
  dailyCheckInEnabled?: boolean;
  dailyCheckInRequiresDeposit?: boolean;
  dailyCheckInBaseReward?: number;
  leaderboardEnabled?: boolean;
  guestBrowsingEnabled?: boolean;
  firstDepositBonusEnabled?: boolean;
  firstDepositBonusPct?: number;
  firstDepositBonusMaxInr?: number;
}

export interface PendingTransferAnimation {
  id: string;
  targetEmail: string;
  direction: 'deposit' | 'withdraw';
  amountInr: number;
  channelLabel: string;
  createdAtMs: number;
}

export interface RegisteredAccount {
  email: string;
  password: string;
  name: string;
  uid: string;
  phone?: string;
  balance?: number;
  withdrawableBalance?: number;
  usdtHoldings?: number;
  todayReceived?: number;
  realizedPnl?: number;
  totalDepositedInr?: number;
  totalWithdrawnInr?: number;
  positions?: ActivePosition[];
  bets?: ActiveBet[];
  transactions?: WalletTransaction[];
  bankAccounts?: BankAccount[];
  upiAccounts?: UpiAccount[];
  redeemedGifts?: GiftRedemption[];
  supportTickets?: SupportTicket[];
  frozen?: boolean;
  freezeReason?: string;
  banned?: boolean;
  banReason?: string;
  withdrawalsBlocked?: boolean;
  tradingBlocked?: boolean;
  seenBroadcastIds?: string[];
  referralCode?: string;
  referredByCode?: string;
  referralRewardSettled?: boolean;
  rewardedReferralsCount?: number;
  referralEarnedInr?: number;
  lastCheckInDate?: string;
  checkInStreak?: number;
  createdAt?: string;
}

export interface AppState {
  balance: number;
  withdrawableBalance: number;
  usdtHoldings: number;
  usdtRateInr: number;
  inrRatioPct: number;
  todayReceived: number;
  realizedPnl: number;
  assets: MarketAsset[];
  predictions: PredictionMarket[];
  positions: ActivePosition[];
  platformPositions?: ActivePosition[];
  bets: ActiveBet[];
  transactions: WalletTransaction[];
  bankAccounts: BankAccount[];
  upiAccounts?: UpiAccount[];
  redeemedGifts: GiftRedemption[];
  customGiftCodes?: CustomGiftCode[];
  referralConfig?: PlatformFeeConfig;
  ownerFeeRevenue?: number;
  commissionLedger?: CommissionLedgerEntry[];
  platformTransactions?: WalletTransaction[];
  platformBroadcasts?: PlatformBroadcastNotification[];
  platformTickets?: SupportTicket[];
  merchantUpiPool?: MerchantUpiConfig[];
  platformSettings?: PlatformSettings;
  pendingTransferAnimations?: PendingTransferAnimation[];
  news: NewsItem[];
  communityMessages?: CommunityMessage[];
  communityChatUsage?: CommunityChatUsage;
  profile: UserProfile;
  isAuthenticated?: boolean;
  registeredAccounts?: RegisteredAccount[];
  themeMode?: ThemeMode;
  supportTickets?: SupportTicket[];
  fxRates?: FxRatesMap;
  fxUpdatedAt?: string;
  fxSource?: 'live' | 'market-tick';
}
