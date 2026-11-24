import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { BaseCurrency, FxRatesMap } from '../types/trading';
import { formatCurrency } from '../utils/tradingEngine';

export interface PaymentTransferPayload {
  direction: 'deposit' | 'withdraw';
  amountInr: number;
  channelLabel: string;
}

interface PaymentTransferAnimationProps {
  transfer: PaymentTransferPayload | null;
  currency?: BaseCurrency;
  fxRates?: FxRatesMap;
  onComplete: () => void;
}

interface MatrixColumn {
  id: number;
  isGreen: boolean;
  leftPct: number;
  fontSize: number;
  opacity: number;
  duration: number;
  delay: number;
  lines: string[];
}

interface ConfettiPiece {
  id: number;
  size: number;
  color: string;
  leftPct: number;
  isRound: boolean;
  delayMs: number;
  durationS: number;
  driftPct: number;
  rotateDeg: number;
}

const MATRIX_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*_+-=[]{}|;:<>?/~';
const CONFETTI_COLORS = [
  '#4ade80',
  '#22c55e',
  '#86efac',
  '#f87171',
  '#fbbf24',
  '#60a5fa',
  '#a78bfa',
];

export const PaymentTransferAnimation: React.FC<PaymentTransferAnimationProps> = ({
  transfer,
  currency = 'INR',
  fxRates,
  onComplete,
}) => {
  const [phase, setPhase] = useState<1 | 2 | 3>(1);
  const [phase1Arriving, setPhase1Arriving] = useState(false);
  const [barFilled, setBarFilled] = useState(false);
  const [showSuccessCard, setShowSuccessCard] = useState(false);
  const [showRings, setShowRings] = useState(false);
  const [confettiActive, setConfettiActive] = useState(false);
  const [displayAmountInr, setDisplayAmountInr] = useState(0);

  const transferAreaRef = useRef<HTMLDivElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const matrixColumns = useMemo<MatrixColumn[]>(() => {
    const count = 48;
    return Array.from({ length: count }, (_, idx) => {
      const len = 18 + ((idx * 7) % 14);
      const lines = Array.from({ length: len }, (__, j) => {
        const charIdx = (idx * 17 + j * 31) % MATRIX_CHARS.length;
        return MATRIX_CHARS[charIdx];
      });
      const duration = 2.4 + ((idx * 19) % 34) / 10;
      // Negative delay pre-populates the rain across the screen the instant Phase 2 begins
      const delay = -(((idx * 11) % 30) / 10);
      return {
        id: idx,
        isGreen: idx % 5 !== 1 && idx % 4 !== 2 ? true : idx % 3 === 0,
        leftPct: ((idx + 0.35) / count) * 100 + ((idx % 3) - 1) * 0.8,
        fontSize: 11 + (idx % 5),
        opacity: 0.55 + ((idx * 13) % 40) / 100,
        duration,
        delay,
        lines,
      };
    });
  }, []);

  const confettiPieces = useMemo<ConfettiPiece[]>(() => {
    return Array.from({ length: 55 }, (_, i) => ({
      id: i,
      size: 5 + ((i * 7) % 9),
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      leftPct: (i * 19) % 100,
      isRound: i % 5 !== 0 && i % 2 === 0,
      delayMs: i * 30,
      durationS: 1.8 + ((i * 11) % 12) / 10,
      driftPct: ((i * 17) % 50) - 25,
      rotateDeg: ((i * 89) % 700) - 350,
    }));
  }, []);

  const ensureAudio = () => {
    try {
      if (typeof window === 'undefined') return null;
      const AudioCtor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtor) return null;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtor();
      }
      if (audioCtxRef.current.state === 'suspended') {
        void audioCtxRef.current.resume().catch(() => {});
      }
      return audioCtxRef.current;
    } catch {
      return null;
    }
  };

  const playTone = (
    freq: number,
    type: OscillatorType,
    dur: number,
    vol = 0.06,
    delay = 0
  ) => {
    try {
      const ctx = audioCtxRef.current;
      if (!ctx) return;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, ctx.currentTime + delay);
      g.gain.setValueAtTime(0, ctx.currentTime + delay);
      g.gain.linearRampToValueAtTime(vol, ctx.currentTime + delay + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + dur);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(ctx.currentTime + delay);
      o.stop(ctx.currentTime + delay + dur + 0.05);
    } catch {
      // Ignore audio failures when autoplay is blocked
    }
  };

  const playWhoosh = () => {
    playTone(180, 'sine', 0.28, 0.04);
    playTone(320, 'triangle', 0.22, 0.028, 0.04);
  };

  const playSuccess = () => {
    playTone(523.25, 'sine', 0.14, 0.075);
    playTone(659.25, 'sine', 0.16, 0.065, 0.11);
    playTone(783.99, 'sine', 0.32, 0.085, 0.23);
  };

  useEffect(() => {
    if (!transfer) return;

    setPhase(1);
    setPhase1Arriving(false);
    setBarFilled(false);
    setShowSuccessCard(false);
    setShowRings(false);
    setConfettiActive(false);
    setDisplayAmountInr(0);

    ensureAudio();

    const timers: number[] = [];
    const rafIds: number[] = [];
    const spawnedOrbs: HTMLDivElement[] = [];

    const startTransferTimeout = window.setTimeout(() => {
      const area = transferAreaRef.current;
      if (!area) return;

      const isDeposit = transfer.direction === 'deposit';
      const areaWidth = area.offsetWidth || 320;
      const startX = isDeposit ? 47 : areaWidth - 47;
      const endX = isDeposit ? areaWidth - 47 : 47;
      const startY = 70;
      const endY = 70;
      const ctrl1X = isDeposit ? startX + 70 : startX - 70;
      const ctrl2X = isDeposit ? endX - 70 : endX + 70;

      const curve = (t: number) => {
        const u = 1 - t;
        const x =
          u ** 3 * startX +
          3 * u ** 2 * t * ctrl1X +
          3 * u * t ** 2 * ctrl2X +
          t ** 3 * endX;
        const y =
          u ** 3 * startY +
          3 * u ** 2 * t * (startY - 55) +
          3 * u * t ** 2 * (endY + 55) +
          t ** 3 * endY;
        return { x, y };
      };

      for (let i = 0; i < 28; i++) {
        const orbTimer = window.setTimeout(() => {
          if (i % 3 === 0) playWhoosh();
          if (!transferAreaRef.current) return;
          const p = document.createElement('div');
          p.style.position = 'absolute';
          p.style.width = '13px';
          p.style.height = '13px';
          p.style.borderRadius = '9999px';
          p.style.background =
            'radial-gradient(circle at 30% 30%, #fde68a, #f59e0b 70%)';
          p.style.boxShadow = '0 0 14px #fbbf24, 0 0 26px rgba(251,191,36,0.5)';
          p.style.zIndex = '8';
          p.style.pointerEvents = 'none';
          p.style.opacity = '0';
          transferAreaRef.current.appendChild(p);
          spawnedOrbs.push(p);

          let animStart: number | null = null;
          const dur = 820 + Math.random() * 260;

          const frame = (ts: number) => {
            if (!animStart) animStart = ts;
            const t = Math.min(1, (ts - animStart) / dur);
            const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
            const pt = curve(ease);
            p.style.left = `${pt.x + (Math.random() * 5 - 2.5)}px`;
            p.style.top = `${pt.y + (Math.random() * 5 - 2.5)}px`;
            p.style.opacity = String(
              t < 0.08 ? t * 12 : t > 0.88 ? (1 - t) * 8 : 1
            );
            p.style.transform = `translate(-50%, -50%) scale(${
              0.65 + Math.sin(t * Math.PI) * 0.7
            })`;
            if (t < 1) {
              const id = requestAnimationFrame(frame);
              rafIds.push(id);
            } else {
              p.remove();
            }
          };

          const id = requestAnimationFrame(frame);
          rafIds.push(id);
        }, i * 45);

        timers.push(orbTimer);
      }
    }, 180);
    timers.push(startTransferTimeout);

    timers.push(
      window.setTimeout(() => {
        setPhase1Arriving(true);
      }, 1050)
    );

    timers.push(
      window.setTimeout(() => {
        setPhase(2);
        timers.push(window.setTimeout(() => setBarFilled(true), 80));
      }, 2200)
    );

    timers.push(
      window.setTimeout(() => {
        setPhase(3);
        playSuccess();
        timers.push(window.setTimeout(() => setShowSuccessCard(true), 100));
        timers.push(
          window.setTimeout(() => {
            setShowRings(true);
            setConfettiActive(true);
          }, 260)
        );

        const countDelay = window.setTimeout(() => {
          let countStart: number | null = null;
          const step = (ts: number) => {
            if (!countStart) countStart = ts;
            const t = Math.min(1, (ts - countStart) / 1100);
            const ease = 1 - Math.pow(1 - t, 3);
            setDisplayAmountInr(
              t >= 1 ? transfer.amountInr : Math.floor(ease * transfer.amountInr)
            );
            if (t < 1) {
              const id = requestAnimationFrame(step);
              rafIds.push(id);
            }
          };
          const id = requestAnimationFrame(step);
          rafIds.push(id);
        }, 340);
        timers.push(countDelay);
      }, 6900)
    );

    return () => {
      timers.forEach((id) => window.clearTimeout(id));
      rafIds.forEach((id) => cancelAnimationFrame(id));
      spawnedOrbs.forEach((el) => el.remove());
    };
  }, [transfer]);

  if (!transfer) return null;

  const isDeposit = transfer.direction === 'deposit';
  const bankActive = isDeposit ? !phase1Arriving : phase1Arriving;
  const walletActive = isDeposit ? phase1Arriving : !phase1Arriving;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Payment transfer verification"
      className="hero-preserve-dark fixed inset-0 z-[70] flex items-center justify-center bg-[#06040f]/95 backdrop-blur-md p-0 sm:p-4"
    >
      <div
        className="pay-scene-grid relative w-full max-w-[430px] h-full sm:h-[820px] sm:max-h-[92vh] sm:rounded-[34px] overflow-hidden border-0 sm:border sm:border-violet-400/20 shadow-[0_30px_90px_rgba(0,0,0,0.85)]"
        style={{
          background:
            'radial-gradient(ellipse at 50% 20%, #1a0b3c 0%, #0d061f 45%, #06040f 100%)',
        }}
      >
        <button
          type="button"
          onClick={onComplete}
          aria-label="Close transfer animation"
          className="preserve-white absolute top-4 right-4 z-40 w-10 h-10 rounded-full bg-white/[0.08] hover:bg-white/[0.16] border border-white/15 flex items-center justify-center text-white/80 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* PHASE 1: Bank <-> Wallet Energy Orb Path */}
        <div
          className={`absolute inset-0 flex flex-col items-center justify-center transition-opacity duration-500 ${
            phase === 1
              ? 'opacity-100 pointer-events-auto'
              : 'opacity-0 pointer-events-none'
          }`}
        >
          <div className="text-center px-7 z-10">
            <h2
              className="text-[22px] font-bold leading-[1.35] bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  'linear-gradient(135deg, #e0e7ff, #c4b5fd 45%, #a78bfa)',
              }}
            >
              {isDeposit ? (
                phase1Arriving ? (
                  <>
                    Money arriving in
                    <br />
                    your wallet
                  </>
                ) : (
                  <>
                    Money leaving your
                    <br />
                    bank account
                  </>
                )
              ) : phase1Arriving ? (
                <>
                  Money arriving in
                  <br />
                  your bank account
                </>
              ) : (
                <>
                  Money leaving your
                  <br />
                  Ouroboros wallet
                </>
              )}
            </h2>
            <p className="mt-2.5 text-sm text-[#c4b5fd]/70">
              {phase1Arriving
                ? 'Almost there…'
                : `${transfer.channelLabel} transfer in progress…`}
            </p>
          </div>

          <div
            ref={transferAreaRef}
            className="relative w-[88%] mt-12 h-[140px]"
          >
            {/* Bank Card */}
            <div
              className={`preserve-white w-[94px] h-[94px] rounded-[26px] backdrop-blur-xl flex flex-col items-center justify-center gap-2 text-[13px] font-semibold text-white/90 absolute left-0 top-1/2 transition-all duration-500 z-[5] ${
                bankActive
                  ? 'border border-[#a78bfa]/60 shadow-[0_0_40px_rgba(139,92,246,0.42)] -translate-y-1/2 scale-[1.06]'
                  : 'border border-[#a78bfa]/20 opacity-40 -translate-y-1/2 scale-[0.93]'
              }`}
              style={{
                background:
                  'linear-gradient(145deg, rgba(255,255,255,0.1), rgba(255,255,255,0.02))',
              }}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="#a78bfa"
                strokeWidth="1.7"
                className="w-8 h-8"
              >
                <path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3" />
              </svg>
              <span>Bank</span>
            </div>

            {/* Curved Dotted Path */}
            <svg
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%] h-[90px] overflow-visible z-[2]"
              viewBox="0 0 200 90"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="payGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#7c3aed" />
                  <stop offset="50%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#a78bfa" />
                </linearGradient>
              </defs>
              <path
                d="M8,45 C55,8 145,82 192,45"
                fill="none"
                stroke="#8b5cf6"
                strokeWidth="10"
                strokeLinecap="round"
                opacity="0.28"
                style={{ filter: 'blur(7px)' }}
              />
              <path
                d="M8,45 C55,8 145,82 192,45"
                fill="none"
                stroke="url(#payGrad)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray="6 9"
                opacity="0.75"
              />
            </svg>

            {/* Wallet Card */}
            <div
              className={`preserve-white w-[94px] h-[94px] rounded-[26px] backdrop-blur-xl flex flex-col items-center justify-center gap-2 text-[13px] font-semibold text-white/90 absolute right-0 top-1/2 transition-all duration-500 z-[5] ${
                walletActive
                  ? 'border border-[#a78bfa]/60 shadow-[0_0_40px_rgba(139,92,246,0.42)] -translate-y-1/2 scale-[1.06]'
                  : 'border border-[#a78bfa]/20 opacity-40 -translate-y-1/2 scale-[0.93]'
              }`}
              style={{
                background:
                  'linear-gradient(145deg, rgba(255,255,255,0.1), rgba(255,255,255,0.02))',
              }}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="#c4b5fd"
                strokeWidth="1.7"
                className="w-8 h-8"
              >
                <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
                <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
                <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
              </svg>
              <span>Wallet</span>
            </div>
          </div>
        </div>

        {/* PHASE 2: Green + Red Matrix Verification */}
        <div
          className={`absolute inset-0 flex flex-col items-center justify-center transition-opacity duration-500 ${
            phase === 2
              ? 'opacity-100 pointer-events-auto'
              : 'opacity-0 pointer-events-none'
          }`}
        >
          <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
            {phase === 2 &&
              matrixColumns.map((col) => (
                <div
                  key={col.id}
                  className="absolute top-0 font-mono leading-[1.3] whitespace-nowrap select-none"
                  style={{
                    left: `${col.leftPct}%`,
                    fontSize: `${col.fontSize}px`,
                    opacity: col.opacity,
                    color: col.isGreen ? '#4ade80' : '#f87171',
                    textShadow: col.isGreen
                      ? '0 0 12px rgba(74,222,128,0.7)'
                      : '0 0 12px rgba(248,113,113,0.7)',
                    animation: `payMatrixFall ${col.duration}s linear ${col.delay}s infinite`,
                  }}
                >
                  {col.lines.map((ch, idx) => (
                    <div key={idx}>{ch}</div>
                  ))}
                </div>
              ))}
          </div>

          <div
            className="relative z-30 backdrop-blur-2xl border border-violet-500/30 rounded-[22px] px-8 py-6 text-center min-w-[250px] shadow-[0_25px_60px_rgba(0,0,0,0.55)]"
            style={{ background: 'rgba(8,5,22,0.88)' }}
          >
            <h2 className="text-[17px] font-semibold text-[#e0e7ff] mb-2">
              Verifying transaction
            </h2>
            <p className="text-[13.5px] text-[#c4b5fd]/65">
              Secure handshake in progress...
            </p>
            <div className="w-[160px] h-[3.5px] bg-white/[0.08] rounded-full mx-auto mt-4 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: barFilled ? '100%' : '0%',
                  background:
                    'linear-gradient(90deg, #7c3aed, #3b82f6, #22c55e)',
                  transition: 'width 4.5s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              />
            </div>
          </div>
        </div>

        {/* PHASE 3: Emerald Success + Concentric Rings + Confetti */}
        <div
          className={`absolute inset-0 flex flex-col items-center justify-center transition-opacity duration-500 ${
            phase === 3
              ? 'opacity-100 pointer-events-auto'
              : 'opacity-0 pointer-events-none'
          }`}
          style={{
            background:
              'radial-gradient(ellipse at 50% 25%, #064e3b 0%, #022c22 45%, #011510 100%)',
          }}
        >
          {/* Confetti */}
          {confettiActive &&
            confettiPieces.map((c) => (
              <div
                key={c.id}
                aria-hidden="true"
                className="absolute pointer-events-none"
                style={
                  {
                    width: `${c.size}px`,
                    height: `${c.size * 0.7}px`,
                    background: c.color,
                    left: `${c.leftPct}%`,
                    top: '-15px',
                    borderRadius: c.isRound ? '9999px' : '2px',
                    '--confetti-dx': `${c.driftPct}px`,
                    '--confetti-rot': `${c.rotateDeg}deg`,
                    animation: `payConfettiFall ${c.durationS}s cubic-bezier(0.22,0.61,0.36,1) ${c.delayMs}ms forwards`,
                  } as React.CSSProperties
                }
              />
            ))}

          {/* Expanding Rings */}
          <div
            className={`absolute top-1/2 left-1/2 w-[130px] h-[130px] rounded-full border-2 border-[#4ade80]/45 pointer-events-none ${
              showRings ? 'pay-ring-expand' : 'opacity-0'
            }`}
          />
          <div
            className={`absolute top-1/2 left-1/2 w-[130px] h-[130px] rounded-full border-2 border-[#4ade80]/45 pointer-events-none ${
              showRings ? 'pay-ring-expand' : 'opacity-0'
            }`}
            style={{ animationDelay: '0.22s' }}
          />

          {/* Success Glass Card */}
          <div
            className={`relative z-20 w-[86%] backdrop-blur-2xl border border-[#4ade80]/30 rounded-[30px] px-6 py-10 text-center transition-all duration-700 ${
              showSuccessCard
                ? 'scale-100 translate-y-0 opacity-100'
                : 'scale-50 translate-y-12 opacity-0'
            }`}
            style={{
              background:
                'linear-gradient(160deg, rgba(255,255,255,0.11), rgba(255,255,255,0.025))',
              transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
          >
            <div
              className="w-[88px] h-[88px] rounded-full flex items-center justify-center mx-auto mb-6"
              style={{
                background: 'linear-gradient(145deg, #22c55e, #16a34a)',
                boxShadow:
                  '0 0 0 12px rgba(34,197,94,0.15), 0 0 50px rgba(34,197,94,0.5)',
              }}
            >
              <svg
                viewBox="0 0 24 24"
                className="w-11 h-11 stroke-white fill-none"
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <div className="text-sm font-medium text-white/80">
              {isDeposit
                ? 'Amount credited to your'
                : 'Withdrawal sent to your'}
            </div>
            <div
              className="text-[44px] sm:text-[48px] font-extrabold text-white my-3 tracking-[-1.5px] font-mono-nums"
              style={{ textShadow: '0 0 30px rgba(74,222,128,0.45)' }}
            >
              {formatCurrency(displayAmountInr, currency, fxRates)}
            </div>
            <div className="text-sm text-white/55 font-medium">
              {isDeposit ? 'Wallet' : 'Bank Account'} · {transfer.channelLabel}
            </div>

            <button
              type="button"
              onClick={onComplete}
              className="preserve-white btn-press mt-7 w-full min-h-[48px] rounded-2xl bg-[#22c55e] hover:bg-[#16a34a] text-white font-bold text-sm shadow-[0_8px_24px_rgba(34,197,94,0.35)]"
            >
              Continue to Ouroboros
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
