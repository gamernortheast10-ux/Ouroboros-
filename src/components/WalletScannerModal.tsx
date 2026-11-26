import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import {
  ArrowUpRight,
  Camera,
  CameraOff,
  Check,
  CheckCircle2,
  Copy,
  Download,
  ImagePlus,
  QrCode,
  ScanLine,
  Send,
  Share2,
  UserCheck,
  X,
} from 'lucide-react';
import {
  AppState,
  BaseCurrency,
  FxRatesMap,
  ThemeMode,
} from '../types/trading';
import {
  MAX_P2P_WALLET_TRANSFER_INR,
  MIN_P2P_WALLET_TRANSFER_INR,
  WalletRecipientLookupResult,
  buildWalletQrPayload,
  findWalletRecipientByUid,
  formatCurrency,
  parseWalletQrOrProfileInput,
} from '../utils/tradingEngine';
import { getAssetUrl } from '../utils/assetPath';

export type WalletScannerTab = 'scan' | 'receive';

interface WalletScannerModalProps {
  open: boolean;
  initialTab?: WalletScannerTab;
  state: AppState;
  currency?: BaseCurrency;
  fxRates?: FxRatesMap;
  themeMode?: ThemeMode;
  onClose: () => void;
  onTransfer: (params: {
    recipientUid: string;
    amountInr: number;
    note?: string;
    via: 'qr' | 'id';
  }) => {
    ok: boolean;
    error?: string;
    recipient?: WalletRecipientLookupResult;
    amountInr?: number;
    txId?: string;
  };
}

const QUICK_TRANSFER_AMOUNTS = [50, 100, 500, 1000];

export const WalletScannerModal: React.FC<WalletScannerModalProps> = ({
  open,
  initialTab = 'scan',
  state,
  currency = 'INR',
  fxRates,
  themeMode = 'dark',
  onClose,
  onTransfer,
}) => {
  const isLight = themeMode === 'light';
  const [activeTab, setActiveTab] = useState<WalletScannerTab>(initialTab);

  // Scan & Send state
  const [rawInput, setRawInput] = useState('');
  const [transferVia, setTransferVia] = useState<'qr' | 'id'>('id');
  const [amountInput, setAmountInput] = useState('100');
  const [noteInput, setNoteInput] = useState('');
  const [scanError, setScanError] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStatus, setCameraStatus] = useState<string>('');
  const [receipt, setReceipt] = useState<{
    txId: string;
    recipientName: string;
    recipientUid: string;
    amountInr: number;
    via: 'qr' | 'id';
  } | null>(null);

  // Receive QR state
  const [requestAmountInput, setRequestAmountInput] = useState('');
  const [myQrDataUrl, setMyQrDataUrl] = useState('');
  const [copiedUid, setCopiedUid] = useState(false);
  const [receiveNotice, setReceiveNotice] = useState('');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const stopCamera = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  useEffect(() => {
    if (!open) {
      stopCamera();
      return;
    }
    setActiveTab(initialTab);
    setScanError('');
    setCameraStatus('');
    setReceipt(null);
    setCopiedUid(false);
    setReceiveNotice('');
  }, [open, initialTab, stopCamera]);

  useEffect(() => {
    if (activeTab !== 'scan') {
      stopCamera();
    }
  }, [activeTab, stopCamera]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const myUid = (state.profile.uid || 'UID-0000-NEW').trim().toUpperCase();
  const myName = (state.profile.name || 'Trader').trim();

  const parsedRequestAmount = useMemo(() => {
    const n = Number(requestAmountInput);
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : undefined;
  }, [requestAmountInput]);

  const myWalletQrPayload = useMemo(
    () =>
      buildWalletQrPayload({
        uid: myUid,
        name: myName,
        amountInr: parsedRequestAmount,
      }),
    [myUid, myName, parsedRequestAmount]
  );

  // Generate personal receive QR code whenever modal opens on Receive tab or payload updates
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    QRCode.toDataURL(myWalletQrPayload, {
      width: 240,
      margin: 1,
      color: { dark: '#141124', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    })
      .then((url) => {
        if (!cancelled) setMyQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setMyQrDataUrl('');
      });
    return () => {
      cancelled = true;
    };
  }, [open, myWalletQrPayload]);

  const applyScannedString = useCallback((decodedText: string) => {
    const parsed = parseWalletQrOrProfileInput(decodedText);
    if (!parsed.ok) {
      setScanError(parsed.error);
      return false;
    }
    setRawInput(parsed.uid);
    setTransferVia('qr');
    if (parsed.amountInr && parsed.amountInr >= MIN_P2P_WALLET_TRANSFER_INR) {
      setAmountInput(String(parsed.amountInr));
    }
    setScanError('');
    setCameraStatus(`Scanned ${parsed.nameHint ? `${parsed.nameHint} · ` : ''}${parsed.uid}`);
    return true;
  }, []);

  const startCameraScan = async () => {
    setScanError('');
    setCameraStatus('Starting camera…');
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      setCameraStatus('Camera unavailable on this browser. Upload a QR image or enter Profile ID below.');
      return;
    }

    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraActive(true);
      setCameraStatus('Point camera at an Ouroboros Wallet QR code');

      const tick = () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || !streamRef.current) return;
        if (video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth > 0) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imgData.data, imgData.width, imgData.height, {
              inversionAttempts: 'dontInvert',
            });
            if (code && code.data) {
              const accepted = applyScannedString(code.data);
              if (accepted) {
                stopCamera();
                return;
              }
            }
          }
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      stopCamera();
      setCameraStatus('Camera permission denied or unavailable. Upload a QR image or enter Profile ID below.');
    }
  };

  useEffect(() => {
    if (cameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      void videoRef.current.play().catch(() => {});
    }
  }, [cameraActive]);

  const handleQrImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setScanError('');

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        setScanError('Could not read selected image.');
        return;
      }
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setScanError('Could not initialize image decoder.');
          return;
        }
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const decoded = jsQR(imgData.data, imgData.width, imgData.height, {
          inversionAttempts: 'attemptBoth',
        });
        if (!decoded || !decoded.data) {
          setScanError('No valid QR code found in this image. Try a clearer QR or enter Profile ID.');
          return;
        }
        applyScannedString(decoded.data);
      };
      img.onerror = () => {
        setScanError('Unsupported image file.');
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  const recipientResolution = useMemo(() => {
    const trimmed = rawInput.trim();
    if (!trimmed) return null;
    const parsed = parseWalletQrOrProfileInput(trimmed);
    if (!parsed.ok) {
      return { ok: false as const, error: parsed.error };
    }
    return findWalletRecipientByUid(state, parsed.uid);
  }, [rawInput, state]);

  const quickPeerAccounts = useMemo(() => {
    const selfEmail = state.profile.email.trim().toLowerCase();
    const selfUid = myUid;
    return (state.registeredAccounts ?? [])
      .filter(
        (acc) =>
          !acc.banned &&
          !acc.frozen &&
          acc.email.trim().toLowerCase() !== selfEmail &&
          acc.uid.trim().toUpperCase() !== selfUid
      )
      .slice(0, 4);
  }, [state.registeredAccounts, state.profile.email, myUid]);

  if (!open) return null;

  const parsedSendAmount = Math.round((Number(amountInput) || 0) * 100) / 100;

  const handleSendSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setScanError('');
    const res = onTransfer({
      recipientUid: rawInput,
      amountInr: parsedSendAmount,
      note: noteInput,
      via: transferVia,
    });
    if (!res.ok) {
      setScanError(res.error ?? 'Could not send wallet transfer.');
      return;
    }
    if (res.recipient && res.amountInr && res.txId) {
      setReceipt({
        txId: res.txId,
        recipientName: res.recipient.name,
        recipientUid: res.recipient.uid,
        amountInr: res.amountInr,
        via: transferVia,
      });
    }
  };

  const handleCopyMyUid = async () => {
    try {
      await navigator.clipboard?.writeText(myUid);
    } catch {
      // Ignore clipboard restrictions
    }
    setCopiedUid(true);
    setReceiveNotice(`Profile ID copied: ${myUid}`);
    window.setTimeout(() => setCopiedUid(false), 1800);
  };

  const handleDownloadMyQr = () => {
    if (!myQrDataUrl) return;
    const link = document.createElement('a');
    link.href = myQrDataUrl;
    link.download = `ouroboros-wallet-${myUid.toLowerCase()}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setReceiveNotice('Wallet QR saved');
  };

  const handleShareMyQr = async () => {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: 'Pay My Ouroboros Wallet',
          text: `Send money to ${myName} on Ouroboros using Profile ID: ${myUid}`,
          url: myWalletQrPayload,
        });
        return;
      } catch {
        // Fallback to copy
      }
    }
    try {
      await navigator.clipboard?.writeText(myUid);
    } catch {
      // Ignore
    }
    setReceiveNotice(`Copied Profile ID (${myUid}) to share`);
  };

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/75 backdrop-blur-sm p-0 md:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wallet-scanner-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          stopCamera();
          onClose();
        }
      }}
    >
      <div
        className={`w-full max-w-[460px] rounded-t-3xl md:rounded-[28px] p-5 pb-7 max-h-[92dvh] overflow-y-auto flex flex-col border ${modalShellCls}`}
      >
        <div
          className={`w-10 h-1 rounded-full mx-auto mb-3 md:hidden ${
            isLight ? 'bg-purple-200' : 'bg-white/20'
          }`}
        />

        {/* Header */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="preserve-white w-9 h-9 rounded-xl bg-gradient-to-br from-[#8b5cf6] to-[#6d28d9] text-white flex items-center justify-center shrink-0 shadow-[0_6px_14px_rgba(124,58,237,0.35)]">
              <QrCode className="w-4.5 h-4.5" />
            </span>
            <div className="min-w-0">
              <h2
                id="wallet-scanner-modal-title"
                className={`text-[17px] font-bold tracking-tight truncate ${headingTextCls}`}
              >
                Scan &amp; Pay Wallet
              </h2>
              <p className={`text-[11px] truncate ${mutedTextCls}`}>
                Send or receive via QR Code &amp; Profile ID
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            aria-label="Close scanner dialog"
            className={`w-10 h-10 rounded-full border flex items-center justify-center transition-colors shrink-0 ${
              isLight
                ? 'bg-purple-50 border-purple-200 text-slate-600 hover:text-purple-900 hover:border-purple-400'
                : 'bg-white/[0.06] border-white/10 text-slate-300 hover:text-white hover:border-[#8b5cf6]'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Segmented Tabs: Scan & Send | Receive QR & My ID */}
        <div
          role="tablist"
          aria-label="Wallet transfer modes"
          className={`grid grid-cols-2 gap-1.5 p-1 rounded-2xl border mb-4 ${surfaceBoxCls}`}
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'scan'}
            onClick={() => {
              setActiveTab('scan');
              setReceipt(null);
              setScanError('');
            }}
            className={`btn-press min-h-[40px] rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-all ${
              activeTab === 'scan'
                ? 'preserve-white bg-[#7c3aed] text-white shadow-md'
                : mutedTextCls
            }`}
          >
            <ScanLine className="w-3.5 h-3.5" />
            <span>Scan &amp; Send</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'receive'}
            onClick={() => {
              setActiveTab('receive');
              setScanError('');
            }}
            className={`btn-press min-h-[40px] rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-all ${
              activeTab === 'receive'
                ? 'preserve-white bg-[#7c3aed] text-white shadow-md'
                : mutedTextCls
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Receive QR &amp; ID</span>
          </button>
        </div>

        {/* TAB 1: SCAN & SEND */}
        {activeTab === 'scan' && (
          receipt ? (
            <div className="space-y-4">
              <div className={`rounded-2xl border p-5 text-center space-y-2.5 ${surfaceBoxCls}`}>
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/35 text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  Wallet Transfer Sent
                </div>
                <div className={`text-3xl font-extrabold font-mono-nums ${headingTextCls}`}>
                  ₹{receipt.amountInr.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className={`text-xs ${mutedTextCls}`}>
                  Sent via {receipt.via === 'qr' ? 'QR Scan' : 'Profile ID'} to{' '}
                  <span className={`font-bold ${headingTextCls}`}>{receipt.recipientName}</span>
                </div>
                <div className="text-[11px] font-mono-nums text-[#a78bfa]">
                  {receipt.recipientUid} · Ref {receipt.txId}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setReceipt(null);
                    setRawInput('');
                    setNoteInput('');
                    setCameraStatus('');
                  }}
                  className={`btn-press min-h-[44px] rounded-xl border text-xs font-bold whitespace-nowrap ${surfaceBoxCls}`}
                >
                  Send Another
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="preserve-white btn-press min-h-[44px] rounded-xl bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-xs font-bold whitespace-nowrap"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSendSubmit} className="space-y-4">
              {/* Scanner Viewfinder Box */}
              <div className={`rounded-2xl border p-3.5 space-y-3 ${surfaceBoxCls}`}>
                <div className="relative rounded-xl overflow-hidden bg-[#0a0914] border border-white/10 min-h-[168px] flex flex-col items-center justify-center">
                  {cameraActive ? (
                    <>
                      <video
                        ref={videoRef}
                        playsInline
                        muted
                        className="w-full h-[190px] object-cover"
                      />
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 flex items-center justify-center"
                      >
                        <div className="w-36 h-36 rounded-2xl border-2 border-[#a78bfa] shadow-[0_0_0_9999px_rgba(10,9,20,0.45)]" />
                      </div>
                    </>
                  ) : (
                    <div className="p-4 text-center space-y-2">
                      <div className="w-11 h-11 rounded-2xl bg-[#7c3aed]/20 border border-[#8b5cf6]/35 text-[#c4b5fd] flex items-center justify-center mx-auto">
                        <ScanLine className="w-5 h-5" />
                      </div>
                      <div className="text-xs font-semibold text-white">
                        Scan a Friend&rsquo;s Wallet QR Code
                      </div>
                      <p className="text-[11px] text-slate-400 max-w-[260px] mx-auto">
                        {cameraStatus || 'Use your live camera or upload a QR image to autofill their Profile ID.'}
                      </p>
                    </div>
                  )}
                  <canvas ref={canvasRef} className="hidden" />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {cameraActive ? (
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="btn-press min-h-[40px] px-3 rounded-xl bg-rose-500/15 border border-rose-500/35 text-rose-400 text-xs font-bold inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
                    >
                      <CameraOff className="w-3.5 h-3.5" />
                      <span>Stop Camera</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={startCameraScan}
                      className="preserve-white btn-press min-h-[40px] px-3 rounded-xl bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Scan Camera</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className={`btn-press min-h-[40px] px-3 rounded-xl border text-xs font-bold inline-flex items-center justify-center gap-1.5 whitespace-nowrap ${
                      isLight
                        ? 'bg-white border-purple-200 text-purple-900 hover:border-purple-400'
                        : 'bg-[#12121c] border-white/15 text-slate-200 hover:border-[#8b5cf6]'
                    }`}
                  >
                    <ImagePlus className="w-3.5 h-3.5" />
                    <span>Upload QR</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleQrImageUpload}
                    aria-label="Upload QR code image"
                    className="hidden"
                  />
                </div>
              </div>

              {/* Below Scanner: Direct Profile ID Entry */}
              <div>
                <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 mb-1.5">
                  <label
                    htmlFor="p2p-recipient-uid-input"
                    className={`text-[11px] font-bold uppercase tracking-wider whitespace-nowrap ${labelTextCls}`}
                  >
                    Recipient Profile ID
                  </label>
                  <span className={`text-[11px] font-mono-nums whitespace-nowrap shrink-0 ${mutedTextCls}`}>
                    My ID: {myUid}
                  </span>
                </div>
                <input
                  id="p2p-recipient-uid-input"
                  type="text"
                  value={rawInput}
                  onChange={(e) => {
                    setRawInput(e.target.value);
                    setTransferVia('id');
                    setScanError('');
                  }}
                  placeholder="Enter Profile ID (e.g. UID-8412-VIKRA)"
                  className={`w-full h-11 px-3.5 rounded-xl border font-mono-nums text-sm font-semibold ${inputFieldCls}`}
                />

                {/* Quick Pick Other Accounts Registered on Platform */}
                {quickPeerAccounts.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap mt-2">
                    <span className={`text-[10.5px] font-semibold ${mutedTextCls}`}>
                      Recent users:
                    </span>
                    {quickPeerAccounts.map((acc) => (
                      <button
                        key={acc.uid}
                        type="button"
                        onClick={() => {
                          setRawInput(acc.uid);
                          setTransferVia('id');
                          setScanError('');
                        }}
                        className={`btn-press px-2.5 py-1 rounded-lg border text-[11px] font-mono-nums font-semibold whitespace-nowrap ${
                          rawInput.trim().toUpperCase() === acc.uid.trim().toUpperCase()
                            ? 'preserve-white bg-[#7c3aed] border-[#7c3aed] text-white'
                            : isLight
                            ? 'bg-purple-50 border-purple-200 text-purple-900'
                            : 'bg-[#181826] border-white/10 text-slate-300 hover:border-[#8b5cf6]/60'
                        }`}
                      >
                        {acc.name} · {acc.uid}
                      </button>
                    ))}
                  </div>
                )}

                {/* Recipient Verification Status */}
                {recipientResolution && (
                  recipientResolution.ok ? (
                    <div
                      data-testid="p2p-recipient-preview"
                      className="mt-2 rounded-xl px-3 py-2 bg-emerald-500/12 border border-emerald-500/30 flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                        <div className="min-w-0">
                          <div className={`text-xs font-bold truncate ${headingTextCls}`}>
                            {recipientResolution.recipient.name}
                          </div>
                          <div className="text-[10.5px] font-mono-nums text-emerald-400 truncate">
                            {recipientResolution.recipient.uid} · Verified Wallet
                          </div>
                        </div>
                      </div>
                      <span className="text-[10.5px] font-bold text-emerald-400 shrink-0">
                        Ready
                      </span>
                    </div>
                  ) : (
                    <div className="mt-2 rounded-xl px-3 py-2 bg-rose-500/10 border border-rose-500/25 text-[11px] text-rose-400">
                      {recipientResolution.error}
                    </div>
                  )
                )}
              </div>

              {/* Amount Input + Quick Chips */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="p2p-amount-input"
                    className={`text-[11px] font-bold uppercase tracking-wider ${labelTextCls}`}
                  >
                    Amount (₹{MIN_P2P_WALLET_TRANSFER_INR} – ₹{MAX_P2P_WALLET_TRANSFER_INR.toLocaleString('en-IN')})
                  </label>
                  <span className={`text-[11px] font-mono-nums font-semibold ${mutedTextCls}`}>
                    Bal: {formatCurrency(state.balance, currency, fxRates)}
                  </span>
                </div>
                <input
                  id="p2p-amount-input"
                  type="number"
                  min={MIN_P2P_WALLET_TRANSFER_INR}
                  max={MAX_P2P_WALLET_TRANSFER_INR}
                  value={amountInput}
                  onChange={(e) => {
                    setAmountInput(e.target.value);
                    setScanError('');
                  }}
                  placeholder="100"
                  className={`w-full h-11 px-3.5 rounded-xl border font-mono-nums text-base font-bold ${inputFieldCls}`}
                />
                <div className="grid grid-cols-4 gap-2 mt-2">
                  {QUICK_TRANSFER_AMOUNTS.map((amt) => {
                    const active = Number(amountInput) === amt;
                    return (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => {
                          setAmountInput(String(amt));
                          setScanError('');
                        }}
                        className={`btn-press py-2 rounded-xl border text-xs font-bold font-mono-nums transition-colors ${
                          active
                            ? isLight
                              ? 'bg-purple-100 border-purple-600 text-purple-900'
                              : 'bg-[#7c3aed]/25 border-[#8b5cf6] text-[#c4b5fd]'
                            : isLight
                            ? 'bg-[#f8f6ff] border-purple-200 text-slate-700 hover:border-purple-400'
                            : 'bg-[#181826] border-white/10 text-slate-200 hover:border-[#8b5cf6]/50'
                        }`}
                      >
                        ₹{amt}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Optional Note */}
              <div>
                <label
                  htmlFor="p2p-note-input"
                  className={`block text-[11px] font-bold uppercase tracking-wider mb-1.5 ${labelTextCls}`}
                >
                  Note (Optional)
                </label>
                <input
                  id="p2p-note-input"
                  type="text"
                  maxLength={60}
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  placeholder="Add a short transfer message"
                  className={`w-full h-10 px-3.5 rounded-xl border text-xs ${inputFieldCls}`}
                />
              </div>

              {scanError && (
                <p
                  role="alert"
                  className={`text-xs rounded-xl px-3 py-2 border ${
                    isLight
                      ? 'text-rose-700 bg-rose-50 border-rose-200'
                      : 'text-rose-400 bg-rose-500/10 border-rose-500/25'
                  }`}
                >
                  {scanError}
                </p>
              )}

              <button
                type="submit"
                data-testid="p2p-send-submit-btn"
                className="preserve-white btn-press w-full py-3.5 rounded-[14px] text-white font-bold text-sm inline-flex items-center justify-center gap-2 shadow-[0_8px_22px_rgba(124,58,237,0.45)]"
                style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)' }}
              >
                <Send className="w-4 h-4" />
                <span>
                  Send {parsedSendAmount > 0 ? `₹${parsedSendAmount.toLocaleString('en-IN')}` : 'Money'} Now
                </span>
              </button>
            </form>
          )
        )}

        {/* TAB 2: RECEIVE QR & PROFILE ID DIRECTLY BELOW */}
        {activeTab === 'receive' && (
          <div className="space-y-4">
            <div
              className={`rounded-[22px] p-4 border flex flex-col items-center text-center ${surfaceBoxCls}`}
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="preserve-white w-7 h-7 rounded-lg bg-white border border-purple-200 flex items-center justify-center">
                  <img
                    src={getAssetUrl('assets/ouroboros-emblem.png')}
                    alt="Ouroboros"
                    className="w-5 h-5 object-contain"
                  />
                </span>
                <div className="text-left">
                  <div className={`text-xs font-extrabold leading-tight ${headingTextCls}`}>
                    {myName}
                  </div>
                  <div className={`text-[10.5px] ${mutedTextCls}`}>
                    Ouroboros Instant Wallet QR
                  </div>
                </div>
              </div>

              <div className="preserve-white bg-white rounded-2xl p-3 border border-purple-200/80 shadow-[0_8px_24px_rgba(0,0,0,0.16)]">
                {myQrDataUrl ? (
                  <img
                    src={myQrDataUrl}
                    alt={`Wallet receive QR code for ${myUid}`}
                    data-testid="my-wallet-qr-img"
                    className="w-[186px] h-[186px] rounded-[4px] block"
                  />
                ) : (
                  <div className="w-[186px] h-[186px] flex items-center justify-center text-xs text-slate-600 font-semibold">
                    Generating QR…
                  </div>
                )}
              </div>

              {/* Profile ID directly below QR Code */}
              <div
                className={`w-full mt-3.5 rounded-xl border px-3.5 py-2.5 flex items-center justify-between gap-2 ${
                  isLight
                    ? 'bg-white border-purple-200'
                    : 'bg-[#12121c] border-white/10'
                }`}
              >
                <div className="text-left min-w-0">
                  <div className={`text-[10px] font-bold uppercase tracking-wider ${labelTextCls}`}>
                    Your Profile ID
                  </div>
                  <div
                    data-testid="my-wallet-profile-id"
                    className={`text-sm font-extrabold font-mono-nums truncate ${headingTextCls}`}
                  >
                    {myUid}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCopyMyUid}
                  className="preserve-white btn-press min-h-[34px] px-3 rounded-lg bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  {copiedUid ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedUid ? 'Copied' : 'Copy ID'}</span>
                </button>
              </div>

              <p className={`text-[11px] mt-2.5 leading-relaxed ${mutedTextCls}`}>
                Friends can scan this QR code or enter your Profile ID above to send money straight to your wallet.
              </p>

              {/* Download & Share */}
              <div className="grid grid-cols-2 gap-2.5 w-full mt-3">
                <button
                  type="button"
                  onClick={handleDownloadMyQr}
                  className={`btn-press min-h-[38px] rounded-xl border text-xs font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap ${
                    isLight
                      ? 'bg-white border-purple-200 text-purple-900 hover:border-purple-400'
                      : 'bg-[#12121c] border-white/12 text-slate-200 hover:border-[#8b5cf6]'
                  }`}
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Save QR</span>
                </button>
                <button
                  type="button"
                  onClick={handleShareMyQr}
                  className={`btn-press min-h-[38px] rounded-xl border text-xs font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap ${
                    isLight
                      ? 'bg-white border-purple-200 text-purple-900 hover:border-purple-400'
                      : 'bg-[#12121c] border-white/12 text-slate-200 hover:border-[#8b5cf6]'
                  }`}
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Share</span>
                </button>
              </div>
            </div>

            {/* Optional Request Amount Input */}
            <div>
              <label
                htmlFor="p2p-request-amount-input"
                className={`block text-[11px] font-bold uppercase tracking-wider mb-1.5 ${labelTextCls}`}
              >
                Request Specific Amount (Optional INR)
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="p2p-request-amount-input"
                  type="number"
                  min={MIN_P2P_WALLET_TRANSFER_INR}
                  max={MAX_P2P_WALLET_TRANSFER_INR}
                  value={requestAmountInput}
                  onChange={(e) => setRequestAmountInput(e.target.value)}
                  placeholder="Any amount"
                  className={`flex-1 h-10 px-3.5 rounded-xl border font-mono-nums text-sm font-semibold ${inputFieldCls}`}
                />
                {requestAmountInput && (
                  <button
                    type="button"
                    onClick={() => setRequestAmountInput('')}
                    className={`btn-press h-10 px-3 rounded-xl border text-xs font-semibold whitespace-nowrap ${surfaceBoxCls}`}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {receiveNotice && (
              <div className="rounded-xl px-3 py-2 bg-emerald-500/12 border border-emerald-500/30 text-xs font-semibold text-emerald-400 text-center">
                {receiveNotice}
              </div>
            )}

            <button
              type="button"
              onClick={() => setActiveTab('scan')}
              className={`btn-press w-full py-3 rounded-xl border text-xs font-bold inline-flex items-center justify-center gap-1.5 ${surfaceBoxCls}`}
            >
              <ArrowUpRight className="w-4 h-4 text-[#a78bfa]" />
              <span>Switch to Scan &amp; Send Money</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
