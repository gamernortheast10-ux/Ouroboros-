import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  Phone,
  Ticket,
  User,
} from 'lucide-react';
import { ThemeMode } from '../types/trading';
import { BannerFeatureIcon, BannerTagBadgeIcon } from './BrandMark';

type AuthScreenMode = 'login' | 'signup' | 'forgot';

interface AuthViewProps {
  platformFeePct?: number;
  themeMode?: ThemeMode;
  signupsPaused?: boolean;
  maintenanceNotice?: string;
  onLogin: (params: {
    email: string;
    password: string;
    mobileNumber?: string;
  }) => { ok: boolean; error?: string };
  onSignup: (params: {
    name: string;
    email: string;
    password: string;
    mobileNumber?: string;
    referralCode?: string;
  }) => { ok: boolean; error?: string };
  onResetPassword: (params: {
    email: string;
    newPassword: string;
  }) => { ok: boolean; error?: string };
}

export const AuthView: React.FC<AuthViewProps> = ({
  platformFeePct = 5,
  themeMode = 'dark',
  signupsPaused = false,
  maintenanceNotice = '',
  onLogin,
  onSignup,
  onResetPassword,
}) => {
  const isLight = themeMode === 'light';
  const initialUrlRef = (() => {
    if (typeof window === 'undefined') return '';
    try {
      return (new URLSearchParams(window.location.search).get('ref') ?? '')
        .trim()
        .toUpperCase();
    } catch {
      return '';
    }
  })();
  const [authMode, setAuthMode] = useState<AuthScreenMode>(
    initialUrlRef ? 'signup' : 'login'
  );
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mobileNumber, setMobileNumber] = useState('');
  const [referralCode, setReferralCode] = useState(initialUrlRef);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [typingField, setTypingField] = useState<string | null>(null);

  const pulseTyping = (field: string) => {
    setTypingField(field);
    window.setTimeout(() => {
      setTypingField((curr) => (curr === field ? null : curr));
    }, 260);
  };

  const switchMode = (next: AuthScreenMode) => {
    setAuthMode(next);
    setError('');
    setSuccessMsg('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    if (authMode === 'forgot') {
      if (password.length < 6) {
        setError('New password must be at least 6 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
      const res = onResetPassword({ email: cleanEmail, newPassword: password });
      if (!res.ok) {
        setError(res.error ?? 'Could not reset password.');
        return;
      }
      setSuccessMsg('Password updated! You can now sign in with your new password.');
      setPassword('');
      setConfirmPassword('');
      setAuthMode('login');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (authMode === 'signup') {
      if (signupsPaused) {
        setError(
          maintenanceNotice.trim() ||
            'New registrations are temporarily paused by Owner Console.'
        );
        return;
      }
      if (!name.trim()) {
        setError('Please enter your display name.');
        return;
      }
      const res = onSignup({
        name: name.trim(),
        email: cleanEmail,
        password,
        mobileNumber: mobileNumber.trim() || undefined,
        referralCode: referralCode.trim().toUpperCase() || undefined,
      });
      if (!res.ok) {
        setError(res.error ?? 'Unable to create account.');
      }
      return;
    }

    const res = onLogin({
      email: cleanEmail,
      password,
      mobileNumber: mobileNumber.trim() || undefined,
    });
    if (!res.ok) {
      setError(res.error ?? 'Invalid email or password.');
    }
  };

  const inputShellClass = (field: string) =>
    `flex items-center gap-2.5 h-10.5 px-3 rounded-xl border transition-all ${
      isLight ? 'bg-[#f4f1fd]' : 'bg-[#181826]'
    } ${
      typingField === field
        ? 'border-[#8b5cf6] shadow-[0_0_0_3px_rgba(139,92,246,0.22)]'
        : isLight
        ? 'border-purple-200/90 focus-within:border-[#7c3aed]'
        : 'border-white/10 focus-within:border-[#8b5cf6]'
    }`;

  return (
    <div
      className={`min-h-screen flex flex-col items-center justify-start md:justify-center md:py-5 md:px-4 ${
        isLight ? 'bg-[#f3f1fa]' : 'bg-[#0b0814]'
      }`}
    >
      <div
        className={`w-full max-w-[460px] min-h-screen md:min-h-0 flex flex-col md:rounded-[30px] overflow-hidden shadow-[0_24px_70px_rgba(15,5,35,0.45)] border-0 md:border ${
          isLight ? 'md:border-purple-200/80' : 'md:border-white/10'
        }`}
      >
        {/* Top Compact Purple Hero with Fair P2P Trading Rules Highlight Banner */}
        <section
          className="hero-preserve-dark relative px-4 sm:px-6 pt-4 pb-6 overflow-hidden"
          style={{
            background:
              'linear-gradient(155deg, #240b4f 0%, #4c1d95 45%, #7c3aed 100%)',
          }}
        >
          <div aria-hidden="true" className="profile-header-shine" />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-14 -right-12 w-48 h-48 rounded-full"
            style={{
              background:
                'radial-gradient(circle, rgba(255,255,255,0.18) 0%, transparent 70%)',
            }}
          />

          {/* Top Logo + Switch Mode */}
          <div className="relative z-10 flex items-center justify-between gap-2 mb-3">
            <img
              src="/assets/ouroboros-logo.png"
              alt="Ouroboros"
              className="h-7 w-auto object-contain select-none"
              draggable={false}
            />

            {authMode !== 'forgot' ? (
              <button
                type="button"
                onClick={() => switchMode(authMode === 'login' ? 'signup' : 'login')}
                className="preserve-white btn-press inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 hover:bg-white/25 border border-white/20 text-xs font-bold text-white backdrop-blur-md whitespace-nowrap shrink-0"
              >
                <span>{authMode === 'login' ? 'Sign up' : 'Sign in'}</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="preserve-white btn-press inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 hover:bg-white/25 border border-white/20 text-xs font-bold text-white backdrop-blur-md whitespace-nowrap shrink-0"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Sign in</span>
              </button>
            )}
          </div>

          {/* Animated Fair P2P Trading Highlight Banner */}
          <div
            id="auth-p2p-banner"
            className="relative z-10 overflow-hidden rounded-2xl bg-white/[0.14] backdrop-blur-xl border border-white/25 px-3.5 py-3 shadow-[0_12px_30px_rgba(15,5,35,0.35)] mb-3.5"
          >
            <div aria-hidden="true" className="animate-wallet-sheen opacity-65" />
            <div className="relative z-10 flex items-center justify-between gap-2.5">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-emerald-200">
                  <BannerTagBadgeIcon className="w-3.5 h-3.5 shrink-0" />
                  <span>Peer-to-Peer Prediction Exchange</span>
                </div>
                <div className="text-sm sm:text-base font-extrabold text-white tracking-tight mt-0.5 leading-snug">
                  Fair UP vs DOWN Matching · Live Settlement
                </div>
                <div className="text-[11px] text-purple-100/90 mt-0.5 leading-tight flex items-center gap-1.5 flex-wrap">
                  <span>100% No-Match Refund</span>
                  <span>·</span>
                  <span>Transparent {platformFeePct}% Win Fee</span>
                </div>
              </div>
              <BannerFeatureIcon kind="chart" className="w-11 h-11 shrink-0" />
            </div>
          </div>

          <div className="relative z-10 text-center">
            <h1 className="font-display text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              {authMode === 'login'
                ? 'Welcome back'
                : authMode === 'signup'
                ? 'Create your account'
                : 'Reset password'}
            </h1>
            <p className="text-[11.5px] text-purple-100/85 mt-0.5">
              {authMode === 'login'
                ? 'Sign in with your registered email & password'
                : authMode === 'signup'
                ? 'Start peer-to-peer UP/DOWN trading on live assets'
                : 'Enter your email and choose a new password'}
            </p>
          </div>
        </section>

        {/* Bottom Compact Mobile-First Form Sheet */}
        <section
          className={`flex-1 -mt-3 rounded-t-[24px] px-4 sm:px-6 pt-4 pb-5 border-t ${
            isLight
              ? 'bg-white text-slate-900 border-purple-200/80'
              : 'bg-[#12121c] text-white border-white/10'
          }`}
        >
          {signupsPaused && authMode === 'signup' && (
            <div className="mb-3 rounded-xl bg-amber-500/15 border border-amber-500/35 px-3 py-2 text-xs font-semibold text-amber-400">
              {maintenanceNotice.trim() ||
                'New signups are temporarily paused by the Owner Desk.'}
            </div>
          )}

          {authMode !== 'forgot' && (
            <div
              role="tablist"
              aria-label="Authentication mode"
              className={`grid grid-cols-2 gap-1.5 p-1 rounded-2xl border mb-3.5 ${
                isLight
                  ? 'bg-[#f4f1fd] border-purple-200/80'
                  : 'bg-[#181826] border-white/10'
              }`}
            >
              <button
                type="button"
                role="tab"
                aria-selected={authMode === 'login'}
                onClick={() => switchMode('login')}
                className={`btn-press py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  authMode === 'login'
                    ? 'preserve-white bg-[#7c3aed] text-white shadow-sm'
                    : isLight
                    ? 'text-slate-600 hover:text-slate-900'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={authMode === 'signup'}
                onClick={() => switchMode('signup')}
                className={`btn-press py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  authMode === 'signup'
                    ? 'preserve-white bg-[#7c3aed] text-white shadow-sm'
                    : isLight
                    ? 'text-slate-600 hover:text-slate-900'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Create Account
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-2.5">
            {authMode === 'signup' && (
              <div>
                <label
                  htmlFor="auth-name"
                  className={`block text-[10.5px] font-bold uppercase tracking-wider mb-1 ${
                    isLight ? 'text-slate-600' : 'text-slate-400'
                  }`}
                >
                  Full Name
                </label>
                <div className={inputShellClass('name')}>
                  <User
                    className={`w-4 h-4 shrink-0 ${
                      isLight ? 'text-[#6d28d9]' : 'text-[#a78bfa]'
                    }`}
                  />
                  <input
                    id="auth-name"
                    type="text"
                    placeholder="e.g. Rohan Verma"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      pulseTyping('name');
                      setError('');
                    }}
                    className={`w-full bg-transparent text-sm placeholder:text-slate-500 focus:outline-none ${
                      isLight ? 'text-slate-900' : 'text-white'
                    }`}
                  />
                </div>
              </div>
            )}

            {/* Email Input */}
            <div>
              <label
                htmlFor="auth-email"
                className={`block text-[10.5px] font-bold uppercase tracking-wider mb-1 ${
                  isLight ? 'text-slate-600' : 'text-slate-400'
                }`}
              >
                Email Address
              </label>
              <div className={inputShellClass('email')}>
                <Mail
                  className={`w-4 h-4 shrink-0 ${
                    isLight ? 'text-[#6d28d9]' : 'text-[#a78bfa]'
                  }`}
                />
                <input
                  id="auth-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    pulseTyping('email');
                    setError('');
                  }}
                  className={`w-full bg-transparent text-sm placeholder:text-slate-500 focus:outline-none ${
                    isLight ? 'text-slate-900' : 'text-white'
                  }`}
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label
                  htmlFor="auth-password"
                  className={`text-[10.5px] font-bold uppercase tracking-wider ${
                    isLight ? 'text-slate-600' : 'text-slate-400'
                  }`}
                >
                  {authMode === 'forgot' ? 'New Password' : 'Password'}
                </label>
                {authMode === 'login' && (
                  <button
                    type="button"
                    onClick={() => switchMode('forgot')}
                    className={`text-[11px] font-bold hover:underline ${
                      isLight ? 'text-[#6d28d9]' : 'text-[#a78bfa]'
                    }`}
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className={inputShellClass('password')}>
                <Lock
                  className={`w-4 h-4 shrink-0 ${
                    isLight ? 'text-[#6d28d9]' : 'text-[#a78bfa]'
                  }`}
                />
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={
                    authMode === 'login' ? 'current-password' : 'new-password'
                  }
                  placeholder="Minimum 6 characters"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    pulseTyping('password');
                    setError('');
                  }}
                  className={`w-full bg-transparent text-sm placeholder:text-slate-500 focus:outline-none ${
                    isLight ? 'text-slate-900' : 'text-white'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className={`p-1 ${
                    isLight
                      ? 'text-slate-500 hover:text-slate-900'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Confirm Password (Forgot mode) */}
            {authMode === 'forgot' && (
              <div>
                <label
                  htmlFor="auth-confirm-password"
                  className={`block text-[10.5px] font-bold uppercase tracking-wider mb-1 ${
                    isLight ? 'text-slate-600' : 'text-slate-400'
                  }`}
                >
                  Confirm New Password
                </label>
                <div className={inputShellClass('confirm')}>
                  <KeyRound
                    className={`w-4 h-4 shrink-0 ${
                      isLight ? 'text-[#6d28d9]' : 'text-[#a78bfa]'
                    }`}
                  />
                  <input
                    id="auth-confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Re-enter password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      pulseTyping('confirm');
                      setError('');
                    }}
                    className={`w-full bg-transparent text-sm placeholder:text-slate-500 focus:outline-none ${
                      isLight ? 'text-slate-900' : 'text-white'
                    }`}
                  />
                </div>
              </div>
            )}

            {/* Mobile Number (Optional) */}
            {authMode !== 'forgot' && (
              <div className="pt-0.5">
                <label
                  htmlFor="auth-mobile"
                  className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${
                    isLight ? 'text-slate-600' : 'text-slate-400'
                  }`}
                >
                  Mobile Number{' '}
                  <span className="font-normal lowercase text-slate-500">
                    (optional)
                  </span>
                </label>
                <div className={inputShellClass('mobile')}>
                  <Phone
                    className={`w-3.5 h-3.5 shrink-0 ${
                      isLight ? 'text-[#6d28d9]' : 'text-[#a78bfa]'
                    }`}
                  />
                  <input
                    id="auth-mobile"
                    type="tel"
                    inputMode="tel"
                    placeholder="+91 98xxxx"
                    value={mobileNumber}
                    onChange={(e) => {
                      setMobileNumber(e.target.value);
                      pulseTyping('mobile');
                    }}
                    className={`w-full bg-transparent text-xs font-mono-nums placeholder:text-slate-500 focus:outline-none ${
                      isLight ? 'text-slate-900' : 'text-white'
                    }`}
                  />
                </div>
              </div>
            )}

            {/* Optional Referral Code on Signup */}
            {authMode === 'signup' && (
              <div className="pt-0.5">
                <label
                  htmlFor="auth-referral"
                  className={`block text-[10.5px] font-bold uppercase tracking-wider mb-1 ${
                    isLight ? 'text-slate-600' : 'text-slate-400'
                  }`}
                >
                  Invite / Referral Code{' '}
                  <span className="font-normal lowercase text-slate-500">
                    (optional · unlocks bonus on 1st bet)
                  </span>
                </label>
                <div className={inputShellClass('referral')}>
                  <Ticket
                    className={`w-3.5 h-3.5 shrink-0 ${
                      isLight ? 'text-[#6d28d9]' : 'text-[#a78bfa]'
                    }`}
                  />
                  <input
                    id="auth-referral"
                    type="text"
                    placeholder="e.g. OURO-AB12CD"
                    value={referralCode}
                    onChange={(e) => {
                      setReferralCode(e.target.value.toUpperCase());
                      pulseTyping('referral');
                      setError('');
                    }}
                    className={`w-full bg-transparent text-xs font-mono-nums uppercase tracking-wider placeholder:text-slate-500 focus:outline-none ${
                      isLight ? 'text-slate-900' : 'text-white'
                    }`}
                  />
                </div>
              </div>
            )}

            {error && (
              <p
                role="alert"
                className="text-xs text-rose-500 bg-rose-500/10 border border-rose-500/25 rounded-xl px-3 py-2"
              >
                {error}
              </p>
            )}

            {successMsg && (
              <p
                role="status"
                className="text-xs text-emerald-500 bg-emerald-500/10 border border-emerald-500/25 rounded-xl px-3 py-2"
              >
                {successMsg}
              </p>
            )}

            <button
              type="submit"
              className="preserve-white btn-press w-full min-h-[46px] rounded-xl text-white font-extrabold text-sm inline-flex items-center justify-center gap-2 shadow-[0_10px_28px_rgba(124,58,237,0.45)] whitespace-nowrap"
              style={{
                background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
              }}
            >
              <span>
                {authMode === 'login'
                  ? 'Sign in'
                  : authMode === 'signup'
                  ? 'Create account'
                  : 'Update Password'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {authMode !== 'forgot' && (
            <p
              className={`mt-3.5 text-center text-xs ${
                isLight ? 'text-slate-600' : 'text-slate-400'
              }`}
            >
              {authMode === 'login'
                ? "Don't have an account? "
                : 'Already have an account? '}
              <button
                type="button"
                onClick={() => switchMode(authMode === 'login' ? 'signup' : 'login')}
                className={`font-bold hover:underline ${
                  isLight ? 'text-[#6d28d9]' : 'text-[#a78bfa]'
                }`}
              >
                {authMode === 'login' ? 'Create account' : 'Sign in'}
              </button>
            </p>
          )}
        </section>
      </div>
    </div>
  );
};
