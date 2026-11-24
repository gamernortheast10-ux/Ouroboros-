import {
  AppNotification,
  NotificationIconKey,
  NotificationRoute,
  NotificationStyle,
  NotificationTemplateKey,
} from '../types/notifications';

export interface NotificationTemplate {
  title: string;
  msg: string;
  icon: NotificationIconKey;
  style: NotificationStyle;
  sound: NotificationStyle | 'system';
  route: NotificationRoute;
}

export const NOTIFICATION_TEMPLATES: Record<NotificationTemplateKey, NotificationTemplate> = {
  deposit_ok: {
    title: 'Deposit Successful',
    msg: '₹2,000 credited to your wallet.',
    icon: 'deposit',
    style: 'success',
    sound: 'success',
    route: 'wallet',
  },
  deposit_pending: {
    title: 'Deposit Pending',
    msg: '₹1,500 is being processed. Usually 1–5 min.',
    icon: 'clock',
    style: 'warning',
    sound: 'warning',
    route: 'wallet',
  },
  deposit_fail: {
    title: 'Deposit Rejected',
    msg: 'Payment failed. Please try another method.',
    icon: 'close',
    style: 'error',
    sound: 'error',
    route: 'wallet',
  },
  withdraw_ok: {
    title: 'Withdrawal Successful',
    msg: '₹3,000 sent to bank account ••4821.',
    icon: 'withdraw',
    style: 'success',
    sound: 'success',
    route: 'wallet',
  },
  withdraw_pending: {
    title: 'Withdrawal Pending',
    msg: '₹1,200 under review. ETA ~30 minutes.',
    icon: 'clock',
    style: 'warning',
    sound: 'warning',
    route: 'wallet',
  },
  withdraw_fail: {
    title: 'Withdrawal Rejected',
    msg: 'Insufficient balance or KYC pending.',
    icon: 'close',
    style: 'error',
    sound: 'error',
    route: 'wallet',
  },
  bet_ok: {
    title: 'Bet Confirmed',
    msg: 'YES bet of ₹500 on GTA VI sales placed.',
    icon: 'check',
    style: 'success',
    sound: 'success',
    route: 'markets',
  },
  bet_fail: {
    title: 'Bet Rejected',
    msg: 'Pool closed. Your amount has been refunded.',
    icon: 'close',
    style: 'error',
    sound: 'error',
    route: 'markets',
  },
  trade_ok: {
    title: 'Trade Confirmed',
    msg: 'Long position on APPLE @ ₹267.92 opened.',
    icon: 'trade',
    style: 'info',
    sound: 'info',
    route: 'trade',
  },
  trade_win: {
    title: 'Trade Won',
    msg: 'Profit +₹186 on APPLE short trade.',
    icon: 'win',
    style: 'money',
    sound: 'money',
    route: 'portfolio',
  },
  refund: {
    title: 'Money Refunded',
    msg: '₹500 has been returned to your wallet.',
    icon: 'refund',
    style: 'cyan',
    sound: 'money',
    route: 'wallet',
  },
  news: {
    title: 'New Market News',
    msg: 'Apple India manufacturing scales up – Bullish.',
    icon: 'news',
    style: 'news',
    sound: 'news',
    route: 'news',
  },
  price: {
    title: 'Price Alert',
    msg: 'APPLE reached your target price of ₹269.34.',
    icon: 'alert',
    style: 'warning',
    sound: 'warning',
    route: 'trade',
  },
  system: {
    title: 'System Notice',
    msg: 'Scheduled maintenance tonight 2:00–3:00 AM IST.',
    icon: 'system',
    style: 'info',
    sound: 'system',
    route: 'system',
  },
};

export function createSeedNotifications(now = Date.now()): AppNotification[] {
  return [
    {
      id: 'notif-seed-1',
      ...NOTIFICATION_TEMPLATES.trade_win,
      createdAt: now - 45_000,
      read: false,
    },
    {
      id: 'notif-seed-2',
      ...NOTIFICATION_TEMPLATES.news,
      createdAt: now - 180_000,
      read: false,
    },
    {
      id: 'notif-seed-3',
      ...NOTIFICATION_TEMPLATES.deposit_ok,
      msg: '₹5,000 credited via UPI Instant.',
      createdAt: now - 900_000,
      read: false,
    },
  ];
}

export function createNotificationFromTemplate(
  key: NotificationTemplateKey,
  overrides?: Partial<Pick<AppNotification, 'title' | 'msg' | 'route'>>,
  now = Date.now()
): AppNotification {
  const tpl = NOTIFICATION_TEMPLATES[key];
  return {
    id: `notif-${now}-${Math.random().toString(36).slice(2, 6)}`,
    title: overrides?.title ?? tpl.title,
    msg: overrides?.msg ?? tpl.msg,
    icon: tpl.icon,
    style: tpl.style,
    sound: tpl.sound,
    route: overrides?.route ?? tpl.route,
    createdAt: now,
    read: false,
  };
}

export function formatRelativeTime(createdAt: number, now = Date.now()): string {
  const diffSec = Math.max(0, (now - createdAt) / 1000);
  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return new Date(createdAt).toLocaleDateString();
}

export function getUnreadCount(list: AppNotification[]): number {
  return list.reduce((acc, n) => acc + (n.read ? 0 : 1), 0);
}

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    if (!sharedAudioCtx) sharedAudioCtx = new Ctor();
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

function playTone(
  freq: number,
  type: OscillatorType,
  dur: number,
  vol = 0.1,
  delay = 0
): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(vol, ctx.currentTime + delay + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime + delay);
    osc.stop(ctx.currentTime + delay + dur + 0.05);
  } catch {
    // Ignore Web Audio autoplay restrictions
  }
}

export function playNotificationSound(kind: AppNotification['sound']): void {
  switch (kind) {
    case 'success':
      playTone(784, 'sine', 0.1);
      playTone(1046, 'sine', 0.16, 0.1, 0.09);
      break;
    case 'error':
      playTone(200, 'sawtooth', 0.22, 0.08);
      playTone(160, 'sawtooth', 0.28, 0.06, 0.14);
      break;
    case 'warning':
      playTone(466, 'triangle', 0.12);
      playTone(466, 'triangle', 0.12, 0.09, 0.18);
      break;
    case 'info':
      playTone(659, 'sine', 0.18);
      break;
    case 'news':
      playTone(523, 'sine', 0.08);
      playTone(659, 'sine', 0.08, 0.08, 0.08);
      playTone(784, 'sine', 0.14, 0.08, 0.16);
      break;
    case 'money':
      playTone(880, 'sine', 0.08);
      playTone(1174, 'sine', 0.1, 0.09, 0.07);
      playTone(1396, 'sine', 0.16, 0.08, 0.14);
      break;
    case 'cyan':
      playTone(659, 'sine', 0.08);
      playTone(784, 'sine', 0.08, 0.09, 0.07);
      playTone(1046, 'sine', 0.2, 0.1, 0.14);
      break;
    case 'system':
    default:
      playTone(392, 'triangle', 0.26, 0.08);
      break;
  }
}
