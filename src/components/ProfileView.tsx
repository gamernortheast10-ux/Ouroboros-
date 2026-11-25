import React, { useMemo, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowLeftRight,
  ArrowUpFromLine,
  BadgeCheck,
  Bell,
  Building2,
  Check,
  ChevronRight,
  Copy,
  CreditCard,
  Crown,
  Download,
  Globe,
  Headphones,
  KeyRound,
  Languages,
  Lock,
  LogOut,
  Mail,
  MessageCircle,
  Moon,
  Plus,
  ReceiptText,
  RefreshCw,
  Shield,
  ShieldCheck,
  Smartphone,
  Sun,
  Ticket,
  User,
  X,
} from 'lucide-react';
import {
  AppState,
  BaseCurrency,
  LanguageCode,
  SupportTicket,
  ThemeMode,
  WalletTransaction,
} from '../types/trading';
import { LANGUAGES, t } from '../utils/i18n';
import {
  PLAYER_LEVELS,
  SUPPORTED_CURRENCIES,
  calculatePlayerLevel,
  calculateTotalSpent,
  convertCurrency,
  formatCurrency,
  getCurrencyMeta,
  getEffectivePlatformSettings,
  isOwnerAdmin,
} from '../utils/tradingEngine';
import { WalletModalMode } from './WalletModal';
import { UpiAppLogo } from './UpiAppBranding';
import {
  LeaderboardPodiumIcon,
  TopTradersLeaderboard,
} from './TopTradersLeaderboard';

interface ProfileViewProps {
  state: AppState;
  onBack: () => void;
  onOpenWalletModal: (mode: WalletModalMode) => void;
  onNavigatePortfolio: () => void;
  onNavigateGift: () => void;
  onNavigateAdmin?: () => void;
  onUpdateProfile: (name: string, email: string) => void;
  onToggleTwoFactor: () => void;
  onToggleCurrency: (currency: BaseCurrency) => void;
  onChangeLanguage: (language: LanguageCode) => void;
  onRefreshFxRates: () => void;
  onToggleAlerts: () => void;
  onToggleTheme: (theme: ThemeMode) => void;
  onChangePassword: (params: {
    currentPassword: string;
    newPassword: string;
  }) => { ok: boolean; error?: string };
  onNotify: (text: string, tone?: 'success' | 'error' | 'info') => void;
  onLogout?: () => void;
}

type ProfileSheet = null | 'transactions' | 'trader_id' | 'tickets' | 'security' | 'settings' | 'get_app' | 'leaderboard';
type TxFilter = 'all' | 'deposit' | 'trade' | 'withdraw';

export const ProfileView: React.FC<ProfileViewProps> = ({
  state,
  onBack,
  onOpenWalletModal,
  onNavigatePortfolio,
  onNavigateGift,
  onNavigateAdmin,
  onUpdateProfile,
  onToggleTwoFactor,
  onToggleCurrency,
  onChangeLanguage,
  onRefreshFxRates,
  onToggleAlerts,
  onToggleTheme,
  onChangePassword,
  onNotify,
  onLogout,
}) => {
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState(state.profile.name);
  const [emailInput, setEmailInput] = useState(state.profile.email);
  const [activeSheet, setActiveSheet] = useState<ProfileSheet>(null);
  const [txFilter, setTxFilter] = useState<TxFilter>('all');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [refreshSpin, setRefreshSpin] = useState(false);
  const [showAllLevels, setShowAllLevels] = useState(false);
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState('');

  const themeMode: ThemeMode = state.themeMode ?? 'dark';
  const isLight = themeMode === 'light';
  const lang: LanguageCode = state.profile.language ?? 'en';
  const currency: BaseCurrency = state.profile.baseCurrency ?? 'INR';
  const fxRates = state.fxRates;
  const platformSettings = getEffectivePlatformSettings(state);

  const activeCurrencyMeta = getCurrencyMeta(currency);
  const inrToActiveRate = useMemo(
    () => convertCurrency(1, 'INR', currency, fxRates),
    [currency, fxRates]
  );
  const convertedWalletValue = useMemo(
    () => convertCurrency(1000, 'INR', currency, fxRates),
    [currency, fxRates]
  );

  const totalSpent = useMemo(() => calculateTotalSpent(state), [state]);
  const levelInfo = useMemo(() => calculatePlayerLevel(totalSpent), [totalSpent]);
  const supportTickets: SupportTicket[] = state.supportTickets ?? [];

  const filteredTransactions = useMemo(() => {
    return state.transactions.filter((tx) => {
      if (txFilter === 'all') return true;
      if (txFilter === 'deposit') {
        return tx.type === 'deposit' || tx.type === 'sell_usdt' || tx.type === 'gift_redeem';
      }
      if (txFilter === 'trade') {
        return (
          tx.type === 'trade_open' ||
          tx.type === 'trade_close' ||
          tx.type === 'trade_refund' ||
          tx.type === 'bet_place' ||
          tx.type === 'game_bet' ||
          tx.type === 'game_win' ||
          tx.type === 'game_refund'
        );
      }
      return tx.type === 'withdraw';
    });
  }, [state.transactions, txFilter]);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim() || !emailInput.trim()) return;
    onUpdateProfile(nameInput.trim(), emailInput.trim());
    setEditing(false);
  };

  const handleCopy = async (value: string, label: string, key: string) => {
    try {
      await navigator.clipboard?.writeText(value);
    } catch {
      // Clipboard API may be unavailable in restricted frames
    }
    setCopiedKey(key);
    onNotify(`${label} copied: ${value}`, 'success');
    window.setTimeout(() => {
      setCopiedKey((prev) => (prev === key ? null : prev));
    }, 1800);
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError('');
    setPwdSuccess('');
    if (!currentPwd) {
      setPwdError('Please enter your current password.');
      return;
    }
    if (newPwd.length < 6) {
      setPwdError('New password must be at least 6 characters.');
      return;
    }
    if (newPwd !== confirmPwd) {
      setPwdError('New password and confirmation do not match.');
      return;
    }
    const res = onChangePassword({
      currentPassword: currentPwd,
      newPassword: newPwd,
    });
    if (!res.ok) {
      setPwdError(res.error ?? 'Could not update password.');
      return;
    }
    setCurrentPwd('');
    setNewPwd('');
    setConfirmPwd('');
    setPwdSuccess('Password updated successfully.');
  };

  const surfaceCard = isLight
    ? 'bg-white border border-slate-200/90 shadow-sm text-slate-900'
    : 'bg-[#13131f]/95 border border-white/[0.08] text-white';

  const subtleTile = isLight
    ? 'bg-slate-100/90 hover:bg-slate-200/80 border border-slate-200 text-slate-900'
    : 'bg-[#191928] hover:bg-[#222236] border border-white/[0.06] text-white';

  const rowHover = isLight ? 'hover:bg-slate-100/80' : 'hover:bg-white/[0.03]';
  const mutedText = isLight ? 'text-slate-500' : 'text-slate-400';
  const headingText = isLight ? 'text-slate-900' : 'text-white';
  const dividerColor = isLight ? 'divide-slate-200/80' : 'divide-white/[0.06]';

  const renderTxBadge = (tx: WalletTransaction) => {
    const isPositive = tx.amount >= 0;
    return (
      <span
        className={`font-mono-nums text-xs font-bold ${
          isPositive ? 'text-emerald-400' : 'text-rose-400'
        }`}
      >
        {isPositive ? '+' : ''}
        {formatCurrency(tx.amount, currency, fxRates)}
      </span>
    );
  };

  return (
    <div className="relative overflow-hidden rounded-[28px]">
      {/* 30° Ambient Moving Light Effect */}
      <div aria-hidden="true" className="profile-light-sweep" />

      <div className="relative z-10 space-y-5">
        {/* Profile • Compact Mobile & Premium Desktop Header */}
        <section
          className="hero-preserve-dark relative overflow-hidden rounded-[24px] sm:rounded-[28px] p-3.5 sm:p-5 md:p-6 border border-white/15 shadow-[0_18px_45px_rgba(76,29,149,0.35)]"
          style={{
            background: 'linear-gradient(145deg, #4c1d95 0%, #7e22ce 45%, #6b21a8 100%)',
          }}
        >
          <div aria-hidden="true" className="profile-header-shine" />

          {/* Top Bar */}
          <div className="relative z-10 flex items-center justify-between gap-2 mb-3 sm:mb-5">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onBack}
                aria-label="Back to markets"
                className="btn-press w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/12 hover:bg-white/20 border border-white/15 flex items-center justify-center text-white"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <h1 className="font-display text-lg sm:text-xl font-extrabold text-white tracking-tight">
                {t(lang, 'profileTitle')}
              </h1>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => onToggleTheme(isLight ? 'dark' : 'light')}
                aria-label={`Current theme ${themeMode}. Click to switch.`}
                className="btn-press inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full bg-white/12 hover:bg-white/20 border border-white/15 text-[11px] font-bold text-white"
              >
                {isLight ? <Sun className="w-3.5 h-3.5 text-amber-300" /> : <Moon className="w-3.5 h-3.5 text-purple-200" />}
                <span>{isLight ? t(lang, 'light') : t(lang, 'dark')}</span>
              </button>

              <span className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/35 text-[11px] font-bold text-emerald-200">
                <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                {t(lang, 'verified')}
              </span>
            </div>
          </div>

          {/* Compact Frosted Account Card */}
          <div className="relative z-10 rounded-[18px] sm:rounded-[22px] bg-white/[0.11] backdrop-blur-xl border border-white/[0.15] p-3 sm:p-4 md:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
              <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                <div className="relative shrink-0">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-white/15 border-2 border-white/30 flex items-center justify-center text-lg sm:text-2xl font-extrabold text-white shadow-inner">
                    {state.profile.name.charAt(0).toUpperCase()}
                  </div>
                  <span
                    title="Verified Account"
                    className="absolute bottom-0 right-0 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-emerald-500 border-2 border-[#5b21b6] flex items-center justify-center text-white"
                  >
                    <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3 stroke-[3]" />
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="text-base sm:text-lg font-extrabold text-white truncate">
                      {state.profile.name}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy(state.profile.uid, 'Trader UID', 'uid')}
                      className="btn-press inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/25 hover:bg-black/35 border border-white/10 text-[10px] font-mono-nums text-purple-100"
                    >
                      <span>{state.profile.uid}</span>
                      {copiedKey === 'uid' ? (
                        <Check className="w-2.5 h-2.5 text-emerald-300" />
                      ) : (
                        <Copy className="w-2.5 h-2.5 text-purple-200" />
                      )}
                    </button>
                  </div>
                  <p className="text-[11px] sm:text-xs text-purple-100/80 truncate mt-0.5">
                    {state.profile.email}
                    {state.profile.phone ? ` · ${state.profile.phone}` : ''}
                  </p>
                </div>
              </div>

              {/* Balance & Top up */}
              <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 pt-2.5 sm:pt-0 border-t sm:border-t-0 border-white/15">
                <div>
                  <div className="text-[9.5px] sm:text-[10px] font-bold uppercase tracking-widest text-purple-200/80">
                    {t(lang, 'balanceLabel')} ({currency})
                  </div>
                  <div className="text-xl sm:text-2xl font-extrabold text-white font-mono-nums leading-tight mt-0.5">
                    {formatCurrency(state.balance, currency, fxRates)}
                  </div>
                  <div className="text-[10px] font-semibold text-emerald-200/90 font-mono-nums">
                    Withdrawable:{' '}
                    {formatCurrency(
                      Math.min(state.balance, state.withdrawableBalance ?? state.balance),
                      currency,
                      fxRates
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onOpenWalletModal('topup')}
                  className="preserve-white btn-press min-h-[38px] sm:min-h-[42px] px-3.5 sm:px-4 rounded-full bg-white text-[#4c1d95] hover:bg-purple-50 font-extrabold text-xs inline-flex items-center gap-1.5 whitespace-nowrap shadow-[0_6px_20px_rgba(0,0,0,0.22)]"
                >
                  <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
                  {t(lang, 'topUp')}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Responsive Desktop & Mobile Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Column */}
          <div className="lg:col-span-6 space-y-5">
            {/* Wallet 4-Button Grid: Deposit · Withdrawal · Transactions · ID */}
            <section className={`rounded-[22px] p-5 ${surfaceCard}`}>
              <div className="flex items-center justify-between mb-4">
                <h2 className={`text-base font-bold ${headingText}`}>{t(lang, 'wallet')}</h2>
                <span className={`text-[11px] font-medium ${mutedText}`}>
                  Instant INR &amp; Bank Rails
                </span>
              </div>

              <div className="grid grid-cols-4 gap-2 sm:gap-2.5">
                <button
                  type="button"
                  onClick={() => onOpenWalletModal('topup')}
                  className={`btn-press min-h-[84px] px-1.5 py-2.5 rounded-2xl flex flex-col items-center justify-center gap-2 text-center ${subtleTile}`}
                >
                  <span className="preserve-white w-10 h-10 rounded-xl bg-gradient-to-br from-[#7c3aed] to-[#6d28d9] text-white flex items-center justify-center shadow-[0_6px_14px_rgba(124,58,237,0.35)]">
                    <ArrowDownToLine className="w-4 h-4" />
                  </span>
                  <span className="text-[10.5px] sm:text-[11px] font-bold whitespace-nowrap tracking-tight">
                    {t(lang, 'deposit')}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => onOpenWalletModal('withdraw')}
                  className={`btn-press min-h-[84px] px-1.5 py-2.5 rounded-2xl flex flex-col items-center justify-center gap-2 text-center ${subtleTile}`}
                >
                  <span className="preserve-white w-10 h-10 rounded-xl bg-gradient-to-br from-[#7c3aed] to-[#6d28d9] text-white flex items-center justify-center shadow-[0_6px_14px_rgba(124,58,237,0.35)]">
                    <ArrowUpFromLine className="w-4 h-4" />
                  </span>
                  <span className="text-[10.5px] sm:text-[11px] font-bold whitespace-nowrap tracking-tight">
                    {t(lang, 'withdrawal')}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSheet('transactions')}
                  className={`btn-press min-h-[84px] px-1 py-2.5 rounded-2xl flex flex-col items-center justify-center gap-2 text-center ${subtleTile}`}
                >
                  <span className="preserve-white w-10 h-10 rounded-xl bg-gradient-to-br from-[#7c3aed] to-[#6d28d9] text-white flex items-center justify-center shadow-[0_6px_14px_rgba(124,58,237,0.35)]">
                    <ReceiptText className="w-4 h-4" />
                  </span>
                  <span className="text-[10px] sm:text-[11px] font-bold whitespace-nowrap tracking-tight">
                    {t(lang, 'transactions')}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSheet('trader_id')}
                  className={`btn-press min-h-[84px] px-1.5 py-2.5 rounded-2xl flex flex-col items-center justify-center gap-2 text-center ${subtleTile}`}
                >
                  <span className="preserve-white w-10 h-10 rounded-xl bg-gradient-to-br from-[#7c3aed] to-[#6d28d9] text-white flex items-center justify-center shadow-[0_6px_14px_rgba(124,58,237,0.35)]">
                    <BadgeCheck className="w-4 h-4" />
                  </span>
                  <span className="text-[10.5px] sm:text-[11px] font-bold whitespace-nowrap tracking-tight">
                    {t(lang, 'idLabel')}
                  </span>
                </button>
              </div>
            </section>

            {/* Simple Trader Level Card */}
            <section
              aria-label="Trader Level System"
              className={`rounded-[22px] p-5 ${surfaceCard}`}
            >
              <button
                type="button"
                onClick={() => setShowAllLevels((v) => !v)}
                className="w-full text-left flex items-center justify-between gap-3 mb-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{
                      backgroundColor: `${levelInfo.current.accentColor}22`,
                      color: levelInfo.current.accentColor,
                      border: `1px solid ${levelInfo.current.accentColor}44`,
                    }}
                  >
                    <Crown className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className={`text-sm font-bold ${headingText}`}>
                        {t(lang, 'traderLevel')}
                      </h2>
                      <span
                        className="px-2 py-0.5 rounded-full text-[11px] font-extrabold"
                        style={{
                          backgroundColor: `${levelInfo.current.accentColor}20`,
                          color: levelInfo.current.accentColor,
                        }}
                      >
                        {levelInfo.current.name}
                      </span>
                    </div>
                    <p className={`text-[11px] mt-0.5 truncate ${mutedText}`}>
                      {levelInfo.next
                        ? `Next: ${levelInfo.next.name} · ${formatCurrency(levelInfo.remainingToNext, currency, fxRates)} to go`
                        : 'Max Rank · Sovereign'}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className={`text-xs font-extrabold font-mono-nums ${headingText}`}>
                    {formatCurrency(levelInfo.totalSpent, currency, fxRates)}
                  </div>
                  <div className="text-[10px] font-semibold text-[#a78bfa]">
                    {showAllLevels ? 'Hide tiers' : 'All 8 tiers'}
                  </div>
                </div>
              </button>

              {/* Clean Progress Bar */}
              <div
                className={`h-2 w-full rounded-full overflow-hidden ${
                  isLight ? 'bg-slate-200' : 'bg-white/[0.08]'
                }`}
              >
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.max(4, levelInfo.progressPct)}%`,
                    background: 'linear-gradient(90deg, #7c3aed 0%, #c084fc 55%, #f59e0b 100%)',
                  }}
                />
              </div>

              {showAllLevels && (
                <div className="grid grid-cols-4 gap-1.5 mt-3.5 pt-3 border-t border-white/[0.06]">
                  {PLAYER_LEVELS.map((tier) => {
                    const unlocked = levelInfo.totalSpent >= tier.minSpent;
                    const isCurrent = levelInfo.current.tier === tier.tier;
                    return (
                      <div
                        key={tier.name}
                        className={`rounded-xl px-1 py-1.5 border text-center ${
                          isCurrent
                            ? 'bg-[#7c3aed]/20 border-[#a78bfa]'
                            : unlocked
                            ? isLight
                              ? 'bg-emerald-50 border-emerald-200'
                              : 'bg-emerald-500/10 border-emerald-500/25'
                            : isLight
                            ? 'bg-slate-100/90 border-slate-200/90'
                            : 'bg-white/[0.02] border-white/[0.05] opacity-65'
                        }`}
                      >
                        <div
                          className={`text-[9.5px] font-bold truncate ${
                            isCurrent
                              ? isLight
                                ? 'text-[#5b21b6]'
                                : 'text-white'
                              : unlocked
                              ? 'text-emerald-400'
                              : mutedText
                          }`}
                        >
                          {tier.name}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Simple Theme + Select Language Card */}
            <section className={`rounded-[22px] p-5 space-y-4 ${surfaceCard}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#7c3aed]/15 border border-[#7c3aed]/30 text-[#a78bfa] flex items-center justify-center">
                    {isLight ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                  </div>
                  <div>
                    <h2 className={`text-sm font-bold ${headingText}`}>
                      {t(lang, 'appearanceTheme')}
                    </h2>
                    <p className={`text-xs ${mutedText}`}>
                      {isLight ? t(lang, 'lightModeActive') : t(lang, 'darkModeActive')}
                    </p>
                  </div>
                </div>

                <div
                  className={`p-1 rounded-xl inline-flex items-center gap-1 ${
                    isLight ? 'bg-slate-100 border border-slate-200' : 'bg-[#191928] border border-white/[0.06]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onToggleTheme('light')}
                    className={`btn-press px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 ${
                      isLight
                        ? 'bg-white text-[#5b21b6] shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Sun className="w-3.5 h-3.5" />
                    {t(lang, 'light')}
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleTheme('dark')}
                    className={`btn-press px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 ${
                      !isLight
                        ? 'preserve-white bg-[#7c3aed] text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    <Moon className="w-3.5 h-3.5" />
                    {t(lang, 'dark')}
                  </button>
                </div>
              </div>

              {/* Simple Select Language Control */}
              <div className={`pt-3.5 border-t flex items-center justify-between gap-3 ${isLight ? 'border-slate-200' : 'border-white/[0.06]'}`}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-[#7c3aed]/15 text-[#a78bfa] flex items-center justify-center shrink-0">
                    <Languages className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className={`text-sm font-bold truncate ${headingText}`}>
                      {t(lang, 'languageSetting')}
                    </div>
                    <div className={`text-xs truncate ${mutedText}`}>{t(lang, 'languageDesc')}</div>
                  </div>
                </div>

                <select
                  aria-label="Choose your language"
                  value={lang}
                  onChange={(e) => onChangeLanguage(e.target.value as LanguageCode)}
                  className={`h-9 px-3 rounded-xl border text-xs font-bold focus:outline-none focus:border-[#7c3aed] shrink-0 ${
                    isLight
                      ? 'bg-slate-100 border-slate-200 text-slate-900'
                      : 'bg-[#191928] border-white/10 text-white'
                  }`}
                >
                  {LANGUAGES.map((opt) => (
                    <option key={opt.code} value={opt.code}>
                      {opt.nativeName} ({opt.shortLabel})
                    </option>
                  ))}
                </select>
              </div>
            </section>

            {/* Bound Bank & UPI Accounts */}
            <section className={`rounded-[22px] p-5 ${surfaceCard}`}>
              <div className="flex items-center justify-between mb-3">
                <h2 className={`text-base font-bold ${headingText}`}>{t(lang, 'boundBanks')}</h2>
                <button
                  type="button"
                  onClick={() => onOpenWalletModal('bind_bank')}
                  className="btn-press px-3 py-1.5 rounded-xl bg-[#7c3aed]/15 hover:bg-[#7c3aed]/25 border border-[#7c3aed]/30 text-xs font-bold text-[#a78bfa] inline-flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {t(lang, 'bindBank')}
                </button>
              </div>
              <div className={`divide-y ${dividerColor}`}>
                {state.bankAccounts.map((bank) => (
                  <div key={bank.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-[#7c3aed]/15 text-[#a78bfa] flex items-center justify-center shrink-0">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className={`text-sm font-semibold truncate ${headingText}`}>
                          {bank.bankName} · ••••{bank.accountLast4}
                        </div>
                        <div className={`text-xs font-mono-nums truncate ${mutedText}`}>
                          {bank.holderName} · {bank.ifsc}
                        </div>
                      </div>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[11px] font-bold text-emerald-400 shrink-0">
                      Active
                    </span>
                  </div>
                ))}

                {(state.upiAccounts ?? []).map((upi) => (
                  <div key={upi.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <UpiAppLogo methodId={upi.appId} size="sm" />
                      <div className="min-w-0">
                        <div className={`text-sm font-semibold font-mono-nums truncate ${headingText}`}>
                          {upi.upiId}
                        </div>
                        <div className={`text-xs truncate ${mutedText}`}>
                          {upi.appName} · {upi.holderName}
                        </div>
                      </div>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-[#7c3aed]/15 border border-[#7c3aed]/30 text-[11px] font-bold text-[#a78bfa] shrink-0">
                      UPI
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Right Column */}
          <div className="lg:col-span-6 space-y-5">
            {/* 1-Click Exchange Card matching Select Language */}
            <section className={`rounded-[22px] p-5 space-y-3 ${surfaceCard}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-[#7c3aed]/15 border border-[#7c3aed]/30 text-[#a78bfa] flex items-center justify-center shrink-0">
                    <Globe className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h2 className={`text-sm font-bold truncate ${headingText}`}>
                      {t(lang, 'currencySection')}
                    </h2>
                    <p className={`text-xs truncate ${mutedText}`}>
                      {t(lang, 'currencySub')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <select
                    aria-label="Choose your currency"
                    value={currency}
                    onChange={(e) => onToggleCurrency(e.target.value as BaseCurrency)}
                    className={`h-9 px-3 rounded-xl border text-xs font-bold font-mono-nums focus:outline-none focus:border-[#7c3aed] shrink-0 ${
                      isLight
                        ? 'bg-slate-100 border-slate-200 text-slate-900'
                        : 'bg-[#191928] border-white/10 text-white'
                    }`}
                  >
                    {SUPPORTED_CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} ({c.symbol})
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => {
                      setRefreshSpin(true);
                      onRefreshFxRates();
                      window.setTimeout(() => setRefreshSpin(false), 650);
                    }}
                    aria-label="Refresh live exchange rates"
                    className="btn-press w-9 h-9 rounded-xl bg-[#7c3aed]/15 hover:bg-[#7c3aed]/25 border border-[#7c3aed]/30 text-[#a78bfa] flex items-center justify-center shrink-0"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${refreshSpin ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              <div
                className={`pt-2.5 border-t flex items-center justify-between gap-2 text-xs font-mono-nums ${
                  isLight ? 'border-slate-200' : 'border-white/[0.06]'
                }`}
              >
                <span className="text-emerald-400 font-bold">
                  {currency === 'INR'
                    ? `1 USD = ₹${(1 / (fxRates?.USD || 0.01183)).toFixed(2)} INR`
                    : `1 INR = ${inrToActiveRate.toFixed(currency === 'JPY' ? 3 : 4)} ${currency} · ₹1,000 = ${activeCurrencyMeta.symbol}${convertedWalletValue.toLocaleString('en-IN', {
                        minimumFractionDigits: currency === 'JPY' ? 0 : 2,
                        maximumFractionDigits: currency === 'JPY' ? 0 : 2,
                      })}`}
                </span>
                <span className={mutedText}>{state.fxUpdatedAt ?? 'Live'}</span>
              </div>
            </section>

            {/* Account & Security */}
            <section className={`rounded-[22px] p-5 ${surfaceCard}`}>
              <h2 className={`text-base font-bold mb-3 ${headingText}`}>
                {t(lang, 'accountSecurity')}
              </h2>

              {editing ? (
                <form
                  onSubmit={handleSaveProfile}
                  className={`space-y-3 pb-4 mb-3 border-b ${
                    isLight ? 'border-slate-200' : 'border-white/[0.06]'
                  }`}
                >
                  <div>
                    <label htmlFor="profile-name" className={`block text-xs mb-1 ${mutedText}`}>
                      Display Name
                    </label>
                    <input
                      id="profile-name"
                      type="text"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      className={`w-full h-10 px-3 rounded-xl border text-sm ${
                        isLight
                          ? 'bg-slate-50 border-slate-300 text-slate-900'
                          : 'bg-[#191928] border-white/10 text-white'
                      }`}
                    />
                  </div>
                  <div>
                    <label htmlFor="profile-email" className={`block text-xs mb-1 ${mutedText}`}>
                      Email
                    </label>
                    <input
                      id="profile-email"
                      type="email"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      className={`w-full h-10 px-3 rounded-xl border text-sm ${
                        isLight
                          ? 'bg-slate-50 border-slate-300 text-slate-900'
                          : 'bg-[#191928] border-white/10 text-white'
                      }`}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="preserve-white btn-press min-h-[40px] px-4 rounded-xl bg-[#7c3aed] text-white text-xs font-bold inline-flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing(false)}
                      className={`btn-press min-h-[40px] px-4 rounded-xl text-xs font-semibold ${
                        isLight ? 'bg-slate-200 text-slate-700' : 'bg-[#1d1d2e] text-slate-300'
                      }`}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : null}

              <div className={`divide-y ${dividerColor}`}>
                <button
                  type="button"
                  onClick={() => setEditing((v) => !v)}
                  className={`btn-press w-full min-h-[54px] py-2.5 flex items-center justify-between text-left rounded-xl px-1.5 ${rowHover}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-9 h-9 rounded-xl bg-[#7c3aed]/15 text-[#a78bfa] flex items-center justify-center">
                      <User className="w-4 h-4" />
                    </span>
                    <div>
                      <div className={`text-sm font-semibold ${headingText}`}>
                        {t(lang, 'editProfile')}
                      </div>
                      <div className={`text-xs ${mutedText}`}>Name and personal details</div>
                    </div>
                  </div>
                  <ChevronRight className={`w-4 h-4 ${mutedText}`} />
                </button>

                <button
                  type="button"
                  onClick={onToggleTwoFactor}
                  className={`btn-press w-full min-h-[54px] py-2.5 flex items-center justify-between text-left rounded-xl px-1.5 ${rowHover}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-9 h-9 rounded-xl bg-[#7c3aed]/15 text-[#a78bfa] flex items-center justify-center">
                      <Shield className="w-4 h-4" />
                    </span>
                    <div>
                      <div className={`text-sm font-semibold ${headingText}`}>
                        {t(lang, 'twoFactorLabel')}
                      </div>
                      <div className={`text-xs ${mutedText}`}>SSL &amp; Vault encrypted</div>
                    </div>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                      state.profile.twoFactorEnabled
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                        : 'bg-amber-500/15 text-amber-400 border border-amber-500/25'
                    }`}
                  >
                    {state.profile.twoFactorEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const idx = SUPPORTED_CURRENCIES.findIndex((c) => c.code === currency);
                    const next = SUPPORTED_CURRENCIES[(idx + 1) % SUPPORTED_CURRENCIES.length];
                    onToggleCurrency(next.code);
                  }}
                  className={`btn-press w-full min-h-[54px] py-2.5 flex items-center justify-between text-left rounded-xl px-1.5 ${rowHover}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-9 h-9 rounded-xl bg-[#7c3aed]/15 text-[#a78bfa] flex items-center justify-center">
                      <ArrowLeftRight className="w-4 h-4" />
                    </span>
                    <div>
                      <div className={`text-sm font-semibold ${headingText}`}>
                        {t(lang, 'baseCurrencyLabel')}
                      </div>
                      <div className={`text-xs ${mutedText}`}>
                        Cycle INR · USD · JPY · EUR · GBP · AED
                      </div>
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#7c3aed]/20 border border-[#7c3aed]/35 text-xs font-bold text-[#a78bfa] font-mono-nums">
                    {currency}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={onToggleAlerts}
                  className={`btn-press w-full min-h-[54px] py-2.5 flex items-center justify-between text-left rounded-xl px-1.5 ${rowHover}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-9 h-9 rounded-xl bg-[#7c3aed]/15 text-[#a78bfa] flex items-center justify-center">
                      <Bell className="w-4 h-4" />
                    </span>
                    <div>
                      <div className={`text-sm font-semibold ${headingText}`}>
                        {t(lang, 'priceAlerts')}
                      </div>
                      <div className={`text-xs ${mutedText}`}>Volatility notifications</div>
                    </div>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                      state.profile.priceAlertsEnabled
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                        : 'bg-slate-500/15 text-slate-400 border border-slate-500/25'
                    }`}
                  >
                    {state.profile.priceAlertsEnabled ? 'On' : 'Off'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSheet('security')}
                  className={`btn-press w-full min-h-[54px] py-2.5 flex items-center justify-between text-left rounded-xl px-1.5 ${rowHover}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-9 h-9 rounded-xl bg-[#7c3aed]/15 text-[#a78bfa] flex items-center justify-center">
                      <Lock className="w-4 h-4" />
                    </span>
                    <div>
                      <div className={`text-sm font-semibold ${headingText}`}>
                        {t(lang, 'securityLabel')}
                      </div>
                      <div className={`text-xs ${mutedText}`}>
                        Vault status, passkey &amp; active session
                      </div>
                    </div>
                  </div>
                  <ChevronRight className={`w-4 h-4 ${mutedText}`} />
                </button>
              </div>
            </section>

            {/* Help & Support */}
            <section className={`rounded-[22px] p-5 ${surfaceCard}`}>
              <h2 className={`text-base font-bold mb-2 ${headingText}`}>
                {t(lang, 'helpSupport')}
              </h2>

              <div className={`divide-y ${dividerColor}`}>
                <button
                  type="button"
                  onClick={() => onOpenWalletModal('support')}
                  className={`btn-press w-full min-h-[52px] py-2 flex items-center justify-between text-left rounded-xl px-1.5 ${rowHover}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-9 h-9 rounded-xl bg-[#7c3aed]/15 text-[#a78bfa] flex items-center justify-center">
                      <Mail className="w-4 h-4" />
                    </span>
                    <div>
                      <div className={`text-sm font-semibold ${headingText}`}>{t(lang, 'contactUs')}</div>
                      <div className={`text-xs ${mutedText}`}>Get help from desk support</div>
                    </div>
                  </div>
                  <ChevronRight className={`w-4 h-4 ${mutedText}`} />
                </button>

                <button
                  type="button"
                  onClick={() => onOpenWalletModal('support')}
                  className={`btn-press w-full min-h-[52px] py-2 flex items-center justify-between text-left rounded-xl px-1.5 ${rowHover}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                      <MessageCircle className="w-4 h-4" />
                    </span>
                    <div>
                      <div className={`text-sm font-semibold ${headingText}`}>{t(lang, 'chatWithUs')}</div>
                      <div className={`text-xs ${mutedText}`}>Instant support is available</div>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Live
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSheet('tickets')}
                  className={`btn-press w-full min-h-[52px] py-2 flex items-center justify-between text-left rounded-xl px-1.5 ${rowHover}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-9 h-9 rounded-xl bg-[#7c3aed]/15 text-[#a78bfa] flex items-center justify-center">
                      <Headphones className="w-4 h-4" />
                    </span>
                    <div>
                      <div className={`text-sm font-semibold ${headingText}`}>{t(lang, 'pastTickets')}</div>
                      <div className={`text-xs ${mutedText}`}>Track your support ticket status</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full bg-white/10 text-[11px] font-bold font-mono-nums">
                      {supportTickets.length}
                    </span>
                    <ChevronRight className={`w-4 h-4 ${mutedText}`} />
                  </div>
                </button>

                <button
                  type="button"
                  onClick={onNavigateGift}
                  className={`btn-press w-full min-h-[52px] py-2 flex items-center justify-between text-left rounded-xl px-1.5 ${rowHover}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-9 h-9 rounded-xl bg-[#7c3aed]/15 text-[#a78bfa] flex items-center justify-center">
                      <Ticket className="w-4 h-4" />
                    </span>
                    <div>
                      <div className={`text-sm font-semibold ${headingText}`}>{t(lang, 'couponCode')}</div>
                      <div className={`text-xs ${mutedText}`}>Avail exciting offers</div>
                    </div>
                  </div>
                  <ChevronRight className={`w-4 h-4 ${mutedText}`} />
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSheet('get_app')}
                  className={`btn-press w-full min-h-[52px] py-2 flex items-center justify-between text-left rounded-xl px-1.5 ${rowHover}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-9 h-9 rounded-xl bg-[#7c3aed]/15 text-[#a78bfa] flex items-center justify-center">
                      <Download className="w-4 h-4" />
                    </span>
                    <div>
                      <div className={`text-sm font-semibold ${headingText}`}>{t(lang, 'getApp')}</div>
                      <div className={`text-xs ${mutedText}`}>Download the Android app</div>
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#7c3aed]/20 border border-[#7c3aed]/40 text-[11px] font-extrabold text-[#a78bfa]">
                    APK
                  </span>
                </button>
              </div>
            </section>

            {/* Top Traders Leaderboard Trigger Button */}
            {platformSettings.leaderboardEnabled !== false && (
              <button
                type="button"
                id="profile-leaderboard-btn"
                onClick={() => setActiveSheet('leaderboard')}
                className={`btn-press w-full min-h-[54px] px-4 rounded-2xl border flex items-center justify-between text-left ${surfaceCard}`}
              >
                <span className="flex items-center gap-3">
                  <span className="w-9 h-9 rounded-xl bg-[#7c3aed]/15 border border-[#8b5cf6]/30 text-[#a78bfa] flex items-center justify-center">
                    <LeaderboardPodiumIcon className="w-4 h-4" />
                  </span>
                  <span>
                    <span className={`block text-sm font-bold ${headingText}`}>
                      Top Traders Leaderboard
                    </span>
                    <span className={`block text-xs ${mutedText}`}>
                      View Top 10 traders ranked by Realized PnL
                    </span>
                  </span>
                </span>
                <ChevronRight className={`w-4 h-4 ${mutedText}`} />
              </button>
            )}

            {/* Bottom Settings & Password Change + Account Log out */}
            <div className="space-y-2.5">
              <button
                type="button"
                id="profile-bottom-settings-btn"
                onClick={() => {
                  setPwdError('');
                  setPwdSuccess('');
                  setActiveSheet('settings');
                }}
                className={`btn-press w-full min-h-[52px] px-4 rounded-2xl border flex items-center justify-between text-left ${surfaceCard}`}
              >
                <span className="flex items-center gap-3">
                  <span className="w-9 h-9 rounded-xl bg-[#7c3aed]/15 text-[#a78bfa] flex items-center justify-center">
                    <KeyRound className="w-4 h-4" />
                  </span>
                  <span>
                    <span className={`block text-sm font-bold ${headingText}`}>
                      Settings &amp; Change Password
                    </span>
                    <span className={`block text-xs ${mutedText}`}>
                      Update account login password &amp; preferences
                    </span>
                  </span>
                </span>
                <ChevronRight className={`w-4 h-4 ${mutedText}`} />
              </button>

              <button
                type="button"
                onClick={onLogout}
                className="btn-press w-full min-h-[46px] rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 font-bold text-sm inline-flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Log out
              </button>
            </div>

            {/* Owner-Exclusive Admin Panel Entry (hidden completely from all other accounts) */}
            {isOwnerAdmin(state.profile.email) && onNavigateAdmin && (
              <div className="pt-1">
                <button
                  type="button"
                  id="owner-admin-panel-btn"
                  onClick={onNavigateAdmin}
                  className="hero-preserve-dark preserve-white btn-press w-full min-h-[54px] px-4 rounded-2xl border border-[#8b5cf6]/45 text-white font-bold text-sm flex items-center justify-between shadow-[0_10px_28px_rgba(76,29,149,0.35)]"
                  style={{
                    background: 'linear-gradient(135deg, #2e1065 0%, #5b21b6 55%, #7c3aed 100%)',
                  }}
                >
                  <span className="flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center">
                      <ShieldCheck className="w-4.5 h-4.5 text-emerald-300" />
                    </span>
                    <span className="text-left">
                      <span className="block text-sm font-extrabold leading-tight">
                        Admin Control Panel
                      </span>
                      <span className="block text-[10.5px] font-medium text-purple-200/85">
                        Owner Access · Commissions, Users &amp; Payouts
                      </span>
                    </span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-purple-200 shrink-0" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Interactive Modals for Transactions, Digital ID, Past Tickets, Security, Get App */}
      {activeSheet && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Profile detail modal"
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/75 backdrop-blur-sm p-0 md:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveSheet(null);
          }}
        >
          <div
            className={`w-full ${
              activeSheet === 'leaderboard' ? 'max-w-lg' : 'max-w-md'
            } bg-[#12121c] border border-white/10 rounded-t-3xl md:rounded-2xl p-5 pb-7 shadow-2xl max-h-[85vh] overflow-y-auto`}
          >
            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4 md:hidden" />

            {/* Transactions Sheet */}
            {activeSheet === 'transactions' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-extrabold text-white">Transactions Ledger</h3>
                    <p className="text-xs text-slate-400">
                      {state.transactions.length} recorded settlements
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveSheet(null)}
                    aria-label="Close transactions dialog"
                    className="btn-press w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-300"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex gap-1.5 mb-4 overflow-x-auto no-scrollbar">
                  {(
                    [
                      { id: 'all', label: 'All' },
                      { id: 'deposit', label: 'Deposits' },
                      { id: 'trade', label: 'Trades' },
                      { id: 'withdraw', label: 'Withdrawals' },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setTxFilter(tab.id)}
                      className={`btn-press px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap ${
                        txFilter === tab.id
                          ? 'preserve-white bg-[#7c3aed] text-white'
                          : 'bg-[#191928] text-slate-400 hover:text-white'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {filteredTransactions.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    No transactions match this filter yet.
                  </div>
                ) : (
                  <div className="divide-y divide-white/[0.06]">
                    {filteredTransactions.map((tx) => (
                      <div key={tx.id} className="py-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-white truncate">
                            {tx.title}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {tx.timestamp} · {tx.meta ?? tx.status}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          {renderTxBadge(tx)}
                          <div className="text-[10px] text-slate-500 mt-0.5">{tx.status}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setActiveSheet(null);
                    onNavigatePortfolio();
                  }}
                  className="preserve-white btn-press mt-4 w-full min-h-[44px] rounded-xl bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-bold text-xs"
                >
                  Open Full Portfolio &amp; Holdings
                </button>
              </div>
            )}

            {/* Digital Trader ID Card Sheet */}
            {activeSheet === 'trader_id' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-extrabold text-white">Ouroboros Digital ID</h3>
                  <button
                    type="button"
                    onClick={() => setActiveSheet(null)}
                    aria-label="Close ID dialog"
                    className="btn-press w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-300"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div
                  className="hero-preserve-dark rounded-2xl p-5 border border-white/20 space-y-4"
                  style={{
                    background: 'linear-gradient(145deg, #3b0764 0%, #6d28d9 60%, #4c1d95 100%)',
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-widest text-purple-200">
                      Ouroboros Verified Pass
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/35 text-[10px] font-bold text-emerald-200">
                      {levelInfo.current.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-3.5">
                    <div className="w-14 h-14 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center text-xl font-extrabold text-white">
                      {state.profile.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-base font-extrabold text-white">
                        {state.profile.name}
                      </div>
                      <div className="text-xs text-purple-100/80">{state.profile.email}</div>
                      <div className="text-xs font-mono-nums text-emerald-300 mt-0.5">
                        Tier {levelInfo.current.tier} · Spent{' '}
                        {formatCurrency(levelInfo.totalSpent, currency, fxRates)}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 pt-3 border-t border-white/15">
                    <button
                      type="button"
                      onClick={() => handleCopy(state.profile.uid, 'UID', 'modal-uid')}
                      className="btn-press p-2.5 rounded-xl bg-black/25 border border-white/10 text-left"
                    >
                      <div className="text-[10px] uppercase text-purple-200/75">Trader UID</div>
                      <div className="text-xs font-mono-nums font-bold text-white flex items-center justify-between mt-0.5">
                        <span className="truncate">{state.profile.uid}</span>
                        <Copy className="w-3 h-3 shrink-0 ml-1" />
                      </div>
                    </button>

                    <div className="p-2.5 rounded-xl bg-black/25 border border-white/10 text-left">
                      <div className="text-[10px] uppercase text-purple-200/75">Account Status</div>
                      <div className="text-xs font-mono-nums font-bold text-emerald-300 mt-0.5 truncate">
                        Verified · {currency} Desk
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Past Tickets Sheet */}
            {activeSheet === 'tickets' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-extrabold text-white">Past Support Tickets</h3>
                    <p className="text-xs text-slate-400">Live status of your desk inquiries</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveSheet(null)}
                    aria-label="Close tickets dialog"
                    className="btn-press w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-300"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {supportTickets.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    No support tickets filed yet.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {supportTickets.map((ticket) => (
                      <div
                        key={ticket.id}
                        className="p-3.5 rounded-xl bg-[#191928] border border-white/[0.06] space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-mono-nums font-bold text-[#a78bfa]">
                            {ticket.id} {ticket.uid ? `· ${ticket.uid}` : ''}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              ticket.status === 'Resolved'
                                ? 'bg-emerald-500/15 text-emerald-400'
                                : 'bg-amber-500/15 text-amber-300'
                            }`}
                          >
                            {ticket.status}
                          </span>
                        </div>
                        <div className="text-sm font-semibold text-white">
                          {ticket.subject}
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">{ticket.message}</p>
                        {(ticket.paymentDateTime || ticket.whatsapp) && (
                          <div className="flex flex-wrap gap-2 pt-1 text-[10px] text-slate-400 font-mono-nums">
                            {ticket.paymentDateTime && (
                              <span className="px-2 py-0.5 rounded bg-white/[0.05]">
                                Time: {ticket.paymentDateTime}
                              </span>
                            )}
                            {ticket.whatsapp && (
                              <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300">
                                WhatsApp: {ticket.whatsapp}
                              </span>
                            )}
                          </div>
                        )}
                        {ticket.screenshotDataUrl && (
                          <div className="pt-1.5">
                            <img
                              src={ticket.screenshotDataUrl}
                              alt={`Screenshot for ${ticket.id}`}
                              className="h-20 w-auto rounded-lg border border-white/10 object-cover"
                            />
                          </div>
                        )}
                        <div className="text-[10px] text-slate-500">Filed: {ticket.createdAt}</div>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setActiveSheet(null);
                    onOpenWalletModal('support');
                  }}
                  className="preserve-white btn-press mt-4 w-full min-h-[44px] rounded-xl bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-bold text-xs"
                >
                  Open New Support Ticket
                </button>
              </div>
            )}

            {/* Security Sheet */}
            {activeSheet === 'security' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-extrabold text-white">Security &amp; Vault Audit</h3>
                  <button
                    type="button"
                    onClick={() => setActiveSheet(null)}
                    aria-label="Close security dialog"
                    className="btn-press w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-300"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-2.5">
                  <div className="p-3.5 rounded-xl bg-[#191928] border border-white/[0.06] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <div>
                        <div className="text-sm font-semibold text-white">AES-256 Zero-Knowledge Vault</div>
                        <div className="text-xs text-slate-400">Encrypted wallet &amp; bank rails</div>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-emerald-400">Protected</span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-[#191928] border border-white/[0.06] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <KeyRound className="w-4 h-4 text-[#a78bfa]" />
                      <div>
                        <div className="text-sm font-semibold text-white">2-Factor Authentication</div>
                        <div className="text-xs text-slate-400">Withdrawal confirmation guard</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={onToggleTwoFactor}
                      className="btn-press px-2.5 py-1 rounded-lg bg-[#7c3aed]/25 text-xs font-bold text-[#a78bfa]"
                    >
                      {state.profile.twoFactorEnabled ? 'Enabled' : 'Enable'}
                    </button>
                  </div>

                  <div className="p-3.5 rounded-xl bg-[#191928] border border-white/[0.06] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CreditCard className="w-4 h-4 text-[#a78bfa]" />
                      <div>
                        <div className="text-sm font-semibold text-white">Bound Withdrawal Banks</div>
                        <div className="text-xs text-slate-400">
                          {state.bankAccounts.length} verified account(s)
                        </div>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-emerald-400">Verified</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setPwdError('');
                      setPwdSuccess('');
                      setActiveSheet('settings');
                    }}
                    className="preserve-white btn-press w-full min-h-[44px] rounded-xl bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-bold text-xs inline-flex items-center justify-center gap-2"
                  >
                    <KeyRound className="w-4 h-4" />
                    Change Account Password
                  </button>
                </div>
              </div>
            )}

            {/* Settings & Change Password Sheet */}
            {activeSheet === 'settings' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-extrabold text-white">Account Settings</h3>
                    <p className="text-xs text-slate-400">Change your login password anytime</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveSheet(null)}
                    aria-label="Close settings dialog"
                    className="btn-press w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-300"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handlePasswordSubmit} className="space-y-3">
                  <div>
                    <label
                      htmlFor="settings-current-pwd"
                      className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1"
                    >
                      Current Password
                    </label>
                    <input
                      id="settings-current-pwd"
                      type="password"
                      value={currentPwd}
                      onChange={(e) => {
                        setCurrentPwd(e.target.value);
                        setPwdError('');
                        setPwdSuccess('');
                      }}
                      placeholder="Enter current password"
                      className="w-full h-10 px-3 rounded-xl bg-[#191928] border border-white/10 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#7c3aed]"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="settings-new-pwd"
                      className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1"
                    >
                      New Password
                    </label>
                    <input
                      id="settings-new-pwd"
                      type="password"
                      value={newPwd}
                      onChange={(e) => {
                        setNewPwd(e.target.value);
                        setPwdError('');
                        setPwdSuccess('');
                      }}
                      placeholder="Minimum 6 characters"
                      className="w-full h-10 px-3 rounded-xl bg-[#191928] border border-white/10 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#7c3aed]"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="settings-confirm-pwd"
                      className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1"
                    >
                      Confirm New Password
                    </label>
                    <input
                      id="settings-confirm-pwd"
                      type="password"
                      value={confirmPwd}
                      onChange={(e) => {
                        setConfirmPwd(e.target.value);
                        setPwdError('');
                        setPwdSuccess('');
                      }}
                      placeholder="Re-enter new password"
                      className="w-full h-10 px-3 rounded-xl bg-[#191928] border border-white/10 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#7c3aed]"
                    />
                  </div>

                  {pwdError && (
                    <p
                      role="alert"
                      className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/25 rounded-xl px-3 py-2"
                    >
                      {pwdError}
                    </p>
                  )}

                  {pwdSuccess && (
                    <p
                      role="status"
                      className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 rounded-xl px-3 py-2"
                    >
                      {pwdSuccess}
                    </p>
                  )}

                  <button
                    type="submit"
                    className="preserve-white btn-press w-full min-h-[44px] rounded-xl bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-bold text-xs inline-flex items-center justify-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    Update Password
                  </button>
                </form>
              </div>
            )}

            {/* Top Traders Leaderboard Sheet */}
            {activeSheet === 'leaderboard' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="w-9 h-9 rounded-xl bg-[#7c3aed]/15 border border-[#8b5cf6]/30 text-[#a78bfa] flex items-center justify-center shrink-0">
                      <LeaderboardPodiumIcon className="w-4 h-4" />
                    </span>
                    <div>
                      <h3 className="text-lg font-extrabold text-white leading-tight">
                        Top Traders Leaderboard
                      </h3>
                      <p className="text-xs text-slate-400">
                        Top 10 ranked by Realized PnL
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveSheet(null)}
                    aria-label="Close leaderboard dialog"
                    className="btn-press w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-300"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <TopTradersLeaderboard
                  state={state}
                  embeddedInModal
                  onTradeNow={() => {
                    setActiveSheet(null);
                    onBack();
                  }}
                />
              </div>
            )}

            {/* Get App / APK Sheet */}
            {activeSheet === 'get_app' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-extrabold text-white">Get Ouroboros App</h3>
                  <button
                    type="button"
                    onClick={() => setActiveSheet(null)}
                    aria-label="Close app download dialog"
                    className="btn-press w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-300"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-4 rounded-2xl bg-[#191928] border border-white/[0.08] space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-[#7c3aed]/20 border border-[#7c3aed]/35 text-[#a78bfa] flex items-center justify-center">
                      <Smartphone className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white">
                        Ouroboros Mobile Terminal v2.4
                      </div>
                      <div className="text-xs text-slate-400">
                        Signed Android APK &amp; Instant PWA Web Install
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Add Ouroboros directly to your Android or iOS home screen via your browser
                    menu (&quot;Add to Home Screen&quot;) for full-screen native speed, or download
                    the verified Android package below.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveSheet(null);
                      onNotify('Ouroboros Android APK package ready (v2.4.0)', 'success');
                    }}
                    className="preserve-white btn-press w-full min-h-[44px] rounded-xl bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-bold text-xs inline-flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Download Signed Android APK
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
