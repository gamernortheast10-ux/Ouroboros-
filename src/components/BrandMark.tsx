import React, { useId } from 'react';
import { MarketAsset } from '../types/trading';

export const OuroborosLogo: React.FC<{ className?: string }> = ({ className = 'w-8 h-8' }) => {
  return (
    <img
      src="/assets/ouroboros-emblem.png"
      alt="Ouroboros"
      className={`${className} object-contain select-none`}
      draggable={false}
    />
  );
};

export const AssetBadge: React.FC<{ asset: Pick<MarketAsset, 'id' | 'symbol' | 'brandColor' | 'brandText' | 'brandGlyph'>; size?: 'sm' | 'md' | 'lg' }> = ({
  asset,
  size = 'md',
}) => {
  const sizeClass =
    size === 'lg' ? 'w-12 h-12 text-sm rounded-2xl' : size === 'sm' ? 'w-9 h-9 text-xs rounded-xl' : 'w-11 h-11 text-xs rounded-xl';

  if (asset.id === 'apple') {
    return (
      <div
        className={`${sizeClass} bg-white text-neutral-950 flex items-center justify-center shrink-0 font-bold shadow-sm`}
        aria-hidden="true"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
        </svg>
      </div>
    );
  }

  return (
    <div
      className={`${sizeClass} flex items-center justify-center shrink-0 font-extrabold tracking-tight border border-white/10`}
      style={{ backgroundColor: asset.brandColor, color: asset.brandText }}
      aria-hidden="true"
    >
      {asset.brandGlyph}
    </div>
  );
};

export const AnimatedEarthIcon: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => {
  const uid = useId().replace(/:/g, '');
  const gradId = `earthGrad-${uid}`;

  return (
    <svg className={`${className} animate-earth-float`} viewBox="0 0 36 36" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={gradId} x1="4" y1="4" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="55%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#818cf8" />
        </linearGradient>
      </defs>
      {/* Looping orbital ring */}
      <g className="animate-earth-orbit">
        <ellipse
          cx="18"
          cy="18"
          rx="15"
          ry="6"
          transform="rotate(-24 18 18)"
          stroke="rgba(255,255,255,0.45)"
          strokeWidth="1.25"
          strokeDasharray="3 3"
        />
        <circle cx="31" cy="12" r="2.2" fill="#34d399" />
      </g>
      {/* Globe sphere */}
      <circle cx="18" cy="18" r="10.5" fill={`url(#${gradId})`} fillOpacity="0.24" stroke="#a5f3fc" strokeWidth="1.6" />
      <ellipse cx="18" cy="18" rx="4.8" ry="10.5" stroke="#a5f3fc" strokeWidth="1.2" strokeOpacity="0.85" />
      <path d="M8 15.2H28M8.5 21H27.5" stroke="#a5f3fc" strokeWidth="1.2" strokeOpacity="0.75" />
    </svg>
  );
};

export const AnimatedBetsIcon: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => {
  return (
    <svg className={className} viewBox="0 0 36 36" fill="none" aria-hidden="true">
      <circle
        cx="18"
        cy="18"
        r="12"
        stroke="#fbbf24"
        strokeWidth="1.6"
        className="animate-bet-radar"
      />
      <circle cx="18" cy="18" r="9.5" fill="rgba(251, 191, 36, 0.14)" stroke="#fcd34d" strokeWidth="1.5" />
      <circle cx="18" cy="18" r="5" stroke="#fde68a" strokeWidth="1.4" />
      <circle cx="18" cy="18" r="2.2" fill="#f59e0b" />
    </svg>
  );
};

export type PaymentMethodType = 'upi' | 'bank' | 'crypto' | 'usdt' | 'coming_soon';

const UpiOfficialBadge: React.FC<{ className: string }> = ({ className }) => (
  <span
    className={`preserve-white ${className} rounded-lg bg-white border border-slate-200/85 flex items-center justify-center overflow-hidden p-0.5 shadow-sm`}
    aria-hidden="true"
  >
    <svg viewBox="0 0 36 28" className="w-full h-full" fill="none">
      <text
        x="3"
        y="17.5"
        fill="#334155"
        fontSize="10.5"
        fontWeight="900"
        fontStyle="italic"
        fontFamily="system-ui, sans-serif"
        letterSpacing="-0.4"
      >
        UPI
      </text>
      <path d="M23.5 6.5L29.5 14L23.5 21.5L25.8 14L23.5 6.5Z" fill="#f97316" />
      <path d="M27.8 6.5L33.8 14L27.8 21.5L30.1 14L27.8 6.5Z" fill="#138808" />
    </svg>
  </span>
);

export const PaymentLogo: React.FC<{ type: PaymentMethodType; className?: string }> = ({
  type,
  className = 'w-5 h-5',
}) => {
  if (type === 'upi') {
    return <UpiOfficialBadge className={className} />;
  }
  if (type === 'bank') {
    return (
      <span className={`preserve-white ${className} rounded-lg bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] flex items-center justify-center shadow-sm`}>
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 3.5L20 7.8H4L12 3.5Z" fill="#ffffff" />
          <path d="M6.8 10V16.5M10.3 10V16.5M13.7 10V16.5M17.2 10V16.5" stroke="#dbeafe" strokeWidth="1.9" strokeLinecap="round" />
          <path d="M4.5 19.2H19.5" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </span>
    );
  }
  if (type === 'crypto') {
    return (
      <svg className={className} viewBox="0 0 28 28" fill="none" aria-hidden="true">
        <rect width="28" height="28" rx="8" fill="rgba(245,158,11,0.14)" />
        <path d="M14 5.5L20 14L14 17.5L8 14L14 5.5Z" fill="#fbbf24" />
        <path d="M14 18.8L20 15.2L14 22.8L8 15.2L14 18.8Z" fill="#d97706" />
      </svg>
    );
  }
  if (type === 'usdt') {
    return (
      <svg className={className} viewBox="0 0 28 28" fill="none" aria-hidden="true">
        <rect width="28" height="28" rx="8" fill="rgba(16,185,129,0.16)" />
        <circle cx="14" cy="14" r="8.5" fill="#26A17B" />
        <path
          d="M10 10.5H18M14 10.5V18.5M10.5 13.8C10.5 14.7 12.1 15.3 14 15.3C15.9 15.3 17.5 14.7 17.5 13.8"
          stroke="white"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg className={className} viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <rect width="28" height="28" rx="8" fill="rgba(167,139,250,0.16)" />
      {/* Card body */}
      <rect x="5" y="8" width="18" height="12.5" rx="3" fill="#6d28d9" stroke="#c4b5fd" strokeWidth="1.3" />
      {/* Card magnetic stripe / chip */}
      <path d="M5.5 12H22.5" stroke="#ddd6fe" strokeWidth="1.8" />
      <rect x="7.5" y="14.5" width="4" height="3" rx="0.8" fill="#fbbf24" />
      {/* Contactless waves */}
      <path d="M17.5 14.7C18.3 15.4 18.3 16.6 17.5 17.3" stroke="#34d399" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M19.5 13.7C20.8 14.9 20.8 17.1 19.5 18.3" stroke="#34d399" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
};

export type SecurityFeatureType = 'encrypted' | 'anonymous' | 'execution' | 'settlements';

export const SecurityFeatureIcon: React.FC<{
  type: SecurityFeatureType;
  className?: string;
}> = ({ type, className = 'w-9 h-9' }) => {
  const uid = useId().replace(/:/g, '');

  if (type === 'encrypted') {
    const g = `secEnc-${uid}`;
    return (
      <svg className={className} viewBox="0 0 36 36" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id={g} x1="4" y1="4" x2="32" y2="32" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#a78bfa" />
            <stop offset="100%" stopColor="#6d28d9" />
          </linearGradient>
        </defs>
        <rect width="36" height="36" rx="11" fill="rgba(124, 58, 237, 0.22)" />
        <rect x="0.6" y="0.6" width="34.8" height="34.8" rx="10.4" stroke="rgba(167, 139, 250, 0.32)" strokeWidth="1.2" />
        {/* Vault shield + lock */}
        <path
          d="M18 7L26.5 10.6V17.4C26.5 22.8 22.8 27.3 18 29C13.2 27.3 9.5 22.8 9.5 17.4V10.6L18 7Z"
          fill={`url(#${g})`}
          fillOpacity="0.28"
          stroke="#c4b5fd"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <rect x="14" y="16.5" width="8" height="6.2" rx="1.6" fill="#ede9fe" />
        <path d="M15.6 16.5V14.7C15.6 13.3 16.7 12.2 18 12.2C19.3 12.2 20.4 13.3 20.4 14.7V16.5" stroke="#ede9fe" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="18" cy="19.6" r="1" fill="#5b21b6" />
      </svg>
    );
  }

  if (type === 'anonymous') {
    const g = `secAnon-${uid}`;
    return (
      <svg className={className} viewBox="0 0 36 36" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id={g} x1="4" y1="4" x2="32" y2="32" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#c084fc" />
            <stop offset="100%" stopColor="#4f46e5" />
          </linearGradient>
        </defs>
        <rect width="36" height="36" rx="11" fill="rgba(139, 92, 246, 0.22)" />
        <rect x="0.6" y="0.6" width="34.8" height="34.8" rx="10.4" stroke="rgba(192, 132, 252, 0.34)" strokeWidth="1.2" />
        {/* Incognito stealth hood & visor */}
        <path
          d="M11.5 14.8L14.2 9.8C14.6 9.1 15.3 8.8 16.1 9L18 9.5L19.9 9C20.7 8.8 21.4 9.1 21.8 9.8L24.5 14.8"
          fill={`url(#${g})`}
          fillOpacity="0.45"
          stroke="#e9d5ff"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path d="M8.5 16H27.5" stroke="#e9d5ff" strokeWidth="1.7" strokeLinecap="round" />
        <circle cx="13.8" cy="21.5" r="3.1" fill="#1e1b4b" stroke="#c4b5fd" strokeWidth="1.5" />
        <circle cx="22.2" cy="21.5" r="3.1" fill="#1e1b4b" stroke="#c4b5fd" strokeWidth="1.5" />
        <path d="M16.9 21.5H19.1" stroke="#c4b5fd" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }

  if (type === 'execution') {
    const g = `secExec-${uid}`;
    return (
      <svg className={className} viewBox="0 0 36 36" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id={g} x1="6" y1="6" x2="30" y2="30" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>
        </defs>
        <rect width="36" height="36" rx="11" fill="rgba(16, 185, 129, 0.18)" />
        <rect x="0.6" y="0.6" width="34.8" height="34.8" rx="10.4" stroke="rgba(52, 211, 153, 0.32)" strokeWidth="1.2" />
        {/* Precision execution candlestick & upward trajectory */}
        <path d="M11.5 11V25" stroke="#6ee7b7" strokeWidth="1.5" strokeLinecap="round" />
        <rect x="9.5" y="14.5" width="4" height="6.5" rx="1.2" fill={`url(#${g})`} />
        <path d="M18 9V24" stroke="#6ee7b7" strokeWidth="1.5" strokeLinecap="round" />
        <rect x="16" y="11.5" width="4" height="8" rx="1.2" fill={`url(#${g})`} />
        <path d="M24.5 8.5V22.5" stroke="#a7f3d0" strokeWidth="1.5" strokeLinecap="round" />
        <rect x="22.5" y="10" width="4" height="7" rx="1.2" fill="#d1fae5" />
      </svg>
    );
  }

  const g = `secSettle-${uid}`;
  return (
    <svg className={className} viewBox="0 0 36 36" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={g} x1="6" y1="6" x2="30" y2="30" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#2dd4bf" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>
      </defs>
      <rect width="36" height="36" rx="11" fill="rgba(16, 185, 129, 0.18)" />
      <rect x="0.6" y="0.6" width="34.8" height="34.8" rx="10.4" stroke="rgba(45, 212, 191, 0.34)" strokeWidth="1.2" />
      {/* Instant INR clearing badge + directional instant arrows */}
      <circle cx="18" cy="18" r="9.2" fill={`url(#${g})`} fillOpacity="0.25" stroke="#5eead4" strokeWidth="1.5" />
      <path
        d="M14.8 13.5H21.2M14.8 16.4H20.8M15.4 13.5C17.4 13.5 18.8 14.4 18.8 16C18.8 17.6 17.3 18.7 15.2 18.7L19.6 23"
        stroke="#ecfdf5"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="26.5" cy="9.5" r="2.5" fill="#34d399" />
    </svg>
  );
};

export const QuickBankIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M12 3.2L20.5 7.6H3.5L12 3.2Z"
      fill="currentColor"
      fillOpacity="0.22"
      stroke="currentColor"
      strokeWidth="1.85"
      strokeLinejoin="round"
    />
    <path d="M6.2 10.5V16.8M10 10.5V16.8M14 10.5V16.8M17.8 10.5V16.8" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" />
    <path d="M3.5 19.6H20.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <circle cx="12" cy="6.2" r="0.9" fill="currentColor" />
  </svg>
);

export const QuickTradeIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M6.5 5.5V18.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    <rect x="4.5" y="9" width="4" height="6.2" rx="1" fill="currentColor" />
    <path d="M12 4.5V17.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    <rect x="10" y="7" width="4" height="5.5" rx="1" fill="currentColor" fillOpacity="0.55" stroke="currentColor" strokeWidth="1.4" />
    <path d="M17.5 4V15.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    <rect x="15.5" y="6.2" width="4" height="5.5" rx="1" fill="currentColor" />
    <path d="M4 20H20" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);

export const QuickBetsIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M7 4.5H17V10.2C17 13.1 14.8 15.2 12 15.2C9.2 15.2 7 13.1 7 10.2V4.5Z"
      fill="currentColor"
      fillOpacity="0.22"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
    <path d="M7 6.5H4.5C4.5 9.2 5.4 10.8 7 11.2M17 6.5H19.5C19.5 9.2 18.6 10.8 17 11.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    <path d="M12 15.2V19M8.5 19.8H15.5" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" />
  </svg>
);

export const QuickNewsIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect
      x="3.5"
      y="4.5"
      width="17"
      height="15"
      rx="3"
      fill="currentColor"
      fillOpacity="0.18"
      stroke="currentColor"
      strokeWidth="1.8"
    />
    <rect x="6.5" y="7.5" width="5.5" height="4.5" rx="1" fill="currentColor" />
    <path d="M14 8.2H17.5M14 11.2H17.5M6.5 15H17.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
  </svg>
);

export const QuickSupportAgentIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    {/* Head & shoulders helpline agent */}
    <circle cx="12" cy="9.8" r="3.4" fill="currentColor" fillOpacity="0.22" stroke="currentColor" strokeWidth="1.7" />
    <path
      d="M6.2 19.4C6.7 16.4 9.1 14.8 12 14.8C14.9 14.8 17.3 16.4 17.8 19.4"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
    {/* Over-ear headphones & boom mic */}
    <path
      d="M5.4 10.8V9.6C5.4 5.9 8.3 3.2 12 3.2C15.7 3.2 18.6 5.9 18.6 9.6V10.8"
      stroke="currentColor"
      strokeWidth="1.85"
      strokeLinecap="round"
    />
    <rect x="3.8" y="8.8" width="2.5" height="4.2" rx="1.2" fill="currentColor" />
    <rect x="17.7" y="8.8" width="2.5" height="4.2" rx="1.2" fill="currentColor" />
    <path d="M18.6 12.6C18.2 14.4 16.6 15.2 14.2 15.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="13.5" cy="15.2" r="1" fill="currentColor" />
  </svg>
);

export type BannerFeatureKind = 'welcome' | 'refer' | 'withdraw' | 'chart' | 'gift';

export const BannerTagBadgeIcon: React.FC<{ className?: string }> = ({ className = 'w-3.5 h-3.5' }) => {
  const uid = useId().replace(/:/g, '');
  const gradId = `bTag-${uid}`;
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={gradId} x1="2" y1="2" x2="14" y2="14" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
      </defs>
      <path
        d="M8 1.5L9.75 5.65L14.2 6.05L10.85 9L11.85 13.4L8 11.1L4.15 13.4L5.15 9L1.8 6.05L6.25 5.65L8 1.5Z"
        fill={`url(#${gradId})`}
      />
    </svg>
  );
};

export const BannerFeatureIcon: React.FC<{ kind: BannerFeatureKind; className?: string }> = ({
  kind,
  className = 'w-11 h-11',
}) => {
  const uid = useId().replace(/:/g, '');

  if (kind === 'welcome') {
    const bg = `bfWelBg-${uid}`;
    const fg = `bfWelFg-${uid}`;
    return (
      <svg className={className} viewBox="0 0 44 44" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id={bg} x1="2" y1="2" x2="42" y2="42" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="rgba(255,255,255,0.26)" />
            <stop offset="100%" stopColor="rgba(167,139,250,0.16)" />
          </linearGradient>
          <linearGradient id={fg} x1="11" y1="11" x2="34" y2="33" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#fde68a" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
        </defs>
        <rect x="0.75" y="0.75" width="42.5" height="42.5" rx="13" fill={`url(#${bg})`} stroke="rgba(255,255,255,0.28)" strokeWidth="1.5" />
        <rect x="10" y="13" width="24" height="18" rx="4.5" fill="#ede9fe" fillOpacity="0.92" />
        <path d="M10 18.5H34" stroke="#7c3aed" strokeWidth="2.4" />
        <rect x="24" y="20" width="11" height="7" rx="2.5" fill={`url(#${fg})`} stroke="#4c1d95" strokeWidth="1.2" />
        <circle cx="28.5" cy="23.5" r="1.4" fill="#4c1d95" />
        <circle cx="15.5" cy="25" r="2.2" fill="#7c3aed" fillOpacity="0.35" />
      </svg>
    );
  }

  if (kind === 'refer') {
    const bg = `bfRefBg-${uid}`;
    const coin = `bfRefCoin-${uid}`;
    return (
      <svg className={className} viewBox="0 0 44 44" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id={bg} x1="2" y1="2" x2="42" y2="42" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="rgba(255,255,255,0.25)" />
            <stop offset="100%" stopColor="rgba(192,132,252,0.18)" />
          </linearGradient>
          <linearGradient id={coin} x1="24" y1="9" x2="35" y2="20" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#6ee7b7" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
        </defs>
        <rect x="0.75" y="0.75" width="42.5" height="42.5" rx="13" fill={`url(#${bg})`} stroke="rgba(255,255,255,0.28)" strokeWidth="1.5" />
        <circle cx="17.5" cy="17.5" r="4.8" fill="#ffffff" fillOpacity="0.95" />
        <path d="M9.5 31C10.2 26.2 13.4 24 17.5 24C21.6 24 24.8 26.2 25.5 31" fill="#ede9fe" fillOpacity="0.92" />
        <circle cx="29.5" cy="14.5" r="5.5" fill={`url(#${coin})`} stroke="rgba(255,255,255,0.45)" strokeWidth="1.2" />
        <path d="M29.5 11.8V17.2M26.8 14.5H32.2" stroke="#ffffff" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M26 30.5C26.5 27.6 28.6 26.2 31.3 26.2C33.4 26.2 34.8 27.2 35.4 29.2" stroke="#ddd6fe" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    );
  }

  if (kind === 'withdraw') {
    const bg = `bfWdBg-${uid}`;
    const shield = `bfWdSh-${uid}`;
    return (
      <svg className={className} viewBox="0 0 44 44" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id={bg} x1="2" y1="2" x2="42" y2="42" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="rgba(52,211,153,0.24)" />
            <stop offset="100%" stopColor="rgba(99,102,241,0.2)" />
          </linearGradient>
          <linearGradient id={shield} x1="12" y1="9" x2="32" y2="35" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#6ee7b7" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
        </defs>
        <rect x="0.75" y="0.75" width="42.5" height="42.5" rx="13" fill={`url(#${bg})`} stroke="rgba(110,231,183,0.35)" strokeWidth="1.5" />
        <path
          d="M22 8.5L32.5 13V21.5C32.5 28.2 28 33.4 22 35.5C16 33.4 11.5 28.2 11.5 21.5V13L22 8.5Z"
          fill={`url(#${shield})`}
        />
        <path d="M17.2 21.8L20.5 25L27 18.5" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (kind === 'chart') {
    const bg = `bfChBg-${uid}`;
    const barUp = `bfChUp-${uid}`;
    return (
      <svg className={className} viewBox="0 0 44 44" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id={bg} x1="2" y1="2" x2="42" y2="42" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="rgba(167,139,250,0.28)" />
            <stop offset="100%" stopColor="rgba(79,70,229,0.2)" />
          </linearGradient>
          <linearGradient id={barUp} x1="14" y1="12" x2="32" y2="32" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
        </defs>
        <rect x="0.75" y="0.75" width="42.5" height="42.5" rx="13" fill={`url(#${bg})`} stroke="rgba(255,255,255,0.26)" strokeWidth="1.5" />
        <path d="M13 18V31" stroke="#c4b5fd" strokeWidth="1.8" strokeLinecap="round" />
        <rect x="10.5" y="21" width="5" height="7" rx="1.5" fill="#f43f5e" />
        <path d="M22 14V29" stroke="#a7f3d0" strokeWidth="1.8" strokeLinecap="round" />
        <rect x="19.5" y="16.5" width="5" height="9.5" rx="1.5" fill={`url(#${barUp})`} />
        <path d="M31 10V26" stroke="#d1fae5" strokeWidth="1.8" strokeLinecap="round" />
        <rect x="28.5" y="12.5" width="5" height="8.5" rx="1.5" fill={`url(#${barUp})`} />
      </svg>
    );
  }

  const bg = `bfGfBg-${uid}`;
  const ribbon = `bfGfRb-${uid}`;
  return (
    <svg className={className} viewBox="0 0 44 44" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={bg} x1="2" y1="2" x2="42" y2="42" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="rgba(255,255,255,0.26)" />
          <stop offset="100%" stopColor="rgba(168,85,247,0.2)" />
        </linearGradient>
        <linearGradient id={ribbon} x1="14" y1="11" x2="30" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
      </defs>
      <rect x="0.75" y="0.75" width="42.5" height="42.5" rx="13" fill={`url(#${bg})`} stroke="rgba(255,255,255,0.28)" strokeWidth="1.5" />
      <rect x="11" y="20" width="22" height="13" rx="3" fill="#ede9fe" fillOpacity="0.92" />
      <rect x="9.5" y="15.5" width="25" height="5.5" rx="2" fill="#ffffff" />
      <rect x="20" y="15.5" width="4" height="17.5" fill={`url(#${ribbon})`} />
      <path d="M22 15.5C19.5 11.2 14.2 10.6 14.2 13.5C14.2 15.6 19.2 15.5 22 15.5ZM22 15.5C24.5 11.2 29.8 10.6 29.8 13.5C29.8 15.6 24.8 15.5 22 15.5Z" fill={`url(#${ribbon})`} />
    </svg>
  );
};

export const ActivePositionsIcon: React.FC<{ className?: string }> = ({ className = 'w-7 h-7' }) => {
  const uid = useId().replace(/:/g, '');
  const gradId = `actPos-${uid}`;
  return (
    <svg className={className} viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={gradId} x1="3" y1="3" x2="25" y2="25" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#5b21b6" />
        </linearGradient>
      </defs>
      <rect width="28" height="28" rx="8" fill={`url(#${gradId})`} />
      <path d="M8 9V20" stroke="#e9d5ff" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="6.5" y="12" width="3" height="5" rx="1" fill="#f43f5e" />
      <path d="M14 7V19" stroke="#e9d5ff" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="12.5" y="9.5" width="3" height="6" rx="1" fill="#34d399" />
      <path d="M20 6V17" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="18.5" y="8" width="3" height="5.5" rx="1" fill="#6ee7b7" />
    </svg>
  );
};
