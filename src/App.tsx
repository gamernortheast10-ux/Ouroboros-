import React, { useEffect, useState } from 'react';
import {
  Bell,
  Briefcase,
  CandlestickChart,
  CheckCircle2,
  Gamepad2,
  Gift,
  Home,
  Newspaper,
  Plus,
  ScanLine,
  Trophy,
  User,
  Wallet,
  X,
} from 'lucide-react';
import { AdminView } from './components/AdminView';
import { AllBetsView } from './components/AllBetsView';
import { AuthView } from './components/AuthView';
import { FeedView } from './components/FeedView';
import { GamesView } from './components/GamesView';
import { GiftView } from './components/GiftView';
import { MarketsView } from './components/MarketsView';
import { NotificationCenter } from './components/NotificationCenter';
import {
  PaymentTransferAnimation,
  PaymentTransferPayload,
} from './components/PaymentTransferAnimation';
import { PortfolioView } from './components/PortfolioView';
import { PredictionModal } from './components/PredictionModal';
import { ProfileView } from './components/ProfileView';
import { TermsModal } from './components/TermsModal';
import { TradeModal } from './components/TradeModal';
import { TradeTerminalView } from './components/TradeTerminalView';
import {
  SupportTicketPayload,
  WalletModal,
  WalletModalMode,
} from './components/WalletModal';
import {
  WalletScannerModal,
  WalletScannerTab,
} from './components/WalletScannerModal';
import {
  DEFAULT_MERCHANT_UPIS,
  DEFAULT_PLATFORM_SETTINGS,
  DEFAULT_REFERRAL_CONFIG,
  INITIAL_APP_STATE,
  INITIAL_ASSETS,
  INITIAL_COMMUNITY_MESSAGES,
} from './data/seedData';
import { AppNotification, NotificationTemplateKey } from './types/notifications';
import {
  AppState,
  BankAccount,
  BaseCurrency,
  BroadcastCategory,
  CustomGiftCode,
  LanguageCode,
  MarketAsset,
  NavSection,
  PlatformBroadcastNotification,
  PlatformSettings,
  PredictionMarket,
  ReferralConfig,
  RegisteredAccount,
  SettledPositionSummary,
  SupportTicket,
  ThemeMode,
  TimeHorizon,
  TradeSide,
  UpiAccount,
} from './types/trading';
import {
  generateAutoNewsItem,
  generateLiveCommunityMessage,
  postCommunityMessage,
} from './utils/chartPatterns';
import { fetchLiveFxRates } from './utils/fxRates';
import { t } from './utils/i18n';
import {
  createNotificationFromTemplate,
  playNotificationSound,
} from './utils/notifications';
import {
  DEFAULT_FX_RATES,
  OwnerPredictionDraft,
  adminApproveWithdrawal,
  adminRejectAndRefundWithdrawal,
  adminRejectDeposit,
  adminVerifyAndCreditDeposit,
  applyGameWalletTransaction,
  applyTopUp,
  applyWithdraw,
  GameWalletTxParams,
  changeAccountPassword,
  claimDailyCheckIn,
  closeTradePosition,
  consumePendingTransferForUser,
  createOwnerPredictionMarket,
  executeTradeOrder,
  formatCurrency,
  formatExactDateTime,
  generateReferralCode,
  getEffectivePlatformSettings,
  getEffectiveReferralConfig,
  hasVerifiedDeposit,
  isOwnerAdmin,
  placePredictionBet,
  redeemGiftCode,
  sellUsdtToInr,
  settleExpiredPositions,
  settlePredictionMarketByOutcome,
  tickFxRates,
  tickMarketPrices,
  transferWalletByProfileId,
  validateAndResolveReferralCode,
} from './utils/tradingEngine';
import { getAssetUrl } from './utils/assetPath';

const STORAGE_KEY = 'ouroboros_app_state_v1';
const NOTIF_STORAGE_KEY = 'ouroboros_notifications_v1';

function loadInitialState(): AppState {
  const autoStart =
    typeof window !== 'undefined' &&
    window.location.search.includes('autostart=1');

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        ...INITIAL_APP_STATE,
        isAuthenticated: autoStart
          ? true
          : INITIAL_APP_STATE.isAuthenticated ?? false,
      };
    }
    const parsed = JSON.parse(raw) as Partial<AppState>;
    if (typeof parsed.balance !== 'number' || !Array.isArray(parsed.assets)) {
      return {
        ...INITIAL_APP_STATE,
        isAuthenticated: autoStart
          ? true
          : INITIAL_APP_STATE.isAuthenticated ?? false,
      };
    }
    const parsedAccounts = Array.isArray(parsed.registeredAccounts)
      ? parsed.registeredAccounts.filter(
          (a) => a.email.trim().toLowerCase() !== 'aarav@ouroboros.trade'
        )
      : [];
    const storedEmail = parsed.profile?.email?.trim().toLowerCase();
    const matchedStoredAcc = storedEmail
      ? parsedAccounts.find((a) => a.email.trim().toLowerCase() === storedEmail)
      : undefined;
    const wasDemoSession =
      storedEmail === 'aarav@ouroboros.trade' && !matchedStoredAcc;
    const wasRestricted = Boolean(
      matchedStoredAcc &&
        !isOwnerAdmin(matchedStoredAcc.email) &&
        (matchedStoredAcc.frozen || matchedStoredAcc.banned)
    );

    const hydratedSupportTickets: SupportTicket[] = Array.isArray(parsed.supportTickets)
      ? parsed.supportTickets
      : INITIAL_APP_STATE.supportTickets ?? [];

    const hydratedPlatformTickets: SupportTicket[] = Array.isArray(
      parsed.platformTickets
    )
      ? parsed.platformTickets
      : (() => {
          const map = new Map<string, SupportTicket>();
          for (const t of hydratedSupportTickets) {
            map.set(t.id, t);
          }
          for (const acc of parsedAccounts) {
            for (const t of acc.supportTickets ?? []) {
              if (!map.has(t.id)) {
                map.set(t.id, { ...t, userEmail: t.userEmail ?? acc.email, uid: t.uid ?? acc.uid });
              }
            }
          }
          return Array.from(map.values());
        })();

    const normalizedAccounts: RegisteredAccount[] = [];
    const seenRefCodes: string[] = [];
    for (const acc of parsedAccounts) {
      const code =
        acc.referralCode?.trim().toUpperCase() ||
        generateReferralCode(acc.email || acc.name, seenRefCodes);
      seenRefCodes.push(code);
      normalizedAccounts.push({
        ...acc,
        referralCode: code,
      });
    }
    const matchedNormalizedAcc = storedEmail
      ? normalizedAccounts.find((a) => a.email.trim().toLowerCase() === storedEmail)
      : undefined;

    const parsedAssets = Array.isArray(parsed.assets) ? parsed.assets : [];
    const hydratedAssets = INITIAL_ASSETS.map((seedAsset) => {
      const saved = parsedAssets.find((a) => a.id === seedAsset.id);
      return saved
        ? {
            ...saved,
            brandColor: seedAsset.brandColor,
            brandText: seedAsset.brandText,
            brandGlyph: seedAsset.brandGlyph,
            logoUrl: seedAsset.logoUrl,
            fallbackLogoUrl: seedAsset.fallbackLogoUrl,
            logoBg: seedAsset.logoBg,
          }
        : seedAsset;
    });
    for (const extra of parsedAssets) {
      if (!hydratedAssets.some((a) => a.id === extra.id)) {
        hydratedAssets.push(extra);
      }
    }

    return {
      ...INITIAL_APP_STATE,
      ...parsed,
      assets: hydratedAssets,
      withdrawableBalance:
        typeof parsed.withdrawableBalance === 'number'
          ? Math.min(parsed.balance, Math.max(0, parsed.withdrawableBalance))
          : Math.min(parsed.balance, INITIAL_APP_STATE.withdrawableBalance),
      isAuthenticated: autoStart
        ? true
        : wasDemoSession || wasRestricted
        ? false
        : parsed.isAuthenticated ?? INITIAL_APP_STATE.isAuthenticated ?? false,
      registeredAccounts: normalizedAccounts,
      profile: {
        ...INITIAL_APP_STATE.profile,
        ...(parsed.profile ?? {}),
        referralCode:
          parsed.profile?.referralCode ||
          matchedNormalizedAcc?.referralCode ||
          (parsed.profile?.email
            ? generateReferralCode(parsed.profile.email, seenRefCodes)
            : undefined),
        referredByCode:
          parsed.profile?.referredByCode ?? matchedNormalizedAcc?.referredByCode,
        language:
          parsed.profile?.language ?? INITIAL_APP_STATE.profile.language ?? 'en',
      },
      themeMode: parsed.themeMode ?? INITIAL_APP_STATE.themeMode ?? 'dark',
      fxRates: parsed.fxRates
        ? { ...DEFAULT_FX_RATES, ...parsed.fxRates, INR: 1 }
        : INITIAL_APP_STATE.fxRates,
      fxUpdatedAt: parsed.fxUpdatedAt ?? INITIAL_APP_STATE.fxUpdatedAt,
      fxSource: parsed.fxSource ?? INITIAL_APP_STATE.fxSource ?? 'market-tick',
      communityMessages: Array.isArray(parsed.communityMessages)
        ? parsed.communityMessages
        : INITIAL_COMMUNITY_MESSAGES,
      communityChatUsage:
        parsed.communityChatUsage ?? INITIAL_APP_STATE.communityChatUsage,
      supportTickets: hydratedSupportTickets,
      platformTickets: hydratedPlatformTickets,
      merchantUpiPool:
        Array.isArray(parsed.merchantUpiPool) && parsed.merchantUpiPool.length > 0
          ? parsed.merchantUpiPool
          : DEFAULT_MERCHANT_UPIS,
      platformSettings: {
        ...DEFAULT_PLATFORM_SETTINGS,
        ...(parsed.platformSettings ?? {}),
      },
      pendingTransferAnimations: Array.isArray(parsed.pendingTransferAnimations)
        ? parsed.pendingTransferAnimations
        : [],
      upiAccounts: Array.isArray(parsed.upiAccounts)
        ? parsed.upiAccounts
        : INITIAL_APP_STATE.upiAccounts,
      referralConfig: {
        ...DEFAULT_REFERRAL_CONFIG,
        ...(parsed.referralConfig ?? {}),
      },
      customGiftCodes: Array.isArray(parsed.customGiftCodes)
        ? parsed.customGiftCodes
        : [],
      ownerFeeRevenue:
        typeof parsed.ownerFeeRevenue === 'number' ? parsed.ownerFeeRevenue : 0,
      commissionLedger: Array.isArray(parsed.commissionLedger)
        ? parsed.commissionLedger
        : [],
      platformTransactions: Array.isArray(parsed.platformTransactions)
        ? parsed.platformTransactions
        : [],
      platformBroadcasts: Array.isArray(parsed.platformBroadcasts)
        ? parsed.platformBroadcasts
        : [],
      platformPositions: Array.isArray(parsed.platformPositions)
        ? parsed.platformPositions
        : [],
    };
  } catch {
    return {
      ...INITIAL_APP_STATE,
      isAuthenticated: autoStart
        ? true
        : INITIAL_APP_STATE.isAuthenticated ?? false,
    };
  }
}

function loadInitialNotifications(): AppNotification[] {
  try {
    const raw = localStorage.getItem(NOTIF_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AppNotification[];
    return Array.isArray(parsed)
      ? parsed.filter((n) => !String(n.id).startsWith('notif-seed-'))
      : [];
  } catch {
    return [];
  }
}

export default function App() {
  const [state, setState] = useState<AppState>(() => loadInitialState());
  const [notifications, setNotifications] = useState<AppNotification[]>(() =>
    loadInitialNotifications()
  );
  const [notifOpen, setNotifOpen] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [hasUnreadNews, setHasUnreadNews] = useState(true);
  const [activeNav, setActiveNav] = useState<NavSection>('markets');
  const activeNavRef = React.useRef<NavSection>(activeNav);
  activeNavRef.current = activeNav;
  const [terminalAssetId, setTerminalAssetId] = useState<string | null>(null);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [gamesReturnNav, setGamesReturnNav] = useState<'markets' | 'games'>('markets');
  const [tradeModalState, setTradeModalState] = useState<{
    asset: MarketAsset;
    side: TradeSide;
  } | null>(null);
  const [predictionModalState, setPredictionModalState] = useState<{
    market: PredictionMarket;
    choice: 'yes' | 'no';
  } | null>(null);
  const [walletModalMode, setWalletModalMode] = useState<WalletModalMode>(null);
  const [scannerModalTab, setScannerModalTab] =
    useState<WalletScannerTab | null>(null);
  const [supportPreselectedTxId, setSupportPreselectedTxId] = useState<
    string | null
  >(null);
  const [activeTransfer, setActiveTransfer] =
    useState<PaymentTransferPayload | null>(null);
  const [latestSettledBanner, setLatestSettledBanner] =
    useState<SettledPositionSummary | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [toast, setToast] = useState<{
    text: string;
    tone: 'success' | 'error' | 'info';
  } | null>(null);

  const showToast = (
    text: string,
    tone: 'success' | 'error' | 'info' = 'info'
  ) => {
    setToast({ text, tone });
  };

  const requireAuth = (
    message = 'Please sign in or create an account to continue.'
  ): boolean => {
    if (state.isAuthenticated) return true;
    setShowAuthModal(true);
    showToast(message, 'info');
    return false;
  };

  const openScanner = (tab: WalletScannerTab = 'scan') => {
    if (!requireAuth('Sign in to scan QR codes and send wallet money.')) {
      return;
    }
    setScannerModalTab(tab);
  };

  const openNewsFeed = () => {
    setHasUnreadNews(false);
    setActiveNav('feed');
  };

  const pushNotification = (
    template: NotificationTemplateKey,
    overrides?: Partial<Pick<AppNotification, 'title' | 'msg' | 'route'>>,
    withSound = true
  ) => {
    const item = createNotificationFromTemplate(template, overrides);
    setNotifications((prev) => [item, ...prev]);
    if (withSound) {
      playNotificationSound(item.sound);
    }
  };

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [activeNav, state.isAuthenticated]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(id);
  }, [toast]);

  // Auto-dismiss result announcement banner after 12s unless clicked earlier
  useEffect(() => {
    if (!latestSettledBanner) return;
    const id = window.setTimeout(() => setLatestSettledBanner(null), 12000);
    return () => window.clearTimeout(id);
  }, [latestSettledBanner]);

  // Sync themeMode with <html data-theme="..."> & dark/light CSS class across the entire app
  const themeMode: ThemeMode = state.themeMode ?? 'dark';
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', themeMode);
    root.classList.toggle('dark', themeMode === 'dark');
    root.classList.toggle('light', themeMode === 'light');
  }, [themeMode]);

  const refreshLiveFxRates = async (notifyOnDone = false) => {
    const res = await fetchLiveFxRates();
    setState((prev) => ({
      ...prev,
      fxRates: res.rates,
      fxUpdatedAt: res.updatedAt,
      fxSource: res.source,
    }));
    if (notifyOnDone) {
      showToast(
        res.source === 'live'
          ? `Live FX rates synced (${res.updatedAt})`
          : `FX market feed updated (${res.updatedAt})`,
        'success'
      );
    }
  };

  // Fetch real live FX rates on mount + refresh every 60s
  useEffect(() => {
    void refreshLiveFxRates(false);
    const fxFetchTimer = window.setInterval(() => {
      void refreshLiveFxRates(false);
    }, 60000);
    return () => window.clearInterval(fxFetchTimer);
  }, []);

  // Persist app state & notifications to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage quota errors
    }
  }, [state]);

  useEffect(() => {
    try {
      localStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(notifications));
    } catch {
      // Ignore storage quota errors
    }
  }, [notifications]);

  // Multi-tab storage sync so Owner approvals or freezes propagate live
  useEffect(() => {
    const handleStorageSync = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
      try {
        const external = JSON.parse(e.newValue) as Partial<AppState>;
        setState((prev) => ({
          ...prev,
          registeredAccounts: Array.isArray(external.registeredAccounts)
            ? external.registeredAccounts
            : prev.registeredAccounts,
          platformTransactions: Array.isArray(external.platformTransactions)
            ? external.platformTransactions
            : prev.platformTransactions,
          platformTickets: Array.isArray(external.platformTickets)
            ? external.platformTickets
            : prev.platformTickets,
          platformBroadcasts: Array.isArray(external.platformBroadcasts)
            ? external.platformBroadcasts
            : prev.platformBroadcasts,
          merchantUpiPool: Array.isArray(external.merchantUpiPool)
            ? external.merchantUpiPool
            : prev.merchantUpiPool,
          platformSettings: external.platformSettings ?? prev.platformSettings,
          pendingTransferAnimations: Array.isArray(external.pendingTransferAnimations)
            ? external.pendingTransferAnimations
            : prev.pendingTransferAnimations,
          platformPositions: Array.isArray(external.platformPositions)
            ? external.platformPositions
            : prev.platformPositions,
          ownerFeeRevenue:
            typeof external.ownerFeeRevenue === 'number'
              ? external.ownerFeeRevenue
              : prev.ownerFeeRevenue,
          commissionLedger: Array.isArray(external.commissionLedger)
            ? external.commissionLedger
            : prev.commissionLedger,
          referralConfig: external.referralConfig ?? prev.referralConfig,
        }));
      } catch {
        // Ignore malformed external updates
      }
    };
    window.addEventListener('storage', handleStorageSync);
    return () => window.removeEventListener('storage', handleStorageSync);
  }, []);

  // Trigger PaymentTransferAnimation ONLY when Owner approves a deposit or withdrawal for this user
  useEffect(() => {
    if (!state.isAuthenticated || activeTransfer) return;
    const queue = state.pendingTransferAnimations ?? [];
    if (queue.length === 0) return;

    const { transfer, nextState } = consumePendingTransferForUser(
      state,
      state.profile.email
    );
    if (!transfer) return;

    setState(nextState);
    setActiveTransfer({
      direction: transfer.direction,
      amountInr: transfer.amountInr,
      channelLabel: transfer.channelLabel,
    });
    if (transfer.direction === 'deposit') {
      pushNotification('deposit_ok', {
        title: 'Deposit Verified & Credited',
        msg: `₹${transfer.amountInr.toFixed(2)} via ${transfer.channelLabel} verified by Owner and credited to your wallet.`,
        route: 'wallet',
      });
    } else {
      pushNotification('withdraw_ok', {
        title: 'Withdrawal Completed',
        msg: `₹${transfer.amountInr.toFixed(2)} payout to ${transfer.channelLabel} confirmed and sent.`,
        route: 'portfolio',
      });
    }
  }, [state, activeTransfer]);

  // Enforce active-session lock if current non-owner user gets frozen or banned
  useEffect(() => {
    if (!state.isAuthenticated) return;
    const cleanEmail = state.profile.email.trim().toLowerCase();
    if (!cleanEmail || isOwnerAdmin(cleanEmail)) return;
    const currentAcc = (state.registeredAccounts ?? []).find(
      (a) => a.email.trim().toLowerCase() === cleanEmail
    );
    if (currentAcc && (currentAcc.banned || currentAcc.frozen)) {
      const msg = currentAcc.banned
        ? `Account banned${currentAcc.banReason ? `: ${currentAcc.banReason}` : ''}`
        : `Account frozen${currentAcc.freezeReason ? `: ${currentAcc.freezeReason}` : ''}`;
      setState((prev) => ({ ...prev, isAuthenticated: false }));
      showToast(msg, 'error');
    }
  }, [state.isAuthenticated, state.profile.email, state.registeredAccounts]);

  // Live price updates every 4s, live FX micro-updates, and 1s countdown clock
  useEffect(() => {
    let step = 1;
    const priceTimer = window.setInterval(() => {
      step += 1;
      const nowLabel = new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      setState((prev) => ({
        ...prev,
        assets: tickMarketPrices(prev.assets, step),
        fxRates:
          prev.fxSource === 'live'
            ? prev.fxRates
            : tickFxRates(prev.fxRates ?? DEFAULT_FX_RATES, step),
        fxUpdatedAt: prev.fxSource === 'live' ? prev.fxUpdatedAt : nowLabel,
      }));
    }, 4000);

    const countdownTimer = window.setInterval(() => {
      setNowMs(Date.now());
      setState((prev) => ({
        ...prev,
        predictions: prev.predictions.map((p) => ({
          ...p,
          endsInSeconds: p.endsInSeconds > 0 ? p.endsInSeconds - 1 : 0,
        })),
      }));
    }, 1000);

    let newsTick = 0;
    const autoNewsTimer = window.setInterval(() => {
      newsTick += 1;
      setState((prev) => {
        const nextItem = generateAutoNewsItem(
          prev.assets,
          prev.predictions,
          newsTick
        );
        return {
          ...prev,
          news: [nextItem, ...prev.news].slice(0, 24),
        };
      });
    }, 18000);

    const liveChatTimer = window.setInterval(() => {
      setState((prev) => {
        const existing = prev.communityMessages ?? [];
        const nextMsg = generateLiveCommunityMessage(
          prev.assets,
          prev.predictions,
          existing
        );
        return {
          ...prev,
          communityMessages: [...existing, nextMsg].slice(-45),
        };
      });
      if (activeNavRef.current !== 'feed') {
        setHasUnreadNews(true);
      }
    }, 6500);

    return () => {
      window.clearInterval(priceTimer);
      window.clearInterval(countdownTimer);
      window.clearInterval(autoNewsTimer);
      window.clearInterval(liveChatTimer);
    };
  }, []);

  // Auto-settle expired timed positions when countdown reaches 00:00 & announce result
  useEffect(() => {
    const activePool = state.platformPositions ?? state.positions;
    const hasExpired = activePool.some(
      (p) =>
        p.status === 'open' &&
        typeof p.expiresAtMs === 'number' &&
        p.expiresAtMs > 0 &&
        nowMs >= p.expiresAtMs
    );
    if (!hasExpired) return;
    const { nextState, settled } = settleExpiredPositions(state, nowMs);
    if (settled.length > 0) {
      setState(nextState);
      const latest = settled[0];
      setLatestSettledBanner(latest);
      const isRefunded = latest.p2pStatus === 'Cancelled/Refunded';
      pushNotification(latest.won || isRefunded ? 'trade_win' : 'refund', {
        title: isRefunded
          ? `Trade Refunded · ${latest.symbol}`
          : latest.won
          ? `Trade Won · ${latest.symbol}`
          : `Trade Settled · ${latest.symbol}`,
        msg:
          latest.outcomeNote ||
          `${latest.symbol} ${latest.side === 'long' ? 'UP' : 'DOWN'} closed @ ₹${latest.exitPrice.toFixed(2)} (${
            latest.pnl >= 0 ? '+' : ''
          }₹${latest.pnl.toFixed(2)}).`,
        route: 'portfolio',
      });
      showToast(
        isRefunded
          ? `${latest.symbol} cancelled & refunded (₹${latest.payout.toFixed(2)})`
          : `${latest.symbol} settled: ${latest.pnl >= 0 ? '+' : ''}₹${latest.pnl.toFixed(2)}`,
        latest.won || isRefunded ? 'success' : 'info'
      );
    } else {
      // Persist any background counterpart auto-settlements
      setState(nextState);
    }
  }, [nowMs, state]);

  // Deliver unseen Owner Broadcast notifications to the currently authenticated user
  useEffect(() => {
    if (!state.isAuthenticated) return;
    const cleanEmail = state.profile.email.trim().toLowerCase();
    if (!cleanEmail) return;
    const broadcasts = state.platformBroadcasts ?? [];
    if (broadcasts.length === 0) return;

    const accounts = state.registeredAccounts ?? [];
    const currentAcc = accounts.find(
      (a) => a.email.trim().toLowerCase() === cleanEmail
    );
    const seen = new Set(currentAcc?.seenBroadcastIds ?? []);
    const unseen = broadcasts.filter(
      (b) =>
        !seen.has(b.id) &&
        (b.targetEmail === 'ALL' ||
          b.targetEmail.trim().toLowerCase() === cleanEmail)
    );
    if (unseen.length === 0) return;

    const categoryMap: Record<
      BroadcastCategory,
      { tpl: NotificationTemplateKey; route: AppNotification['route'] }
    > = {
      promo: { tpl: 'deposit_ok', route: 'wallet' },
      wallet: { tpl: 'deposit_ok', route: 'wallet' },
      market: { tpl: 'news', route: 'trade' },
      gift: { tpl: 'deposit_ok', route: 'wallet' },
      system: { tpl: 'system', route: 'system' },
    };

    const newNotifs: AppNotification[] = unseen.map((b) => {
      const mapping = categoryMap[b.category] ?? categoryMap.system;
      const base = createNotificationFromTemplate(
        mapping.tpl,
        {
          title: b.title,
          msg: b.msg,
          route: mapping.route,
        },
        b.createdAtMs
      );
      return { ...base, id: `notif-bcast-${b.id}` };
    });

    setNotifications((prev) => {
      const existingIds = new Set(prev.map((n) => n.id));
      const uniqueAdd = newNotifs.filter((n) => !existingIds.has(n.id));
      return uniqueAdd.length > 0 ? [...uniqueAdd, ...prev] : prev;
    });

    const newSeenIds = unseen.map((b) => b.id);
    setState((prev) => ({
      ...prev,
      registeredAccounts: (prev.registeredAccounts ?? []).map((acc) =>
        acc.email.trim().toLowerCase() === cleanEmail
          ? {
              ...acc,
              seenBroadcastIds: Array.from(
                new Set([...(acc.seenBroadcastIds ?? []), ...newSeenIds])
              ),
            }
          : acc
      ),
    }));
  }, [
    state.isAuthenticated,
    state.profile.email,
    state.platformBroadcasts,
    state.registeredAccounts,
  ]);

  const syncSnapshotToAccounts = (srcState: AppState): RegisteredAccount[] => {
    const cleanCurr = srcState.profile.email.trim().toLowerCase();
    return (srcState.registeredAccounts ?? []).map((acc) =>
      acc.email.trim().toLowerCase() === cleanCurr
        ? {
            ...acc,
            name: srcState.profile.name,
            phone: srcState.profile.phone,
            balance: srcState.balance,
            withdrawableBalance: srcState.withdrawableBalance,
            usdtHoldings: srcState.usdtHoldings,
            todayReceived: srcState.todayReceived,
            realizedPnl: srcState.realizedPnl,
            positions: srcState.positions,
            bets: srcState.bets,
            transactions: srcState.transactions,
            bankAccounts: srcState.bankAccounts,
            upiAccounts: srcState.upiAccounts ?? [],
            supportTickets: srcState.supportTickets ?? [],
            redeemedGifts: srcState.redeemedGifts,
          }
        : acc
    );
  };

  // ===== Auth Handlers =====
  const handleLogin = (params: {
    email: string;
    password: string;
    mobileNumber?: string;
  }) => {
    const cleanEmail = params.email.trim().toLowerCase();
    const accounts = state.registeredAccounts ?? [];
    const found = accounts.find(
      (a) => a.email.trim().toLowerCase() === cleanEmail
    );
    if (!found) {
      return {
        ok: false,
        error: 'Account not found for this email. Please create an account.',
      };
    }
    if (found.password !== params.password) {
      return {
        ok: false,
        error: 'Incorrect password. Please try again.',
      };
    }
    if (found.banned) {
      return {
        ok: false,
        error: `Account is banned${
          found.banReason ? `: ${found.banReason}` : '. Contact Support Helpline.'
        }`,
      };
    }
    if (found.frozen) {
      return {
        ok: false,
        error: `Account is frozen${
          found.freezeReason ? `: ${found.freezeReason}` : '. Contact Support Helpline.'
        }`,
      };
    }

    const switchingUser =
      state.profile.email.trim().toLowerCase() !== cleanEmail;
    if (switchingUser) {
      setNotifications([]);
    }

    setState((prev) => {
      const synced = syncSnapshotToAccounts(prev);
      const target =
        synced.find((a) => a.email.trim().toLowerCase() === cleanEmail) ?? found;
      const hydratedBalance =
        typeof target.balance === 'number' ? target.balance : 0;
      const hydratedWithdrawable =
        typeof target.withdrawableBalance === 'number'
          ? Math.min(hydratedBalance, Math.max(0, target.withdrawableBalance))
          : 0;

      return {
        ...prev,
        isAuthenticated: true,
        balance: hydratedBalance,
        withdrawableBalance: hydratedWithdrawable,
        usdtHoldings:
          typeof target.usdtHoldings === 'number' ? target.usdtHoldings : 0,
        todayReceived:
          typeof target.todayReceived === 'number' ? target.todayReceived : 0,
        realizedPnl:
          typeof target.realizedPnl === 'number' ? target.realizedPnl : 0,
        positions: Array.isArray(target.positions) ? target.positions : [],
        bets: Array.isArray(target.bets) ? target.bets : [],
        transactions: Array.isArray(target.transactions)
          ? target.transactions
          : [],
        bankAccounts: Array.isArray(target.bankAccounts)
          ? target.bankAccounts
          : [],
        upiAccounts: Array.isArray(target.upiAccounts) ? target.upiAccounts : [],
        supportTickets: Array.isArray(target.supportTickets)
          ? target.supportTickets
          : [],
        redeemedGifts: Array.isArray(target.redeemedGifts)
          ? target.redeemedGifts
          : [],
        registeredAccounts: synced,
        profile: {
          ...prev.profile,
          name: target.name,
          email: target.email,
          uid: target.uid,
          phone: params.mobileNumber?.trim() || target.phone || prev.profile.phone,
          referralCode: target.referralCode,
          referredByCode: target.referredByCode,
        },
      };
    });
    setShowAuthModal(false);
    if (activeNav === 'admin' && !isOwnerAdmin(cleanEmail)) {
      setActiveNav('markets');
    }
    showToast(`Welcome back, ${found.name}`, 'success');
    return { ok: true };
  };

  const handleSignup = (params: {
    name: string;
    email: string;
    password: string;
    mobileNumber?: string;
    referralCode?: string;
  }) => {
    const settings = getEffectivePlatformSettings(state);
    if (settings.signupsPaused) {
      return {
        ok: false,
        error:
          settings.maintenanceNotice.trim() ||
          'New registrations are temporarily paused by Owner Desk.',
      };
    }
    const cleanEmail = params.email.trim().toLowerCase();
    const accounts = state.registeredAccounts ?? [];
    if (accounts.some((a) => a.email.trim().toLowerCase() === cleanEmail)) {
      return {
        ok: false,
        error: 'An account with this email already exists. Please Sign In.',
      };
    }

    const refCheck = validateAndResolveReferralCode(
      accounts,
      params.referralCode,
      cleanEmail
    );
    if (!refCheck.ok) {
      return {
        ok: false,
        error: refCheck.error,
      };
    }

    const cleanName = params.name.trim();
    const uid = `UID-${Math.floor(1000 + Math.random() * 8999)}-${
      cleanName
        .replace(/[^a-zA-Z]/g, '')
        .slice(0, 5)
        .toUpperCase() || 'TRD'
    }`;
    const cleanPhone = params.mobileNumber?.trim() || undefined;
    const stamp = formatExactDateTime();
    const assignedReferralCode = generateReferralCode(
      cleanEmail || cleanName,
      accounts.map((a) => a.referralCode)
    );

    const newAcc: RegisteredAccount = {
      email: cleanEmail,
      password: params.password,
      name: cleanName,
      uid,
      phone: cleanPhone,
      balance: 0,
      withdrawableBalance: 0,
      usdtHoldings: 0,
      todayReceived: 0,
      realizedPnl: 0,
      totalDepositedInr: 0,
      totalWithdrawnInr: 0,
      positions: [],
      bets: [],
      transactions: [],
      bankAccounts: [],
      upiAccounts: [],
      supportTickets: [],
      redeemedGifts: [],
      seenBroadcastIds: [],
      referralCode: assignedReferralCode,
      referredByCode: refCheck.normalizedCode,
      referralRewardSettled: false,
      rewardedReferralsCount: 0,
      referralEarnedInr: 0,
      createdAt: stamp,
    };

    setNotifications([]);
    setState((prev) => {
      const syncedPrev = syncSnapshotToAccounts(prev);

      return {
        ...prev,
        isAuthenticated: true,
        balance: 0,
        withdrawableBalance: 0,
        usdtHoldings: 0,
        todayReceived: 0,
        realizedPnl: 0,
        positions: [],
        bets: [],
        transactions: [],
        bankAccounts: [],
        upiAccounts: [],
        supportTickets: [],
        redeemedGifts: [],
        registeredAccounts: [newAcc, ...syncedPrev],
        profile: {
          ...prev.profile,
          name: cleanName,
          email: cleanEmail,
          uid,
          phone: cleanPhone,
          referralCode: assignedReferralCode,
          referredByCode: refCheck.normalizedCode,
        },
      };
    });

    setShowAuthModal(false);
    if (activeNav === 'admin') {
      setActiveNav('markets');
    }
    showToast(
      refCheck.normalizedCode
        ? `Account created! Place your 1st bet to unlock your referral bonus`
        : `Account created for ${cleanName} (₹0.00 ready)`,
      'success'
    );
    return { ok: true };
  };

  const handleClaimDailyCheckIn = () => {
    if (!requireAuth('Please sign in to claim your daily check-in reward.')) {
      return;
    }
    const res = claimDailyCheckIn(state);
    if (!res.ok) {
      if (res.reason === 'deposit_required') {
        showToast(res.error, 'info');
        setWalletModalMode('topup');
      } else {
        showToast(res.error, 'info');
      }
      return;
    }
    setState(res.nextState);
    pushNotification('deposit_ok', {
      title: `Day ${res.streak} Check-In Claimed`,
      msg: `₹${res.rewardInr.toFixed(2)} daily bonus credited to your play wallet.`,
      route: 'wallet',
    });
    showToast(
      `Day ${res.streak} Check-In: +₹${res.rewardInr.toFixed(2)} credited!`,
      'success'
    );
  };

  const handleChangePassword = (params: {
    currentPassword: string;
    newPassword: string;
  }): { ok: boolean; error?: string } => {
    const res = changeAccountPassword(state, params);
    if (!res.ok) {
      return { ok: false, error: res.error };
    }
    setState(res.nextState);
    showToast('Account password updated successfully', 'success');
    return { ok: true };
  };

  const handleLogout = () => {
    setState((prev) => ({
      ...prev,
      isAuthenticated: false,
      registeredAccounts: syncSnapshotToAccounts(prev),
    }));
    setActiveNav('markets');
    showToast('Logged out of Ouroboros', 'info');
  };

  // ===== Trading & Wallet Handlers =====
  const handleConfirmTrade = (params: {
    assetId: string;
    side: TradeSide;
    horizon: TimeHorizon;
    stake: number;
  }) => {
    const result = executeTradeOrder(state, params);
    if (!result.ok) {
      showToast(result.error, 'error');
      return;
    }
    setState(result.nextState);
    setTradeModalState(null);
    const dirLabel = params.side === 'long' ? 'UP' : 'DOWN';
    const matchTag =
      result.position.p2pStatus === 'Matched'
        ? result.position.matchKind === 'same_side'
          ? 'Matched · Same-Side'
          : 'Matched · Opposite'
        : 'Pending Peer Match';
    const msg = `${result.position.symbol} ${dirLabel} (${params.horizon}) @ ₹${result.position.entryPrice.toFixed(
      2
    )} · ${matchTag}.`;
    pushNotification('trade_ok', { msg, route: 'portfolio' });
    showToast(
      `${result.position.symbol} ${dirLabel} (${params.horizon}) · ${matchTag}`,
      'success'
    );
  };

  const handleClosePosition = (positionId: string) => {
    const target = state.positions.find((p) => p.id === positionId);
    const result = closeTradePosition(state, positionId);
    if (!result.ok) {
      showToast(result.error, 'error');
      return;
    }
    setState(result.nextState);
    const isRefunded = result.p2pStatus === 'Cancelled/Refunded';
    if (target) {
      const asset = state.assets.find((a) => a.id === target.assetId);
      setLatestSettledBanner({
        id: target.id,
        symbol: target.symbol,
        side: target.side,
        stake: target.stake,
        entryPrice: target.entryPrice,
        exitPrice: asset ? asset.price : target.entryPrice,
        pnl: result.pnl,
        payout: result.payout,
        won: !isRefunded && result.pnl > 0,
        settledAt: formatExactDateTime(),
        p2pStatus: result.p2pStatus,
        matchKind: target.matchKind,
        outcomeNote: result.outcomeNote,
      });
    }
    pushNotification(result.pnl >= 0 ? 'trade_win' : 'refund', {
      title: isRefunded
        ? 'Trade Cancelled & Refunded'
        : result.pnl > 0
        ? 'Trade Won'
        : 'Position Settled',
      msg:
        result.outcomeNote ||
        `Settled with ${result.pnl >= 0 ? '+' : ''}₹${result.pnl.toFixed(2)} P&L.`,
      route: 'portfolio',
    });
    showToast(
      isRefunded
        ? `Trade cancelled & refunded: ₹${result.payout.toFixed(2)}`
        : `Position settled: ${result.pnl >= 0 ? '+' : ''}₹${result.pnl.toFixed(2)}`,
      result.pnl >= 0 ? 'success' : 'info'
    );
  };

  const handleConfirmPrediction = (params: {
    marketId: string;
    choice: 'yes' | 'no';
    stake: number;
  }) => {
    const result = placePredictionBet(state, params);
    if (!result.ok) {
      showToast(result.error, 'error');
      return;
    }
    setState(result.nextState);
    setPredictionModalState(null);
    pushNotification('bet_ok', {
      msg: `${params.choice.toUpperCase()} bet of ₹${params.stake} placed.`,
      route: 'portfolio',
    });
    showToast(
      `${params.choice.toUpperCase()} bet placed (₹${params.stake})`,
      params.choice === 'yes' ? 'success' : 'info'
    );
  };

  const handleCreatePredictionMarket = (draft: OwnerPredictionDraft) => {
    if (!ownerAuthorized) return;
    const res = createOwnerPredictionMarket(state, state.profile.email, draft);
    if (!res.ok) {
      showToast(res.error, 'error');
      return;
    }
    setState(res.nextState);
    showToast(`Published live bet: ${res.market.question.slice(0, 40)}...`, 'success');
  };

  const handleResolvePredictionMarket = (params: {
    marketId: string;
    outcome: 'yes' | 'no';
    summary: string;
    sources?: Array<{ title: string; uri: string }>;
  }) => {
    if (!ownerAuthorized) return;
    const res = settlePredictionMarketByOutcome(state, {
      ownerEmail: state.profile.email,
      marketId: params.marketId,
      outcome: params.outcome,
      summary: params.summary,
      sources: params.sources,
    });
    if (!res.ok) {
      showToast(res.error, 'error');
      return;
    }
    setState(res.nextState);
    showToast(
      `Settled ${params.outcome.toUpperCase()}: ${res.winnersCount}/${res.settledCount} won · Payout ₹${res.totalPayoutInr} · Fee ₹${res.totalCommissionInr}`,
      'success'
    );
  };

  const handleRedeemCode = (code: string) => {
    const result = redeemGiftCode(state, code);
    if (!result.ok) {
      return { ok: false, error: result.error };
    }
    setState(result.nextState);
    pushNotification('deposit_ok', {
      title: 'Gift Redeemed',
      msg: `Code ${result.code} added ₹${result.amount.toFixed(
        2
      )} to your wallet.`,
      route: 'wallet',
    });
    showToast(`Redeemed ${result.code} (+₹${result.amount})`, 'success');
    return { ok: true, amount: result.amount };
  };

  const handleTopUp = (
    amount: number,
    method: string,
    utr?: string
  ) => {
    const res = applyTopUp(state, amount, method, utr);
    if (!res.ok) return { ok: false, error: res.error };
    setState(res.nextState);
    pushNotification('deposit_pending', {
      title: 'Deposit Under Review',
      msg: `₹${amount.toFixed(2)} via ${method} submitted${
        utr ? ` (UTR ${utr})` : ''
      }. Balance credits once Owner verifies UTR.`,
      route: 'portfolio',
    });
    showToast(
      `Deposit ₹${amount.toFixed(2)} submitted for Owner UTR check`,
      'success'
    );
    return { ok: true };
  };

  const handleWithdraw = (amount: number, destinationId: string) => {
    const res = applyWithdraw(state, amount, destinationId);
    if (!res.ok) return { ok: false, error: res.error };
    setState(res.nextState);
    pushNotification('system', {
      title: 'Withdrawal In Process',
      msg: `₹${amount.toFixed(2)} withdrawal to ${res.channelLabel} is In Process for Owner payout approval.`,
      route: 'portfolio',
    });
    showToast(
      `Withdrawal of ₹${amount.toFixed(2)} submitted for Owner review`,
      'success'
    );
    return { ok: true };
  };

  const handleWalletTransfer = (params: {
    recipientUid: string;
    amountInr: number;
    note?: string;
    via: 'qr' | 'id';
  }) => {
    const res = transferWalletByProfileId(state, params);
    if (!res.ok) {
      return { ok: false, error: res.error };
    }
    setState(res.nextState);
    pushNotification('system', {
      title: 'Wallet Transfer Sent',
      msg: `Sent ₹${res.amountInr.toFixed(2)} to ${res.recipient.name} (${res.recipient.uid}).`,
      route: 'portfolio',
    });
    showToast(
      `Sent ₹${res.amountInr.toFixed(2)} to ${res.recipient.name}`,
      'success'
    );
    return {
      ok: true,
      recipient: res.recipient,
      amountInr: res.amountInr,
      txId: res.txId,
    };
  };

  const handleBindBank = (bank: Omit<BankAccount, 'id'>) => {
    setState((prev) => ({
      ...prev,
      bankAccounts: [
        {
          id: `bank-${Date.now()}`,
          ...bank,
        },
        ...prev.bankAccounts,
      ],
    }));
    pushNotification('system', {
      title: 'Bank Bound',
      msg: `${bank.bankName} ••••${bank.accountLast4} linked for withdrawals.`,
      route: 'wallet',
    });
    showToast(`Bound ${bank.bankName} ••••${bank.accountLast4}`, 'success');
  };

  const handleBindUpi = (upi: Omit<UpiAccount, 'id'>) => {
    setState((prev) => ({
      ...prev,
      upiAccounts: [
        {
          id: `upi-${Date.now()}`,
          ...upi,
        },
        ...(prev.upiAccounts ?? []),
      ],
    }));
    pushNotification('system', {
      title: 'UPI ID Bound',
      msg: `${upi.appName} (${upi.upiId}) linked for instant withdrawals.`,
      route: 'wallet',
    });
    showToast(`Bound ${upi.upiId} (${upi.appName})`, 'success');
  };

  const handleSellUsdt = (usdtAmount: number) => {
    const res = sellUsdtToInr(state, usdtAmount);
    if (!res.ok) return { ok: false, error: res.error };
    setState(res.nextState);
    pushNotification('deposit_ok', {
      title: 'USDT Converted',
      msg: `Sold ${usdtAmount} USDT for ₹${res.inrCredited.toFixed(2)}.`,
      route: 'wallet',
    });
    showToast(
      `Sold ${usdtAmount} USDT for ₹${res.inrCredited.toFixed(2)}`,
      'success'
    );
    return { ok: true };
  };

  const latestStateRef = React.useRef(state);
  latestStateRef.current = state;

  const handleGameWalletTx = (
    params: GameWalletTxParams
  ): { ok: true; balance: number } | { ok: false; error: string; balance: number } => {
    const res = applyGameWalletTransaction(latestStateRef.current, params);
    if (!res.ok) {
      showToast(res.error, 'error');
      return {
        ok: false,
        error: res.error,
        balance: latestStateRef.current.balance,
      };
    }
    latestStateRef.current = res.nextState;
    setState(res.nextState);
    if (params.kind === 'win' && params.amountInr >= 100) {
      showToast(`${params.gameTitle}: +₹${params.amountInr.toFixed(2)} credited`, 'success');
    }
    return { ok: true, balance: res.nextState.balance };
  };

  const handleSupportSubmit = (payload: SupportTicketPayload) => {
    const now = Date.now();
    const cleanEmail = state.profile.email.trim().toLowerCase();
    const newTicket: SupportTicket = {
      id: `TKT-${Math.floor(1000 + Math.random() * 9000)}`,
      uid: state.profile.uid,
      userEmail: state.profile.email || undefined,
      subject: payload.subject,
      message: payload.message,
      transactionId: payload.transactionId,
      paymentDateTime: payload.paymentDateTime,
      whatsapp: payload.whatsapp,
      screenshotDataUrl: payload.screenshotDataUrl,
      status: 'Open',
      createdAt: formatExactDateTime(now),
    };
    setState((prev) => ({
      ...prev,
      supportTickets: [newTicket, ...(prev.supportTickets ?? [])],
      platformTickets: [newTicket, ...(prev.platformTickets ?? [])],
      registeredAccounts: (prev.registeredAccounts ?? []).map((acc) =>
        acc.email.trim().toLowerCase() === cleanEmail
          ? {
              ...acc,
              supportTickets: [newTicket, ...(acc.supportTickets ?? [])],
            }
          : acc
      ),
    }));
    pushNotification('system', {
      title: 'Support Request Received',
      msg: `Ticket ${newTicket.id} opened for "${payload.subject}". Desk replies shortly.`,
    });
    showToast(`Support ticket ${newTicket.id} sent`, 'success');
  };

  const handleAddComment = (newsId: string, text: string) => {
    setState((prev) => ({
      ...prev,
      news: prev.news.map((item) =>
        item.id === newsId
          ? {
              ...item,
              comments: [
                ...item.comments,
                {
                  id: `c-${Date.now()}`,
                  author: prev.profile.name,
                  text,
                  timestamp: 'Just now',
                },
              ],
            }
          : item
      ),
    }));
    showToast('Comment posted', 'success');
  };

  const handleSendCommunityMessage = (
    text: string
  ): { ok: boolean; error?: string } => {
    const res = postCommunityMessage({
      messages: state.communityMessages ?? [],
      usage: state.communityChatUsage,
      username: state.profile.name,
      text,
    });
    if (!res.ok) {
      showToast(res.error, 'error');
      return { ok: false, error: res.error };
    }
    setState((prev) => ({
      ...prev,
      communityMessages: res.nextMessages,
      communityChatUsage: res.nextUsage,
    }));
    showToast(`Sent (${res.remaining} left today)`, 'success');
    return { ok: true };
  };

  const handleOpenNotificationItem = (item: AppNotification) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === item.id ? { ...n, read: true } : n))
    );
    setNotifOpen(false);
    if (item.route === 'portfolio') setActiveNav('portfolio');
    else if (item.route === 'news') setActiveNav('feed');
    else if (item.route === 'wallet') setActiveNav('profile');
    else if (item.route === 'trade' || item.route === 'markets')
      setActiveNav('trade');
    showToast(
      `Opening ${item.route.charAt(0).toUpperCase() + item.route.slice(1)}`,
      'info'
    );
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const lang: LanguageCode = state.profile.language ?? 'en';
  const currency: BaseCurrency = state.profile.baseCurrency ?? 'INR';
  const fxRates = state.fxRates;
  const isLight = themeMode === 'light';

  const desktopNavItems: {
    id: NavSection;
    label: string;
    icon: React.ReactNode;
  }[] = [
    {
      id: 'markets',
      label: t(lang, 'navMarkets'),
      icon: <Home className="w-4 h-4" />,
    },
    {
      id: 'games',
      label: 'Games',
      icon: <Gamepad2 className="w-4 h-4" />,
    },
    {
      id: 'trade',
      label: t(lang, 'navTrade'),
      icon: <CandlestickChart className="w-4 h-4" />,
    },
    {
      id: 'bets',
      label: t(lang, 'navBets'),
      icon: <Trophy className="w-4 h-4" />,
    },
    {
      id: 'portfolio',
      label: t(lang, 'navPortfolio'),
      icon: <Briefcase className="w-4 h-4" />,
    },
    {
      id: 'gift',
      label: t(lang, 'navGift'),
      icon: <Gift className="w-4 h-4" />,
    },
    {
      id: 'feed',
      label: t(lang, 'navNews'),
      icon: <Newspaper className="w-4 h-4" />,
    },
    {
      id: 'profile',
      label: t(lang, 'navProfile'),
      icon: <User className="w-4 h-4" />,
    },
  ];

  const pageTitles: Record<NavSection, string> = {
    markets: t(lang, 'pageMarkets'),
    games: 'All Games',
    trade: t(lang, 'pageTrade'),
    bets: t(lang, 'pageBets'),
    portfolio: t(lang, 'pagePortfolio'),
    gift: t(lang, 'pageGift'),
    feed: t(lang, 'pageFeed'),
    profile: t(lang, 'pageProfile'),
    admin: 'Owner Admin Panel',
  };

  // Owner-exclusive Admin handlers (blocked completely for non-owner accounts)
  const ownerAuthorized = isOwnerAdmin(state.profile.email);

  const handleUpdateReferralConfig = (next: ReferralConfig) => {
    if (!ownerAuthorized) return;
    setState((prev) => ({
      ...prev,
      referralConfig: next,
    }));
    showToast('P2P settlement & wallet rules saved', 'success');
  };

  const handleVerifyDeposit = (txId: string) => {
    if (!ownerAuthorized) return;
    const res = adminVerifyAndCreditDeposit(state, txId);
    if (!res.ok) {
      showToast(res.error, 'error');
      return;
    }
    setState(res.nextState);
    const bonusText =
      res.firstDepositBonusInr > 0
        ? ` + ₹${res.firstDepositBonusInr.toFixed(2)} New-User Bonus`
        : '';
    if (res.targetEmail === state.profile.email.trim().toLowerCase()) {
      pushNotification('deposit_ok', {
        title: 'Deposit Verified & Credited',
        msg: `₹${res.creditedAmount.toFixed(2)}${bonusText} added to your wallet.`,
        route: 'wallet',
      });
    }
    showToast(
      `Credited ₹${res.creditedAmount.toFixed(2)}${bonusText} to ${res.targetEmail || 'user'}`,
      'success'
    );
  };

  const handleRejectDeposit = (txId: string, reason: string) => {
    if (!ownerAuthorized) return;
    const res = adminRejectDeposit(state, txId, reason);
    if (!res.ok) {
      showToast(res.error, 'error');
      return;
    }
    setState(res.nextState);
    showToast(`Rejected deposit (${res.targetEmail || 'user'})`, 'info');
  };

  const handleApproveWithdrawal = (txId: string) => {
    if (!ownerAuthorized) return;
    const res = adminApproveWithdrawal(state, txId);
    if (!res.ok) {
      showToast(res.error, 'error');
      return;
    }
    setState(res.nextState);
    showToast(
      `Completed ₹${res.amount.toFixed(2)} payout for ${res.targetEmail || 'user'}`,
      'success'
    );
  };

  const handleRejectWithdrawal = (txId: string, reason: string) => {
    if (!ownerAuthorized) return;
    const res = adminRejectAndRefundWithdrawal(state, txId, reason);
    if (!res.ok) {
      showToast(res.error, 'error');
      return;
    }
    setState(res.nextState);
    showToast(
      `Rejected & refunded ₹${res.refundedAmount.toFixed(2)} to ${
        res.targetEmail || 'user'
      }`,
      'info'
    );
  };

  const handleUpdateTicketStatus = (
    ticketId: string,
    status: SupportTicket['status']
  ) => {
    if (!ownerAuthorized) return;
    setState((prev) => ({
      ...prev,
      supportTickets: (prev.supportTickets ?? []).map((tkt) =>
        tkt.id === ticketId ? { ...tkt, status } : tkt
      ),
      platformTickets: (prev.platformTickets ?? []).map((tkt) =>
        tkt.id === ticketId ? { ...tkt, status } : tkt
      ),
      registeredAccounts: (prev.registeredAccounts ?? []).map((acc) => ({
        ...acc,
        supportTickets: (acc.supportTickets ?? []).map((tkt) =>
          tkt.id === ticketId ? { ...tkt, status } : tkt
        ),
      })),
    }));
    showToast(`Ticket ${ticketId} -> ${status}`, 'success');
  };

  const handleAdjustUserBalance = (targetEmail: string, deltaInr: number) => {
    if (!ownerAuthorized || !Number.isFinite(deltaInr) || deltaInr === 0) return;
    const cleanTarget = targetEmail.trim().toLowerCase();
    const isSelf = state.profile.email.trim().toLowerCase() === cleanTarget;
    const round2 = (n: number) => Math.max(0, Math.round(n * 100) / 100);

    setState((prev) => {
      const nextSelfBal = round2(prev.balance + deltaInr);
      const nextSelfWithdrawable = Math.min(
        nextSelfBal,
        round2((prev.withdrawableBalance ?? 0) + deltaInr)
      );
      return {
        ...prev,
        balance: isSelf ? nextSelfBal : prev.balance,
        withdrawableBalance: isSelf
          ? nextSelfWithdrawable
          : prev.withdrawableBalance,
        registeredAccounts: (prev.registeredAccounts ?? []).map((acc) => {
          if (acc.email.trim().toLowerCase() !== cleanTarget) return acc;
          const nextBal = round2((acc.balance ?? 0) + deltaInr);
          const nextWd = Math.min(
            nextBal,
            round2((acc.withdrawableBalance ?? 0) + deltaInr)
          );
          return {
            ...acc,
            balance: nextBal,
            withdrawableBalance: nextWd,
          };
        }),
      };
    });
    showToast(
      `${deltaInr >= 0 ? '+' : ''}₹${deltaInr} applied to ${cleanTarget}`,
      deltaInr >= 0 ? 'success' : 'info'
    );
  };

  const handleToggleFreezeAccount = (
    targetEmail: string,
    frozen: boolean,
    reason: string
  ) => {
    if (!ownerAuthorized || isOwnerAdmin(targetEmail)) return;
    const cleanTarget = targetEmail.trim().toLowerCase();
    setState((prev) => ({
      ...prev,
      registeredAccounts: (prev.registeredAccounts ?? []).map((acc) =>
        acc.email.trim().toLowerCase() === cleanTarget
          ? {
              ...acc,
              frozen,
              freezeReason: frozen
                ? reason.trim() || 'Restricted by Owner Console'
                : undefined,
            }
          : acc
      ),
    }));
    showToast(
      frozen ? `Account ${cleanTarget} frozen` : `Account ${cleanTarget} unfrozen`,
      frozen ? 'info' : 'success'
    );
  };

  const handleToggleBanAccount = (
    targetEmail: string,
    banned: boolean,
    reason: string
  ) => {
    if (!ownerAuthorized || isOwnerAdmin(targetEmail)) return;
    const cleanTarget = targetEmail.trim().toLowerCase();
    setState((prev) => ({
      ...prev,
      registeredAccounts: (prev.registeredAccounts ?? []).map((acc) =>
        acc.email.trim().toLowerCase() === cleanTarget
          ? {
              ...acc,
              banned,
              banReason: banned
                ? reason.trim() || 'Permanently banned by Owner Console'
                : undefined,
            }
          : acc
      ),
    }));
    showToast(
      banned ? `Account ${cleanTarget} banned` : `Account ${cleanTarget} unbanned`,
      banned ? 'info' : 'success'
    );
  };

  const handleToggleUserRestriction = (
    targetEmail: string,
    field: 'withdrawalsBlocked' | 'tradingBlocked',
    value: boolean
  ) => {
    if (!ownerAuthorized || isOwnerAdmin(targetEmail)) return;
    const cleanTarget = targetEmail.trim().toLowerCase();
    setState((prev) => ({
      ...prev,
      registeredAccounts: (prev.registeredAccounts ?? []).map((acc) =>
        acc.email.trim().toLowerCase() === cleanTarget
          ? { ...acc, [field]: value }
          : acc
      ),
    }));
    const label = field === 'withdrawalsBlocked' ? 'Withdrawals' : 'Trading';
    showToast(
      `${label} ${value ? 'paused' : 'enabled'} for ${cleanTarget}`,
      value ? 'info' : 'success'
    );
  };

  const handleAddMerchantUpi = (payload: {
    label: string;
    upiId: string;
    payeeName: string;
  }) => {
    if (!ownerAuthorized) return;
    const now = Date.now();
    setState((prev) => {
      const existing = prev.merchantUpiPool ?? DEFAULT_MERCHANT_UPIS;
      const cleanUpi = payload.upiId.trim().toLowerCase();
      if (existing.some((u) => u.upiId.toLowerCase() === cleanUpi)) {
        return prev;
      }
      return {
        ...prev,
        merchantUpiPool: [
          ...existing,
          {
            id: `mupi-${now}`,
            label: payload.label,
            upiId: cleanUpi,
            payeeName: payload.payeeName,
            active: true,
            isPrimary: existing.length === 0,
          },
        ],
      };
    });
    showToast(`Added merchant UPI ${payload.upiId}`, 'success');
  };

  const handleToggleMerchantUpi = (id: string) => {
    if (!ownerAuthorized) return;
    setState((prev) => {
      const pool = prev.merchantUpiPool ?? DEFAULT_MERCHANT_UPIS;
      const activeCount = pool.filter((u) => u.active).length;
      const target = pool.find((u) => u.id === id);
      if (target?.active && activeCount <= 1) {
        return prev;
      }
      return {
        ...prev,
        merchantUpiPool: pool.map((u) =>
          u.id === id ? { ...u, active: !u.active } : u
        ),
      };
    });
    showToast('Updated merchant UPI status', 'info');
  };

  const handleSetPrimaryMerchantUpi = (id: string) => {
    if (!ownerAuthorized) return;
    setState((prev) => ({
      ...prev,
      merchantUpiPool: (prev.merchantUpiPool ?? DEFAULT_MERCHANT_UPIS).map((u) => ({
        ...u,
        isPrimary: u.id === id,
        active: u.id === id ? true : u.active,
      })),
    }));
    showToast('Primary receiving UPI updated', 'success');
  };

  const handleDeleteMerchantUpi = (id: string) => {
    if (!ownerAuthorized) return;
    setState((prev) => {
      const pool = prev.merchantUpiPool ?? DEFAULT_MERCHANT_UPIS;
      if (pool.length <= 1) return prev;
      const filtered = pool.filter((u) => u.id !== id);
      if (!filtered.some((u) => u.isPrimary) && filtered[0]) {
        filtered[0] = { ...filtered[0], isPrimary: true, active: true };
      }
      return {
        ...prev,
        merchantUpiPool: filtered,
      };
    });
    showToast('Removed merchant UPI gateway', 'info');
  };

  const handleUpdatePlatformSettings = (next: PlatformSettings) => {
    if (!ownerAuthorized) return;
    setState((prev) => ({
      ...prev,
      platformSettings: next,
    }));
    showToast('Platform controls & limits saved', 'success');
  };

  const handleBroadcastNotification = (payload: {
    title: string;
    msg: string;
    category: BroadcastCategory;
    targetEmail: string;
  }) => {
    if (!ownerAuthorized) return;
    const now = Date.now();
    const broadcast: PlatformBroadcastNotification = {
      id: `bcast-${now}-${Math.random().toString(36).slice(2, 6)}`,
      title: payload.title,
      msg: payload.msg,
      category: payload.category,
      targetEmail: payload.targetEmail,
      createdAtMs: now,
      timestamp: formatExactDateTime(now),
    };
    setState((prev) => ({
      ...prev,
      platformBroadcasts: [broadcast, ...(prev.platformBroadcasts ?? [])].slice(
        0,
        50
      ),
    }));
    showToast(
      payload.targetEmail === 'ALL'
        ? 'Broadcast sent to all users'
        : `Alert sent to ${payload.targetEmail}`,
      'success'
    );
  };

  const handleUpdateAssetPrice = (assetId: string, nextPrice: number) => {
    if (!ownerAuthorized) return;
    setState((prev) => ({
      ...prev,
      assets: prev.assets.map((a) =>
        a.id === assetId
          ? {
              ...a,
              price: nextPrice,
              changePct: Math.round(((nextPrice - a.price) / a.price) * 10000) / 100,
              history: [...a.history.slice(1), nextPrice],
            }
          : a
      ),
    }));
    showToast('Market price updated', 'success');
  };

  const handleAddGiftCode = (gift: CustomGiftCode) => {
    if (!ownerAuthorized) return;
    setState((prev) => ({
      ...prev,
      customGiftCodes: [
        gift,
        ...(prev.customGiftCodes ?? []).filter((g) => g.code !== gift.code),
      ],
    }));
    showToast(`Gift code ${gift.code} added (₹${gift.amount})`, 'success');
  };

  const handleToggleGiftCode = (code: string) => {
    if (!ownerAuthorized) return;
    setState((prev) => ({
      ...prev,
      customGiftCodes: (prev.customGiftCodes ?? []).map((g) =>
        g.code === code ? { ...g, active: !g.active } : g
      ),
    }));
  };

  const activeFeaturedAsset = state.assets[0];

  // Show full-screen Authentication gate ONLY if guest browsing is disabled by Owner Admin
  const activeSettings = getEffectivePlatformSettings(state);
  const activeRefCfg = getEffectiveReferralConfig(state);

  if (!state.isAuthenticated && activeSettings.guestBrowsingEnabled === false) {
    return (
      <>
        <AuthView
          platformFeePct={activeRefCfg.platformFeePct}
          themeMode={themeMode}
          signupsPaused={activeSettings.signupsPaused}
          maintenanceNotice={activeSettings.maintenanceNotice}
          onOpenTerms={() => setTermsOpen(true)}
          onLogin={handleLogin}
          onSignup={handleSignup}
        />
        <TermsModal open={termsOpen} onClose={() => setTermsOpen(false)} />
        {toast && (
          <div
            role="status"
            aria-live="polite"
            className={`hero-preserve-dark fixed top-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl border text-xs font-semibold shadow-xl backdrop-blur-md whitespace-nowrap ${
              toast.tone === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200'
                : toast.tone === 'error'
                ? 'bg-rose-950/90 border-rose-500/40 text-rose-200'
                : 'bg-[#1a1a27]/95 border-white/15 text-white'
            }`}
          >
            {toast.text}
          </div>
        )}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0814] text-[#f1f5f9] lg:grid lg:grid-cols-[248px_1fr]">
      {/* Desktop Left Sidebar */}
      <aside className="hidden lg:flex flex-col justify-between bg-[#110d1c] border-r border-white/[0.06] p-5 sticky top-0 h-screen">
        <div className="space-y-8">
          <div
            className={
              isLight
                ? 'inline-flex items-center px-3 py-2 rounded-xl bg-gradient-to-r from-[#3b0764] to-[#5b21b6] shadow-sm'
                : 'px-2'
            }
          >
            <img
              src={getAssetUrl('assets/ouroboros-logo.png')}
              alt="Ouroboros"
              className="h-9 w-auto object-contain select-none"
              draggable={false}
            />
          </div>

          <nav aria-label="Primary navigation" className="space-y-1">
            {desktopNavItems.map((item) => {
              const active = activeNav === item.id;
              const isFeedItem = item.id === 'feed';
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    if (
                      !state.isAuthenticated &&
                      (item.id === 'portfolio' ||
                        item.id === 'gift' ||
                        item.id === 'profile' ||
                        item.id === 'admin')
                    ) {
                      requireAuth('Sign in to access your account & portfolio.');
                      return;
                    }
                    if (item.id === 'games') setSelectedGameId(null);
                    if (isFeedItem) {
                      openNewsFeed();
                    } else {
                      setActiveNav(item.id);
                    }
                  }}
                  className={`w-full min-h-[44px] px-3.5 rounded-xl flex items-center justify-between text-sm font-semibold transition-colors ${
                    active
                      ? 'bg-[#7c3aed]/20 text-[#a78bfa]'
                      : 'text-[#94a3b8] hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    {item.icon}
                    <span>{item.label}</span>
                  </span>
                  {isFeedItem && hasUnreadNews && (
                    <span
                      aria-label="Unread community updates"
                      className="w-2 h-2 rounded-full bg-[#ef4444] animate-pulse shrink-0"
                    />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="space-y-3 pt-4 border-t border-white/[0.06]">
          <div className="px-2">
            <div className="text-xs text-[#94a3b8]">
              {state.isAuthenticated ? t(lang, 'availableWallet') : 'Guest Browsing'}
            </div>
            <div className="text-lg font-extrabold text-white font-mono-nums mt-0.5">
              {state.isAuthenticated
                ? formatCurrency(state.balance, currency, fxRates)
                : 'Sign In Ready'}
            </div>
          </div>
          {state.isAuthenticated ? (
            <button
              type="button"
              onClick={() =>
                setTradeModalState({ asset: activeFeaturedAsset, side: 'long' })
              }
              className="preserve-white w-full min-h-[44px] rounded-xl bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-sm font-bold flex items-center justify-center gap-1.5 transition-colors shadow-[0_4px_14px_rgba(124,58,237,0.35)]"
            >
              <Plus className="w-4 h-4" />
              {t(lang, 'quickTrade')}
            </button>
          ) : (
            <button
              type="button"
              id="sidebar-guest-signin-btn"
              onClick={() => setShowAuthModal(true)}
              className="preserve-white w-full min-h-[44px] rounded-xl bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-sm font-bold flex items-center justify-center gap-1.5 transition-colors"
            >
              <User className="w-4 h-4" />
              <span>Sign In / Register</span>
            </button>
          )}
        </div>
      </aside>

      {/* Main Column */}
      <div className="min-w-0 flex flex-col">
        {/* Desktop Top Bar */}
        <header className="hidden lg:flex sticky top-0 z-30 h-14 bg-[#0b0814]/90 backdrop-blur-md border-b border-white/[0.06] px-8 items-center justify-between gap-4">
          <h1 className="font-display text-base font-bold text-white whitespace-nowrap">
            {pageTitles[activeNav]}
          </h1>

          <div className="flex items-center gap-6 text-xs font-medium text-[#94a3b8]">
            <button
              type="button"
              onClick={() => setActiveNav('markets')}
              className={`hover:text-white transition-colors whitespace-nowrap ${
                activeNav === 'markets' ? 'text-white font-semibold' : ''
              }`}
            >
              {t(lang, 'liveMarkets')}
            </button>
            <button
              type="button"
              onClick={openNewsFeed}
              className={`relative inline-flex items-center gap-1.5 hover:text-white transition-colors whitespace-nowrap ${
                activeNav === 'feed' ? 'text-white font-semibold' : ''
              }`}
            >
              <span>{t(lang, 'navNews')}</span>
              {hasUnreadNews && (
                <span
                  aria-label="Unread community updates"
                  className="w-2 h-2 rounded-full bg-[#ef4444] animate-pulse shrink-0"
                />
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                if (!requireAuth('Sign in to claim Gift Drops.')) return;
                setActiveNav('gift');
              }}
              className={`hover:text-white transition-colors whitespace-nowrap ${
                activeNav === 'gift' ? 'text-white font-semibold' : ''
              }`}
            >
              {t(lang, 'giftDrop')}
            </button>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {state.isAuthenticated ? (
              <>
                {activeNav !== 'markets' && (
                  <button
                    type="button"
                    onClick={() => setNotifOpen(true)}
                    aria-label={`Notifications (${unreadCount} unread)`}
                    className="relative w-[38px] h-[38px] rounded-xl bg-[#15101f] hover:bg-[#1c1529] border border-white/10 flex items-center justify-center text-white transition-colors"
                  >
                    <Bell className="w-4 h-4" />
                    {unreadCount > 0 && (
                      <span className="preserve-white absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-[#ef4444] text-white text-[9px] font-bold flex items-center justify-center border-2 border-[#0b0814] font-mono-nums">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => openScanner('scan')}
                  aria-label="Scan QR and send money"
                  className="min-h-[38px] px-3 rounded-xl bg-[#15101f] hover:bg-[#1c1529] border border-white/10 text-xs font-bold text-white inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
                >
                  <ScanLine className="w-3.5 h-3.5 text-[#a78bfa]" />
                  <span>Scan &amp; Pay</span>
                </button>
                <button
                  type="button"
                  onClick={() => setWalletModalMode('topup')}
                  aria-label="Wallet balance and top up"
                  className="min-h-[38px] px-3.5 rounded-xl bg-[#15101f] hover:bg-[#1c1529] border border-white/10 text-xs font-bold text-white font-mono-nums inline-flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors"
                >
                  <Wallet className="w-3.5 h-3.5 text-[#a78bfa]" />
                  <span>{formatCurrency(state.balance, currency, fxRates)}</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                id="desktop-header-signin-btn"
                onClick={() => setShowAuthModal(true)}
                className="preserve-white min-h-[38px] px-4 rounded-xl bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-xs font-extrabold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
              >
                <User className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </header>

        {/* Main Scrollable Content */}
        <main className="flex-1 w-full max-w-6xl mx-auto px-4 md:px-8 pb-28 lg:py-6 lg:pb-12">
          {activeNav === 'markets' && (
            <MarketsView
              state={state}
              unreadNotifications={unreadCount}
              hasUnreadNews={hasUnreadNews}
              onOpenNotifications={() => {
                if (!requireAuth('Sign in to view notifications.')) return;
                setNotifOpen(true);
              }}
              onOpenAuth={() => setShowAuthModal(true)}
              onClaimDailyCheckIn={handleClaimDailyCheckIn}
              onOpenTrade={(asset, side = 'long') => {
                if (!requireAuth('Sign in to place live trades.')) return;
                setTradeModalState({ asset, side });
              }}
              onOpenTradeTerminal={(assetId) => {
                setTerminalAssetId(assetId ?? null);
                setActiveNav('trade');
              }}
              onOpenGame={(gameId) => {
                if (!requireAuth('Sign in to play interactive games.')) return;
                setGamesReturnNav('markets');
                setSelectedGameId(gameId);
                setActiveNav('games');
              }}
              onOpenAllGames={() => {
                setGamesReturnNav('markets');
                setSelectedGameId(null);
                setActiveNav('games');
              }}
              onOpenAllBets={() => setActiveNav('bets')}
              onOpenPrediction={(market, choice) => {
                if (!requireAuth('Sign in to place prediction bets.')) return;
                setPredictionModalState({ market, choice });
              }}
              onOpenWalletModal={(mode) => {
                if (!requireAuth('Sign in to access deposits, withdrawals & support.')) {
                  return;
                }
                setSupportPreselectedTxId(null);
                setWalletModalMode(mode);
              }}
              onOpenScanner={(tab = 'scan') => openScanner(tab)}
              onNavigateNews={openNewsFeed}
              onNavigateGift={() => {
                if (!requireAuth('Sign in to claim Gift Drops.')) return;
                setActiveNav('gift');
              }}
              onOpenTerms={() => setTermsOpen(true)}
            />
          )}

          {activeNav === 'games' && (
            <div className="pt-4 lg:pt-0">
              <GamesView
                selectedGameId={selectedGameId}
                isAuthenticated={Boolean(state.isAuthenticated)}
                balance={state.balance}
                currency={currency}
                fxRates={fxRates}
                onSelectGame={(gameId) => {
                  if (gameId !== null && !requireAuth('Sign in to launch and play games.')) {
                    return;
                  }
                  if (gameId && selectedGameId === null) {
                    setGamesReturnNav('games');
                  }
                  setSelectedGameId(gameId);
                }}
                onBack={() => {
                  if (selectedGameId) {
                    setSelectedGameId(null);
                    if (gamesReturnNav === 'markets') {
                      setActiveNav('markets');
                    }
                  } else {
                    setActiveNav('markets');
                  }
                }}
                onOpenTopUp={() => {
                  if (!requireAuth('Sign in to deposit funds.')) return;
                  setSupportPreselectedTxId(null);
                  setWalletModalMode('topup');
                }}
                onGameWalletTx={handleGameWalletTx}
              />
            </div>
          )}

          {activeNav === 'trade' && (
            <div className="pt-4 lg:pt-0">
              <TradeTerminalView
                state={state}
                nowMs={nowMs}
                initialAssetId={terminalAssetId}
                onBack={() => {
                  setTerminalAssetId(null);
                  setActiveNav('markets');
                }}
                onExecuteTrade={(params) => {
                  if (!requireAuth('Sign in to submit live orders.')) return;
                  handleConfirmTrade(params);
                }}
                onClosePosition={(positionId) => {
                  if (!requireAuth('Sign in to manage open positions.')) return;
                  handleClosePosition(positionId);
                }}
              />
            </div>
          )}

          {activeNav === 'bets' && (
            <div className="pt-4 lg:pt-0">
              <AllBetsView
                state={state}
                onBack={() => setActiveNav('markets')}
                onOpenPrediction={(market, choice) => {
                  if (!requireAuth('Sign in to place prediction bets.')) return;
                  setPredictionModalState({ market, choice });
                }}
              />
            </div>
          )}

          {activeNav === 'portfolio' && (
            <div className="pt-4 lg:pt-0">
              <PortfolioView
                state={state}
                nowMs={nowMs}
                onClosePosition={handleClosePosition}
                onExploreMarkets={() => setActiveNav('trade')}
                onDeposit={() => setWalletModalMode('topup')}
                onWithdraw={() => setWalletModalMode('withdraw')}
                onReportIssue={(txId) => {
                  setSupportPreselectedTxId(txId);
                  setWalletModalMode('support');
                }}
              />
            </div>
          )}

          {activeNav === 'gift' && (
            <div className="pt-4 lg:pt-0">
              <GiftView state={state} onRedeemCode={handleRedeemCode} />
            </div>
          )}

          {activeNav === 'feed' && (
            <div className="pt-4 lg:pt-0">
              <FeedView
                state={state}
                hasUnreadCommunity={hasUnreadNews}
                onOpenCommunity={() => setHasUnreadNews(false)}
                onBack={() => setActiveNav('markets')}
                onTradeAsset={(asset) => {
                  setTerminalAssetId(asset.id);
                  setActiveNav('trade');
                }}
                onViewAllBets={() => setActiveNav('bets')}
                onAddComment={(newsId, text) => {
                  if (!requireAuth('Sign in to post market comments.')) return;
                  handleAddComment(newsId, text);
                }}
                onSendCommunityMessage={(text) => {
                  if (!requireAuth('Sign in to chat in the community.')) {
                    return { ok: false, error: 'Sign in required.' };
                  }
                  return handleSendCommunityMessage(text);
                }}
              />
            </div>
          )}

          {activeNav === 'profile' && (
            <div className="pt-4 lg:pt-0">
              <ProfileView
                state={state}
                onBack={() => setActiveNav('markets')}
                onOpenWalletModal={(mode) => {
                  setSupportPreselectedTxId(null);
                  setWalletModalMode(mode);
                }}
                onOpenScanner={(tab = 'scan') => openScanner(tab)}
                onNavigatePortfolio={() => setActiveNav('portfolio')}
                onNavigateGift={() => setActiveNav('gift')}
                onNavigateAdmin={
                  ownerAuthorized ? () => setActiveNav('admin') : undefined
                }
                onUpdateProfile={(name, email) => {
                  setState((prev) => ({
                    ...prev,
                    profile: { ...prev.profile, name, email },
                  }));
                  showToast('Profile updated', 'success');
                }}
                onToggleTwoFactor={() => {
                  setState((prev) => ({
                    ...prev,
                    profile: {
                      ...prev.profile,
                      twoFactorEnabled: !prev.profile.twoFactorEnabled,
                    },
                  }));
                  showToast('Security preference updated', 'info');
                }}
                onToggleCurrency={(nextCurrency: BaseCurrency) => {
                  setState((prev) => ({
                    ...prev,
                    profile: { ...prev.profile, baseCurrency: nextCurrency },
                  }));
                  showToast(`Base currency switched to ${nextCurrency}`, 'info');
                }}
                onChangeLanguage={(nextLang: LanguageCode) => {
                  setState((prev) => ({
                    ...prev,
                    profile: { ...prev.profile, language: nextLang },
                  }));
                  showToast(
                    `Language changed to ${nextLang.toUpperCase()}`,
                    'success'
                  );
                }}
                onRefreshFxRates={() => {
                  void refreshLiveFxRates(true);
                }}
                onToggleAlerts={() => {
                  setState((prev) => ({
                    ...prev,
                    profile: {
                      ...prev.profile,
                      priceAlertsEnabled: !prev.profile.priceAlertsEnabled,
                    },
                  }));
                }}
                onToggleTheme={(theme: ThemeMode) => {
                  setState((prev) => ({
                    ...prev,
                    themeMode: theme,
                  }));
                  showToast(
                    `${theme === 'light' ? 'Light' : 'Dark'} mode active`,
                    'info'
                  );
                }}
                onChangePassword={handleChangePassword}
                onNotify={showToast}
                onLogout={handleLogout}
              />
            </div>
          )}

          {activeNav === 'admin' && ownerAuthorized && (
            <div className="pt-4 lg:pt-0">
              <AdminView
                state={state}
                onBack={() => setActiveNav('profile')}
                onUpdateReferralConfig={handleUpdateReferralConfig}
                onVerifyDeposit={handleVerifyDeposit}
                onRejectDeposit={handleRejectDeposit}
                onApproveWithdrawal={handleApproveWithdrawal}
                onRejectWithdrawal={handleRejectWithdrawal}
                onUpdateTicketStatus={handleUpdateTicketStatus}
                onAdjustUserBalance={handleAdjustUserBalance}
                onToggleFreezeAccount={handleToggleFreezeAccount}
                onToggleBanAccount={handleToggleBanAccount}
                onToggleUserRestriction={handleToggleUserRestriction}
                onAddMerchantUpi={handleAddMerchantUpi}
                onToggleMerchantUpi={handleToggleMerchantUpi}
                onSetPrimaryMerchantUpi={handleSetPrimaryMerchantUpi}
                onDeleteMerchantUpi={handleDeleteMerchantUpi}
                onUpdatePlatformSettings={handleUpdatePlatformSettings}
                onBroadcastNotification={handleBroadcastNotification}
                onUpdateAssetPrice={handleUpdateAssetPrice}
                onAddGiftCode={handleAddGiftCode}
                onToggleGiftCode={handleToggleGiftCode}
                onCreatePredictionMarket={handleCreatePredictionMarket}
                onResolvePredictionMarket={handleResolvePredictionMarket}
              />
            </div>
          )}
        </main>
      </div>

      {/* Mobile Floating Glass Pill Bottom Nav */}
      <nav
        aria-label="Mobile navigation"
        className="lg:hidden fixed bottom-4 left-4 right-4 max-w-[480px] mx-auto h-[66px] rounded-[22px] bg-[#15101f]/85 backdrop-blur-xl border border-white/[0.09] shadow-[0_12px_40px_rgba(0,0,0,0.45)] z-30 grid grid-cols-5 items-center px-1"
      >
        <button
          type="button"
          onClick={() => setActiveNav('markets')}
          className={`min-h-[48px] flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
            activeNav === 'markets' ? 'text-[#a78bfa]' : 'text-[#94a3b8]'
          }`}
        >
          <Home className="w-[21px] h-[21px]" />
          <span>{t(lang, 'navHome')}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (!requireAuth('Sign in to view your portfolio & orders.')) return;
            setActiveNav('portfolio');
          }}
          className={`min-h-[48px] flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
            activeNav === 'portfolio' ? 'text-[#a78bfa]' : 'text-[#94a3b8]'
          }`}
        >
          <Briefcase className="w-[21px] h-[21px]" />
          <span>{t(lang, 'navPortfolio')}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (!requireAuth('Sign in to claim Gift Drops.')) return;
            setActiveNav('gift');
          }}
          className={`min-h-[48px] flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
            activeNav === 'gift' ? 'text-[#a78bfa]' : 'text-[#94a3b8]'
          }`}
        >
          <Gift className="w-[21px] h-[21px]" />
          <span>{t(lang, 'navGift')}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveNav('trade')}
          className={`min-h-[48px] flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
            activeNav === 'trade' ? 'text-[#a78bfa]' : 'text-[#94a3b8]'
          }`}
        >
          <CandlestickChart className="w-[21px] h-[21px]" />
          <span>{t(lang, 'navTrade')}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (!requireAuth('Sign in to access your profile & leaderboard.')) return;
            setActiveNav('profile');
          }}
          className={`min-h-[48px] flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
            activeNav === 'profile' ? 'text-[#a78bfa]' : 'text-[#94a3b8]'
          }`}
        >
          <User className="w-[21px] h-[21px]" />
          <span>{t(lang, 'navProfile')}</span>
        </button>
      </nav>

      {/* Auto-Settled Trade Result Announcement Banner */}
      {latestSettledBanner && (
        <div
          role="dialog"
          aria-label="Trade settlement result"
          className="fixed bottom-24 lg:bottom-6 left-4 right-4 lg:left-auto lg:right-6 lg:w-[360px] z-40 rounded-2xl bg-[#131122]/95 border border-[#7c3aed]/50 shadow-[0_18px_45px_rgba(0,0,0,0.6)] p-4 backdrop-blur-xl"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span
                className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                  latestSettledBanner.p2pStatus === 'Cancelled/Refunded'
                    ? 'bg-sky-500/20 text-sky-400'
                    : latestSettledBanner.won
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-rose-500/20 text-rose-400'
                }`}
              >
                <CheckCircle2 className="w-5 h-5" />
              </span>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#a78bfa]">
                  {latestSettledBanner.p2pStatus === 'Cancelled/Refunded'
                    ? 'Cancelled / Refunded'
                    : 'P2P Timer Complete · Settled'}
                </div>
                <div className="text-sm font-extrabold text-white">
                  {latestSettledBanner.symbol} ·{' '}
                  {latestSettledBanner.p2pStatus === 'Cancelled/Refunded'
                    ? '100% Refunded'
                    : latestSettledBanner.won
                    ? 'Trade Won'
                    : 'Trade Settled'}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setLatestSettledBanner(null)}
              aria-label="Dismiss result announcement"
              className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {latestSettledBanner.outcomeNote && (
            <p className="mt-2 text-[11px] text-slate-300 leading-relaxed">
              {latestSettledBanner.outcomeNote}
            </p>
          )}

          <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-[#191928] border border-white/[0.08] p-2.5 text-center font-mono-nums">
            <div>
              <div className="text-[10px] text-slate-400">Entry</div>
              <div className="text-xs font-bold text-white">
                {latestSettledBanner.entryPrice.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400">Exit</div>
              <div className="text-xs font-bold text-white">
                {latestSettledBanner.exitPrice.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400">Net P&amp;L</div>
              <div
                className={`text-xs font-extrabold ${
                  latestSettledBanner.pnl >= 0
                    ? 'text-emerald-400'
                    : 'text-rose-400'
                }`}
              >
                {latestSettledBanner.pnl >= 0 ? '+' : ''}
                {formatCurrency(latestSettledBanner.pnl, currency, fxRates)}
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="text-[11px] text-slate-300 font-mono-nums">
              Payout: {formatCurrency(latestSettledBanner.payout, currency, fxRates)}
            </span>
            <button
              type="button"
              onClick={() => {
                setLatestSettledBanner(null);
                setActiveNav('portfolio');
              }}
              className="preserve-white btn-press px-3 py-1.5 rounded-lg bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-[11px] font-bold"
            >
              View Portfolio
            </button>
          </div>
        </div>
      )}

      {/* Single Notification Slide-Up Panel */}
      <NotificationCenter
        open={notifOpen}
        notifications={notifications}
        onClose={() => setNotifOpen(false)}
        onMarkAllRead={() =>
          setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
        }
        onClearAll={() => setNotifications([])}
        onDeleteOne={(id) =>
          setNotifications((prev) => prev.filter((n) => n.id !== id))
        }
        onOpenItem={handleOpenNotificationItem}
        onTriggerDemo={(key) => pushNotification(key)}
      />

      {/* Trade, Prediction & Wallet Modals */}
      <TradeModal
        asset={tradeModalState?.asset ?? null}
        initialSide={tradeModalState?.side}
        balance={state.balance}
        currency={currency}
        fxRates={fxRates}
        onClose={() => setTradeModalState(null)}
        onConfirm={handleConfirmTrade}
      />

      <PredictionModal
        market={predictionModalState?.market ?? null}
        choice={predictionModalState?.choice ?? 'yes'}
        balance={state.balance}
        currency={currency}
        fxRates={fxRates}
        onClose={() => setPredictionModalState(null)}
        onConfirm={handleConfirmPrediction}
      />

      <WalletModal
        mode={walletModalMode}
        balance={state.balance}
        withdrawableBalance={Math.min(
          state.balance,
          state.withdrawableBalance ?? state.balance
        )}
        usdtHoldings={state.usdtHoldings}
        usdtRateInr={state.usdtRateInr}
        bankAccounts={state.bankAccounts}
        upiAccounts={state.upiAccounts ?? []}
        transactions={state.transactions}
        userUid={state.profile.uid}
        preselectedTxId={supportPreselectedTxId}
        defaultHolderName={state.profile.name}
        currency={currency}
        fxRates={fxRates}
        themeMode={themeMode}
        merchantUpiPool={state.merchantUpiPool}
        platformSettings={activeSettings}
        isFirstDeposit={!hasVerifiedDeposit(state)}
        minDepositInr={activeRefCfg.minDepositInr}
        minWithdrawInr={activeRefCfg.minWithdrawInr}
        onClose={() => {
          setWalletModalMode(null);
          setSupportPreselectedTxId(null);
        }}
        onTopUp={handleTopUp}
        onWithdraw={handleWithdraw}
        onBindBank={handleBindBank}
        onBindUpi={handleBindUpi}
        onSellUsdt={handleSellUsdt}
        onSupportSubmit={handleSupportSubmit}
      />

      <WalletScannerModal
        open={scannerModalTab !== null}
        initialTab={scannerModalTab ?? 'scan'}
        state={state}
        currency={currency}
        fxRates={fxRates}
        themeMode={themeMode}
        onClose={() => setScannerModalTab(null)}
        onTransfer={handleWalletTransfer}
      />

      <PaymentTransferAnimation
        transfer={activeTransfer}
        currency={currency}
        fxRates={fxRates}
        onComplete={() => setActiveTransfer(null)}
      />

      {/* Sign In / Registration Modal for Guests */}
      {showAuthModal && !state.isAuthenticated && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Sign in or create account"
          className="fixed inset-0 z-[70] bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAuthModal(false);
          }}
        >
          <div className="w-full max-w-md">
            <AuthView
              platformFeePct={activeRefCfg.platformFeePct}
              themeMode={themeMode}
              signupsPaused={activeSettings.signupsPaused}
              maintenanceNotice={activeSettings.maintenanceNotice}
              onOpenTerms={() => setTermsOpen(true)}
              onLogin={handleLogin}
              onSignup={handleSignup}
              onClose={() => setShowAuthModal(false)}
            />
          </div>
        </div>
      )}

      <TermsModal open={termsOpen} onClose={() => setTermsOpen(false)} />

      {/* Toast Notification */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`hero-preserve-dark fixed top-5 left-1/2 -translate-x-1/2 lg:left-auto lg:translate-x-0 lg:top-16 lg:right-8 z-[80] px-4 py-2.5 rounded-xl border text-xs font-semibold shadow-xl backdrop-blur-md whitespace-nowrap ${
            toast.tone === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200'
              : toast.tone === 'error'
              ? 'bg-rose-950/90 border-rose-500/40 text-rose-200'
              : 'bg-[#1a1a27]/95 border-white/15 text-white'
          }`}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}
