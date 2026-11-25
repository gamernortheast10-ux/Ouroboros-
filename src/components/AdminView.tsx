import React, { useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  Ban,
  BellRing,
  Check,
  CheckCircle2,
  Coins,
  Copy,
  Gift,
  Globe,
  Headphones,
  Lock,
  Mic,
  MicOff,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Trash2,
  TrendingUp,
  Unlock,
  Users,
  Wallet,
  X,
  XCircle,
} from 'lucide-react';
import {
  ADMIN_OWNER_EMAIL,
  DEFAULT_PLATFORM_SETTINGS,
  DEFAULT_REFERRAL_CONFIG,
} from '../data/seedData';
import {
  AppState,
  BroadcastCategory,
  CustomGiftCode,
  MarketCategory,
  PlatformSettings,
  ReferralConfig,
  SupportTicket,
  WalletTransaction,
} from '../types/trading';
import {
  OwnerPredictionDraft,
  computeAdminPlatformSummary,
  computeGiftCodeClaimAmount,
  formatCurrency,
  getEffectivePlatformSettings,
  getEffectiveReferralConfig,
  isOwnerAdmin,
  validateUpiId,
} from '../utils/tradingEngine';

interface AdminViewProps {
  state: AppState;
  onBack: () => void;
  onUpdateReferralConfig: (next: ReferralConfig) => void;
  onVerifyDeposit: (txId: string) => void;
  onRejectDeposit: (txId: string, reason: string) => void;
  onApproveWithdrawal: (txId: string) => void;
  onRejectWithdrawal: (txId: string, reason: string) => void;
  onUpdateTicketStatus: (ticketId: string, status: SupportTicket['status']) => void;
  onAdjustUserBalance: (email: string, deltaInr: number) => void;
  onToggleFreezeAccount: (email: string, frozen: boolean, reason: string) => void;
  onToggleBanAccount: (email: string, banned: boolean, reason: string) => void;
  onToggleUserRestriction: (
    email: string,
    field: 'withdrawalsBlocked' | 'tradingBlocked',
    value: boolean
  ) => void;
  onAddMerchantUpi: (payload: { label: string; upiId: string; payeeName: string }) => void;
  onToggleMerchantUpi: (id: string) => void;
  onSetPrimaryMerchantUpi: (id: string) => void;
  onDeleteMerchantUpi: (id: string) => void;
  onUpdatePlatformSettings: (next: PlatformSettings) => void;
  onBroadcastNotification: (payload: {
    title: string;
    msg: string;
    category: BroadcastCategory;
    targetEmail: string;
  }) => void;
  onUpdateAssetPrice: (assetId: string, nextPrice: number) => void;
  onAddGiftCode: (gift: CustomGiftCode) => void;
  onToggleGiftCode: (code: string) => void;
  onCreatePredictionMarket?: (draft: OwnerPredictionDraft) => void;
  onResolvePredictionMarket?: (params: {
    marketId: string;
    outcome: 'yes' | 'no';
    summary: string;
    sources?: Array<{ title: string; uri: string }>;
  }) => void;
}

type AdminSection =
  | 'overview'
  | 'deposits'
  | 'withdrawals'
  | 'users'
  | 'notifications'
  | 'tickets'
  | 'markets'
  | 'settings';

export const AdminView: React.FC<AdminViewProps> = ({
  state,
  onBack,
  onUpdateReferralConfig,
  onVerifyDeposit,
  onRejectDeposit,
  onApproveWithdrawal,
  onRejectWithdrawal,
  onUpdateTicketStatus,
  onAdjustUserBalance,
  onToggleFreezeAccount,
  onToggleBanAccount,
  onToggleUserRestriction,
  onAddMerchantUpi,
  onToggleMerchantUpi,
  onSetPrimaryMerchantUpi,
  onDeleteMerchantUpi,
  onUpdatePlatformSettings,
  onBroadcastNotification,
  onUpdateAssetPrice,
  onAddGiftCode,
  onToggleGiftCode,
  onCreatePredictionMarket,
  onResolvePredictionMarket,
}) => {
  // Defense-in-depth owner lock
  if (!isOwnerAdmin(state.profile.email)) {
    return null;
  }

  const effectiveCfg = getEffectiveReferralConfig(state);
  const effectiveSettings = getEffectivePlatformSettings(state);
  const [activeSection, setActiveSection] = useState<AdminSection>('overview');
  const [cfgDraft, setCfgDraft] = useState<ReferralConfig>(effectiveCfg);
  const [settingsDraft, setSettingsDraft] = useState<PlatformSettings>(effectiveSettings);

  // Deposits & Withdrawals filters + inline reject inputs
  const [depositFilter, setDepositFilter] = useState<'pending' | 'all'>('pending');
  const [withdrawFilter, setWithdrawFilter] = useState<'pending' | 'all'>('pending');
  const [rejectTxId, setRejectTxId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Users search, status filter + inline freeze/ban/adjust inputs
  const [userSearch, setUserSearch] = useState('');
  const [userFilter, setUserFilter] = useState<'all' | 'active' | 'frozen' | 'banned'>('all');
  const [freezeEmail, setFreezeEmail] = useState<string | null>(null);
  const [freezeReasonDraft, setFreezeReasonDraft] = useState('');
  const [banEmail, setBanEmail] = useState<string | null>(null);
  const [banReasonDraft, setBanReasonDraft] = useState('');
  const [adjustEmail, setAdjustEmail] = useState<string | null>(null);
  const [adjustAmountDraft, setAdjustAmountDraft] = useState('100');

  // Notifications composer
  const [notifTitle, setNotifTitle] = useState('');
  const [notifMsg, setNotifMsg] = useState('');
  const [notifCategory, setNotifCategory] = useState<BroadcastCategory>('promo');
  const [notifTarget, setNotifTarget] = useState<string>('ALL');

  // Tickets screenshot modal
  const [previewTicketImage, setPreviewTicketImage] = useState<string | null>(null);

  // Progressive Gift Code creator
  const [newGiftCode, setNewGiftCode] = useState('');
  const [newGiftAmount, setNewGiftAmount] = useState('100');
  const [newGiftStepDecrease, setNewGiftStepDecrease] = useState('10');
  const [newGiftMinAmount, setNewGiftMinAmount] = useState('20');
  const [newGiftMaxClaims, setNewGiftMaxClaims] = useState('10');
  const [newGiftLabel, setNewGiftLabel] = useState('Owner Special Drop');

  // Voice-Command Bet Studio & Live Web Auto-Settlement
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const [draftQuestion, setDraftQuestion] = useState('');
  const [draftCategory, setDraftCategory] = useState<Exclude<MarketCategory, 'All Markets'>>('Political');
  const [draftSubLabel, setDraftSubLabel] = useState('India Politics');
  const [draftEndLabel, setDraftEndLabel] = useState('Live Web Settled');
  const [draftEndsHours, setDraftEndsHours] = useState('24');
  const [draftCriteria, setDraftCriteria] = useState('');
  const [resolvingMarketId, setResolvingMarketId] = useState<string | null>(null);
  const [resolveFeedback, setResolveFeedback] = useState<{
    marketId: string;
    status: string;
    summary: string;
    sources?: Array<{ title: string; uri: string }>;
  } | null>(null);
  const recognitionRef = React.useRef<{ stop: () => void } | null>(null);

  // Multi-UPI Gateway creator
  const [newUpiLabel, setNewUpiLabel] = useState('');
  const [newUpiId, setNewUpiId] = useState('');
  const [newUpiPayee, setNewUpiPayee] = useState('Ouroboros Desk');
  const [upiFormError, setUpiFormError] = useState('');

  const currency = state.profile.baseCurrency;
  const fxRates = state.fxRates;
  const accounts = state.registeredAccounts ?? [];
  const ledger = state.commissionLedger ?? [];
  const broadcasts = state.platformBroadcasts ?? [];
  const merchantUpiPool = state.merchantUpiPool ?? [];

  const platformSummary = useMemo(() => computeAdminPlatformSummary(state), [state]);

  // Cross-user deduplicated support tickets combining platformTickets, active user tickets, and all registeredAccounts tickets
  const tickets = useMemo(() => {
    const map = new Map<string, SupportTicket>();
    for (const t of state.platformTickets ?? []) {
      map.set(t.id, t);
    }
    for (const t of state.supportTickets ?? []) {
      if (!map.has(t.id)) {
        map.set(t.id, {
          ...t,
          userEmail: t.userEmail ?? state.profile.email,
          uid: t.uid ?? state.profile.uid,
        });
      }
    }
    for (const acc of accounts) {
      for (const t of acc.supportTickets ?? []) {
        if (!map.has(t.id)) {
          map.set(t.id, {
            ...t,
            userEmail: t.userEmail ?? acc.email,
            uid: t.uid ?? acc.uid,
          });
        }
      }
    }
    return Array.from(map.values());
  }, [state.platformTickets, state.supportTickets, state.profile.email, state.profile.uid, accounts]);

  // Deduplicated platform-wide transaction feed combining platformTransactions & active user transactions
  const mergedPlatformTxs = useMemo(() => {
    const map = new Map<string, WalletTransaction>();
    for (const tx of state.platformTransactions ?? []) {
      map.set(tx.id, tx);
    }
    for (const tx of state.transactions) {
      if (!map.has(tx.id)) {
        map.set(tx.id, {
          ...tx,
          userEmail: tx.userEmail ?? state.profile.email,
          userName: tx.userName ?? state.profile.name,
          userUid: tx.userUid ?? state.profile.uid,
        });
      }
    }
    return Array.from(map.values()).sort(
      (a, b) => (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0)
    );
  }, [
    state.platformTransactions,
    state.transactions,
    state.profile.email,
    state.profile.name,
    state.profile.uid,
  ]);

  const depositTxs = useMemo(
    () => mergedPlatformTxs.filter((tx) => tx.type === 'deposit'),
    [mergedPlatformTxs]
  );
  const withdrawalTxs = useMemo(
    () => mergedPlatformTxs.filter((tx) => tx.type === 'withdraw'),
    [mergedPlatformTxs]
  );

  const pendingDeposits = depositTxs.filter(
    (tx) =>
      tx.status !== 'Credited' &&
      tx.status !== 'Completed' &&
      tx.status !== 'Rejected' &&
      !tx.credited
  );
  const pendingWithdrawals = withdrawalTxs.filter(
    (tx) => tx.status === 'In Process' || tx.status === 'Under Review'
  );

  const visibleDeposits =
    depositFilter === 'pending' ? pendingDeposits : depositTxs;
  const visibleWithdrawals =
    withdrawFilter === 'pending' ? pendingWithdrawals : withdrawalTxs;

  const openTicketsCount = tickets.filter((t) => t.status !== 'Resolved').length;

  const activeP2pOrdersCount = useMemo(
    () => (state.platformPositions ?? state.positions).filter((p) => p.status === 'open').length,
    [state.platformPositions, state.positions]
  );

  const filteredAccounts = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    return accounts.filter((a) => {
      if (userFilter === 'active' && (a.frozen || a.banned)) return false;
      if (userFilter === 'frozen' && !a.frozen) return false;
      if (userFilter === 'banned' && !a.banned) return false;
      if (!q) return true;
      return (
        a.name.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q) ||
        a.uid.toLowerCase().includes(q)
      );
    });
  }, [accounts, userSearch, userFilter]);

  const handleCopyText = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Safe fallback
    }
    setCopiedId(id);
    window.setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 1800);
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateReferralConfig({
      platformFeePct: Math.min(25, Math.max(0.5, Number(cfgDraft.platformFeePct) || 5)),
      minDepositInr: Math.max(10, Number(cfgDraft.minDepositInr) || 100),
      minWithdrawInr: Math.max(10, Number(cfgDraft.minWithdrawInr) || 100),
      referrerBonusInr: Math.max(0, Number(cfgDraft.referrerBonusInr ?? 50)),
      refereeBonusInr: Math.max(0, Number(cfgDraft.refereeBonusInr ?? 25)),
      maxReferralsPerUser: Math.max(1, Math.floor(Number(cfgDraft.maxReferralsPerUser ?? 10))),
      referralBonusCapInr: Math.max(0, Number(cfgDraft.referralBonusCapInr ?? 500)),
    });
  };

  const handleResetDefaults = () => {
    setCfgDraft(DEFAULT_REFERRAL_CONFIG);
    onUpdateReferralConfig(DEFAULT_REFERRAL_CONFIG);
  };

  const handleCreateGiftCode = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newGiftCode.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    const initialAmt = Math.max(1, Math.round((Number(newGiftAmount) || 0) * 100) / 100);
    const stepDec = Math.max(0, Math.round((Number(newGiftStepDecrease) || 0) * 100) / 100);
    const minFloor = Math.max(
      1,
      Math.min(initialAmt, Math.round((Number(newGiftMinAmount) || 1) * 100) / 100)
    );
    const maxUsers = Math.max(1, Math.floor(Number(newGiftMaxClaims) || 1));
    if (!clean || !Number.isFinite(initialAmt) || initialAmt <= 0) return;
    onAddGiftCode({
      code: clean,
      amount: initialAmt,
      initialAmount: initialAmt,
      stepDecreaseInr: stepDec,
      minAmount: minFloor,
      maxClaims: maxUsers,
      claimsCount: 0,
      claimedByEmails: [],
      label: newGiftLabel.trim() || 'Owner Reward Code',
      active: true,
    });
    setNewGiftCode('');
  };

  const handleToggleVoiceMic = () => {
    setVoiceError('');
    if (voiceListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setVoiceListening(false);
      return;
    }
    const win = window as unknown as {
      SpeechRecognition?: new () => {
        lang: string;
        interimResults: boolean;
        continuous: boolean;
        onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
        onerror: ((ev: { error?: string }) => void) | null;
        onend: (() => void) | null;
        start: () => void;
        stop: () => void;
      };
      webkitSpeechRecognition?: new () => {
        lang: string;
        interimResults: boolean;
        continuous: boolean;
        onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
        onerror: ((ev: { error?: string }) => void) | null;
        onend: (() => void) | null;
        start: () => void;
        stop: () => void;
      };
    };
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SpeechRec) {
      setVoiceError('Browser microphone speech API unavailable here — type your command below.');
      return;
    }
    try {
      const rec = new SpeechRec();
      rec.lang = 'en-IN';
      rec.interimResults = true;
      rec.continuous = false;
      rec.onresult = (ev) => {
        const parts: string[] = [];
        for (let i = 0; i < ev.results.length; i += 1) {
          parts.push(ev.results[i][0]?.transcript ?? '');
        }
        setVoiceTranscript(parts.join(' ').trim());
      };
      rec.onerror = (ev) => {
        setVoiceError(`Mic error: ${ev.error || 'permission denied'}`);
        setVoiceListening(false);
      };
      rec.onend = () => {
        setVoiceListening(false);
      };
      recognitionRef.current = rec;
      rec.start();
      setVoiceListening(true);
    } catch {
      setVoiceError('Unable to start microphone.');
      setVoiceListening(false);
    }
  };

  const handleParseVoiceCommand = async () => {
    const clean = voiceTranscript.trim();
    if (clean.length < 4) {
      setVoiceError('Speak or enter a voice command first (e.g. "Agle election mein kaun PM banega Amit Shah Yes or No").');
      return;
    }
    setVoiceError('');
    setVoiceBusy(true);
    try {
      const resp = await fetch('/api/admin/parse-voice-bet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: clean,
          ownerEmail: state.profile.email,
        }),
      });
      const data = await resp.json();
      const draft = data?.draft ?? data;
      if (!resp.ok || !draft?.question) {
        setVoiceError(data?.error || 'Could not parse voice command.');
        return;
      }
      setDraftQuestion(String(draft.question || ''));
      const rawCat = String(draft.category || 'Political');
      setDraftCategory(
        rawCat === 'Sports' ||
          rawCat === 'Crypto' ||
          rawCat === 'Famous Games' ||
          rawCat === 'Mobile Brands' ||
          rawCat === 'Political'
          ? rawCat
          : 'Political'
      );
      setDraftSubLabel(String(draft.subLabel || 'Owner Desk'));
      setDraftEndLabel(String(draft.endLabel || 'Live Web Settled'));
      const hrs = Math.max(1, Math.round((Number(draft.endsInSeconds) || 86400) / 3600));
      setDraftEndsHours(String(hrs));
      setDraftCriteria(String(draft.resolutionCriteria || ''));
    } catch {
      setVoiceError('Network error calling voice bet parser.');
    } finally {
      setVoiceBusy(false);
    }
  };

  const handlePublishVoiceMarket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftQuestion.trim() || !onCreatePredictionMarket) return;
    onCreatePredictionMarket({
      question: draftQuestion.trim(),
      category: draftCategory,
      subLabel: draftSubLabel.trim() || `${draftCategory} · Owner Desk`,
      endLabel: draftEndLabel.trim() || 'Live Web Settled',
      endsInSeconds: Math.max(300, (Number(draftEndsHours) || 24) * 3600),
      resolutionCriteria: draftCriteria.trim() || undefined,
    });
    setDraftQuestion('');
    setDraftCriteria('');
    setVoiceTranscript('');
  };

  const handleCheckLiveWebAndSettle = async (marketId: string) => {
    const market = state.predictions.find((m) => m.id === marketId);
    if (!market) return;
    setResolvingMarketId(marketId);
    setResolveFeedback(null);
    try {
      const resp = await fetch('/api/admin/resolve-prediction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerEmail: state.profile.email,
          market: {
            id: market.id,
            question: market.question,
            subLabel: market.subLabel,
            resolutionCriteria: market.resolutionCriteria,
          },
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setResolveFeedback({
          marketId,
          status: 'error',
          summary: data?.error || 'Live web verification failed.',
        });
        return;
      }
      if (data.outcome === 'yes' || data.outcome === 'no') {
        onResolvePredictionMarket?.({
          marketId: market.id,
          outcome: data.outcome,
          summary: String(data.summary || `Verified live outcome: ${data.outcome.toUpperCase()}`),
          sources: Array.isArray(data.sources) ? data.sources : [],
        });
      }
      setResolveFeedback({
        marketId,
        status: String(data.outcome || 'pending'),
        summary: String(data.summary || ''),
        sources: Array.isArray(data.sources) ? data.sources : [],
      });
    } catch {
      setResolveFeedback({
        marketId,
        status: 'error',
        summary: 'Network error reaching live web settlement verifier.',
      });
    } finally {
      setResolvingMarketId(null);
    }
  };

  const handleSendBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifTitle.trim() || !notifMsg.trim()) return;
    onBroadcastNotification({
      title: notifTitle.trim(),
      msg: notifMsg.trim(),
      category: notifCategory,
      targetEmail: notifTarget,
    });
    setNotifTitle('');
    setNotifMsg('');
  };

  const handleCreateUpiGateway = (e: React.FormEvent) => {
    e.preventDefault();
    setUpiFormError('');
    const check = validateUpiId(newUpiId);
    if (!check.valid) {
      setUpiFormError(check.error ?? 'Enter a valid UPI ID (e.g. merchant@okaxis).');
      return;
    }
    onAddMerchantUpi({
      label: newUpiLabel.trim() || `Merchant UPI ${merchantUpiPool.length + 1}`,
      upiId: check.cleaned,
      payeeName: newUpiPayee.trim() || 'Ouroboros Desk',
    });
    setNewUpiLabel('');
    setNewUpiId('');
  };

  const handleSavePlatformSettings = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdatePlatformSettings({
      ...settingsDraft,
      maxDepositInr: Math.max(effectiveCfg.minDepositInr, Number(settingsDraft.maxDepositInr) || 100000),
      maxWithdrawInr: Math.max(effectiveCfg.minWithdrawInr, Number(settingsDraft.maxWithdrawInr) || 100000),
    });
  };

  const sidebarItems: {
    id: AdminSection;
    label: string;
    icon: React.ReactNode;
    badge?: number;
    badgeTone?: 'amber' | 'purple' | 'emerald';
  }[] = [
    {
      id: 'overview',
      label: 'Overview & Rules',
      icon: <Settings2 className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'deposits',
      label: 'Deposit Requests',
      icon: <ArrowDownLeft className="w-4 h-4 shrink-0" />,
      badge: pendingDeposits.length,
      badgeTone: pendingDeposits.length > 0 ? 'amber' : 'purple',
    },
    {
      id: 'withdrawals',
      label: 'Withdrawal Desk',
      icon: <ArrowUpRight className="w-4 h-4 shrink-0" />,
      badge: pendingWithdrawals.length,
      badgeTone: pendingWithdrawals.length > 0 ? 'amber' : 'purple',
    },
    {
      id: 'users',
      label: 'User Management',
      icon: <Users className="w-4 h-4 shrink-0" />,
      badge: accounts.length,
      badgeTone: 'purple',
    },
    {
      id: 'notifications',
      label: 'Broadcast Alerts',
      icon: <BellRing className="w-4 h-4 shrink-0" />,
      badge: broadcasts.length > 0 ? broadcasts.length : undefined,
      badgeTone: 'emerald',
    },
    {
      id: 'tickets',
      label: 'Support Tickets',
      icon: <Headphones className="w-4 h-4 shrink-0" />,
      badge: openTicketsCount,
      badgeTone: openTicketsCount > 0 ? 'amber' : 'purple',
    },
    {
      id: 'markets',
      label: 'Markets & Gifts',
      icon: <Coins className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'settings',
      label: 'Gateway & Settings',
      icon: <SlidersHorizontal className="w-4 h-4 shrink-0" />,
      badge: merchantUpiPool.filter((u) => u.active).length || undefined,
      badgeTone: 'emerald',
    },
  ];

  const getBadgeClasses = (tone?: 'amber' | 'purple' | 'emerald', active?: boolean) => {
    if (active) return 'bg-white/25 text-white';
    if (tone === 'amber') return 'bg-amber-500/20 text-amber-300';
    if (tone === 'emerald') return 'bg-emerald-500/20 text-emerald-300';
    return 'bg-[#7c3aed]/20 text-[#a78bfa]';
  };

  return (
    <div className="space-y-4 sm:space-y-5 animate-fade-up">
      {/* Owner Header Banner */}
      <section
        className="hero-preserve-dark relative overflow-hidden rounded-[22px] sm:rounded-[26px] p-4 sm:p-5 border border-white/15 shadow-[0_18px_46px_rgba(76,29,149,0.38)]"
        style={{
          background: 'linear-gradient(155deg, #240b4f 0%, #4c1d95 50%, #7c3aed 100%)',
        }}
      >
        <div aria-hidden="true" className="profile-header-shine" />

        <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              aria-label="Back to profile"
              className="btn-press w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 flex items-center justify-center text-white shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="inline-flex items-center gap-1.5 text-[10px] sm:text-[10.5px] font-extrabold uppercase tracking-wider text-emerald-200">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Owner Control Console</span>
              </div>
              <h1 className="font-display text-base sm:text-xl font-extrabold text-white">
                Ouroboros Admin Panel
              </h1>
              <p className="text-[11px] text-purple-100/80 font-mono-nums">
                Owner: {ADMIN_OWNER_EMAIL}
              </p>
            </div>
          </div>

          <span className="px-2.5 sm:px-3 py-1 rounded-full bg-emerald-400/20 border border-emerald-300/35 text-[11px] sm:text-xs font-bold text-emerald-100 whitespace-nowrap">
            Owner Exclusive
          </span>
        </div>

        {/* 4 Key KPI Tiles */}
        <div className="relative z-10 grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5 mt-3.5 sm:mt-4">
          <div className="rounded-xl sm:rounded-2xl bg-white/12 border border-white/15 p-2.5 sm:p-3">
            <div className="text-[10px] sm:text-[10.5px] font-semibold text-purple-100/80">
              Owner Fee &amp; Pool Profit
            </div>
            <div className="text-base sm:text-lg font-extrabold text-white font-mono-nums mt-0.5">
              {formatCurrency(state.ownerFeeRevenue ?? 0, currency, fxRates)}
            </div>
          </div>
          <div className="rounded-xl sm:rounded-2xl bg-white/12 border border-white/15 p-2.5 sm:p-3">
            <div className="text-[10px] sm:text-[10.5px] font-semibold text-purple-100/80">
              Active P2P Orders
            </div>
            <div className="text-base sm:text-lg font-extrabold text-emerald-200 font-mono-nums mt-0.5">
              {activeP2pOrdersCount} Open
            </div>
          </div>
          <div className="rounded-xl sm:rounded-2xl bg-white/12 border border-white/15 p-2.5 sm:p-3">
            <div className="text-[10px] sm:text-[10.5px] font-semibold text-purple-100/80">
              Registered Users
            </div>
            <div className="text-base sm:text-lg font-extrabold text-amber-200 font-mono-nums mt-0.5">
              {platformSummary.totalUsersCount} Accounts
            </div>
          </div>
          <div className="rounded-xl sm:rounded-2xl bg-white/12 border border-white/15 p-2.5 sm:p-3">
            <div className="text-[10px] sm:text-[10.5px] font-semibold text-purple-100/80">
              Action Queue
            </div>
            <div className="text-sm sm:text-base font-extrabold text-white font-mono-nums mt-0.5">
              {pendingDeposits.length} Dep · {pendingWithdrawals.length} Wd · {openTicketsCount} Tkt
            </div>
          </div>
        </div>
      </section>

      {/* Main Sidebar + Active Operational Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-[232px_1fr] gap-4 sm:gap-5 items-start">
        {/* Sidebar Navigation (Vertical sticky on lg+, horizontal scrollable strip on mobile) */}
        <aside
          aria-label="Admin control sidebar"
          className="rounded-2xl bg-[#13131f] border border-white/[0.08] p-2 sm:p-2.5 lg:sticky lg:top-20"
        >
          <div className="hidden lg:block px-2.5 pt-1 pb-2 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            Admin Modules
          </div>
          <nav
            role="tablist"
            aria-label="Admin sidebar sections"
            className="flex lg:flex-col gap-1.5 overflow-x-auto no-scrollbar"
          >
            {sidebarItems.map((item) => {
              const active = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveSection(item.id)}
                  className={`btn-press min-h-[40px] px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between gap-2 whitespace-nowrap shrink-0 lg:w-full transition-all ${
                    active
                      ? 'preserve-white bg-[#7c3aed] text-white shadow-[0_4px_14px_rgba(124,58,237,0.35)]'
                      : 'bg-transparent hover:bg-white/[0.04] text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="inline-flex items-center gap-2 min-w-0">
                    {item.icon}
                    <span>{item.label}</span>
                  </span>
                  {item.badge !== undefined && (
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono-nums font-extrabold ${getBadgeClasses(
                        item.badgeTone,
                        active
                      )}`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Active Panel Content */}
        <div className="min-w-0 space-y-5">
          {/* PANEL 1: Overview & Rules */}
          {activeSection === 'overview' && (
            <div className="space-y-5">
              {/* Financial & User Platform Analytics Strip */}
              <section className="rounded-2xl bg-[#13131f] border border-white/[0.08] p-4 sm:p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-base font-bold text-white inline-flex items-center gap-2">
                      <Wallet className="w-4 h-4 text-[#a78bfa]" />
                      Owner Financial &amp; User Summary
                    </h2>
                    <p className="text-xs text-slate-400">
                      Real-time verified deposits, payouts, net float, and trader account health
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveSection('settings')}
                    className="btn-press px-3 py-1.5 rounded-xl bg-[#7c3aed]/20 hover:bg-[#7c3aed]/35 border border-[#7c3aed]/40 text-[11px] font-bold text-[#c4b5fd] inline-flex items-center gap-1.5"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    Gateway &amp; Settings
                  </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2.5">
                  <div className="rounded-xl bg-[#191928] border border-white/[0.07] p-3">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Verified Deposits
                    </div>
                    <div className="text-base font-extrabold text-emerald-400 font-mono-nums mt-1">
                      {formatCurrency(platformSummary.verifiedDepositsTotalInr, currency, fxRates)}
                    </div>
                    <div className="text-[10.5px] text-slate-400 font-mono-nums mt-0.5">
                      {platformSummary.verifiedDepositsCount} verified
                    </div>
                  </div>

                  <div className="rounded-xl bg-[#191928] border border-white/[0.07] p-3">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Completed Withdrawals
                    </div>
                    <div className="text-base font-extrabold text-rose-400 font-mono-nums mt-1">
                      {formatCurrency(platformSummary.completedWithdrawalsTotalInr, currency, fxRates)}
                    </div>
                    <div className="text-[10.5px] text-slate-400 font-mono-nums mt-0.5">
                      {platformSummary.completedWithdrawalsCount} payouts
                    </div>
                  </div>

                  <div className="rounded-xl bg-[#191928] border border-white/[0.07] p-3">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Net Platform Float
                    </div>
                    <div className="text-base font-extrabold text-white font-mono-nums mt-1">
                      {formatCurrency(platformSummary.netPlatformFloatInr, currency, fxRates)}
                    </div>
                    <div className="text-[10.5px] text-slate-400 font-mono-nums mt-0.5">
                      Deposits − Payouts
                    </div>
                  </div>

                  <div className="rounded-xl bg-[#191928] border border-white/[0.07] p-3">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Owner Fee Profit
                    </div>
                    <div className="text-base font-extrabold text-[#c4b5fd] font-mono-nums mt-1">
                      {formatCurrency(platformSummary.ownerFeeRevenue, currency, fxRates)}
                    </div>
                    <div className="text-[10.5px] text-slate-400 font-mono-nums mt-0.5">
                      Trade &amp; Bet fees
                    </div>
                  </div>

                  <div className="rounded-xl bg-[#191928] border border-white/[0.07] p-3">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Pending Dep / Wd
                    </div>
                    <div className="text-sm font-extrabold text-amber-300 font-mono-nums mt-1">
                      {formatCurrency(platformSummary.pendingDepositsTotalInr, currency, fxRates)}
                    </div>
                    <div className="text-[10.5px] text-slate-400 font-mono-nums mt-0.5">
                      Wd queue: {formatCurrency(platformSummary.pendingWithdrawalsTotalInr, currency, fxRates)}
                    </div>
                  </div>

                  <div className="rounded-xl bg-[#191928] border border-white/[0.07] p-3">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Registered Users
                    </div>
                    <div className="text-base font-extrabold text-white font-mono-nums mt-1">
                      {platformSummary.totalUsersCount} Total
                    </div>
                    <div className="text-[10.5px] text-slate-400 font-mono-nums mt-0.5">
                      {platformSummary.activeUsersCount} Act · {platformSummary.frozenUsersCount} Frz · {platformSummary.bannedUsersCount} Ban
                    </div>
                  </div>
                </div>
              </section>

              <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
              <section className="xl:col-span-6 rounded-2xl bg-[#13131f] border border-white/[0.08] p-4 sm:p-5 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-base font-bold text-white">
                      P2P Settlement Fee &amp; Wallet Limits
                    </h2>
                    <p className="text-xs text-slate-400">
                      Applies immediately across P2P matching, Trade Terminal &amp; Wallet flows
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleResetDefaults}
                    className="btn-press px-3 py-1.5 rounded-lg bg-[#191928] border border-white/10 text-[11px] font-bold text-slate-300 inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset
                  </button>
                </div>

                <form onSubmit={handleSaveConfig} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <label className="flex flex-col justify-between">
                      <span className="text-[11px] font-semibold text-slate-400">
                        P2P Win Fee (%)
                      </span>
                      <input
                        type="number"
                        min={0.5}
                        max={25}
                        step={0.5}
                        value={cfgDraft.platformFeePct}
                        onChange={(e) =>
                          setCfgDraft({
                            ...cfgDraft,
                            platformFeePct: Number(e.target.value),
                          })
                        }
                        aria-label="P2P Winner Pool Fee percent"
                        className="mt-1.5 w-full h-10 px-3 rounded-xl bg-[#191928] border border-white/10 text-sm font-mono-nums text-white focus:outline-none focus:border-[#7c3aed]"
                      />
                    </label>

                    <label className="flex flex-col justify-between">
                      <span className="text-[11px] font-semibold text-slate-400">
                        Min Deposit (₹)
                      </span>
                      <input
                        type="number"
                        min={10}
                        step={10}
                        value={cfgDraft.minDepositInr}
                        onChange={(e) =>
                          setCfgDraft({
                            ...cfgDraft,
                            minDepositInr: Number(e.target.value),
                          })
                        }
                        aria-label="Minimum deposit INR"
                        className="mt-1.5 w-full h-10 px-3 rounded-xl bg-[#191928] border border-white/10 text-sm font-mono-nums text-white focus:outline-none focus:border-[#7c3aed]"
                      />
                    </label>

                    <label className="flex flex-col justify-between">
                      <span className="text-[11px] font-semibold text-slate-400">
                        Min Withdraw (₹)
                      </span>
                      <input
                        type="number"
                        min={10}
                        step={10}
                        value={cfgDraft.minWithdrawInr}
                        onChange={(e) =>
                          setCfgDraft({
                            ...cfgDraft,
                            minWithdrawInr: Number(e.target.value),
                          })
                        }
                        aria-label="Minimum withdraw INR"
                        className="mt-1.5 w-full h-10 px-3 rounded-xl bg-[#191928] border border-white/10 text-sm font-mono-nums text-white focus:outline-none focus:border-[#7c3aed]"
                      />
                    </label>
                  </div>

                  {/* Capped Referral Program Controls */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                    <label className="flex flex-col justify-between">
                      <span className="text-[11px] font-semibold text-slate-400">
                        Referrer Bonus (₹)
                      </span>
                      <input
                        type="number"
                        min={0}
                        step={5}
                        value={cfgDraft.referrerBonusInr ?? 50}
                        onChange={(e) =>
                          setCfgDraft({
                            ...cfgDraft,
                            referrerBonusInr: Number(e.target.value),
                          })
                        }
                        aria-label="Referrer bonus INR"
                        className="mt-1.5 w-full h-10 px-3 rounded-xl bg-[#191928] border border-white/10 text-sm font-mono-nums text-white focus:outline-none focus:border-[#7c3aed]"
                      />
                    </label>
                    <label className="flex flex-col justify-between">
                      <span className="text-[11px] font-semibold text-slate-400">
                        Referee Bonus (₹)
                      </span>
                      <input
                        type="number"
                        min={0}
                        step={5}
                        value={cfgDraft.refereeBonusInr ?? 25}
                        onChange={(e) =>
                          setCfgDraft({
                            ...cfgDraft,
                            refereeBonusInr: Number(e.target.value),
                          })
                        }
                        aria-label="Referee bonus INR"
                        className="mt-1.5 w-full h-10 px-3 rounded-xl bg-[#191928] border border-white/10 text-sm font-mono-nums text-white focus:outline-none focus:border-[#7c3aed]"
                      />
                    </label>
                    <label className="flex flex-col justify-between">
                      <span className="text-[11px] font-semibold text-slate-400">
                        Max Referrals / User
                      </span>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={cfgDraft.maxReferralsPerUser ?? 10}
                        onChange={(e) =>
                          setCfgDraft({
                            ...cfgDraft,
                            maxReferralsPerUser: Number(e.target.value),
                          })
                        }
                        aria-label="Max referrals per user"
                        className="mt-1.5 w-full h-10 px-3 rounded-xl bg-[#191928] border border-white/10 text-sm font-mono-nums text-white focus:outline-none focus:border-[#7c3aed]"
                      />
                    </label>
                    <label className="flex flex-col justify-between">
                      <span className="text-[11px] font-semibold text-slate-400">
                        Lifetime Cap (₹)
                      </span>
                      <input
                        type="number"
                        min={0}
                        step={50}
                        value={cfgDraft.referralBonusCapInr ?? 500}
                        onChange={(e) =>
                          setCfgDraft({
                            ...cfgDraft,
                            referralBonusCapInr: Number(e.target.value),
                          })
                        }
                        aria-label="Lifetime referral bonus cap INR"
                        className="mt-1.5 w-full h-10 px-3 rounded-xl bg-[#191928] border border-white/10 text-sm font-mono-nums text-white focus:outline-none focus:border-[#7c3aed]"
                      />
                    </label>
                  </div>

                  {/* Active P2P Rule Engine Summary */}
                  <div className="rounded-xl bg-[#191928] border border-white/[0.07] p-3.5 space-y-2 text-xs text-slate-300">
                    <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#c4b5fd]">
                      Active P2P Rule Engine Summary
                    </div>
                    <ul className="space-y-1.5 text-[11.5px] leading-relaxed text-slate-400">
                      <li>
                        <strong className="text-white">Rule 1 · Opposite Match (UP vs DOWN):</strong>{' '}
                        Live price vs match anchor picks winner; winner receives matched pool minus{' '}
                        <strong className="text-emerald-300">{cfgDraft.platformFeePct}%</strong> fee.
                      </li>
                      <li>
                        <strong className="text-white">Rule 2A · Same-Side Opposite Move:</strong>{' '}
                        Both UP + price drops, or Both DOWN + price rises → both lose &amp; entire invested
                        pool credits directly to Owner Fee &amp; Pool Profit.
                      </li>
                      <li>
                        <strong className="text-white">Rule 2B &amp; 3 · Same-Side Match / No-Match:</strong>{' '}
                        Same-direction or flat outcome, or expired unmatched order →{' '}
                        <strong className="text-sky-300">Cancelled/Refunded</strong> with 100% full refund
                        and ₹0 commission.
                      </li>
                    </ul>
                  </div>

                  <button
                    type="submit"
                    className="preserve-white btn-press w-full min-h-[44px] rounded-xl bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-sm font-extrabold inline-flex items-center justify-center gap-2 shadow-[0_6px_18px_rgba(124,58,237,0.35)]"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Save P2P Fee &amp; Wallet Rules
                  </button>
                </form>
              </section>

              <section className="xl:col-span-6 rounded-2xl bg-[#13131f] border border-white/[0.08] p-4 sm:p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-bold text-white">
                    Owner P2P Pool &amp; Commission Ledger
                  </h2>
                  <span className="text-xs font-mono-nums text-slate-400">
                    {ledger.length} events
                  </span>
                </div>

                {ledger.length === 0 ? (
                  <div className="py-10 text-center rounded-2xl bg-[#191928] border border-white/[0.06] px-4">
                    <TrendingUp className="w-8 h-8 text-[#a78bfa] mx-auto mb-2" />
                    <div className="text-sm font-bold text-white">
                      No P2P settlement events yet
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Events appear automatically when matched opposite P2P trades settle or when
                      same-side predictions forfeit their pool to the platform owner.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/[0.06] max-h-[420px] overflow-y-auto pr-1">
                    {ledger.map((entry) => (
                      <div key={entry.id} className="py-3 space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                            <span className="text-xs font-bold text-white">
                              {entry.actorName}
                            </span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#7c3aed]/15 text-[#c4b5fd]">
                              {entry.kind === 'matched_opposite'
                                ? 'Matched Opposite'
                                : entry.kind === 'same_side_forfeiture'
                                ? 'Same-Side Forfeiture'
                                : entry.kind}
                            </span>
                          </div>
                          <span className="text-xs font-bold text-emerald-400 font-mono-nums shrink-0">
                            Owner +
                            {formatCurrency(entry.ownerNetRevenueInr, currency, fxRates)}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400">{entry.note}</div>
                        <div className="text-[10px] text-slate-500 font-mono-nums">
                          {entry.timestamp} · Pool Gross{' '}
                          {formatCurrency(entry.grossAmountInr, currency, fxRates)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
              </div>
            </div>
          )}

          {/* PANEL 2: Deposit Requests (Verify UTR & Credit / Reject) */}
          {activeSection === 'deposits' && (
            <section className="rounded-2xl bg-[#13131f] border border-white/[0.08] p-4 sm:p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-white">
                    Deposit UTR Verification Queue
                  </h2>
                  <p className="text-xs text-slate-400">
                    Copy &amp; match 12-digit UTR in your bank/UPI app, then click Verify UTR
                    &amp; Credit to fund user wallet
                  </p>
                </div>

                <div className="inline-flex p-1 rounded-xl bg-[#191928] border border-white/[0.08] shrink-0 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setDepositFilter('pending')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                      depositFilter === 'pending'
                        ? 'preserve-white bg-[#7c3aed] text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Pending ({pendingDeposits.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setDepositFilter('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                      depositFilter === 'all'
                        ? 'preserve-white bg-[#7c3aed] text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    All ({depositTxs.length})
                  </button>
                </div>
              </div>

              {visibleDeposits.length === 0 ? (
                <div className="py-12 text-center rounded-2xl bg-[#191928] border border-white/[0.06] text-xs text-slate-400">
                  {depositFilter === 'pending'
                    ? 'No pending deposit UTR verifications.'
                    : 'No deposit requests recorded yet.'}
                </div>
              ) : (
                <div className="space-y-3">
                  {visibleDeposits.map((tx) => {
                    const isPending =
                      tx.status !== 'Credited' &&
                      tx.status !== 'Completed' &&
                      tx.status !== 'Rejected' &&
                      !tx.credited;
                    const isRejecting = rejectTxId === tx.id;

                    return (
                      <div
                        key={tx.id}
                        className="p-3.5 sm:p-4 rounded-2xl bg-[#191928] border border-white/[0.07] space-y-3"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-extrabold text-white">
                                {tx.userName || 'User'}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  tx.status === 'Credited' || tx.status === 'Completed'
                                    ? 'bg-emerald-500/20 text-emerald-300'
                                    : tx.status === 'Rejected'
                                    ? 'bg-rose-500/20 text-rose-300'
                                    : 'bg-amber-500/20 text-amber-300'
                                }`}
                              >
                                {tx.status}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono-nums truncate">
                              {tx.userEmail || 'N/A'} · {tx.userUid || tx.id}
                            </div>
                            <div className="text-xs text-slate-300">
                              {tx.title} ·{' '}
                              <span className="text-slate-400">{tx.timestamp}</span>
                            </div>
                            {tx.utr && (
                              <div className="inline-flex items-center gap-2 mt-1 px-2.5 py-1 rounded-lg bg-[#7c3aed]/15 border border-[#7c3aed]/30">
                                <span className="text-[11px] font-mono-nums font-extrabold text-[#c4b5fd]">
                                  UTR: {tx.utr}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleCopyText(tx.utr!, `utr-${tx.id}`)}
                                  className="inline-flex items-center gap-1 text-[10.5px] font-bold text-white bg-[#7c3aed]/35 hover:bg-[#7c3aed]/55 px-2 py-0.5 rounded"
                                >
                                  {copiedId === `utr-${tx.id}` ? (
                                    <>
                                      <Check className="w-3 h-3 text-emerald-300" />
                                      Copied
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3 h-3" />
                                      Copy UTR
                                    </>
                                  )}
                                </button>
                              </div>
                            )}
                            {tx.rejectionReason && (
                              <div className="text-[11px] text-rose-400 font-medium">
                                Reason: {tx.rejectionReason}
                              </div>
                            )}
                          </div>

                          <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0">
                            <div className="text-lg font-extrabold text-emerald-400 font-mono-nums">
                              +{formatCurrency(tx.amount, currency, fxRates)}
                            </div>

                            {isPending && !isRejecting && (
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => onVerifyDeposit(tx.id)}
                                  className="preserve-white btn-press min-h-[36px] px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold inline-flex items-center gap-1.5 whitespace-nowrap"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Verify UTR &amp; Credit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRejectTxId(tx.id);
                                    setRejectReason('UTR mismatch / not received');
                                  }}
                                  className="btn-press min-h-[36px] px-3 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/35 text-rose-300 text-xs font-bold inline-flex items-center gap-1 whitespace-nowrap"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                  Reject
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {isRejecting && (
                          <div className="pt-2 border-t border-white/[0.06] flex flex-col sm:flex-row gap-2">
                            <input
                              type="text"
                              value={rejectReason}
                              onChange={(e) => setRejectReason(e.target.value)}
                              placeholder="Reason for rejecting deposit..."
                              className="flex-1 h-9 px-3 rounded-lg bg-[#13131f] border border-rose-500/35 text-xs text-white focus:outline-none"
                            />
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  onRejectDeposit(tx.id, rejectReason);
                                  setRejectTxId(null);
                                  setRejectReason('');
                                }}
                                className="preserve-white btn-press h-9 px-3.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold whitespace-nowrap"
                              >
                                Confirm Reject
                              </button>
                              <button
                                type="button"
                                onClick={() => setRejectTxId(null)}
                                className="h-9 px-3 rounded-lg bg-white/10 text-slate-300 text-xs font-semibold"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* PANEL 3: Withdrawal Desk (Copy UPI/Bank, Approve or Reject & Refund) */}
          {activeSection === 'withdrawals' && (
            <section className="rounded-2xl bg-[#13131f] border border-white/[0.08] p-4 sm:p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-white">
                    Withdrawal Payout Desk
                  </h2>
                  <p className="text-xs text-slate-400">
                    Copy user&apos;s bound UPI ID or Bank details with 1 click, send payout, then
                    Confirm or Reject &amp; Refund with reason
                  </p>
                </div>

                <div className="inline-flex p-1 rounded-xl bg-[#191928] border border-white/[0.08] shrink-0 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setWithdrawFilter('pending')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                      withdrawFilter === 'pending'
                        ? 'preserve-white bg-[#7c3aed] text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    In Process ({pendingWithdrawals.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setWithdrawFilter('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                      withdrawFilter === 'all'
                        ? 'preserve-white bg-[#7c3aed] text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    All ({withdrawalTxs.length})
                  </button>
                </div>
              </div>

              {visibleWithdrawals.length === 0 ? (
                <div className="py-12 text-center rounded-2xl bg-[#191928] border border-white/[0.06] text-xs text-slate-400">
                  {withdrawFilter === 'pending'
                    ? 'No withdrawal requests awaiting payout.'
                    : 'No withdrawal history yet.'}
                </div>
              ) : (
                <div className="space-y-3">
                  {visibleWithdrawals.map((tx) => {
                    const isPending =
                      tx.status === 'In Process' || tx.status === 'Under Review';
                    const isRejecting = rejectTxId === tx.id;
                    const copyPayload =
                      tx.destinationCopyValue || tx.destinationSummary || tx.title;

                    return (
                      <div
                        key={tx.id}
                        className="p-3.5 sm:p-4 rounded-2xl bg-[#191928] border border-white/[0.07] space-y-3"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-extrabold text-white">
                                {tx.userName || 'User'}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  tx.status === 'Completed'
                                    ? 'bg-emerald-500/20 text-emerald-300'
                                    : tx.status === 'Rejected'
                                    ? 'bg-rose-500/20 text-rose-300'
                                    : 'bg-amber-500/20 text-amber-300'
                                }`}
                              >
                                {tx.status}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono-nums truncate">
                              {tx.userEmail || 'N/A'} · {tx.userUid || tx.id} · {tx.timestamp}
                            </div>
                            <div className="text-xs font-semibold text-white">
                              {tx.destinationSummary || tx.title}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleCopyText(copyPayload, `wd-${tx.id}`)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#7c3aed]/15 hover:bg-[#7c3aed]/30 border border-[#7c3aed]/30 text-[11px] font-bold text-[#c4b5fd]"
                            >
                              {copiedId === `wd-${tx.id}` ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-300" />
                                  Copied UPI / Bank Details!
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" />
                                  Copy UPI / Bank Details
                                </>
                              )}
                            </button>
                            {tx.rejectionReason && (
                              <div className="text-[11px] text-rose-400 font-medium">
                                Rejected &amp; Refunded: {tx.rejectionReason}
                              </div>
                            )}
                          </div>

                          <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0">
                            <div className="text-lg font-extrabold text-rose-400 font-mono-nums">
                              {formatCurrency(Math.abs(tx.amount), currency, fxRates)}
                            </div>

                            {isPending && !isRejecting && (
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => onApproveWithdrawal(tx.id)}
                                  className="preserve-white btn-press min-h-[36px] px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold inline-flex items-center gap-1.5 whitespace-nowrap"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Approve &amp; Complete
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRejectTxId(tx.id);
                                    setRejectReason('Invalid UPI / Bank IFSC mismatch');
                                  }}
                                  className="btn-press min-h-[36px] px-3 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/35 text-rose-300 text-xs font-bold inline-flex items-center gap-1 whitespace-nowrap"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                  Reject &amp; Refund
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {isRejecting && (
                          <div className="pt-2 border-t border-white/[0.06] flex flex-col sm:flex-row gap-2">
                            <input
                              type="text"
                              value={rejectReason}
                              onChange={(e) => setRejectReason(e.target.value)}
                              placeholder="Reason for rejecting withdrawal..."
                              className="flex-1 h-9 px-3 rounded-lg bg-[#13131f] border border-rose-500/35 text-xs text-white focus:outline-none"
                            />
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  onRejectWithdrawal(tx.id, rejectReason);
                                  setRejectTxId(null);
                                  setRejectReason('');
                                }}
                                className="preserve-white btn-press h-9 px-3.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold whitespace-nowrap"
                              >
                                Confirm Reject &amp; Refund
                              </button>
                              <button
                                type="button"
                                onClick={() => setRejectTxId(null)}
                                className="h-9 px-3 rounded-lg bg-white/10 text-slate-300 text-xs font-semibold"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* PANEL 4: User Management (Freeze/Unfreeze, Ban/Unban, Pause WD/Trade, Balance +/- Adjust) */}
          {activeSection === 'users' && (
            <section className="rounded-2xl bg-[#13131f] border border-white/[0.08] p-4 sm:p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-white">
                    Registered Users &amp; Account Controls
                  </h2>
                  <p className="text-xs text-slate-400">
                    Manage balances, freeze/ban accounts, pause withdrawals/trading &amp; audit totals
                  </p>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="search"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Search name, email, UID or code..."
                    className="w-full h-10 pl-9 pr-3 rounded-xl bg-[#191928] border border-white/10 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-[#7c3aed]"
                  />
                </div>
              </div>

              {/* Status Filter Tabs */}
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    { id: 'all', label: `All (${platformSummary.totalUsersCount})` },
                    { id: 'active', label: `Active (${platformSummary.activeUsersCount})` },
                    { id: 'frozen', label: `Frozen (${platformSummary.frozenUsersCount})` },
                    { id: 'banned', label: `Banned (${platformSummary.bannedUsersCount})` },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setUserFilter(tab.id)}
                    className={`btn-press px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                      userFilter === tab.id
                        ? 'preserve-white bg-[#7c3aed] text-white'
                        : 'bg-[#191928] border border-white/10 text-slate-400 hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {filteredAccounts.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-400">
                  No registered accounts match your query.
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredAccounts.map((acc) => {
                    const isThisOwner = isOwnerAdmin(acc.email);
                    const isCurrent =
                      acc.email.trim().toLowerCase() ===
                      state.profile.email.trim().toLowerCase();
                    const bal = isCurrent ? state.balance : acc.balance ?? 0;
                    const withdrawable = isCurrent
                      ? state.withdrawableBalance
                      : acc.withdrawableBalance ?? 0;
                    const banksCount = (
                      isCurrent ? state.bankAccounts : acc.bankAccounts ?? []
                    ).length;
                    const upisCount = (
                      isCurrent ? state.upiAccounts ?? [] : acc.upiAccounts ?? []
                    ).length;
                    const isFreezingThis = freezeEmail === acc.email;
                    const isBanningThis = banEmail === acc.email;
                    const isAdjustingThis = adjustEmail === acc.email;

                    return (
                      <div
                        key={acc.uid}
                        className={`p-3.5 sm:p-4 rounded-2xl border space-y-3 ${
                          acc.banned
                            ? 'bg-rose-950/30 border-rose-500/45'
                            : acc.frozen
                            ? 'bg-amber-950/20 border-amber-500/35'
                            : 'bg-[#191928] border-white/[0.07]'
                        }`}
                      >
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-bold text-white">
                                {acc.name}
                              </span>
                              {isThisOwner && (
                                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                                  OWNER
                                </span>
                              )}
                              {acc.banned && (
                                <span className="px-2 py-0.5 rounded bg-rose-600/30 text-rose-200 text-[10px] font-bold inline-flex items-center gap-1">
                                  <Ban className="w-2.5 h-2.5" />
                                  BANNED
                                </span>
                              )}
                              {acc.frozen && (
                                <span className="px-2 py-0.5 rounded bg-amber-500/25 text-amber-200 text-[10px] font-bold inline-flex items-center gap-1">
                                  <Lock className="w-2.5 h-2.5" />
                                  FROZEN
                                </span>
                              )}
                              {acc.withdrawalsBlocked && (
                                <span className="px-2 py-0.5 rounded bg-orange-500/20 text-orange-300 text-[10px] font-bold">
                                  WD PAUSED
                                </span>
                              )}
                              {acc.tradingBlocked && (
                                <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 text-[10px] font-bold">
                                  TRADE PAUSED
                                </span>
                              )}
                            </div>

                            <div className="text-xs text-slate-400 font-mono-nums truncate">
                              {acc.email} · {acc.uid}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono-nums flex flex-wrap gap-x-3 gap-y-0.5">
                              <span>
                                Deposited:{' '}
                                <strong className="text-emerald-300">
                                  {formatCurrency(acc.totalDepositedInr ?? 0, currency, fxRates)}
                                </strong>
                              </span>
                              <span>
                                Withdrawn:{' '}
                                <strong className="text-rose-300">
                                  {formatCurrency(acc.totalWithdrawnInr ?? 0, currency, fxRates)}
                                </strong>
                              </span>
                              <span>
                                Banks: {banksCount} · UPIs: {upisCount}
                              </span>
                            </div>
                            {acc.frozen && acc.freezeReason && (
                              <div className="text-[11px] text-amber-300 font-medium">
                                Freeze reason: {acc.freezeReason}
                              </div>
                            )}
                            {acc.banned && acc.banReason && (
                              <div className="text-[11px] text-rose-300 font-medium">
                                Ban reason: {acc.banReason}
                              </div>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            <div className="text-right mr-1">
                              <div className="text-[10px] text-slate-400">
                                Bal / Win Unlocked
                              </div>
                              <div className="text-sm font-extrabold text-white font-mono-nums">
                                {formatCurrency(bal, currency, fxRates)}{' '}
                                <span className="text-[11px] text-emerald-400">
                                  ({formatCurrency(withdrawable, currency, fxRates)})
                                </span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => onAdjustUserBalance(acc.email, 100)}
                              className="btn-press min-h-[34px] px-2.5 rounded-xl bg-[#7c3aed]/20 hover:bg-[#7c3aed]/35 border border-[#7c3aed]/40 text-xs font-bold text-[#a78bfa] whitespace-nowrap"
                            >
                              +₹100
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setAdjustEmail(isAdjustingThis ? null : acc.email);
                                setAdjustAmountDraft('250');
                              }}
                              className="btn-press min-h-[34px] px-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-slate-200 whitespace-nowrap"
                            >
                              Adjust +/-
                            </button>

                            {!isThisOwner && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (acc.frozen) {
                                      onToggleFreezeAccount(acc.email, false, '');
                                    } else {
                                      setBanEmail(null);
                                      setFreezeEmail(isFreezingThis ? null : acc.email);
                                      setFreezeReasonDraft('Suspicious activity check');
                                    }
                                  }}
                                  className={`btn-press min-h-[34px] px-2.5 rounded-xl text-xs font-bold inline-flex items-center gap-1 whitespace-nowrap ${
                                    acc.frozen
                                      ? 'bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/35 text-emerald-300'
                                      : 'bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/35 text-amber-300'
                                  }`}
                                >
                                  {acc.frozen ? (
                                    <>
                                      <Unlock className="w-3 h-3" />
                                      Unfreeze
                                    </>
                                  ) : (
                                    <>
                                      <Lock className="w-3 h-3" />
                                      Freeze
                                    </>
                                  )}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    if (acc.banned) {
                                      onToggleBanAccount(acc.email, false, '');
                                    } else {
                                      setFreezeEmail(null);
                                      setBanEmail(isBanningThis ? null : acc.email);
                                      setBanReasonDraft('Terms violation / multi-account abuse');
                                    }
                                  }}
                                  className={`btn-press min-h-[34px] px-2.5 rounded-xl text-xs font-bold inline-flex items-center gap-1 whitespace-nowrap ${
                                    acc.banned
                                      ? 'bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/35 text-emerald-300'
                                      : 'bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/35 text-rose-300'
                                  }`}
                                >
                                  <Ban className="w-3 h-3" />
                                  {acc.banned ? 'Unban' : 'Ban'}
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    onToggleUserRestriction(
                                      acc.email,
                                      'withdrawalsBlocked',
                                      !acc.withdrawalsBlocked
                                    )
                                  }
                                  className={`btn-press min-h-[34px] px-2.5 rounded-xl text-xs font-bold whitespace-nowrap border ${
                                    acc.withdrawalsBlocked
                                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                                      : 'bg-white/5 border-white/10 text-slate-300 hover:border-orange-400/50'
                                  }`}
                                >
                                  {acc.withdrawalsBlocked ? 'Allow WD' : 'Pause WD'}
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    onToggleUserRestriction(
                                      acc.email,
                                      'tradingBlocked',
                                      !acc.tradingBlocked
                                    )
                                  }
                                  className={`btn-press min-h-[34px] px-2.5 rounded-xl text-xs font-bold whitespace-nowrap border ${
                                    acc.tradingBlocked
                                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                                      : 'bg-white/5 border-white/10 text-slate-300 hover:border-sky-400/50'
                                  }`}
                                >
                                  {acc.tradingBlocked ? 'Allow Trade' : 'Pause Trade'}
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        {isAdjustingThis && (
                          <div className="pt-2 border-t border-white/[0.06] flex flex-col sm:flex-row gap-2">
                            <input
                              type="number"
                              step="1"
                              value={adjustAmountDraft}
                              onChange={(e) => setAdjustAmountDraft(e.target.value)}
                              placeholder="Amount in INR (use - for debit)"
                              className="flex-1 h-9 px-3 rounded-lg bg-[#13131f] border border-[#7c3aed]/40 text-xs font-mono-nums text-white focus:outline-none"
                            />
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  const delta = Number(adjustAmountDraft);
                                  if (Number.isFinite(delta) && delta !== 0) {
                                    onAdjustUserBalance(acc.email, delta);
                                  }
                                  setAdjustEmail(null);
                                }}
                                className="preserve-white btn-press h-9 px-3.5 rounded-lg bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-xs font-bold whitespace-nowrap"
                              >
                                Apply Adjustment
                              </button>
                              <button
                                type="button"
                                onClick={() => setAdjustEmail(null)}
                                className="h-9 px-3 rounded-lg bg-white/10 text-slate-300 text-xs font-semibold"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}

                        {isFreezingThis && !acc.frozen && (
                          <div className="pt-2 border-t border-white/[0.06] flex flex-col sm:flex-row gap-2">
                            <input
                              type="text"
                              value={freezeReasonDraft}
                              onChange={(e) => setFreezeReasonDraft(e.target.value)}
                              placeholder="Freeze reason shown to user..."
                              className="flex-1 h-9 px-3 rounded-lg bg-[#13131f] border border-amber-500/40 text-xs text-white focus:outline-none"
                            />
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  onToggleFreezeAccount(
                                    acc.email,
                                    true,
                                    freezeReasonDraft.trim() || 'Restricted by Owner'
                                  );
                                  setFreezeEmail(null);
                                }}
                                className="preserve-white btn-press h-9 px-3.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold whitespace-nowrap"
                              >
                                Confirm Freeze
                              </button>
                              <button
                                type="button"
                                onClick={() => setFreezeEmail(null)}
                                className="h-9 px-3 rounded-lg bg-white/10 text-slate-300 text-xs font-semibold"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}

                        {isBanningThis && !acc.banned && (
                          <div className="pt-2 border-t border-white/[0.06] flex flex-col sm:flex-row gap-2">
                            <input
                              type="text"
                              value={banReasonDraft}
                              onChange={(e) => setBanReasonDraft(e.target.value)}
                              placeholder="Permanent ban reason..."
                              className="flex-1 h-9 px-3 rounded-lg bg-[#13131f] border border-rose-500/40 text-xs text-white focus:outline-none"
                            />
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  onToggleBanAccount(
                                    acc.email,
                                    true,
                                    banReasonDraft.trim() || 'Permanently banned by Owner'
                                  );
                                  setBanEmail(null);
                                }}
                                className="preserve-white btn-press h-9 px-3.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold whitespace-nowrap"
                              >
                                Confirm Ban
                              </button>
                              <button
                                type="button"
                                onClick={() => setBanEmail(null)}
                                className="h-9 px-3 rounded-lg bg-white/10 text-slate-300 text-xs font-semibold"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* PANEL 5: Notifications Broadcast Desk */}
          {activeSection === 'notifications' && (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
              <section className="xl:col-span-6 rounded-2xl bg-[#13131f] border border-white/[0.08] p-4 sm:p-5 space-y-4">
                <div>
                  <h2 className="text-base font-bold text-white inline-flex items-center gap-2">
                    <BellRing className="w-4 h-4 text-[#a78bfa]" />
                    Send Platform Notification
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Deliver promo drops, wallet announcements, or system alerts to all users or a
                    specific member
                  </p>
                </div>

                <form onSubmit={handleSendBroadcast} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="block">
                      <span className="text-[11px] font-semibold text-slate-400">
                        Category
                      </span>
                      <select
                        value={notifCategory}
                        onChange={(e) =>
                          setNotifCategory(e.target.value as BroadcastCategory)
                        }
                        className="mt-1 w-full h-10 px-3 rounded-xl bg-[#191928] border border-white/10 text-xs font-semibold text-white focus:outline-none focus:border-[#7c3aed]"
                      >
                        <option value="promo">Promo / Bonus Offer</option>
                        <option value="wallet">Wallet / Deposit / Payout</option>
                        <option value="market">Market &amp; Trading Alert</option>
                        <option value="gift">Gift Code Drop</option>
                        <option value="system">System Notice</option>
                      </select>
                    </label>

                    <label className="block">
                      <span className="text-[11px] font-semibold text-slate-400">
                        Recipient Target
                      </span>
                      <select
                        value={notifTarget}
                        onChange={(e) => setNotifTarget(e.target.value)}
                        className="mt-1 w-full h-10 px-3 rounded-xl bg-[#191928] border border-white/10 text-xs font-semibold text-white focus:outline-none focus:border-[#7c3aed]"
                      >
                        <option value="ALL">All Users ({accounts.length} accounts)</option>
                        {accounts.map((acc) => (
                          <option key={acc.email} value={acc.email}>
                            {acc.name} ({acc.email})
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <label className="block">
                    <span className="text-[11px] font-semibold text-slate-400">
                      Notification Title
                    </span>
                    <input
                      type="text"
                      required
                      value={notifTitle}
                      onChange={(e) => setNotifTitle(e.target.value)}
                      placeholder="e.g. Weekend Bonus Drop Live!"
                      className="mt-1 w-full h-10 px-3 rounded-xl bg-[#191928] border border-white/10 text-xs text-white focus:outline-none focus:border-[#7c3aed]"
                    />
                  </label>

                  <label className="block">
                    <span className="text-[11px] font-semibold text-slate-400">
                      Message Body
                    </span>
                    <textarea
                      required
                      rows={3}
                      value={notifMsg}
                      onChange={(e) => setNotifMsg(e.target.value)}
                      placeholder="Write the message users will see in their Notification Center..."
                      className="mt-1 w-full p-3 rounded-xl bg-[#191928] border border-white/10 text-xs text-white focus:outline-none focus:border-[#7c3aed]"
                    />
                  </label>

                  <button
                    type="submit"
                    className="preserve-white btn-press w-full min-h-[42px] rounded-xl bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-xs font-extrabold inline-flex items-center justify-center gap-2 shadow-[0_6px_18px_rgba(124,58,237,0.35)]"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Send Notification Now
                  </button>
                </form>
              </section>

              <section className="xl:col-span-6 rounded-2xl bg-[#13131f] border border-white/[0.08] p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-white">Broadcast History</h2>
                  <span className="text-xs font-mono-nums text-slate-400">
                    {broadcasts.length} sent
                  </span>
                </div>

                {broadcasts.length === 0 ? (
                  <div className="py-12 text-center rounded-2xl bg-[#191928] border border-white/[0.06] text-xs text-slate-400">
                    No owner broadcasts sent yet.
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                    {broadcasts.map((b) => (
                      <div
                        key={b.id}
                        className="p-3 rounded-xl bg-[#191928] border border-white/[0.06] space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-extrabold text-white truncate">
                            {b.title}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-[#7c3aed]/20 text-[#c4b5fd] text-[10px] font-bold uppercase shrink-0">
                            {b.category}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300">{b.msg}</p>
                        <div className="text-[10.5px] text-slate-400 font-mono-nums">
                          Target: {b.targetEmail === 'ALL' ? 'All Users' : b.targetEmail} ·{' '}
                          {b.timestamp}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}

          {/* PANEL 6: Support Helpline Tickets */}
          {activeSection === 'tickets' && (
            <section className="rounded-2xl bg-[#13131f] border border-white/[0.08] p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-white inline-flex items-center gap-2">
                    <Headphones className="w-4 h-4 text-[#a78bfa]" />
                    Support Helpline Tickets
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Review deposit/withdrawal complaints, WhatsApp contacts &amp; attached payment
                    screenshots
                  </p>
                </div>
                <span className="text-xs font-mono-nums text-slate-400">
                  {tickets.length} total
                </span>
              </div>

              {tickets.length === 0 ? (
                <div className="py-12 text-center rounded-2xl bg-[#191928] border border-white/[0.06] text-xs text-slate-400">
                  No support tickets submitted yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {tickets.map((ticket) => (
                    <div
                      key={ticket.id}
                      className="p-3.5 sm:p-4 rounded-2xl bg-[#191928] border border-white/[0.06] space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-xs font-extrabold text-white">
                          {ticket.id} · {ticket.subject}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            ticket.status === 'Resolved'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : ticket.status === 'In Review'
                              ? 'bg-sky-500/20 text-sky-300'
                              : 'bg-amber-500/20 text-amber-300'
                          }`}
                        >
                          {ticket.status}
                        </span>
                      </div>

                      <p className="text-xs text-slate-300">{ticket.message}</p>

                      <div className="text-[11px] text-slate-400 font-mono-nums flex flex-wrap gap-x-3 gap-y-1">
                        <span>UID: {ticket.uid ?? 'N/A'}</span>
                        {ticket.userEmail && <span>Email: {ticket.userEmail}</span>}
                        <span>Time: {ticket.paymentDateTime ?? ticket.createdAt}</span>
                        {ticket.whatsapp && <span>WhatsApp: {ticket.whatsapp}</span>}
                        {ticket.transactionId && <span>Tx: {ticket.transactionId}</span>}
                      </div>

                      {ticket.screenshotDataUrl && (
                        <div>
                          <button
                            type="button"
                            onClick={() => setPreviewTicketImage(ticket.screenshotDataUrl!)}
                            className="inline-flex items-center gap-2 p-1.5 rounded-xl bg-[#13131f] border border-white/10 hover:border-[#7c3aed]"
                          >
                            <img
                              src={ticket.screenshotDataUrl}
                              alt={`Payment proof for ${ticket.id}`}
                              className="w-12 h-12 rounded-lg object-cover"
                            />
                            <span className="text-[11px] font-bold text-[#c4b5fd] pr-2">
                              View Payment Screenshot
                            </span>
                          </button>
                        </div>
                      )}

                      {ticket.status !== 'Resolved' && (
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => onUpdateTicketStatus(ticket.id, 'In Review')}
                            className="btn-press px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-[11px] font-bold text-slate-200 whitespace-nowrap"
                          >
                            Mark In Review
                          </button>
                          <button
                            type="button"
                            onClick={() => onUpdateTicketStatus(ticket.id, 'Resolved')}
                            className="preserve-white btn-press px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-[11px] font-bold text-white whitespace-nowrap"
                          >
                            Resolve Ticket
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* PANEL 7: Voice Bet Studio, Live Web Settlement & Progressive Gift Codes */}
          {activeSection === 'markets' && (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
              {/* Owner Voice-Command Bet Studio & Live Web Auto-Settlement */}
              <section className="xl:col-span-12 rounded-2xl bg-[#13131f] border border-white/[0.08] p-4 sm:p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-base font-bold text-white inline-flex items-center gap-2">
                      <Mic className="w-4 h-4 text-[#a78bfa]" />
                      Owner Voice-Command Bet Studio &amp; Live Web Settlement
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Dictate any new Yes/No prediction by voice or text, publish live, and auto-settle via live web verification with automatic commission payout.
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-[#7c3aed]/20 border border-[#7c3aed]/40 text-[10.5px] font-bold text-[#c4b5fd]">
                    Owner Exclusive Settlement
                  </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                  {/* Left: Voice Dictation & Draft Form */}
                  <div className="lg:col-span-6 space-y-3 rounded-xl bg-[#191928] border border-white/[0.07] p-3.5">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleToggleVoiceMic}
                        data-testid="admin-voice-mic-btn"
                        className={`preserve-white btn-press h-10 px-3.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shrink-0 ${
                          voiceListening
                            ? 'bg-rose-600 hover:bg-rose-500 text-white animate-pulse'
                            : 'bg-[#7c3aed] hover:bg-[#6d28d9] text-white'
                        }`}
                      >
                        {voiceListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                        {voiceListening ? 'Stop Mic' : 'Speak Command'}
                      </button>
                      <button
                        type="button"
                        disabled={voiceBusy}
                        onClick={handleParseVoiceCommand}
                        data-testid="admin-voice-parse-btn"
                        className="btn-press h-10 px-3.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/35 border border-emerald-500/35 text-emerald-300 text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        {voiceBusy ? 'Drafting...' : 'Draft Bet with AI'}
                      </button>
                    </div>

                    <textarea
                      rows={2}
                      value={voiceTranscript}
                      onChange={(e) => {
                        setVoiceTranscript(e.target.value);
                        setVoiceError('');
                      }}
                      placeholder='Dictate or type: "Agle election mein kaun PM banega Amit Shah yes ya no"...'
                      aria-label="Voice command transcript"
                      className="w-full p-3 rounded-xl bg-[#13131f] border border-white/10 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-[#7c3aed]"
                    />

                    {voiceError && (
                      <p role="alert" className="text-[11px] text-rose-400">
                        {voiceError}
                      </p>
                    )}

                    <form onSubmit={handlePublishVoiceMarket} className="space-y-2.5 pt-1 border-t border-white/[0.06]">
                      <input
                        type="text"
                        required
                        placeholder="Prediction Yes/No Question..."
                        value={draftQuestion}
                        onChange={(e) => setDraftQuestion(e.target.value)}
                        className="w-full h-10 px-3 rounded-xl bg-[#13131f] border border-white/10 text-xs font-semibold text-white focus:outline-none focus:border-[#7c3aed]"
                      />
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        <select
                          value={draftCategory}
                          onChange={(e) =>
                            setDraftCategory(
                              e.target.value as Exclude<MarketCategory, 'All Markets'>
                            )
                          }
                          className="h-9 px-2.5 rounded-xl bg-[#13131f] border border-white/10 text-xs text-white focus:outline-none"
                        >
                          <option value="Political">Political</option>
                          <option value="Sports">Sports</option>
                          <option value="Crypto">Crypto</option>
                          <option value="Famous Games">Famous Games</option>
                          <option value="Mobile Brands">Mobile Brands</option>
                        </select>
                        <input
                          type="text"
                          placeholder="Sub-label"
                          value={draftSubLabel}
                          onChange={(e) => setDraftSubLabel(e.target.value)}
                          className="h-9 px-2.5 rounded-xl bg-[#13131f] border border-white/10 text-xs text-white focus:outline-none"
                        />
                        <input
                          type="number"
                          min={1}
                          placeholder="Hours"
                          value={draftEndsHours}
                          onChange={(e) => setDraftEndsHours(e.target.value)}
                          className="h-9 px-2.5 rounded-xl bg-[#13131f] border border-white/10 text-xs font-mono-nums text-white focus:outline-none"
                        />
                      </div>
                      <input
                        type="text"
                        placeholder="Resolution criteria (used by Live Web check)..."
                        value={draftCriteria}
                        onChange={(e) => setDraftCriteria(e.target.value)}
                        className="w-full h-9 px-3 rounded-xl bg-[#13131f] border border-white/10 text-[11px] text-slate-200 focus:outline-none"
                      />
                      <button
                        type="submit"
                        disabled={!draftQuestion.trim()}
                        data-testid="admin-publish-bet-btn"
                        className="preserve-white btn-press w-full h-10 rounded-xl bg-[#7c3aed] hover:bg-[#6d28d9] disabled:opacity-40 text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Publish Live Prediction Bet
                      </button>
                    </form>
                  </div>

                  {/* Right: Live Markets + Web Auto-Settle */}
                  <div className="lg:col-span-6 space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                    {state.predictions.map((mkt) => {
                      const isBusy = resolvingMarketId === mkt.id;
                      const fb = resolveFeedback?.marketId === mkt.id ? resolveFeedback : null;
                      return (
                        <div
                          key={mkt.id}
                          className="rounded-xl bg-[#191928] border border-white/[0.07] p-3 space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-[10.5px] font-bold text-[#a78bfa]">
                                {mkt.category} · {mkt.subLabel}
                              </div>
                              <div className="text-xs font-bold text-white leading-snug mt-0.5">
                                {mkt.question}
                              </div>
                            </div>
                            {mkt.resolvedOutcome ? (
                              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 text-[10.5px] font-extrabold shrink-0">
                                SETTLED: {mkt.resolvedOutcome.toUpperCase()}
                              </span>
                            ) : (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => void handleCheckLiveWebAndSettle(mkt.id)}
                                data-testid={`admin-resolve-btn-${mkt.id}`}
                                className="btn-press px-2.5 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/35 border border-sky-500/35 text-sky-300 text-[11px] font-bold inline-flex items-center gap-1 shrink-0 disabled:opacity-50"
                              >
                                <Globe className="w-3 h-3" />
                                {isBusy ? 'Checking Web...' : 'Check Live Web & Auto-Settle'}
                              </button>
                            )}
                          </div>

                          <div className="text-[11px] font-mono-nums text-slate-400">
                            YES Pool ₹{mkt.yesPool.toLocaleString('en-IN')} ({mkt.yesBettors}) · NO Pool ₹
                            {mkt.noPool.toLocaleString('en-IN')} ({mkt.noBettors})
                          </div>

                          {(fb || mkt.resolutionSummary) && (
                            <div className="rounded-lg bg-[#13131f] border border-white/[0.06] p-2 text-[11px] text-slate-300 space-y-1">
                              <p>{fb?.summary || mkt.resolutionSummary}</p>
                              {(fb?.sources || mkt.resolutionSources)?.length ? (
                                <div className="flex flex-wrap gap-2">
                                  {(fb?.sources || mkt.resolutionSources || []).slice(0, 3).map((s, idx) => (
                                    <a
                                      key={`${s.uri}-${idx}`}
                                      href={s.uri}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-[10.5px] font-semibold text-[#a78bfa] hover:underline"
                                    >
                                      {s.title || 'Web Source'} ↗
                                    </a>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>

              <section className="xl:col-span-6 rounded-2xl bg-[#13131f] border border-white/[0.08] p-4 sm:p-5 space-y-4">
                <div>
                  <h2 className="text-base font-bold text-white inline-flex items-center gap-2">
                    <Gift className="w-4 h-4 text-[#a78bfa]" />
                    Owner Progressive Gift Codes
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Only codes created here are active. Configure max user claims and step-down payout reduction per claim.
                  </p>
                </div>

                <form onSubmit={handleCreateGiftCode} className="space-y-2.5">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <label className="block">
                      <span className="text-[10px] font-semibold text-slate-400">Code</span>
                      <input
                        type="text"
                        placeholder="DROP100"
                        value={newGiftCode}
                        onChange={(e) => setNewGiftCode(e.target.value.toUpperCase())}
                        className="mt-1 w-full h-9 px-3 rounded-xl bg-[#191928] border border-white/10 text-xs font-mono-nums font-bold text-white uppercase focus:outline-none focus:border-[#7c3aed]"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[10px] font-semibold text-slate-400">Initial ₹</span>
                      <input
                        type="number"
                        min={1}
                        value={newGiftAmount}
                        onChange={(e) => setNewGiftAmount(e.target.value)}
                        className="mt-1 w-full h-9 px-3 rounded-xl bg-[#191928] border border-white/10 text-xs font-mono-nums text-white focus:outline-none focus:border-[#7c3aed]"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[10px] font-semibold text-slate-400">Decrease/Claim ₹</span>
                      <input
                        type="number"
                        min={0}
                        value={newGiftStepDecrease}
                        onChange={(e) => setNewGiftStepDecrease(e.target.value)}
                        className="mt-1 w-full h-9 px-3 rounded-xl bg-[#191928] border border-white/10 text-xs font-mono-nums text-white focus:outline-none focus:border-[#7c3aed]"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[10px] font-semibold text-slate-400">Min Floor ₹</span>
                      <input
                        type="number"
                        min={1}
                        value={newGiftMinAmount}
                        onChange={(e) => setNewGiftMinAmount(e.target.value)}
                        className="mt-1 w-full h-9 px-3 rounded-xl bg-[#191928] border border-white/10 text-xs font-mono-nums text-white focus:outline-none focus:border-[#7c3aed]"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[10px] font-semibold text-slate-400">Max Users</span>
                      <input
                        type="number"
                        min={1}
                        value={newGiftMaxClaims}
                        onChange={(e) => setNewGiftMaxClaims(e.target.value)}
                        className="mt-1 w-full h-9 px-3 rounded-xl bg-[#191928] border border-white/10 text-xs font-mono-nums text-white focus:outline-none focus:border-[#7c3aed]"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[10px] font-semibold text-slate-400">Campaign Label</span>
                      <input
                        type="text"
                        placeholder="Label"
                        value={newGiftLabel}
                        onChange={(e) => setNewGiftLabel(e.target.value)}
                        className="mt-1 w-full h-9 px-3 rounded-xl bg-[#191928] border border-white/10 text-xs text-white focus:outline-none focus:border-[#7c3aed]"
                      />
                    </label>
                  </div>
                  <button
                    type="submit"
                    className="preserve-white btn-press w-full h-10 px-4 rounded-xl bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Create Progressive Gift Code
                  </button>
                </form>

                <div className="space-y-2">
                  {(state.customGiftCodes ?? []).length === 0 ? (
                    <p className="text-xs text-slate-400 rounded-xl bg-[#191928] border border-dashed border-white/10 p-3">
                      No gift codes active right now. Create one above to release a progressive gift drop.
                    </p>
                  ) : (
                    (state.customGiftCodes ?? []).map((g) => {
                      const nextPayout = computeGiftCodeClaimAmount(g);
                      const claimed = g.claimsCount ?? 0;
                      const maxC = g.maxClaims ?? 0;
                      return (
                        <div
                          key={g.code}
                          className="p-3 rounded-xl bg-[#191928] border border-white/[0.06] flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-extrabold font-mono-nums text-white">
                              {g.code} · Next Payout ₹{nextPayout}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {g.label} · Claimed {claimed}
                              {maxC > 0 ? `/${maxC}` : ''} · Step -₹{g.stepDecreaseInr ?? 0} (Min ₹
                              {g.minAmount ?? 1})
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => onToggleGiftCode(g.code)}
                            className={`btn-press px-3 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap shrink-0 ${
                              g.active
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-slate-500/20 text-slate-400'
                            }`}
                          >
                            {g.active ? 'Active' : 'Paused'}
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </section>

              <section className="xl:col-span-6 rounded-2xl bg-[#13131f] border border-white/[0.08] p-4 sm:p-5 space-y-3">
                <h2 className="text-base font-bold text-white inline-flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-[#a78bfa]" />
                  Live Market Asset Controls
                </h2>
                <div className="divide-y divide-white/[0.06] max-h-[380px] overflow-y-auto pr-1">
                  {state.assets.slice(0, 8).map((asset) => (
                    <div
                      key={asset.id}
                      className="py-2.5 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white">{asset.symbol}</div>
                        <div className="text-[11px] text-slate-400 font-mono-nums">
                          {formatCurrency(asset.price, currency, fxRates)} (
                          {asset.changePct >= 0 ? '+' : ''}
                          {asset.changePct.toFixed(2)}%)
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateAssetPrice(
                              asset.id,
                              Math.max(1, Math.round(asset.price * 0.97 * 100) / 100)
                            )
                          }
                          className="btn-press px-2.5 py-1.5 rounded-lg bg-rose-500/15 text-rose-400 text-[11px] font-bold font-mono-nums"
                        >
                          -3%
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateAssetPrice(
                              asset.id,
                              Math.round(asset.price * 1.03 * 100) / 100
                            )
                          }
                          className="btn-press px-2.5 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 text-[11px] font-bold font-mono-nums"
                        >
                          +3%
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {/* PANEL 8: Multi-UPI Receiver Gateways & Platform Controls */}
          {activeSection === 'settings' && (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
              {/* Multi-UPI Gateway Pool Manager */}
              <section className="xl:col-span-6 rounded-2xl bg-[#13131f] border border-white/[0.08] p-4 sm:p-5 space-y-4">
                <div>
                  <h2 className="text-base font-bold text-white inline-flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-[#a78bfa]" />
                    Multi-UPI Receiver Gateways
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Add, activate, pause, or prioritize multiple merchant UPI IDs shown to users on
                    Scan &amp; Pay and app payments
                  </p>
                </div>

                <form onSubmit={handleCreateUpiGateway} className="space-y-2.5 p-3.5 rounded-xl bg-[#191928] border border-white/[0.07]">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <input
                      type="text"
                      placeholder="Label (e.g. Backup HDFC UPI)"
                      value={newUpiLabel}
                      onChange={(e) => setNewUpiLabel(e.target.value)}
                      className="h-10 px-3 rounded-xl bg-[#13131f] border border-white/10 text-xs text-white focus:outline-none focus:border-[#7c3aed]"
                    />
                    <input
                      type="text"
                      placeholder="Payee Name (e.g. Ouroboros Desk)"
                      value={newUpiPayee}
                      onChange={(e) => setNewUpiPayee(e.target.value)}
                      className="h-10 px-3 rounded-xl bg-[#13131f] border border-white/10 text-xs text-white focus:outline-none focus:border-[#7c3aed]"
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      placeholder="UPI ID (e.g. merchant2@okaxis)"
                      value={newUpiId}
                      onChange={(e) => {
                        setNewUpiId(e.target.value);
                        setUpiFormError('');
                      }}
                      className="flex-1 h-10 px-3 rounded-xl bg-[#13131f] border border-white/10 text-xs font-mono-nums text-white focus:outline-none focus:border-[#7c3aed]"
                    />
                    <button
                      type="submit"
                      className="preserve-white btn-press h-10 px-4 rounded-xl bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add UPI ID
                    </button>
                  </div>
                  {upiFormError && (
                    <p role="alert" className="text-[11px] text-rose-400">
                      {upiFormError}
                    </p>
                  )}
                </form>

                <div className="space-y-2.5">
                  {merchantUpiPool.map((rec) => (
                    <div
                      key={rec.id}
                      className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                        rec.active
                          ? 'bg-[#191928] border-white/[0.08]'
                          : 'bg-[#191928]/50 border-white/[0.04] opacity-75'
                      }`}
                    >
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-extrabold text-white">{rec.label}</span>
                          {rec.isPrimary && (
                            <span className="px-2 py-0.5 rounded bg-[#7c3aed]/25 text-[#c4b5fd] text-[10px] font-bold">
                              PRIMARY
                            </span>
                          )}
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              rec.active
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-slate-500/20 text-slate-400'
                            }`}
                          >
                            {rec.active ? 'ACTIVE' : 'PAUSED'}
                          </span>
                        </div>
                        <div className="text-xs font-mono-nums text-[#c4b5fd] truncate">
                          {rec.upiId}{' '}
                          <span className="text-slate-400 font-sans">· {rec.payeeName}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleCopyText(rec.upiId, `rec-${rec.id}`)}
                          className="btn-press px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-[11px] font-bold text-slate-200 inline-flex items-center gap-1"
                        >
                          {copiedId === `rec-${rec.id}` ? (
                            <Check className="w-3 h-3 text-emerald-300" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                          Copy
                        </button>
                        {!rec.isPrimary && rec.active && (
                          <button
                            type="button"
                            onClick={() => onSetPrimaryMerchantUpi(rec.id)}
                            className="btn-press px-2.5 py-1.5 rounded-lg bg-[#7c3aed]/20 hover:bg-[#7c3aed]/35 border border-[#7c3aed]/40 text-[11px] font-bold text-[#c4b5fd]"
                          >
                            Set Primary
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onToggleMerchantUpi(rec.id)}
                          className={`btn-press px-2.5 py-1.5 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 ${
                            rec.active
                              ? 'bg-amber-500/15 text-amber-300'
                              : 'bg-emerald-500/15 text-emerald-300'
                          }`}
                        >
                          {rec.active ? (
                            <>
                              <PauseCircle className="w-3 h-3" />
                              Pause
                            </>
                          ) : (
                            <>
                              <PlayCircle className="w-3 h-3" />
                              Activate
                            </>
                          )}
                        </button>
                        {merchantUpiPool.length > 1 && (
                          <button
                            type="button"
                            onClick={() => onDeleteMerchantUpi(rec.id)}
                            aria-label={`Delete ${rec.upiId}`}
                            className="btn-press p-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Platform Controls & Limits */}
              <section className="xl:col-span-6 rounded-2xl bg-[#13131f] border border-white/[0.08] p-4 sm:p-5 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-base font-bold text-white inline-flex items-center gap-2">
                      <SlidersHorizontal className="w-4 h-4 text-[#a78bfa]" />
                      Platform &amp; Risk Controls
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Pause deposits/withdrawals/signups, adjust max limits &amp; display desk notices
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSettingsDraft(DEFAULT_PLATFORM_SETTINGS);
                      onUpdatePlatformSettings(DEFAULT_PLATFORM_SETTINGS);
                    }}
                    className="btn-press px-3 py-1.5 rounded-lg bg-[#191928] border border-white/10 text-[11px] font-bold text-slate-300 inline-flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset
                  </button>
                </div>

                <form onSubmit={handleSavePlatformSettings} className="space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {(
                      [
                        { key: 'depositsPaused', label: 'Deposits' },
                        { key: 'withdrawalsPaused', label: 'Withdrawals' },
                        { key: 'signupsPaused', label: 'New Signups' },
                      ] as const
                    ).map((item) => {
                      const paused = settingsDraft[item.key];
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() =>
                            setSettingsDraft((prev) => ({
                              ...prev,
                              [item.key]: !prev[item.key],
                            }))
                          }
                          className={`btn-press p-3 rounded-xl border text-left space-y-1 transition-colors ${
                            paused
                              ? 'bg-rose-500/15 border-rose-500/40'
                              : 'bg-emerald-500/10 border-emerald-500/30'
                          }`}
                        >
                          <div className="text-[11px] font-bold text-white">{item.label}</div>
                          <div
                            className={`text-xs font-extrabold ${
                              paused ? 'text-rose-300' : 'text-emerald-300'
                            }`}
                          >
                            {paused ? 'Paused' : 'Active'}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="text-[11px] font-semibold text-slate-400">
                        Max Single Deposit (₹)
                      </span>
                      <input
                        type="number"
                        min={100}
                        step={100}
                        value={settingsDraft.maxDepositInr}
                        onChange={(e) =>
                          setSettingsDraft({
                            ...settingsDraft,
                            maxDepositInr: Number(e.target.value),
                          })
                        }
                        className="mt-1 w-full h-10 px-3 rounded-xl bg-[#191928] border border-white/10 text-sm font-mono-nums text-white focus:outline-none focus:border-[#7c3aed]"
                      />
                    </label>

                    <label className="block">
                      <span className="text-[11px] font-semibold text-slate-400">
                        Max Single Withdrawal (₹)
                      </span>
                      <input
                        type="number"
                        min={100}
                        step={100}
                        value={settingsDraft.maxWithdrawInr}
                        onChange={(e) =>
                          setSettingsDraft({
                            ...settingsDraft,
                            maxWithdrawInr: Number(e.target.value),
                          })
                        }
                        className="mt-1 w-full h-10 px-3 rounded-xl bg-[#191928] border border-white/10 text-sm font-mono-nums text-white focus:outline-none focus:border-[#7c3aed]"
                      />
                    </label>
                  </div>

                  <label className="block">
                    <span className="text-[11px] font-semibold text-slate-400">
                      Maintenance / Pause Banner Notice
                    </span>
                    <input
                      type="text"
                      placeholder="Shown to users when deposits, withdrawals or signups are paused..."
                      value={settingsDraft.maintenanceNotice}
                      onChange={(e) =>
                        setSettingsDraft({
                          ...settingsDraft,
                          maintenanceNotice: e.target.value,
                        })
                      }
                      className="mt-1 w-full h-10 px-3 rounded-xl bg-[#191928] border border-white/10 text-xs text-white focus:outline-none focus:border-[#7c3aed]"
                    />
                  </label>

                  <label className="block">
                    <span className="text-[11px] font-semibold text-slate-400">
                      Support Helpline Notice
                    </span>
                    <input
                      type="text"
                      placeholder="Displayed inside Support Helpline modal..."
                      value={settingsDraft.supportNotice}
                      onChange={(e) =>
                        setSettingsDraft({
                          ...settingsDraft,
                          supportNotice: e.target.value,
                        })
                      }
                      className="mt-1 w-full h-10 px-3 rounded-xl bg-[#191928] border border-white/10 text-xs text-white focus:outline-none focus:border-[#7c3aed]"
                    />
                  </label>

                  {/* Daily Check-in, Leaderboard & Guest Access Controls */}
                  <div className="pt-3 border-t border-white/[0.08] space-y-3">
                    <div className="text-xs font-bold text-white">
                      Daily Check-In, Leaderboard &amp; Guest Controls
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {(
                        [
                          {
                            key: 'dailyCheckInEnabled',
                            label: 'Daily Check-In',
                            onLabel: 'Enabled',
                            offLabel: 'Disabled',
                            defaultVal: true,
                          },
                          {
                            key: 'dailyCheckInRequiresDeposit',
                            label: 'Check-In Deposit Lock',
                            onLabel: 'Deposit Req.',
                            offLabel: 'Unlocked',
                            defaultVal: true,
                          },
                          {
                            key: 'leaderboardEnabled',
                            label: 'Top 10 Leaderboard',
                            onLabel: 'Visible',
                            offLabel: 'Hidden',
                            defaultVal: true,
                          },
                          {
                            key: 'guestBrowsingEnabled',
                            label: 'Guest Browsing',
                            onLabel: 'Open',
                            offLabel: 'Login Wall',
                            defaultVal: true,
                          },
                        ] as const
                      ).map((ctrl) => {
                        const enabled =
                          settingsDraft[ctrl.key] !== undefined
                            ? Boolean(settingsDraft[ctrl.key])
                            : ctrl.defaultVal;
                        return (
                          <button
                            key={ctrl.key}
                            type="button"
                            onClick={() =>
                              setSettingsDraft((prev) => ({
                                ...prev,
                                [ctrl.key]:
                                  prev[ctrl.key] !== undefined
                                    ? !prev[ctrl.key]
                                    : !ctrl.defaultVal,
                              }))
                            }
                            className={`btn-press p-2.5 rounded-xl border text-left space-y-1 transition-colors ${
                              enabled
                                ? 'bg-emerald-500/10 border-emerald-500/30'
                                : 'bg-rose-500/15 border-rose-500/40'
                            }`}
                          >
                            <div className="text-[10.5px] font-bold text-white leading-tight">
                              {ctrl.label}
                            </div>
                            <div
                              className={`text-[11px] font-extrabold ${
                                enabled ? 'text-emerald-300' : 'text-rose-300'
                              }`}
                            >
                              {enabled ? ctrl.onLabel : ctrl.offLabel}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    <label className="block">
                      <span className="text-[11px] font-semibold text-slate-400">
                        Daily Check-In Base Reward (₹ · scales up to ₹50/day by streak)
                      </span>
                      <input
                        type="number"
                        min={1}
                        max={50}
                        step={1}
                        value={settingsDraft.dailyCheckInBaseReward ?? 10}
                        onChange={(e) =>
                          setSettingsDraft({
                            ...settingsDraft,
                            dailyCheckInBaseReward: Math.max(
                              1,
                              Math.min(50, Number(e.target.value) || 10)
                            ),
                          })
                        }
                        className="mt-1 w-full h-10 px-3 rounded-xl bg-[#191928] border border-white/10 text-sm font-mono-nums text-white focus:outline-none focus:border-[#7c3aed]"
                      />
                    </label>
                  </div>

                  {/* New User First-Deposit Bonus Controls */}
                  <div className="pt-3 border-t border-white/[0.08] space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-bold text-white">
                        New User First-Deposit Bonus
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setSettingsDraft((prev) => ({
                            ...prev,
                            firstDepositBonusEnabled:
                              prev.firstDepositBonusEnabled === false ? true : false,
                          }))
                        }
                        className={`btn-press px-3 py-1 rounded-lg text-[11px] font-bold ${
                          settingsDraft.firstDepositBonusEnabled !== false
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-rose-500/20 text-rose-300'
                        }`}
                      >
                        {settingsDraft.firstDepositBonusEnabled !== false ? 'Enabled' : 'Disabled'}
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="block">
                        <span className="text-[11px] font-semibold text-slate-400">
                          Bonus Rate (%)
                        </span>
                        <input
                          type="number"
                          min={0}
                          max={25}
                          step={1}
                          value={settingsDraft.firstDepositBonusPct ?? 5}
                          onChange={(e) =>
                            setSettingsDraft({
                              ...settingsDraft,
                              firstDepositBonusPct: Math.max(
                                0,
                                Math.min(25, Number(e.target.value) || 0)
                              ),
                            })
                          }
                          className="mt-1 w-full h-10 px-3 rounded-xl bg-[#191928] border border-white/10 text-sm font-mono-nums text-white focus:outline-none focus:border-[#7c3aed]"
                        />
                      </label>
                      <label className="block">
                        <span className="text-[11px] font-semibold text-slate-400">
                          Max Bonus Cap (₹)
                        </span>
                        <input
                          type="number"
                          min={0}
                          max={500}
                          step={10}
                          value={settingsDraft.firstDepositBonusMaxInr ?? 100}
                          onChange={(e) =>
                            setSettingsDraft({
                              ...settingsDraft,
                              firstDepositBonusMaxInr: Math.max(
                                0,
                                Math.min(500, Number(e.target.value) || 0)
                              ),
                            })
                          }
                          className="mt-1 w-full h-10 px-3 rounded-xl bg-[#191928] border border-white/10 text-sm font-mono-nums text-white focus:outline-none focus:border-[#7c3aed]"
                        />
                      </label>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="preserve-white btn-press w-full min-h-[44px] rounded-xl bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-sm font-extrabold inline-flex items-center justify-center gap-2 shadow-[0_6px_18px_rgba(124,58,237,0.35)]"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Save Platform Settings
                  </button>
                </form>
              </section>
            </div>
          )}
        </div>
      </div>

      {/* Payment Screenshot Lightbox */}
      {previewTicketImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setPreviewTicketImage(null)}
        >
          <div
            className="relative max-w-md w-full bg-[#13131f] border border-white/15 rounded-2xl p-3 space-y-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white">Payment Screenshot Proof</span>
              <button
                type="button"
                onClick={() => setPreviewTicketImage(null)}
                aria-label="Close screenshot preview"
                className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <img
              src={previewTicketImage}
              alt="Support ticket payment proof"
              className="w-full max-h-[70vh] object-contain rounded-xl bg-black"
            />
          </div>
        </div>
      )}
    </div>
  );
};
