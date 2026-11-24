import React from 'react';

export type UpiMethodId =
  | 'upi-qr'
  | 'phonepe'
  | 'gpay'
  | 'paytm'
  | 'navi'
  | 'airtel'
  | 'amazon'
  | 'bhim'
  | 'cred'
  | 'supermoney'
  | 'whatsapp'
  | 'mobikwik'
  | 'freecharge'
  | 'jupiter'
  | 'slice';

export interface UpiPaymentMethod {
  id: UpiMethodId;
  name: string;
  subtitle: string;
  type: 'qr' | 'app';
  deepLinkBase?: string;
  bgStyle: string;
  ringStyle?: string;
  logoUrls: string[];
}

export const MERCHANT_UPI_ID = 'ouroboros.desk@upi';
export const MERCHANT_NAME = 'Ouroboros Desk';

export const UPI_PAYMENT_METHODS: UpiPaymentMethod[] = [
  {
    id: 'upi-qr',
    name: 'Direct UPI QR',
    subtitle: 'Scan & Pay • Any UPI app',
    type: 'qr',
    bgStyle: 'linear-gradient(135deg, #5b21b6 0%, #7c3aed 100%)',
    logoUrls: [],
  },
  {
    id: 'phonepe',
    name: 'PhonePe',
    subtitle: 'Tap to Pay Directly',
    type: 'app',
    deepLinkBase: 'phonepe://pay',
    bgStyle: '#5f259f',
    logoUrls: [],
  },
  {
    id: 'gpay',
    name: 'Google Pay',
    subtitle: 'Tap to Pay Directly',
    type: 'app',
    deepLinkBase: 'tez://upi/pay',
    bgStyle: '#ffffff',
    ringStyle: '1px solid rgba(15, 23, 42, 0.14)',
    logoUrls: [],
  },
  {
    id: 'paytm',
    name: 'Paytm',
    subtitle: 'Tap to Pay Directly',
    type: 'app',
    deepLinkBase: 'paytmmp://pay',
    bgStyle: '#ffffff',
    ringStyle: '1px solid rgba(0, 46, 110, 0.18)',
    logoUrls: [],
  },
  {
    id: 'bhim',
    name: 'BHIM UPI',
    subtitle: 'Tap to Pay Directly',
    type: 'app',
    deepLinkBase: 'bhim://upi',
    bgStyle: '#ffffff',
    ringStyle: '1px solid rgba(15, 23, 42, 0.14)',
    logoUrls: [],
  },
  {
    id: 'amazon',
    name: 'Amazon Pay',
    subtitle: 'Tap to Pay Directly',
    type: 'app',
    deepLinkBase: 'amazonpay://upi',
    bgStyle: '#232f3e',
    logoUrls: [],
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp Pay',
    subtitle: 'Tap to Pay Directly',
    type: 'app',
    deepLinkBase: 'whatsapp://pay',
    bgStyle: '#25d366',
    logoUrls: [],
  },
  {
    id: 'airtel',
    name: 'Airtel Payments',
    subtitle: 'Tap to Pay Directly',
    type: 'app',
    deepLinkBase: 'myairtel://upi',
    bgStyle: '#e40000',
    logoUrls: [],
  },
  {
    id: 'cred',
    name: 'CRED Pay',
    subtitle: 'Tap to Pay Directly',
    type: 'app',
    deepLinkBase: 'credpay://upi',
    bgStyle: 'linear-gradient(145deg, #0f1014 0%, #23252f 100%)',
    logoUrls: [],
  },
  {
    id: 'mobikwik',
    name: 'MobiKwik',
    subtitle: 'Tap to Pay Directly',
    type: 'app',
    deepLinkBase: 'mobikwik://upi',
    bgStyle: 'linear-gradient(135deg, #0052cc 0%, #0077ff 100%)',
    logoUrls: [],
  },
  {
    id: 'freecharge',
    name: 'Freecharge',
    subtitle: 'Tap to Pay Directly',
    type: 'app',
    deepLinkBase: 'freecharge://upi',
    bgStyle: '#f26522',
    logoUrls: [],
  },
  {
    id: 'navi',
    name: 'Navi UPI',
    subtitle: 'Tap to Pay Directly',
    type: 'app',
    deepLinkBase: 'navi://upi',
    bgStyle: 'linear-gradient(135deg, #0b1630 0%, #14264f 100%)',
    logoUrls: [],
  },
  {
    id: 'supermoney',
    name: 'Super.money',
    subtitle: 'Tap to Pay Directly',
    type: 'app',
    deepLinkBase: 'supermoney://upi',
    bgStyle: 'linear-gradient(135deg, #1b0a42 0%, #4338ca 100%)',
    logoUrls: [],
  },
  {
    id: 'jupiter',
    name: 'Jupiter UPI',
    subtitle: 'Tap to Pay Directly',
    type: 'app',
    deepLinkBase: 'jupiter://upi',
    bgStyle: 'linear-gradient(135deg, #eb5e55 0%, #f97316 100%)',
    logoUrls: [],
  },
  {
    id: 'slice',
    name: 'Slice UPI',
    subtitle: 'Tap to Pay Directly',
    type: 'app',
    deepLinkBase: 'slice://upi',
    bgStyle: 'linear-gradient(135deg, #6d28d9 0%, #ec4899 100%)',
    logoUrls: [],
  },
];

export const UPI_BIND_APPS = UPI_PAYMENT_METHODS.filter((m) => m.type === 'app');

export function getUpiMethodById(id: string): UpiPaymentMethod {
  return UPI_PAYMENT_METHODS.find((m) => m.id === id) ?? UPI_PAYMENT_METHODS[0];
}

export interface UpiReceiverTarget {
  upiId?: string;
  payeeName?: string;
}

export function buildUpiPaymentUri(
  amountInr: number,
  refId?: string,
  receiver?: UpiReceiverTarget
): string {
  const cleanAmount = Math.max(100, Math.round(amountInr * 100) / 100).toFixed(2);
  const tr = refId ?? `OB${Date.now()}`;
  const upiId = receiver?.upiId?.trim() || MERCHANT_UPI_ID;
  const payeeName = receiver?.payeeName?.trim() || MERCHANT_NAME;
  return `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(
    payeeName
  )}&am=${cleanAmount}&cu=INR&tr=${encodeURIComponent(tr)}&tn=${encodeURIComponent(
    'Ouroboros Wallet Top Up'
  )}`;
}

export function buildAppDeepLink(
  method: UpiPaymentMethod,
  amountInr: number,
  receiver?: UpiReceiverTarget
): string {
  const base = method.deepLinkBase ?? 'upi://pay';
  const cleanAmount = Math.max(100, Math.round(amountInr * 100) / 100).toFixed(2);
  const upiId = receiver?.upiId?.trim() || MERCHANT_UPI_ID;
  const payeeName = receiver?.payeeName?.trim() || MERCHANT_NAME;
  const query = `pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(
    payeeName
  )}&am=${cleanAmount}&cu=INR&tn=${encodeURIComponent('Ouroboros Wallet Top Up')}`;
  return `${base}?${query}`;
}

export function launchUpiDeepLink(deepLinkUrl: string): void {
  if (typeof document === 'undefined' || !deepLinkUrl) return;
  try {
    const link = document.createElement('a');
    link.href = deepLinkUrl;
    link.rel = 'noopener noreferrer';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    window.setTimeout(() => {
      link.remove();
    }, 300);
  } catch {
    // Browser environments without a native UPI handler ignore deep links cleanly
  }
}

interface UpiAppLogoProps {
  methodId: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<UpiAppLogoProps['size']>, string> = {
  xs: 'w-7 h-7 rounded-lg',
  sm: 'w-9 h-9 rounded-xl',
  md: 'w-12 h-12 rounded-[14px]',
  lg: 'w-[84px] h-[84px] rounded-[22px]',
};

const ICON_SVG_SIZE: Record<NonNullable<UpiAppLogoProps['size']>, string> = {
  xs: 'w-4 h-4',
  sm: 'w-5 h-5',
  md: 'w-7 h-7',
  lg: 'w-12 h-12',
};

export const UpiAppLogo: React.FC<UpiAppLogoProps> = ({
  methodId,
  size = 'md',
  className = '',
}) => {
  const method = getUpiMethodById(methodId);
  const boxCls = SIZE_CLASSES[size];
  const svgCls = ICON_SVG_SIZE[size];
  const [urlIdx, setUrlIdx] = React.useState(0);

  React.useEffect(() => {
    setUrlIdx(0);
  }, [method.id]);

  const activeUrl =
    method.id !== 'upi-qr' && urlIdx < method.logoUrls.length ? method.logoUrls[urlIdx] : null;

  const renderGlyph = () => {
    switch (method.id) {
      case 'upi-qr':
        return (
          <svg viewBox="0 0 24 24" className={svgCls} fill="none" stroke="#ffffff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1.5" />
            <rect x="14" y="3" width="7" height="7" rx="1.5" />
            <rect x="3" y="14" width="7" height="7" rx="1.5" />
            <rect x="5.3" y="5.3" width="2.4" height="2.4" fill="#ffffff" stroke="none" />
            <rect x="16.3" y="5.3" width="2.4" height="2.4" fill="#ffffff" stroke="none" />
            <rect x="5.3" y="16.3" width="2.4" height="2.4" fill="#ffffff" stroke="none" />
            <path d="M14 14h3v3h-3zM19 14v3M14 19h7" />
          </svg>
        );
      case 'phonepe':
        return (
          <svg viewBox="0 0 32 32" className={svgCls} fill="none">
            <path d="M8.5 11.5h15" stroke="#ffffff" strokeWidth="2.3" strokeLinecap="round" />
            <path d="M19.5 11.5v10.2" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" />
            <path
              d="M12.2 11.5v4.3c0 2.5 1.8 4.1 4.3 4.1 1.3 0 2.4-.5 3-1.4"
              stroke="#ffffff"
              strokeWidth="2.3"
              strokeLinecap="round"
            />
            <path d="M14.5 7.4l4 4.1" stroke="#e9d5ff" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        );
      case 'gpay':
        return (
          <svg viewBox="0 0 24 24" className={svgCls} fill="none">
            <path d="M21.8 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.5a4.7 4.7 0 01-2 3.1v2.5h3.3c1.9-1.8 3-4.4 3-7.5z" fill="#4285F4" />
            <path d="M12 22c2.7 0 5-.9 6.8-2.4l-3.3-2.5c-.9.6-2.1 1-3.5 1-2.7 0-5-1.8-5.8-4.3H2.8v2.6A10 10 0 0012 22z" fill="#34A853" />
            <path d="M6.2 13.8a6 6 0 010-3.6V7.6H2.8a10 10 0 000 8.8l3.4-2.6z" fill="#FBBC05" />
            <path d="M12 5.9c1.5 0 2.8.5 3.9 1.5l2.9-2.9A10 10 0 0012 2a10 10 0 00-9.2 5.6l3.4 2.6C7 7.7 9.3 5.9 12 5.9z" fill="#EA4335" />
          </svg>
        );
      case 'paytm':
        return (
          <svg viewBox="0 0 36 24" className={svgCls} fill="none">
            <text
              x="3"
              y="15.5"
              fill="#002970"
              fontSize="9.2"
              fontWeight="900"
              fontFamily="system-ui, sans-serif"
              letterSpacing="-0.4"
            >
              Pay
            </text>
            <text
              x="20.2"
              y="15.5"
              fill="#00BAF2"
              fontSize="9.2"
              fontWeight="900"
              fontFamily="system-ui, sans-serif"
              letterSpacing="-0.3"
            >
              tm
            </text>
            <rect x="3" y="18" width="30" height="2" rx="1" fill="#00BAF2" />
          </svg>
        );
      case 'navi':
        return (
          <svg viewBox="0 0 24 24" className={svgCls} fill="none">
            <path d="M6 18V6l12 12V6" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="18" cy="17.8" r="2.2" fill="#00d09c" />
          </svg>
        );
      case 'airtel':
        return (
          <svg viewBox="0 0 24 24" className={svgCls} fill="none">
            <path
              d="M16.4 6.2c-2.6-1.4-7.1.1-8.9 4-1.6 3.5.3 7.4 3.9 7.9 2.6.4 5.2-1.1 5.9-3.6.5-1.7-.5-3.4-2.2-3.6-1.9-.2-3.7 1.4-3.7 3.4"
              stroke="#ffffff"
              strokeWidth="2.3"
              strokeLinecap="round"
            />
          </svg>
        );
      case 'amazon':
        return (
          <svg viewBox="0 0 24 24" className={svgCls} fill="none">
            <path d="M8.5 9.8c.7-1.5 2-2.2 3.7-2.2 2 0 3.3 1 3.3 2.8v3.5c0 .5.2.8.5 1" stroke="#ffffff" strokeWidth="2.1" strokeLinecap="round" />
            <path d="M15.5 11.4c-1.8 0-3.8.5-3.8 2 0 1 .8 1.6 1.9 1.6 1.1 0 1.9-.6 1.9-1.6" stroke="#ffffff" strokeWidth="1.9" strokeLinecap="round" />
            <path d="M5.2 16.9c3.6 2.3 9.4 2.4 13.2.2M16.8 16.3l2.2.3-.7 2.1" stroke="#ff9900" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );
      case 'bhim':
        return (
          <svg viewBox="0 0 24 24" className={svgCls} fill="none">
            <path d="M6.5 5.2l7 6.8-7 6.8" stroke="#ff7722" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M12 5.2l7 6.8-7 6.8" stroke="#138808" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );
      case 'cred':
        return (
          <svg viewBox="0 0 24 24" className={svgCls} fill="none">
            <path d="M12 3.4l7 3v5.6c0 4.6-3 7.7-7 9-4-1.3-7-4.4-7-9V6.4l7-3z" stroke="#e5c158" strokeWidth="1.9" strokeLinejoin="round" />
            <path d="M14.7 9.5a3.4 3.4 0 100 5" stroke="#ffffff" strokeWidth="2.1" strokeLinecap="round" />
          </svg>
        );
      case 'supermoney':
        return (
          <svg viewBox="0 0 24 24" className={svgCls} fill="none">
            <path d="M13.5 3L6.2 12.8h5.1l-1 8.2 7.5-9.8h-5.2L13.5 3z" fill="#34d399" stroke="#ffffff" strokeWidth="1.3" strokeLinejoin="round" />
          </svg>
        );
      case 'whatsapp':
        return (
          <svg viewBox="0 0 24 24" className={svgCls} fill="none">
            <path d="M12 4a7.8 7.8 0 00-6.7 11.8L4.2 19.8l4.2-1.1A7.8 7.8 0 1012 4z" stroke="#ffffff" strokeWidth="1.9" strokeLinejoin="round" />
            <path d="M9.4 9.5h5.2M9.4 11.8h4.2M10.4 9.5c1.7 0 2.5.8 2.5 2s-1 2-2.8 2l3 2.8" stroke="#ffffff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );
      case 'mobikwik':
        return (
          <svg viewBox="0 0 24 24" className={svgCls} fill="none">
            <path d="M5.2 17.5V6.8l6.8 6 6.8-6v10.7" stroke="#ffffff" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="12" cy="17" r="1.6" fill="#38bdf8" />
          </svg>
        );
      case 'freecharge':
        return (
          <svg viewBox="0 0 24 24" className={svgCls} fill="none">
            <circle cx="12" cy="12" r="8.5" stroke="#ffffff" strokeWidth="1.7" opacity="0.65" />
            <path d="M14.2 7.2h-3.7L9 12.2h3.3l-1.5 5 5-6.2h-3l1.4-3.8z" fill="#ffffff" />
          </svg>
        );
      case 'jupiter':
        return (
          <svg viewBox="0 0 24 24" className={svgCls} fill="none">
            <circle cx="12" cy="12" r="4.6" fill="#ffffff" fillOpacity="0.25" stroke="#ffffff" strokeWidth="1.9" />
            <ellipse cx="12" cy="12" rx="9.5" ry="3.4" transform="rotate(-24 12 12)" stroke="#fef08a" strokeWidth="1.9" />
          </svg>
        );
      case 'slice':
      default:
        return (
          <svg viewBox="0 0 24 24" className={svgCls} fill="none">
            <path d="M16 7.4c-1.2-1.1-3-1.4-4.7-.7-2 .8-3 2.7-1.6 4.1 1.3 1.2 4.6 1 5.6 2.7.9 1.6-.2 3.6-2.3 4.2-1.9.5-3.8 0-5-1.2" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" />
            <path d="M6 18L18 6" stroke="#fbcfe8" strokeWidth="1.6" strokeLinecap="round" opacity="0.85" />
          </svg>
        );
    }
  };

  if (activeUrl) {
    return (
      <div
        className={`preserve-white ${boxCls} bg-white flex items-center justify-center p-1.5 shadow-[0_6px_14px_rgba(15,23,42,0.18)] border border-slate-200/85 overflow-hidden shrink-0 ${className}`}
      >
        <img
          src={activeUrl}
          alt={`${method.name} logo`}
          className="w-full h-full object-contain rounded-[6px]"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setUrlIdx((prev) => prev + 1)}
        />
      </div>
    );
  }

  return (
    <div
      className={`preserve-white ${boxCls} flex items-center justify-center shadow-[0_6px_14px_rgba(15,23,42,0.22)] shrink-0 ${className}`}
      style={{
        background: method.bgStyle,
        border: method.ringStyle ?? '1px solid rgba(255,255,255,0.16)',
      }}
    >
      {renderGlyph()}
    </div>
  );
};
