import React, { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import {
  ArrowLeft,
  ArrowLeftRight,
  Building2,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  ImagePlus,
  Lock,
  Plus,
  Share2,
  ShieldCheck,
  Smartphone,
  Trash2,
  X,
} from 'lucide-react';
import {
  BankAccount,
  BaseCurrency,
  FxRatesMap,
  MerchantUpiConfig,
  PlatformSettings,
  ThemeMode,
  UpiAccount,
  WalletTransaction,
} from '../types/trading';
import {
  MAX_TOPUP_INR,
  MAX_WITHDRAW_INR,
  MIN_TOPUP_INR,
  MIN_WITHDRAW_INR,
  formatCurrency,
  formatExactDateTime,
  getActiveMerchantUpis,
  validateUpiId,
  validateUtr12Digits,
} from '../utils/tradingEngine';
import { getAssetUrl } from '../utils/assetPath';
import {
  MERCHANT_NAME,
  MERCHANT_UPI_ID,
  UPI_BIND_APPS,
  UPI_PAYMENT_METHODS,
  UpiAppLogo,
  UpiMethodId,
  UpiPaymentMethod,
  buildAppDeepLink,
  buildUpiPaymentUri,
  getUpiMethodById,
  launchUpiDeepLink,
} from './UpiAppBranding';

export type WalletModalMode = 'topup' | 'withdraw' | 'bind_bank' | 'sell_usdt' | 'support' | null;

type TopUpStep = 'start' | 'methods' | 'qr' | 'utr' | 'success';
type AccountRailTab = 'bank' | 'upi';

export interface SupportTicketPayload {
  subject: string;
  message: string;
  transactionId?: string;
  paymentDateTime?: string;
  whatsapp?: string;
  screenshotDataUrl?: string;
}

interface WalletModalProps {
  mode: WalletModalMode;
  balance: number;
  withdrawableBalance: number;
  usdtHoldings: number;
  usdtRateInr: number;
  bankAccounts: BankAccount[];
  upiAccounts: UpiAccount[];
  transactions?: WalletTransaction[];
  userUid?: string;
  preselectedTxId?: string | null;
  defaultHolderName?: string;
  currency?: BaseCurrency;
  fxRates?: FxRatesMap;
  themeMode?: ThemeMode;
  merchantUpiPool?: MerchantUpiConfig[];
  platformSettings?: PlatformSettings;
  isFirstDeposit?: boolean;
  minDepositInr?: number;
  minWithdrawInr?: number;
  onClose: () => void;
  onTopUp: (
    amount: number,
    method: string,
    utr?: string,
    deferAnimation?: boolean
  ) => { ok: boolean; error?: string };
  onWithdraw: (amount: number, destinationId: string) => { ok: boolean; error?: string };
  onBindBank: (bank: Omit<BankAccount, 'id'>) => void;
  onBindUpi: (upi: Omit<UpiAccount, 'id'>) => void;
  onSellUsdt: (usdtAmount: number) => { ok: boolean; error?: string };
  onSupportSubmit: (payload: SupportTicketPayload) => void;
}

const QUICK_AMOUNTS = [500, 1000, 5000, 10000];

export const WalletModal: React.FC<WalletModalProps> = ({
  mode,
  balance,
  withdrawableBalance,
  usdtHoldings,
  usdtRateInr,
  bankAccounts,
  upiAccounts,
  transactions = [],
  userUid = 'UID-95E9-AARAV',
  preselectedTxId = null,
  defaultHolderName = 'Aarav Sharma',
  currency = 'INR',
  fxRates,
  themeMode = 'dark',
  merchantUpiPool,
  platformSettings,
  isFirstDeposit = false,
  minDepositInr,
  minWithdrawInr,
  onClose,
  onTopUp,
  onWithdraw,
  onBindBank,
  onBindUpi,
  onSellUsdt,
  onSupportSubmit,
}) => {
  const isLight = themeMode === 'light';
  const effectiveMinTopUp = minDepositInr ?? MIN_TOPUP_INR;
  const effectiveMaxTopUp = platformSettings?.maxDepositInr ?? MAX_TOPUP_INR;
  const effectiveMinWithdraw = minWithdrawInr ?? MIN_WITHDRAW_INR;
  const effectiveMaxWithdraw = platformSettings?.maxWithdrawInr ?? MAX_WITHDRAW_INR;

  const activeReceivers = useMemo(
    () => getActiveMerchantUpis({ merchantUpiPool }),
    [merchantUpiPool]
  );
  const [selectedReceiverId, setSelectedReceiverId] = useState<string>(
    activeReceivers[0]?.id ?? ''
  );

  const selectedReceiver = useMemo(
    () =>
      activeReceivers.find((r) => r.id === selectedReceiverId) ??
      activeReceivers[0],
    [activeReceivers, selectedReceiverId]
  );

  const activeUpiId = selectedReceiver?.upiId?.trim() || MERCHANT_UPI_ID;
  const activePayeeName = selectedReceiver?.payeeName?.trim() || MERCHANT_NAME;

  // ===== Top-Up Flow State =====
  const [topUpStep, setTopUpStep] = useState<TopUpStep>('start');
  const [selectedMethodId, setSelectedMethodId] = useState<UpiMethodId | null>('upi-qr');
  const [amountInput, setAmountInput] = useState('500');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [remainingSeconds, setRemainingSeconds] = useState(600);
  const [utrInput, setUtrInput] = useState('');
  const [submittedReceipt, setSubmittedReceipt] = useState<{
    amount: number;
    methodName: string;
    utr: string;
    time: string;
    receiverUpiId: string;
  } | null>(null);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [qrToast, setQrToast] = useState<string | null>(null);

  // ===== Withdraw State (Bank or UPI) =====
  const [withdrawRail, setWithdrawRail] = useState<AccountRailTab>(
    bankAccounts.length > 0 ? 'bank' : 'upi'
  );
  const [selectedBankId, setSelectedBankId] = useState(bankAccounts[0]?.id ?? '');
  const [selectedUpiId, setSelectedUpiId] = useState(upiAccounts[0]?.id ?? '');
  const [useCustomWithdrawUpi, setUseCustomWithdrawUpi] = useState(upiAccounts.length === 0);
  const [customWithdrawUpi, setCustomWithdrawUpi] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('500');

  // ===== Bind Bank / UPI State + Bound Confirmation =====
  const [bindTab, setBindTab] = useState<AccountRailTab>('bank');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [holderName, setHolderName] = useState(defaultHolderName);
  const [bindUpiAppId, setBindUpiAppId] = useState<UpiMethodId>('phonepe');
  const [bindUpiHandle, setBindUpiHandle] = useState('');
  const [boundConfirmation, setBoundConfirmation] = useState<{
    kind: 'bank' | 'upi';
    title: string;
    subtitle: string;
    holder: string;
    appId?: string;
  } | null>(null);

  // ===== USDT & Upgraded Support / Helpline State =====
  const [usdtInput, setUsdtInput] = useState('5');
  const [supportSubject, setSupportSubject] = useState('Deposit Issue / Under Review');
  const [supportTxId, setSupportTxId] = useState('');
  const [supportDateTime, setSupportDateTime] = useState('');
  const [supportWhatsapp, setSupportWhatsapp] = useState('');
  const [supportMessage, setSupportMessage] = useState('');
  const [supportScreenshot, setSupportScreenshot] = useState<string | undefined>(undefined);
  const [error, setError] = useState('');

  const paymentTransactions = useMemo(
    () => transactions.filter((tx) => tx.type === 'deposit' || tx.type === 'withdraw'),
    [transactions]
  );

  // Reset modal transient states ONLY when mode opens/changes (or preselectedTxId changes)
  useEffect(() => {
    setError('');
    if (mode === 'topup') {
      setTopUpStep('start');
      setSelectedMethodId('upi-qr');
      setAmountInput('500');
      setUtrInput('');
      setSubmittedReceipt(null);
      setQrDataUrl('');
      setRemainingSeconds(600);
      setSelectedReceiverId(activeReceivers[0]?.id ?? '');
    } else if (mode === 'withdraw') {
      setWithdrawRail(bankAccounts.length > 0 ? 'bank' : 'upi');
      setSelectedBankId(bankAccounts[0]?.id ?? '');
      setSelectedUpiId(upiAccounts[0]?.id ?? '');
      setUseCustomWithdrawUpi(upiAccounts.length === 0);
      setWithdrawAmount(
        String(Math.min(500, Math.max(effectiveMinWithdraw, Math.floor(withdrawableBalance))))
      );
    } else if (mode === 'bind_bank') {
      setBindTab('bank');
      setHolderName(defaultHolderName);
      setBindUpiHandle('');
      setBankName('');
      setAccountNumber('');
      setIfsc('');
      setBoundConfirmation(null);
    } else if (mode === 'support') {
      const matched = preselectedTxId
        ? paymentTransactions.find((tx) => tx.id === preselectedTxId)
        : paymentTransactions[0];
      setSupportTxId(matched?.id ?? '');
      setSupportDateTime(matched?.timestamp ?? formatExactDateTime());
      setSupportSubject(
        matched?.type === 'withdraw'
          ? 'Withdrawal Status / Delay'
          : 'Deposit Issue / Under Review'
      );
      setSupportWhatsapp('');
      setSupportMessage('');
      setSupportScreenshot(undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, preselectedTxId]);

  const activeMethod = useMemo(
    () => getUpiMethodById(selectedMethodId ?? 'upi-qr'),
    [selectedMethodId]
  );

  const parsedTopUpAmount = Math.round((Number(amountInput) || 0) * 100) / 100;

  // Auto-generate scannable QR code & start 10-minute timer when entering 'qr' step or changing receiver
  useEffect(() => {
    if (mode !== 'topup' || topUpStep !== 'qr') return;

    let cancelled = false;
    const uri = buildUpiPaymentUri(parsedTopUpAmount, undefined, {
      upiId: activeUpiId,
      payeeName: activePayeeName,
    });
    QRCode.toDataURL(uri, {
      width: 240,
      margin: 1,
      color: { dark: '#141124', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl('');
      });

    setRemainingSeconds(600);
    const timer = window.setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          setError('QR session expired. Please generate a fresh QR code.');
          setTopUpStep('methods');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [mode, topUpStep, parsedTopUpAmount, activeUpiId, activePayeeName]);

  if (!mode) return null;

  const formatCountdown = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const showQrToast = (msg: string) => {
    setQrToast(msg);
    window.setTimeout(() => setQrToast(null), 2200);
  };

  const handleCopyMerchantUpi = async () => {
    try {
      await navigator.clipboard?.writeText(activeUpiId);
    } catch {
      // Clipboard fallback
    }
    setCopiedUpi(true);
    showQrToast(`Copied ${activeUpiId}`);
    window.setTimeout(() => setCopiedUpi(false), 1600);
  };

  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `ouroboros-upi-qr-${parsedTopUpAmount}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    showQrToast('QR code downloaded');
  };

  const handleShareQr = async () => {
    const uri = buildUpiPaymentUri(parsedTopUpAmount, undefined, {
      upiId: activeUpiId,
      payeeName: activePayeeName,
    });
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: 'Ouroboros UPI Payment',
          text: `Pay ₹${parsedTopUpAmount.toLocaleString('en-IN')} to ${activeUpiId}`,
          url: uri,
        });
        return;
      } catch {
        // Fallback to copying link
      }
    }
    try {
      await navigator.clipboard?.writeText(uri);
    } catch {
      // Ignore
    }
    showQrToast('Payment link copied to share');
  };

  const handleProceedToMethods = () => {
    setError('');
    if (platformSettings?.depositsPaused) {
      setError(
        platformSettings.maintenanceNotice.trim() ||
          'Deposits are temporarily paused by Owner Desk.'
      );
      return;
    }
    if (!Number.isFinite(parsedTopUpAmount) || parsedTopUpAmount < effectiveMinTopUp) {
      setError(`Minimum deposit is ₹${effectiveMinTopUp}.`);
      return;
    }
    if (parsedTopUpAmount > effectiveMaxTopUp) {
      setError(`Maximum single deposit is ₹${effectiveMaxTopUp.toLocaleString('en-IN')}.`);
      return;
    }
    setTopUpStep('methods');
  };

  const handleSelectMethodAndLaunch = (method: UpiPaymentMethod) => {
    setError('');
    if (platformSettings?.depositsPaused) {
      setError(
        platformSettings.maintenanceNotice.trim() ||
          'Deposits are temporarily paused by Owner Desk.'
      );
      setTopUpStep('start');
      return;
    }
    if (!Number.isFinite(parsedTopUpAmount) || parsedTopUpAmount < effectiveMinTopUp) {
      setError(`Minimum deposit is ₹${effectiveMinTopUp}.`);
      setTopUpStep('start');
      return;
    }
    if (parsedTopUpAmount > effectiveMaxTopUp) {
      setError(`Maximum single deposit is ₹${effectiveMaxTopUp.toLocaleString('en-IN')}.`);
      setTopUpStep('start');
      return;
    }
    setSelectedMethodId(method.id);
    setUtrInput('');
    if (method.type === 'qr') {
      setTopUpStep('qr');
    } else {
      // Directly launch selected UPI app for payment without intermediate Open App screen
      launchUpiDeepLink(
        buildAppDeepLink(method, parsedTopUpAmount, {
          upiId: activeUpiId,
          payeeName: activePayeeName,
        })
      );
      setTopUpStep('utr');
    }
  };

  const handleUtrChange = (rawVal: string) => {
    const digitsOnly = rawVal.replace(/\D/g, '').slice(0, 12);
    setUtrInput(digitsOnly);
    setError('');
  };

  const handleSubmitUtr = () => {
    setError('');
    const check = validateUtr12Digits(utrInput);
    if (!check.valid) {
      setError(check.error ?? 'UTR must be a strictly 12-digit number.');
      return;
    }
    const res = onTopUp(parsedTopUpAmount, `${activeMethod.name} (${activeUpiId})`, check.cleaned, true);
    if (!res.ok) {
      setError(res.error ?? 'Failed to verify deposit.');
      return;
    }
    setSubmittedReceipt({
      amount: parsedTopUpAmount,
      methodName: activeMethod.name,
      utr: check.cleaned,
      time: formatExactDateTime(),
      receiverUpiId: activeUpiId,
    });
    setTopUpStep('success');
  };

  const handleCompleteTopUpAndClose = () => {
    // Transfer animation is triggered strictly after Owner verifies & credits UTR
    onClose();
  };

  const handleScreenshotUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      setError('Screenshot file must be under 4 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setSupportScreenshot(reader.result);
        setError('');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleLegacySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (mode === 'withdraw') {
      const targetDest =
        withdrawRail === 'bank'
          ? selectedBankId || bankAccounts[0]?.id || ''
          : useCustomWithdrawUpi
          ? `upi:${customWithdrawUpi.trim()}`
          : selectedUpiId || upiAccounts[0]?.id || '';
      const res = onWithdraw(Number(withdrawAmount), targetDest);
      if (!res.ok) setError(res.error ?? 'Failed to withdraw.');
      else onClose();
    } else if (mode === 'bind_bank') {
      if (bindTab === 'bank') {
        if (!bankName.trim() || accountNumber.trim().length < 4 || !ifsc.trim() || !holderName.trim()) {
          setError('Please fill out bank name, account number, IFSC, and account holder.');
          return;
        }
        const cleanLast4 = accountNumber.trim().slice(-4);
        const cleanIfsc = ifsc.trim().toUpperCase();
        const cleanHolder = holderName.trim();
        onBindBank({
          bankName: bankName.trim(),
          accountLast4: cleanLast4,
          accountNumber: accountNumber.trim(),
          ifsc: cleanIfsc,
          holderName: cleanHolder,
        });
        setBoundConfirmation({
          kind: 'bank',
          title: `${bankName.trim()} ••••${cleanLast4}`,
          subtitle: `IFSC ${cleanIfsc}`,
          holder: cleanHolder,
        });
      } else {
        const upiCheck = validateUpiId(bindUpiHandle);
        if (!upiCheck.valid) {
          setError(upiCheck.error ?? 'Enter a valid UPI ID.');
          return;
        }
        if (!holderName.trim()) {
          setError('Please enter the UPI account holder name.');
          return;
        }
        const chosenApp = getUpiMethodById(bindUpiAppId);
        const cleanHolder = holderName.trim();
        onBindUpi({
          upiId: upiCheck.cleaned,
          appId: chosenApp.id,
          appName: chosenApp.name,
          holderName: cleanHolder,
        });
        setBoundConfirmation({
          kind: 'upi',
          title: upiCheck.cleaned,
          subtitle: chosenApp.name,
          holder: cleanHolder,
          appId: chosenApp.id,
        });
      }
    } else if (mode === 'sell_usdt') {
      const res = onSellUsdt(Number(usdtInput));
      if (!res.ok) setError(res.error ?? 'Unable to sell USDT.');
      else onClose();
    } else if (mode === 'support') {
      if (!supportMessage.trim()) {
        setError('Please describe your deposit, withdrawal, or account issue.');
        return;
      }
      onSupportSubmit({
        subject: supportSubject,
        message: supportMessage.trim(),
        transactionId: supportTxId || undefined,
        paymentDateTime: supportDateTime.trim() || formatExactDateTime(),
        whatsapp: supportWhatsapp.trim() || undefined,
        screenshotDataUrl: supportScreenshot,
      });
      onClose();
    }
  };

  // Shared Light / Dark theme surface tokens for WalletModal
  const modalShellCls = isLight
    ? 'bg-white border-purple-200/80 text-slate-900 shadow-[0_24px_60px_rgba(76,29,149,0.18)]'
    : 'bg-[#12121c] border-white/10 text-white shadow-2xl';
  const surfaceBoxCls = isLight
    ? 'bg-[#f8f6ff] border-purple-200/80 text-slate-900'
    : 'bg-[#181826] border-white/10 text-white';
  const inputFieldCls = isLight
    ? 'bg-white border-purple-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-purple-600'
    : 'bg-[#181826] border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:border-[#8b5cf6]';
  const labelTextCls = isLight ? 'text-slate-600' : 'text-slate-400';
  const headingTextCls = isLight ? 'text-slate-900' : 'text-white';
  const mutedTextCls = isLight ? 'text-slate-600' : 'text-slate-400';

  const renderReceiverSelector = () => {
    if (activeReceivers.length <= 1) return null;
    return (
      <div className={`rounded-xl border p-2.5 space-y-2 ${surfaceBoxCls}`}>
        <div className="flex items-center justify-between text-[10.5px] font-bold uppercase tracking-wider">
          <span className={labelTextCls}>Select Receiving UPI Gateway</span>
          <span className={isLight ? 'text-purple-700' : 'text-[#c4b5fd]'}>
            {activeReceivers.length} Active IDs
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {activeReceivers.map((rec) => {
            const active = rec.id === selectedReceiver?.id;
            return (
              <button
                key={rec.id}
                type="button"
                onClick={() => setSelectedReceiverId(rec.id)}
                className={`btn-press px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold font-mono-nums transition-colors ${
                  active
                    ? isLight
                      ? 'bg-purple-600 border-purple-600 text-white'
                      : 'bg-[#7c3aed] border-[#8b5cf6] text-white'
                    : isLight
                    ? 'bg-white border-purple-200 text-slate-700 hover:border-purple-400'
                    : 'bg-[#12121c] border-white/10 text-slate-300 hover:border-[#8b5cf6]/50'
                }`}
              >
                {rec.label} · {rec.upiId}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  // ===== TOP UP DIRECT PAYMENT & SCAN & PAY FLOW =====
  if (mode === 'topup') {
    const stepDotIdx =
      topUpStep === 'start'
        ? 0
        : topUpStep === 'methods'
        ? 1
        : topUpStep === 'qr' || topUpStep === 'utr'
        ? 1
        : 2;

    const topUpHeaderTitle: Record<TopUpStep, string> = {
      start: 'Top Up Wallet',
      methods: 'Payment Method',
      qr: 'Scan & Pay',
      utr: 'Confirm Payment',
      success: 'Payment Status',
    };

    const handleBack = () => {
      setError('');
      if (topUpStep === 'methods') setTopUpStep('start');
      else if (topUpStep === 'qr' || topUpStep === 'utr') setTopUpStep('methods');
    };

    const showBack = topUpStep !== 'start' && topUpStep !== 'success';

    const renderTrustSection = () => (
      <div className="pt-2 space-y-3">
        <div className={`text-center text-[11px] font-bold uppercase tracking-[0.08em] ${mutedTextCls}`}>
          Why Ouroboros is Trusted
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div
            className={`rounded-2xl border p-3 flex flex-col items-center text-center gap-1.5 ${
              isLight
                ? 'bg-[#f8f6ff] border-purple-200/80'
                : 'bg-white/[0.03] border-white/[0.07]'
            }`}
          >
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                isLight ? 'bg-purple-100 text-purple-700' : 'bg-[#8b5cf6]/15 text-[#c4b5fd]'
              }`}
            >
              <Lock className="w-4 h-4" />
            </div>
            <div className={`text-[11.5px] font-bold leading-tight ${headingTextCls}`}>
              Official SSL Lock
            </div>
            <div className={`text-[10px] ${mutedTextCls}`}>256-Bit Encrypted</div>
          </div>

          <div
            className={`rounded-2xl border p-3 flex flex-col items-center text-center gap-1.5 ${
              isLight
                ? 'bg-[#f8f6ff] border-purple-200/80'
                : 'bg-white/[0.03] border-white/[0.07]'
            }`}
          >
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                isLight ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-500/15 text-emerald-400'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className={`text-[11.5px] font-bold leading-tight ${headingTextCls}`}>
              NPCI Verified Desk
            </div>
            <div className={`text-[10px] ${mutedTextCls}`}>Authentic UPI Gateway</div>
          </div>

          <div
            className={`rounded-2xl border p-3 flex flex-col items-center text-center gap-1.5 ${
              isLight
                ? 'bg-[#f8f6ff] border-purple-200/80'
                : 'bg-white/[0.03] border-white/[0.07]'
            }`}
          >
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                isLight ? 'bg-blue-100 text-blue-700' : 'bg-blue-500/15 text-blue-400'
              }`}
            >
              <ArrowLeftRight className="w-4 h-4" />
            </div>
            <div className={`text-[11.5px] font-bold leading-tight ${headingTextCls}`}>
              Instant Settlement
            </div>
            <div className={`text-[10px] ${mutedTextCls}`}>Auto UTR Verification</div>
          </div>

          <div
            className={`rounded-2xl border p-3 flex flex-col items-center text-center gap-1.5 ${
              isLight
                ? 'bg-[#f8f6ff] border-purple-200/80'
                : 'bg-white/[0.03] border-white/[0.07]'
            }`}
          >
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                isLight ? 'bg-amber-100 text-amber-700' : 'bg-amber-500/15 text-amber-400'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div className={`text-[11.5px] font-bold leading-tight ${headingTextCls}`}>
              Zero-Leak Vault
            </div>
            <div className={`text-[10px] ${mutedTextCls}`}>Protected Ledger</div>
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
          {[
            'Official Website Lock',
            '256-Bit TLS',
            'NPCI UPI Verified',
            '24×7 Instant Clearing',
          ].map((badge) => (
            <span
              key={badge}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-semibold whitespace-nowrap ${
                isLight
                  ? 'bg-purple-50 border-purple-200 text-slate-700'
                  : 'bg-white/[0.04] border-white/[0.08] text-slate-200'
              }`}
            >
              <Lock className={`w-3 h-3 ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`} />
              {badge}
            </span>
          ))}
        </div>

        <div className={`flex items-center justify-center gap-2 pt-1 text-[11px] ${mutedTextCls}`}>
          <span className="preserve-white w-5 h-5 rounded-md bg-white border border-purple-200 flex items-center justify-center shrink-0">
            <img
              src={getAssetUrl('assets/ouroboros-emblem.png')}
              alt="Ouroboros"
              className="w-3.5 h-3.5 object-contain"
            />
          </span>
          <Lock className={`w-3 h-3 ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`} />
          <span>Official Ouroboros Payment Gateway • Verified SSL Lock</span>
        </div>
      </div>
    );

    return (
      <div
        className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/75 backdrop-blur-sm p-0 md:p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wallet-topup-title"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            if (topUpStep === 'success') handleCompleteTopUpAndClose();
            else onClose();
          }
        }}
      >
        <div
          className={`w-full max-w-[440px] rounded-t-3xl md:rounded-[28px] p-5 pb-7 max-h-[92dvh] overflow-y-auto flex flex-col border ${modalShellCls}`}
        >
          <div
            className={`w-10 h-1 rounded-full mx-auto mb-3 md:hidden ${
              isLight ? 'bg-purple-200' : 'bg-white/20'
            }`}
          />

          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            {showBack ? (
              <button
                type="button"
                onClick={handleBack}
                aria-label="Go back"
                className={`w-10 h-10 rounded-full border flex items-center justify-center transition-colors ${
                  isLight
                    ? 'bg-purple-50 border-purple-200 text-slate-700 hover:text-purple-900 hover:border-purple-400'
                    : 'bg-white/[0.06] border-white/10 text-white hover:border-[#8b5cf6]'
                }`}
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            ) : (
              <div className="w-10" />
            )}

            <h2
              id="wallet-topup-title"
              className={`text-[17px] font-bold tracking-tight ${headingTextCls}`}
            >
              {topUpHeaderTitle[topUpStep]}
            </h2>

            <button
              type="button"
              onClick={topUpStep === 'success' ? handleCompleteTopUpAndClose : onClose}
              aria-label="Close top up dialog"
              className={`w-10 h-10 rounded-full border flex items-center justify-center transition-colors ${
                isLight
                  ? 'bg-purple-50 border-purple-200 text-slate-600 hover:text-purple-900 hover:border-purple-400'
                  : 'bg-white/[0.06] border-white/10 text-slate-300 hover:text-white hover:border-[#8b5cf6]'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {topUpStep !== 'success' && (
            <div className="flex justify-center gap-1.5 mb-4" aria-hidden="true">
              {[0, 1, 2].map((dot) => (
                <span
                  key={dot}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    dot === stepDotIdx
                      ? 'w-[22px] bg-gradient-to-r from-[#8b5cf6] to-[#c4b5fd]'
                      : dot < stepDotIdx
                      ? 'w-1.5 bg-[#8b5cf6]/60'
                      : isLight
                      ? 'w-1.5 bg-purple-200'
                      : 'w-1.5 bg-white/20'
                  }`}
                />
              ))}
            </div>
          )}

          {/* SCREEN 1: AMOUNT + START */}
          {topUpStep === 'start' && (
            <div className="space-y-4">
              <div
                className="hero-preserve-dark relative overflow-hidden rounded-2xl p-4 border border-[#8b5cf6]/35 shadow-[0_14px_32px_rgba(30,8,59,0.45)]"
                style={{
                  background:
                    'linear-gradient(150deg, #1e083b 0%, #3b0764 50%, #5b21b6 100%)',
                }}
              >
                <div aria-hidden="true" className="profile-light-sweep opacity-80" />
                <div aria-hidden="true" className="animate-wallet-sheen" />
                <div className="relative z-10">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-purple-200/85">
                    Current Balance
                  </div>
                  <div className="text-2xl font-extrabold font-mono-nums text-white mt-1">
                    {formatCurrency(balance, currency, fxRates)}
                  </div>
                  {currency !== 'INR' && (
                    <div className="text-xs font-mono-nums text-purple-200 mt-0.5">
                      ≈ ₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} INR
                    </div>
                  )}
                </div>
              </div>

              {isFirstDeposit && platformSettings?.firstDepositBonusEnabled !== false && (
                <div className="rounded-xl px-3.5 py-2.5 bg-emerald-500/15 border border-emerald-500/35 text-xs font-semibold text-emerald-400 flex items-center justify-between gap-2">
                  <span>
                    New User Welcome Bonus: +{platformSettings?.firstDepositBonusPct ?? 5}% extra
                    play credit (up to ₹{platformSettings?.firstDepositBonusMaxInr ?? 100}) on your
                    1st verified deposit!
                  </span>
                </div>
              )}

              {platformSettings?.depositsPaused && (
                <div className="rounded-xl px-3.5 py-2.5 bg-amber-500/15 border border-amber-500/35 text-xs font-semibold text-amber-500 flex items-center gap-2">
                  <Lock className="w-4 h-4 shrink-0" />
                  <span>
                    {platformSettings.maintenanceNotice.trim() ||
                      'Deposits are temporarily paused by Owner Desk.'}
                  </span>
                </div>
              )}

              <div>
                <label
                  htmlFor="topup-amount-input"
                  className={`block text-[11px] font-bold uppercase tracking-wider mb-2 ${labelTextCls}`}
                >
                  Enter Amount (INR · ₹{effectiveMinTopUp.toLocaleString('en-IN')} – ₹{effectiveMaxTopUp.toLocaleString('en-IN')})
                </label>
                <input
                  id="topup-amount-input"
                  type="number"
                  min={effectiveMinTopUp}
                  max={effectiveMaxTopUp}
                  placeholder="500"
                  value={amountInput}
                  onChange={(e) => {
                    setAmountInput(e.target.value);
                    setError('');
                  }}
                  className={`w-full h-12 px-4 rounded-xl border font-mono-nums text-lg font-bold ${inputFieldCls}`}
                />
                <div className="grid grid-cols-4 gap-2 mt-2.5">
                  {QUICK_AMOUNTS.map((amt) => {
                    const active = Number(amountInput) === amt;
                    return (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => {
                          setAmountInput(String(amt));
                          setError('');
                        }}
                        className={`btn-press py-2.5 rounded-xl border text-xs font-bold font-mono-nums transition-colors ${
                          active
                            ? isLight
                              ? 'bg-purple-100 border-purple-600 text-purple-900'
                              : 'bg-[#7c3aed]/25 border-[#8b5cf6] text-[#c4b5fd]'
                            : isLight
                            ? 'bg-[#f8f6ff] border-purple-200 text-slate-700 hover:border-purple-400'
                            : 'bg-[#181826] border-white/10 text-slate-200 hover:border-[#8b5cf6]/50'
                        }`}
                      >
                        +₹{amt.toLocaleString('en-IN')}
                      </button>
                    );
                  })}
                </div>
              </div>

              {error && (
                <p
                  role="alert"
                  className={`text-xs rounded-xl px-3 py-2 border ${
                    isLight
                      ? 'text-rose-700 bg-rose-50 border-rose-200'
                      : 'text-rose-400 bg-rose-500/10 border-rose-500/25'
                  }`}
                >
                  {error}
                </p>
              )}

              <button
                type="button"
                onClick={handleProceedToMethods}
                className="preserve-white btn-press w-full py-4 rounded-[14px] text-white font-bold text-base shadow-[0_8px_22px_rgba(124,58,237,0.45)]"
                style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)' }}
              >
                Select Payment Method →
              </button>

              <p className={`text-center text-xs leading-relaxed pt-1 ${mutedTextCls}`}>
                Instant UPI &amp; Bank Gateway • Minimum ₹{effectiveMinTopUp.toLocaleString('en-IN')} · Maximum ₹{effectiveMaxTopUp.toLocaleString('en-IN')}
              </p>
            </div>
          )}

          {/* SCREEN 2: OFFICIAL LOGOS + ONE-TAP DIRECT LAUNCH */}
          {topUpStep === 'methods' && (
            <div className="space-y-3.5">
              <div className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-xs ${surfaceBoxCls}`}>
                <div>
                  <span className={mutedTextCls}>Paying Amount: </span>
                  <span className={`font-mono-nums font-extrabold ${headingTextCls}`}>
                    ₹{parsedTopUpAmount.toLocaleString('en-IN')}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setTopUpStep('start')}
                  className={`font-bold hover:underline ${isLight ? 'text-purple-700' : 'text-[#a78bfa]'}`}
                >
                  Change
                </button>
              </div>

              {renderReceiverSelector()}

              <div className={`text-[11px] font-bold uppercase tracking-wider ${labelTextCls}`}>
                Tap an App to Pay Directly ({UPI_PAYMENT_METHODS.length} UPI Options)
              </div>

              <div className="grid grid-cols-2 gap-2.5 max-h-[52vh] overflow-y-auto pr-0.5">
                {UPI_PAYMENT_METHODS.map((item) => {
                  const isSelected = selectedMethodId === item.id;
                  const isFullWidth = item.id === 'upi-qr';
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectMethodAndLaunch(item)}
                      className={`btn-press text-left rounded-xl border transition-all ${
                        isFullWidth
                          ? 'col-span-2 flex items-center gap-3.5 p-3.5'
                          : 'flex flex-col items-center justify-center text-center gap-2 py-3.5 px-2.5'
                      } ${
                        isSelected
                          ? isLight
                            ? 'border-purple-600 bg-purple-50 shadow-[0_0_0_1px_rgba(124,58,237,0.35)]'
                            : 'border-[#8b5cf6] bg-[#7c3aed]/15 shadow-[0_0_0_1px_rgba(139,92,246,0.5)]'
                          : isLight
                          ? 'border-purple-200/80 bg-[#f8f6ff] hover:border-purple-400'
                          : 'border-white/10 bg-[#181826] hover:border-[#8b5cf6]/70'
                      }`}
                    >
                      <UpiAppLogo methodId={item.id} size="md" />
                      <div className={isFullWidth ? 'min-w-0 flex-1' : 'min-w-0 w-full'}>
                        <div className={`text-xs sm:text-[13px] font-bold truncate ${headingTextCls}`}>
                          {item.name}
                        </div>
                        <div className={`text-[10.5px] truncate mt-0.5 ${mutedTextCls}`}>
                          {item.subtitle}
                        </div>
                      </div>
                      {isFullWidth && (
                        <span
                          className={`text-xs font-bold shrink-0 ${
                            isLight ? 'text-purple-700' : 'text-[#a78bfa]'
                          }`}
                        >
                          Scan →
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* SCREEN 3A: OUROBOROS SCAN & PAY (THEME-AWARE LIGHT/DARK + WHITE MEDALLION + MULTI-UPI) */}
          {topUpStep === 'qr' && (
            <div className="space-y-4">
              {renderReceiverSelector()}

              <div
                className={`rounded-[24px] p-4 border relative overflow-hidden ${
                  isLight
                    ? 'bg-[#f6f3ff] border-purple-200/90 shadow-[0_14px_34px_rgba(91,33,182,0.10)]'
                    : 'bg-gradient-to-b from-[#1e1b37] to-[#121023] border-[#8b5cf6]/25 shadow-[0_22px_45px_rgba(0,0,0,0.45)]'
                }`}
              >
                <div
                  aria-hidden="true"
                  className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#a78bfa]/50 to-transparent"
                />

                {/* Brand Row with White Medallion Ouroboros Emblem + Verified Desk + Live Timer */}
                <div className="flex items-center justify-between gap-2 mb-4">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="preserve-white w-10 h-10 rounded-xl bg-white border border-purple-200/90 shadow-sm flex items-center justify-center shrink-0">
                      <img
                        src={getAssetUrl('assets/ouroboros-emblem.png')}
                        alt="Ouroboros Official Logo"
                        className="w-7 h-7 object-contain"
                      />
                    </div>
                    <div className="min-w-0">
                      <h3 className={`text-[13.5px] font-bold flex items-center gap-1.5 truncate ${headingTextCls}`}>
                        <span>Ouroboros Verified Desk</span>
                        <span className="preserve-white w-3.5 h-3.5 rounded-full bg-emerald-500 text-white inline-flex items-center justify-center shrink-0">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </span>
                      </h3>
                      <p className={`text-[11px] truncate ${mutedTextCls}`}>
                        {selectedReceiver?.label || 'NPCI UPI Instant Gateway'}
                      </p>
                    </div>
                  </div>

                  <div
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-[12px] font-bold font-mono-nums shrink-0 ${
                      isLight
                        ? 'bg-purple-100 border-purple-300 text-purple-800'
                        : 'bg-[#8b5cf6]/15 border-[#8b5cf6]/35 text-[#c4b5fd]'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>{formatCountdown(remainingSeconds)}</span>
                  </div>
                </div>

                {/* Amount Section */}
                <div className="text-center my-2 mb-4">
                  <div className={`text-[11px] font-semibold uppercase tracking-[0.08em] mb-1 ${mutedTextCls}`}>
                    Pay Exact Amount
                  </div>
                  <div
                    className={`text-[38px] font-extrabold tracking-tight font-mono-nums leading-none ${
                      isLight
                        ? 'text-[#3b0764]'
                        : 'bg-gradient-to-br from-white via-[#ede9fe] to-[#c4b5fd] bg-clip-text text-transparent'
                    }`}
                  >
                    ₹{parsedTopUpAmount.toLocaleString('en-IN')}
                  </div>
                </div>

                {/* QR Frame & Actions */}
                <div
                  className={`rounded-[20px] p-4 border flex flex-col items-center ${
                    isLight
                      ? 'bg-white border-purple-200/80'
                      : 'bg-gradient-to-b from-white/[0.06] to-white/[0.02] border-white/[0.08]'
                  }`}
                >
                  <div className="preserve-white bg-white rounded-2xl p-3 border border-purple-100 shadow-[0_8px_24px_rgba(0,0,0,0.16)]">
                    {qrDataUrl ? (
                      <img
                        src={qrDataUrl}
                        alt={`UPI QR code for ₹${parsedTopUpAmount}`}
                        className="w-[180px] h-[180px] rounded-[4px] block"
                      />
                    ) : (
                      <div className="w-[180px] h-[180px] flex items-center justify-center text-xs text-slate-600 font-semibold">
                        Generating QR…
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2.5 mt-3.5 w-full max-w-[290px] justify-center">
                    <button
                      type="button"
                      onClick={handleDownloadQr}
                      className={`btn-press flex-1 h-9 rounded-xl border text-xs font-semibold inline-flex items-center justify-center gap-1.5 ${
                        isLight
                          ? 'border-purple-300 bg-purple-50 text-purple-800 hover:bg-purple-100'
                          : 'border-[#8b5cf6]/35 bg-[#8b5cf6]/15 text-[#c4b5fd] hover:bg-[#8b5cf6]/25'
                      }`}
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download QR
                    </button>
                    <button
                      type="button"
                      onClick={handleShareQr}
                      className={`btn-press flex-1 h-9 rounded-xl border text-xs font-semibold inline-flex items-center justify-center gap-1.5 ${
                        isLight
                          ? 'border-purple-300 bg-purple-50 text-purple-800 hover:bg-purple-100'
                          : 'border-[#8b5cf6]/35 bg-[#8b5cf6]/15 text-[#c4b5fd] hover:bg-[#8b5cf6]/25'
                      }`}
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      Share
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5 justify-center mt-3">
                    {['PhonePe', 'GPay', 'Paytm', 'BHIM'].map((chip) => (
                      <span
                        key={chip}
                        className={`text-[11px] font-medium px-2.5 py-1 rounded-full border ${
                          isLight
                            ? 'text-slate-700 bg-purple-50 border-purple-200'
                            : 'text-slate-300 bg-white/[0.05] border-white/[0.07]'
                        }`}
                      >
                        {chip}
                      </span>
                    ))}
                  </div>

                  <div
                    className={`mt-3.5 w-full border rounded-xl px-3 py-2.5 flex items-center justify-between gap-2 ${
                      isLight
                        ? 'bg-purple-50/90 border-purple-200'
                        : 'bg-black/30 border-white/[0.08]'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className={`text-[10px] font-bold uppercase tracking-wider ${mutedTextCls}`}>
                        VPA
                      </div>
                      <div
                        className={`text-[13px] font-semibold font-mono-nums truncate ${
                          isLight ? 'text-slate-900' : 'text-slate-100'
                        }`}
                      >
                        {activeUpiId}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyMerchantUpi}
                      aria-label="Copy VPA"
                      className={`btn-press w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                        copiedUpi
                          ? 'bg-emerald-500/25 text-emerald-500'
                          : isLight
                          ? 'bg-purple-200/70 text-purple-800 hover:bg-purple-200'
                          : 'bg-[#8b5cf6]/20 text-[#c4b5fd] hover:bg-[#8b5cf6]/30'
                      }`}
                    >
                      {copiedUpi ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>

                  {qrToast && (
                    <div className="mt-2.5 text-[11px] font-semibold text-emerald-500 bg-emerald-500/15 border border-emerald-500/30 rounded-full px-3 py-1">
                      {qrToast}
                    </div>
                  )}
                </div>
              </div>

              {/* UTR Input Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="utr-input-qr"
                    className={`text-[11.5px] font-bold uppercase tracking-wider ${labelTextCls}`}
                  >
                    Enter 12-Digit UTR Number
                  </label>
                  <span
                    className={`text-[11.5px] font-mono-nums font-bold ${
                      utrInput.length === 12
                        ? isLight
                          ? 'text-emerald-600'
                          : 'text-emerald-400'
                        : mutedTextCls
                    }`}
                  >
                    {utrInput.length}/12 digits
                  </span>
                </div>
                <input
                  id="utr-input-qr"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={12}
                  placeholder="12-digit UTR (e.g. 412345678901)"
                  value={utrInput}
                  onChange={(e) => handleUtrChange(e.target.value)}
                  className={`w-full h-12 px-4 rounded-[14px] border-[1.5px] font-mono-nums text-base font-medium tracking-wider ${
                    isLight
                      ? 'bg-white border-purple-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-purple-600'
                      : 'bg-white/[0.04] border-white/15 text-white placeholder:text-slate-500 focus:outline-none focus:border-[#8b5cf6]'
                  }`}
                />
                <p className={`text-[11px] ${mutedTextCls}`}>
                  Strictly 12 digits only. Find this UTR in your UPI payment confirmation receipt.
                </p>

                {error && (
                  <p
                    role="alert"
                    className={`text-xs rounded-xl px-3 py-2 border ${
                      isLight
                        ? 'text-rose-700 bg-rose-50 border-rose-200'
                        : 'text-rose-400 bg-rose-500/10 border-rose-500/25'
                    }`}
                  >
                    {error}
                  </p>
                )}

                <button
                  type="button"
                  onClick={handleSubmitUtr}
                  className={`preserve-white btn-press w-full h-[52px] rounded-2xl text-white font-bold text-[15px] shadow-[0_8px_24px_rgba(109,40,217,0.45)] transition-opacity ${
                    utrInput.length === 12 ? 'opacity-100' : 'opacity-85'
                  }`}
                  style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 55%, #5b21b6 100%)' }}
                >
                  I’ve Paid – Submit UTR
                </button>
              </div>

              {renderTrustSection()}
            </div>
          )}

          {/* SCREEN 3B: DIRECT APP PAYMENT UTR CONFIRMATION (THEME-AWARE LIGHT/DARK) */}
          {topUpStep === 'utr' && (
            <div className="space-y-4">
              {renderReceiverSelector()}

              <div
                className={`rounded-2xl p-4 border text-center ${
                  isLight
                    ? 'bg-[#f6f3ff] border-purple-200/90'
                    : 'bg-gradient-to-b from-[#1e1b37] to-[#121023] border-[#8b5cf6]/25'
                }`}
              >
                <div className="flex items-center justify-center gap-2.5 mb-2.5">
                  <UpiAppLogo methodId={activeMethod.id} size="md" />
                </div>
                <div className={`text-xs font-bold mb-1 ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
                  {activeMethod.name} Payment Launched
                </div>
                <div className={`text-[30px] font-extrabold font-mono-nums leading-tight ${headingTextCls}`}>
                  ₹{parsedTopUpAmount.toLocaleString('en-IN')}
                </div>
                <div className={`text-[11px] font-mono-nums mt-1 ${isLight ? 'text-purple-700' : 'text-[#c4b5fd]'}`}>
                  Gateway VPA: {activeUpiId}
                </div>
                <p className={`text-xs mt-1.5 ${mutedTextCls}`}>
                  Complete your payment in {activeMethod.name}, then enter your 12-digit UTR below.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="utr-input-app"
                    className={`text-[11.5px] font-bold uppercase tracking-wider ${labelTextCls}`}
                  >
                    Enter 12-Digit UTR Number
                  </label>
                  <span
                    className={`text-[11.5px] font-mono-nums font-bold ${
                      utrInput.length === 12
                        ? isLight
                          ? 'text-emerald-600'
                          : 'text-emerald-400'
                        : mutedTextCls
                    }`}
                  >
                    {utrInput.length}/12 digits
                  </span>
                </div>
                <input
                  id="utr-input-app"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={12}
                  placeholder="12-digit UTR (e.g. 412345678901)"
                  value={utrInput}
                  onChange={(e) => handleUtrChange(e.target.value)}
                  className={`w-full h-12 px-4 rounded-[14px] border-[1.5px] font-mono-nums text-base font-semibold tracking-wider ${
                    isLight
                      ? 'bg-white border-purple-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-purple-600'
                      : 'bg-white/[0.04] border-white/15 text-white placeholder:text-slate-500 focus:outline-none focus:border-[#8b5cf6]'
                  }`}
                />
                <p className={`text-[11px] ${mutedTextCls}`}>
                  Strictly 12 digits only. Copy the 12-digit UTR from your payment receipt.
                </p>
              </div>

              {error && (
                <p
                  role="alert"
                  className={`text-xs rounded-xl px-3 py-2 border ${
                    isLight
                      ? 'text-rose-700 bg-rose-50 border-rose-200'
                      : 'text-rose-400 bg-rose-500/10 border-rose-500/25'
                  }`}
                >
                  {error}
                </p>
              )}

              <button
                type="button"
                onClick={handleSubmitUtr}
                className="preserve-white btn-press w-full h-[52px] rounded-2xl text-white font-bold text-[15px] shadow-[0_8px_24px_rgba(109,40,217,0.45)]"
                style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 55%, #5b21b6 100%)' }}
              >
                I’ve Paid – Submit UTR
              </button>

              {renderTrustSection()}
            </div>
          )}

          {/* SCREEN 4: PAYMENT STATUS / RECEIPT */}
          {topUpStep === 'success' && submittedReceipt && (
            <div className="space-y-4">
              <div className="text-center py-2">
                <div
                  className={`w-16 h-16 mx-auto mb-3 rounded-full border flex items-center justify-center ${
                    isLight
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                      : 'bg-emerald-500/15 border-emerald-500/35 text-emerald-400'
                  }`}
                >
                  <Check className="w-8 h-8" />
                </div>
                <h3 className={`text-xl font-extrabold ${headingTextCls}`}>Deposit Submitted</h3>
                <p className={`text-xs sm:text-sm mt-1 ${mutedTextCls}`}>
                  Your 12-digit UTR is Under Review. Balance credits once the Owner verifies your payment.
                </p>
              </div>

              <div
                className={`rounded-2xl p-4 border divide-y text-sm ${
                  isLight
                    ? 'bg-[#f8f6ff] border-purple-200 divide-purple-200/70'
                    : 'bg-[#181826] border-white/10 divide-white/[0.06]'
                }`}
              >
                <div className="py-2.5 flex items-center justify-between">
                  <span className={mutedTextCls}>Amount</span>
                  <span className={`font-mono-nums font-extrabold ${headingTextCls}`}>
                    ₹{submittedReceipt.amount.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="py-2.5 flex items-center justify-between">
                  <span className={mutedTextCls}>Method</span>
                  <span className={`font-semibold ${headingTextCls}`}>{submittedReceipt.methodName}</span>
                </div>
                <div className="py-2.5 flex items-center justify-between">
                  <span className={mutedTextCls}>Gateway VPA</span>
                  <span className={`font-mono-nums text-xs font-semibold ${headingTextCls}`}>
                    {submittedReceipt.receiverUpiId}
                  </span>
                </div>
                <div className="py-2.5 flex items-center justify-between">
                  <span className={mutedTextCls}>UTR</span>
                  <span className={`font-mono-nums font-semibold ${isLight ? 'text-purple-700' : 'text-[#c4b5fd]'}`}>
                    {submittedReceipt.utr}
                  </span>
                </div>
                <div className="py-2.5 flex items-center justify-between">
                  <span className={mutedTextCls}>Status</span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full border text-xs font-bold ${
                      isLight
                        ? 'bg-amber-100 border-amber-300 text-amber-800'
                        : 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                    }`}
                  >
                    Under Review
                  </span>
                </div>
                <div className="py-2.5 flex items-center justify-between">
                  <span className={mutedTextCls}>Date &amp; Time</span>
                  <span className={`font-mono-nums ${headingTextCls}`}>{submittedReceipt.time}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCompleteTopUpAndClose}
                className="preserve-white btn-press w-full py-4 rounded-[14px] text-white font-bold text-sm inline-flex items-center justify-center shadow-[0_8px_22px_rgba(124,58,237,0.45)]"
                style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)' }}
              >
                Back to Wallet
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ===== WITHDRAW, BIND BANK / UPI, SELL USDT, SUPPORT =====
  const titles: Record<Exclude<WalletModalMode, null | 'topup'>, string> = {
    withdraw: 'Withdraw Funds',
    bind_bank: boundConfirmation ? 'Account Bound' : 'Bind Bank & UPI',
    sell_usdt: 'Sell USDT to INR',
    support: 'Help & Support Desk',
  };

  const maxWithdrawableAllowed = Math.min(
    effectiveMaxWithdraw,
    Math.floor(Math.min(balance, Math.max(0, withdrawableBalance)))
  );
  const lockedDepositAmount = Math.max(0, Math.round((balance - Math.min(balance, withdrawableBalance)) * 100) / 100);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/75 backdrop-blur-sm p-0 md:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wallet-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={handleLegacySubmit}
        className={`w-full max-w-md border rounded-t-3xl md:rounded-2xl p-5 pb-7 max-h-[90dvh] overflow-y-auto ${modalShellCls}`}
      >
        <div
          className={`w-10 h-1 rounded-full mx-auto mb-4 md:hidden ${
            isLight ? 'bg-purple-200' : 'bg-white/20'
          }`}
        />
        <div className="flex items-center justify-between mb-4">
          <h2 id="wallet-modal-title" className={`text-lg font-bold ${headingTextCls}`}>
            {titles[mode]}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close wallet dialog"
            className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl transition-colors ${
              isLight
                ? 'text-slate-600 hover:text-purple-900 hover:bg-purple-50'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* WITHDRAW: BANK OR UPI RAIL (WINNINGS ONLY + DYNAMIC MIN - MAX) */}
        {mode === 'withdraw' && (
          <div className="space-y-4">
            <div
              className="hero-preserve-dark relative overflow-hidden rounded-xl border border-[#8b5cf6]/35 p-3.5 space-y-2 shadow-[0_12px_28px_rgba(30,8,59,0.4)]"
              style={{
                background:
                  'linear-gradient(150deg, #1e083b 0%, #3b0764 52%, #5b21b6 100%)',
              }}
            >
              <div aria-hidden="true" className="profile-light-sweep opacity-75" />
              <div aria-hidden="true" className="animate-wallet-sheen" />
              <div className="relative z-10 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-purple-200/85">Withdrawable Winnings</span>
                  <span className="font-mono-nums text-emerald-300 font-extrabold text-sm">
                    {formatCurrency(Math.min(balance, withdrawableBalance), currency, fxRates)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-[11px] text-purple-200/80">
                  <span className="inline-flex items-center gap-1">
                    <Lock className="w-3 h-3 text-amber-300" />
                    Locked Deposit (Play to win &amp; unlock)
                  </span>
                  <span className="font-mono-nums text-white font-semibold">
                    {formatCurrency(lockedDepositAmount, currency, fxRates)}
                  </span>
                </div>
              </div>
            </div>

            {platformSettings?.withdrawalsPaused && (
              <div className="rounded-xl px-3.5 py-2.5 bg-amber-500/15 border border-amber-500/35 text-xs font-semibold text-amber-500 flex items-center gap-2">
                <Lock className="w-4 h-4 shrink-0" />
                <span>
                  {platformSettings.maintenanceNotice.trim() ||
                    'Withdrawals are temporarily paused by Owner Desk.'}
                </span>
              </div>
            )}

            {/* Bank vs UPI Rail Selector */}
            <div
              role="tablist"
              aria-label="Withdrawal destination type"
              className={`grid grid-cols-2 gap-2 p-1 rounded-xl border ${surfaceBoxCls}`}
            >
              <button
                type="button"
                role="tab"
                aria-selected={withdrawRail === 'bank'}
                onClick={() => {
                  setWithdrawRail('bank');
                  setError('');
                }}
                className={`btn-press py-2.5 rounded-lg text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-all ${
                  withdrawRail === 'bank'
                    ? 'preserve-white bg-[#7c3aed] text-white shadow-sm'
                    : isLight
                    ? 'text-slate-600 hover:text-slate-900'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                Bank Account
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={withdrawRail === 'upi'}
                onClick={() => {
                  setWithdrawRail('upi');
                  setError('');
                }}
                className={`btn-press py-2.5 rounded-lg text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-all ${
                  withdrawRail === 'upi'
                    ? 'preserve-white bg-[#7c3aed] text-white shadow-sm'
                    : isLight
                    ? 'text-slate-600 hover:text-slate-900'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                UPI Instant
              </button>
            </div>

            {withdrawRail === 'bank' ? (
              <div>
                <label htmlFor="withdraw-bank" className={`block text-xs mb-1.5 ${labelTextCls}`}>
                  Destination Bank Account
                </label>
                {bankAccounts.length > 0 ? (
                  <select
                    id="withdraw-bank"
                    value={selectedBankId || bankAccounts[0]?.id || ''}
                    onChange={(e) => setSelectedBankId(e.target.value)}
                    className={`w-full h-11 px-3 rounded-xl border text-sm ${inputFieldCls}`}
                  >
                    {bankAccounts.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.bankName} (••••{b.accountLast4})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div
                    className={`p-3 rounded-xl border text-xs ${
                      isLight
                        ? 'bg-amber-50 border-amber-300 text-amber-800'
                        : 'bg-[#181826] border-amber-500/30 text-amber-300'
                    }`}
                  >
                    No bank account bound yet. Switch to UPI Instant or bind a bank account first.
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2.5">
                {upiAccounts.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label htmlFor="withdraw-upi-select" className={`text-xs ${labelTextCls}`}>
                        Select Bound UPI ID
                      </label>
                      <button
                        type="button"
                        onClick={() => setUseCustomWithdrawUpi((v) => !v)}
                        className={`text-[11px] font-bold hover:underline ${
                          isLight ? 'text-purple-700' : 'text-[#a78bfa]'
                        }`}
                      >
                        {useCustomWithdrawUpi ? 'Use saved UPI' : 'Enter another UPI'}
                      </button>
                    </div>
                    {!useCustomWithdrawUpi && (
                      <select
                        id="withdraw-upi-select"
                        value={selectedUpiId || upiAccounts[0]?.id || ''}
                        onChange={(e) => setSelectedUpiId(e.target.value)}
                        className={`w-full h-11 px-3 rounded-xl border text-sm ${inputFieldCls}`}
                      >
                        {upiAccounts.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.appName} · {u.upiId}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}

                {useCustomWithdrawUpi && (
                  <div>
                    <label htmlFor="withdraw-upi-custom" className={`block text-xs mb-1.5 ${labelTextCls}`}>
                      Recipient UPI ID
                    </label>
                    <input
                      id="withdraw-upi-custom"
                      type="text"
                      placeholder="e.g. aarav@okicici or 98xxxxxx@ybl"
                      value={customWithdrawUpi}
                      onChange={(e) => setCustomWithdrawUpi(e.target.value)}
                      className={`w-full h-11 px-3.5 rounded-xl border text-sm font-mono-nums ${inputFieldCls}`}
                    />
                  </div>
                )}
              </div>
            )}

            <div>
              <label htmlFor="withdraw-amount" className={`block text-xs mb-1.5 ${labelTextCls}`}>
                Withdrawal Amount (INR · Min ₹{effectiveMinWithdraw.toLocaleString('en-IN')} – Max ₹{effectiveMaxWithdraw.toLocaleString('en-IN')})
              </label>
              <input
                id="withdraw-amount"
                type="number"
                min={effectiveMinWithdraw}
                max={effectiveMaxWithdraw}
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                className={`w-full h-12 px-4 rounded-xl border font-mono-nums text-base font-semibold ${inputFieldCls}`}
              />
              <div className="grid grid-cols-4 gap-2 mt-2">
                {[100, 500, 1000].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setWithdrawAmount(String(v))}
                    className={`btn-press min-h-[36px] rounded-lg border text-xs font-semibold font-mono-nums ${
                      isLight
                        ? 'bg-[#f8f6ff] border-purple-200 text-slate-700 hover:border-purple-400'
                        : 'bg-[#181826] border-white/10 text-slate-200'
                    }`}
                  >
                    ₹{v}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setWithdrawAmount(String(maxWithdrawableAllowed))}
                  className={`btn-press min-h-[36px] rounded-lg border text-xs font-bold ${
                    isLight
                      ? 'bg-purple-100 border-purple-300 text-purple-800'
                      : 'bg-[#7c3aed]/20 border-[#7c3aed]/40 text-[#c4b5fd]'
                  }`}
                >
                  Max
                </button>
              </div>
            </div>
          </div>
        )}

        {/* BIND BANK OR BIND UPI + BOUND CONFIRMATION + ADD EXTRA LOOP */}
        {mode === 'bind_bank' && boundConfirmation && (
          <div className="space-y-4">
            <div className="text-center py-2">
              <div
                className={`w-14 h-14 mx-auto mb-3 rounded-full border flex items-center justify-center ${
                  isLight
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                    : 'bg-emerald-500/15 border-emerald-500/35 text-emerald-400'
                }`}
              >
                <Check className="w-7 h-7" />
              </div>
              <h3 className={`text-lg font-extrabold ${headingTextCls}`}>
                {boundConfirmation.kind === 'bank' ? 'Bank Account Bound' : 'UPI ID Bound'}
              </h3>
              <p className={`text-xs mt-1 ${mutedTextCls}`}>
                Verified &amp; active for instant withdrawals ({bankAccounts.length} banks · {upiAccounts.length} UPIs saved)
              </p>
            </div>

            <div className={`rounded-2xl p-4 border flex items-center justify-between gap-3 ${surfaceBoxCls}`}>
              <div className="flex items-center gap-3 min-w-0">
                {boundConfirmation.kind === 'upi' && boundConfirmation.appId ? (
                  <UpiAppLogo methodId={boundConfirmation.appId} size="sm" />
                ) : (
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      isLight ? 'bg-purple-100 text-purple-700' : 'bg-[#7c3aed]/20 text-[#a78bfa]'
                    }`}
                  >
                    <Building2 className="w-4 h-4" />
                  </div>
                )}
                <div className="min-w-0">
                  <div className={`text-sm font-bold truncate ${headingTextCls}`}>
                    {boundConfirmation.title}
                  </div>
                  <div className={`text-xs truncate ${mutedTextCls}`}>
                    {boundConfirmation.subtitle} · {boundConfirmation.holder}
                  </div>
                </div>
              </div>
              <span
                className={`px-2.5 py-1 rounded-full border text-[11px] font-bold shrink-0 ${
                  isLight
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                }`}
              >
                Bound Confirmed
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  setBoundConfirmation(null);
                  setBankName('');
                  setAccountNumber('');
                  setIfsc('');
                  setBindUpiHandle('');
                  setError('');
                }}
                className={`btn-press min-h-[46px] rounded-xl border text-xs font-bold inline-flex items-center justify-center gap-1.5 ${
                  isLight
                    ? 'bg-purple-50 hover:bg-purple-100 border-purple-300 text-purple-800'
                    : 'bg-[#181826] hover:bg-[#222236] border-[#8b5cf6]/45 text-[#c4b5fd]'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                Add Extra Bank / UPI
              </button>
              <button
                type="button"
                onClick={onClose}
                className="preserve-white btn-press min-h-[46px] rounded-xl bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-xs font-bold inline-flex items-center justify-center"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {mode === 'bind_bank' && !boundConfirmation && (
          <div className="space-y-3.5">
            <div className={`flex items-center justify-between text-[11px] px-1 ${mutedTextCls}`}>
              <span>Linked Accounts</span>
              <span className={`font-mono-nums font-bold ${isLight ? 'text-purple-700' : 'text-[#a78bfa]'}`}>
                {bankAccounts.length} Bank · {upiAccounts.length} UPI
              </span>
            </div>

            <div
              role="tablist"
              aria-label="Account binding type"
              className={`grid grid-cols-2 gap-2 p-1 rounded-xl border ${surfaceBoxCls}`}
            >
              <button
                type="button"
                role="tab"
                aria-selected={bindTab === 'bank'}
                onClick={() => {
                  setBindTab('bank');
                  setError('');
                }}
                className={`btn-press py-2.5 rounded-lg text-xs font-bold inline-flex items-center justify-center gap-1.5 ${
                  bindTab === 'bank'
                    ? 'preserve-white bg-[#7c3aed] text-white'
                    : isLight
                    ? 'text-slate-600 hover:text-slate-900'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                Bind Bank
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={bindTab === 'upi'}
                onClick={() => {
                  setBindTab('upi');
                  setError('');
                }}
                className={`btn-press py-2.5 rounded-lg text-xs font-bold inline-flex items-center justify-center gap-1.5 ${
                  bindTab === 'upi'
                    ? 'preserve-white bg-[#7c3aed] text-white'
                    : isLight
                    ? 'text-slate-600 hover:text-slate-900'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                Bind UPI
              </button>
            </div>

            {bindTab === 'bank' ? (
              <div className="space-y-3">
                <div>
                  <label htmlFor="bank-name" className={`block text-xs mb-1 ${labelTextCls}`}>
                    Bank Name
                  </label>
                  <input
                    id="bank-name"
                    type="text"
                    placeholder="e.g. ICICI Bank, SBI"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className={`w-full h-11 px-3.5 rounded-xl border text-sm ${inputFieldCls}`}
                  />
                </div>
                <div>
                  <label htmlFor="bank-holder" className={`block text-xs mb-1 ${labelTextCls}`}>
                    Account Holder Name
                  </label>
                  <input
                    id="bank-holder"
                    type="text"
                    placeholder="Aarav Sharma"
                    value={holderName}
                    onChange={(e) => setHolderName(e.target.value)}
                    className={`w-full h-11 px-3.5 rounded-xl border text-sm ${inputFieldCls}`}
                  />
                </div>
                <div>
                  <label htmlFor="bank-acct" className={`block text-xs mb-1 ${labelTextCls}`}>
                    Account Number
                  </label>
                  <input
                    id="bank-acct"
                    type="text"
                    placeholder="123456789012"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    className={`w-full h-11 px-3.5 rounded-xl border text-sm font-mono-nums ${inputFieldCls}`}
                  />
                </div>
                <div>
                  <label htmlFor="bank-ifsc" className={`block text-xs mb-1 ${labelTextCls}`}>
                    IFSC Code
                  </label>
                  <input
                    id="bank-ifsc"
                    type="text"
                    placeholder="ICIC0000042"
                    value={ifsc}
                    onChange={(e) => setIfsc(e.target.value)}
                    className={`w-full h-11 px-3.5 rounded-xl border text-sm font-mono-nums uppercase ${inputFieldCls}`}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <div className={`text-xs mb-1.5 ${labelTextCls}`}>Choose UPI App</div>
                  <div className="grid grid-cols-3 gap-2 max-h-[168px] overflow-y-auto pr-0.5">
                    {UPI_BIND_APPS.map((app) => {
                      const active = bindUpiAppId === app.id;
                      return (
                        <button
                          key={app.id}
                          type="button"
                          onClick={() => setBindUpiAppId(app.id)}
                          className={`btn-press p-2 rounded-xl border flex flex-col items-center gap-1.5 text-center transition-all ${
                            active
                              ? isLight
                                ? 'border-purple-600 bg-purple-50'
                                : 'border-[#8b5cf6] bg-[#7c3aed]/20'
                              : isLight
                              ? 'border-purple-200 bg-[#f8f6ff] hover:border-purple-400'
                              : 'border-white/10 bg-[#181826] hover:border-[#8b5cf6]/50'
                          }`}
                        >
                          <UpiAppLogo methodId={app.id} size="xs" />
                          <span className={`text-[10.5px] font-semibold truncate w-full ${headingTextCls}`}>
                            {app.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label htmlFor="upi-id-input" className={`block text-xs mb-1 ${labelTextCls}`}>
                    UPI ID / VPA
                  </label>
                  <input
                    id="upi-id-input"
                    type="text"
                    placeholder="e.g. aarav@ybl or name@okicici"
                    value={bindUpiHandle}
                    onChange={(e) => setBindUpiHandle(e.target.value)}
                    className={`w-full h-11 px-3.5 rounded-xl border text-sm font-mono-nums ${inputFieldCls}`}
                  />
                </div>

                <div>
                  <label htmlFor="upi-holder-name" className={`block text-xs mb-1 ${labelTextCls}`}>
                    Verified Account Holder
                  </label>
                  <input
                    id="upi-holder-name"
                    type="text"
                    placeholder="Aarav Sharma"
                    value={holderName}
                    onChange={(e) => setHolderName(e.target.value)}
                    className={`w-full h-11 px-3.5 rounded-xl border text-sm ${inputFieldCls}`}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {mode === 'sell_usdt' && (
          <div className="space-y-4">
            <div className={`border rounded-xl p-3.5 text-xs flex justify-between ${surfaceBoxCls}`}>
              <span className={mutedTextCls}>Available USDT</span>
              <span className={`font-mono-nums font-bold ${headingTextCls}`}>{usdtHoldings.toFixed(2)} USDT</span>
            </div>
            <div>
              <label htmlFor="sell-usdt-input" className={`block text-xs mb-1.5 ${labelTextCls}`}>
                USDT Quantity to Sell (Rate ₹{usdtRateInr.toFixed(2)}/USDT)
              </label>
              <input
                id="sell-usdt-input"
                type="number"
                step="0.5"
                min="1"
                value={usdtInput}
                onChange={(e) => setUsdtInput(e.target.value)}
                className={`w-full h-12 px-4 rounded-xl border font-mono-nums text-base font-semibold ${inputFieldCls}`}
              />
            </div>
            <div className={`flex justify-between text-sm font-semibold ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
              <span>Instant Credit</span>
              <span className="font-mono-nums">
                {formatCurrency((Number(usdtInput) || 0) * usdtRateInr, currency, fxRates)}
              </span>
            </div>
          </div>
        )}

        {/* UPGRADED HELPLINE: UID + TX TIME + OPTIONAL WHATSAPP + SCREENSHOT */}
        {mode === 'support' && (
          <div className="space-y-3">
            <div className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-xs ${surfaceBoxCls}`}>
              <span className={mutedTextCls}>Your Trader UID</span>
              <span className={`font-mono-nums font-bold ${isLight ? 'text-purple-700' : 'text-[#c4b5fd]'}`}>{userUid}</span>
            </div>

            {platformSettings?.supportNotice && (
              <div
                className={`px-3 py-2 rounded-xl border text-[11px] font-medium ${
                  isLight
                    ? 'bg-purple-50 border-purple-200 text-purple-900'
                    : 'bg-[#7c3aed]/10 border-[#7c3aed]/30 text-purple-200'
                }`}
              >
                {platformSettings.supportNotice}
              </div>
            )}

            <div>
              <label htmlFor="support-topic" className={`block text-xs mb-1 ${labelTextCls}`}>
                Problem Category
              </label>
              <select
                id="support-topic"
                value={supportSubject}
                onChange={(e) => setSupportSubject(e.target.value)}
                className={`w-full h-11 px-3 rounded-xl border text-sm ${inputFieldCls}`}
              >
                <option value="Deposit Issue / Under Review">Deposit Issue / Under Review</option>
                <option value="Withdrawal Status / Delay">Withdrawal Status / Delay</option>
                <option value="Bank & UPI Binding Verification">Bank &amp; UPI Binding Verification</option>
                <option value="Trade Timer / Settlement">Trade Timer / Settlement</option>
                <option value="Other Support">Other Support</option>
              </select>
            </div>

            {paymentTransactions.length > 0 && (
              <div>
                <label htmlFor="support-tx-select" className={`block text-xs mb-1 ${labelTextCls}`}>
                  Link Deposit / Withdrawal Entry
                </label>
                <select
                  id="support-tx-select"
                  value={supportTxId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSupportTxId(id);
                    const found = paymentTransactions.find((tx) => tx.id === id);
                    if (found) {
                      setSupportDateTime(found.timestamp);
                    }
                  }}
                  className={`w-full h-11 px-3 rounded-xl border text-xs font-mono-nums ${inputFieldCls}`}
                >
                  <option value="">-- Enter payment time manually --</option>
                  {paymentTransactions.slice(0, 10).map((tx) => (
                    <option key={tx.id} value={tx.id}>
                      {tx.type === 'deposit' ? 'DEP' : 'WD'} ₹{Math.abs(tx.amount).toLocaleString('en-IN')} · {tx.status} · {tx.timestamp}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label htmlFor="support-datetime" className={`block text-xs mb-1 ${labelTextCls}`}>
                  Payment / Withdrawal Time
                </label>
                <input
                  id="support-datetime"
                  type="text"
                  placeholder="e.g. 21 Nov, 03:45 PM"
                  value={supportDateTime}
                  onChange={(e) => setSupportDateTime(e.target.value)}
                  className={`w-full h-10 px-3 rounded-xl border text-xs font-mono-nums ${inputFieldCls}`}
                />
              </div>
              <div>
                <label htmlFor="support-whatsapp" className={`block text-xs mb-1 ${labelTextCls}`}>
                  WhatsApp <span className="text-[10px] opacity-75">(optional)</span>
                </label>
                <input
                  id="support-whatsapp"
                  type="tel"
                  inputMode="tel"
                  placeholder="+91 98xxxxxx"
                  value={supportWhatsapp}
                  onChange={(e) => setSupportWhatsapp(e.target.value)}
                  className={`w-full h-10 px-3 rounded-xl border text-xs font-mono-nums ${inputFieldCls}`}
                />
              </div>
            </div>

            <div>
              <label htmlFor="support-msg" className={`block text-xs mb-1 ${labelTextCls}`}>
                Describe Your Problem
              </label>
              <textarea
                id="support-msg"
                rows={3}
                placeholder="Explain your deposit, withdrawal, UTR, or trade issue..."
                value={supportMessage}
                onChange={(e) => setSupportMessage(e.target.value)}
                className={`w-full p-3 rounded-xl border text-sm resize-none ${inputFieldCls}`}
              />
            </div>

            {/* Screenshot Upload */}
            <div>
              <div className={`text-xs mb-1.5 ${labelTextCls}`}>
                Attach Payment Screenshot <span className="text-[10px] opacity-75">(optional)</span>
              </div>
              {supportScreenshot ? (
                <div className={`flex items-center justify-between gap-3 p-2 rounded-xl border ${surfaceBoxCls}`}>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={supportScreenshot}
                      alt="Uploaded payment proof"
                      className="w-12 h-12 rounded-lg object-cover border border-purple-300/40 shrink-0"
                    />
                    <span className={`text-xs font-semibold truncate ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
                      Screenshot attached
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSupportScreenshot(undefined)}
                    aria-label="Remove screenshot"
                    className="p-2 rounded-lg text-rose-500 hover:bg-rose-500/15"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label
                  className={`btn-press flex items-center justify-center gap-2 h-11 px-3 rounded-xl border border-dashed text-xs font-semibold cursor-pointer ${
                    isLight
                      ? 'bg-[#f8f6ff] hover:bg-purple-50 border-purple-300 text-slate-700'
                      : 'bg-[#181826] hover:bg-[#222236] border-white/20 text-slate-300'
                  }`}
                >
                  <ImagePlus className={`w-4 h-4 ${isLight ? 'text-purple-700' : 'text-[#a78bfa]'}`} />
                  <span>Upload Screenshot Image</span>
                  <input
                    id="support-screenshot-input"
                    type="file"
                    accept="image/*"
                    onChange={handleScreenshotUpload}
                    className="sr-only"
                  />
                </label>
              )}
            </div>
          </div>
        )}

        {error && (
          <p
            role="alert"
            className={`mt-3 text-xs rounded-lg px-3 py-2 border ${
              isLight
                ? 'text-rose-700 bg-rose-50 border-rose-200'
                : 'text-rose-400 bg-rose-500/10 border-rose-500/20'
            }`}
          >
            {error}
          </p>
        )}

        {!(mode === 'bind_bank' && boundConfirmation) && (
          <button
            type="submit"
            className="preserve-white btn-press mt-5 w-full min-h-[48px] rounded-xl bg-[#7c5cfc] hover:bg-[#6a48f5] text-white font-bold text-sm transition-colors"
          >
            {mode === 'withdraw'
              ? 'Submit Withdrawal'
              : mode === 'bind_bank'
              ? bindTab === 'bank'
                ? 'Save Bank Account'
                : 'Save UPI ID'
              : mode === 'sell_usdt'
              ? 'Convert USDT to INR'
              : 'Submit Support Ticket'}
          </button>
        )}
      </form>
    </div>
  );
};
