import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Gamepad2,
  Grid2x2,
  Play,
  Plus,
  RotateCw,
  Search,
  Wallet,
} from 'lucide-react';
import {
  GAME_CATEGORIES,
  GAMES_CATALOG,
  GameCatalogItem,
  GameCategory,
} from '../data/gamesCatalog';
import { BaseCurrency, FxRatesMap } from '../types/trading';
import { GameWalletTxParams, formatCurrency } from '../utils/tradingEngine';

interface GameBannerImageProps {
  game: GameCatalogItem;
  className?: string;
}

export const GameBannerArt: React.FC<GameBannerImageProps> = ({ game, className = '' }) => {
  const [imgFailed, setImgFailed] = useState(false);

  if (imgFailed) {
    return (
      <div
        className={`w-full h-full flex items-center justify-center p-3 text-center ${className}`}
        style={{ background: game.fallbackGradient }}
      >
        <Gamepad2 className="w-10 h-10 text-white/80" />
      </div>
    );
  }

  return (
    <img
      src={game.bannerImage}
      alt={game.title}
      draggable={false}
      referrerPolicy="no-referrer"
      onError={() => setImgFailed(true)}
      className={`w-full h-full object-cover ${className}`}
    />
  );
};

interface GamesViewProps {
  selectedGameId: string | null;
  balance: number;
  currency: BaseCurrency;
  fxRates?: FxRatesMap;
  onSelectGame: (gameId: string | null) => void;
  onBack: () => void;
  onOpenTopUp: () => void;
  onGameWalletTx: (
    params: GameWalletTxParams
  ) => { ok: true; balance: number } | { ok: false; error: string; balance: number };
}

export const GamesView: React.FC<GamesViewProps> = ({
  selectedGameId,
  balance,
  currency,
  fxRates,
  onSelectGame,
  onBack,
  onOpenTopUp,
  onGameWalletTx,
}) => {
  const [category, setCategory] = useState<GameCategory>('All');
  const [query, setQuery] = useState('');
  const [reloadNonce, setReloadNonce] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const latestBalanceRef = useRef(balance);
  const onGameWalletTxRef = useRef(onGameWalletTx);
  const onOpenTopUpRef = useRef(onOpenTopUp);

  latestBalanceRef.current = balance;
  onGameWalletTxRef.current = onGameWalletTx;
  onOpenTopUpRef.current = onOpenTopUp;

  const activeGame = useMemo(
    () => GAMES_CATALOG.find((g) => g.id === selectedGameId) ?? null,
    [selectedGameId]
  );

  // Remember the initial balance query param for current game load/restart
  const iframeSrc = useMemo(() => {
    if (!activeGame) return '';
    return `${activeGame.htmlPath}?bal=${encodeURIComponent(
      String(Math.round(latestBalanceRef.current * 100) / 100)
    )}&v=3`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGame?.id, reloadNonce]);

  const syncBalanceToIframe = (nextBal: number) => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.postMessage(
      { type: 'OURO_WALLET_SYNC', balance: Math.round(Math.max(0, nextBal) * 100) / 100 },
      window.location.origin
    );
  };

  useEffect(() => {
    syncBalanceToIframe(balance);
  }, [balance, selectedGameId]);

  useEffect(() => {
    const handleMessage = (ev: MessageEvent) => {
      if (ev.origin !== window.location.origin) return;
      const data = ev.data;
      if (!data || typeof data !== 'object') return;
      if (data.type === 'OURO_WALLET_READY') {
        syncBalanceToIframe(latestBalanceRef.current);
        return;
      }
      if (data.type === 'OURO_OPEN_TOPUP') {
        onOpenTopUpRef.current();
        return;
      }
      if (data.type === 'OURO_GAME_TX') {
        const kind = data.kind;
        const amountInr = Number(data.deltaInr);
        if (
          (kind !== 'bet' && kind !== 'win' && kind !== 'refund') ||
          !Number.isFinite(amountInr) ||
          amountInr <= 0
        ) {
          return;
        }
        const res = onGameWalletTxRef.current({
          txId: typeof data.txId === 'string' ? data.txId : undefined,
          gameId: typeof data.gameId === 'string' ? data.gameId : activeGame?.id || 'game',
          gameTitle:
            typeof data.gameTitle === 'string'
              ? data.gameTitle
              : activeGame?.title || 'Instant Game',
          kind,
          amountInr,
          meta: typeof data.meta === 'string' ? data.meta : undefined,
        });
        if (!res.ok) {
          iframeRef.current?.contentWindow?.postMessage(
            {
              type: 'OURO_GAME_TX_DENIED',
              balance: res.balance,
              error: res.error,
            },
            window.location.origin
          );
        } else {
          syncBalanceToIframe(res.balance);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [activeGame?.id, activeGame?.title]);

  const filteredGames = useMemo(() => {
    const q = query.trim().toLowerCase();
    return GAMES_CATALOG.filter((game) => {
      const catMatch = category === 'All' || game.category === category;
      const qMatch =
        !q ||
        game.title.toLowerCase().includes(q) ||
        game.tag.toLowerCase().includes(q) ||
        game.category.toLowerCase().includes(q);
      return catMatch && qMatch;
    });
  }, [category, query]);

  if (activeGame) {
    return (
      <div
        className="fixed inset-0 z-40 flex flex-col bg-[#080610]"
        role="region"
        aria-label={`${activeGame.title} game player`}
      >
        {/* Top Control Bar */}
        <header className="hero-preserve-dark shrink-0 h-[48px] sm:h-[54px] px-2.5 sm:px-6 bg-[#110d1c]/95 backdrop-blur-md border-b border-white/[0.08] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={onBack}
              aria-label="Back"
              className="btn-press min-h-[34px] min-w-[34px] px-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] border border-white/10 text-white inline-flex items-center justify-center gap-1.5 text-xs font-semibold shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back</span>
            </button>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg overflow-hidden border border-white/15 shrink-0">
              <GameBannerArt game={activeGame} />
            </div>
            <div className="min-w-0">
              <h1 className="text-xs sm:text-base font-extrabold text-white truncate leading-tight">
                {activeGame.title}
              </h1>
              <div className="text-[10px] text-[#c4b5fd] font-medium truncate leading-tight hidden sm:block">
                {activeGame.tag}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenTopUp}
              data-testid="game-header-wallet"
              title="Wallet balance · Tap to Top Up"
              className="btn-press min-h-[34px] pl-2.5 pr-1.5 rounded-xl bg-[#1b152d] hover:bg-[#251d3d] border border-[#8b5cf6]/35 text-white inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Wallet className="w-3.5 h-3.5 text-[#a78bfa] shrink-0" />
              <span className="font-mono-nums text-xs font-extrabold text-white">
                {formatCurrency(balance, currency, fxRates)}
              </span>
              <span className="w-5 h-5 rounded-lg bg-[#7c3aed] text-white inline-flex items-center justify-center shrink-0">
                <Plus className="w-3 h-3 stroke-[2.5]" />
              </span>
            </button>
            <button
              type="button"
              onClick={() => setReloadNonce((n) => n + 1)}
              aria-label="Restart game"
              title="Restart game"
              className="btn-press w-[34px] h-[34px] rounded-xl bg-white/[0.08] hover:bg-white/[0.15] border border-white/10 text-white flex items-center justify-center shrink-0"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onSelectGame(null)}
              aria-label="All Games"
              className="btn-press min-h-[34px] px-2.5 sm:px-3 rounded-xl bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Grid2x2 className="w-3.5 h-3.5" />
              <span className="hidden xs:inline sm:inline">All Games</span>
            </button>
          </div>
        </header>

        {/* Quick Game Switcher Strip (Desktop & Tablet) */}
        <div className="hero-preserve-dark hidden sm:block shrink-0 bg-[#0d0a17] border-b border-white/[0.06] px-6 py-2">
          <div className="max-w-5xl mx-auto flex items-center gap-2 overflow-x-auto no-scrollbar">
            {GAMES_CATALOG.map((g) => {
              const isCurrent = g.id === activeGame.id;
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => onSelectGame(g.id)}
                  className={`btn-press shrink-0 flex items-center gap-2 pl-1 pr-3 py-1 rounded-xl border text-xs font-semibold transition-all whitespace-nowrap ${
                    isCurrent
                      ? 'bg-[#7c3aed]/25 border-[#8b5cf6] text-white'
                      : 'bg-white/[0.04] border-white/[0.08] text-slate-300 hover:bg-white/[0.09] hover:text-white'
                  }`}
                >
                  <span className="w-6 h-6 rounded-lg overflow-hidden shrink-0">
                    <GameBannerArt game={g} />
                  </span>
                  <span>{g.title}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Playable HTML Stage (Desktop theater + Mobile full height) */}
        <div className="flex-1 min-h-0 flex items-center justify-center sm:p-4 bg-[radial-gradient(ellipse_at_top,rgba(124,58,237,0.18),transparent_65%)]">
          <div className="w-full max-w-[440px] h-full sm:max-h-[820px] sm:rounded-[24px] overflow-hidden sm:border sm:border-white/15 sm:shadow-[0_24px_60px_rgba(0,0,0,0.65)] bg-[#0b0e14]">
            <iframe
              ref={iframeRef}
              key={`${activeGame.id}-${reloadNonce}`}
              src={iframeSrc}
              title={activeGame.title}
              onLoad={() => syncBalanceToIframe(latestBalanceRef.current)}
              className="w-full h-full border-0 block"
              allow="autoplay"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-up">
      {/* Header Bar */}
      <section className="rounded-[22px] bg-[#15101f] border border-white/[0.08] p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              aria-label="Back to home"
              className="btn-press w-10 h-10 rounded-xl bg-[#191928] border border-white/10 flex items-center justify-center text-white shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="font-display text-lg sm:text-xl font-extrabold text-[#f1f5f9] flex items-center gap-2">
                <Gamepad2 className="w-5 h-5 text-[#a78bfa]" />
                <span>All Games</span>
              </h1>
              <p className="text-xs text-[#94a3b8]">
                {GAMES_CATALOG.length} instant interactive games connected to your wallet
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onOpenTopUp}
              className="btn-press h-10 px-3 rounded-xl bg-[#1b152d] hover:bg-[#241c3c] border border-[#8b5cf6]/35 text-white inline-flex items-center gap-1.5 shrink-0"
            >
              <Wallet className="w-3.5 h-3.5 text-[#a78bfa]" />
              <span className="font-mono-nums text-xs font-bold">
                {formatCurrency(balance, currency, fxRates)}
              </span>
            </button>
            <div className="relative flex-1 sm:w-56">
              <Search className="w-4 h-4 text-[#94a3b8] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search games..."
                aria-label="Search games"
                className="w-full h-10 pl-9 pr-3 rounded-xl bg-[#191928] border border-white/10 text-xs text-[#f1f5f9] placeholder:text-[#94a3b8] focus:outline-none focus:border-[#7c3aed]"
              />
            </div>
          </div>
        </div>

        {/* Category Filters */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
          {GAME_CATEGORIES.map((cat) => {
            const active = category === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`btn-press min-h-[36px] px-3.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                  active
                    ? 'preserve-white bg-[#7c3aed] text-white shadow-[0_4px_12px_rgba(124,58,237,0.35)]'
                    : 'bg-[#191928] border border-white/[0.08] text-[#94a3b8] hover:text-white'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </section>

      {/* Games Grid — Larger Spotlight Covers for Featured Titles */}
      {filteredGames.length === 0 ? (
        <div className="rounded-[20px] bg-[#15101f] border border-white/[0.08] py-12 text-center text-sm text-[#94a3b8]">
          No games found matching &ldquo;{query}&rdquo;.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-4">
          {filteredGames.map((game, idx) => {
            const isFeatured = Boolean(game.featured);
            return (
              <button
                key={game.id}
                type="button"
                onClick={() => onSelectGame(game.id)}
                style={{ animationDelay: `${Math.min(idx, 8) * 35}ms` }}
                className={`hero-preserve-dark group relative overflow-hidden border text-left transition-all hover:-translate-y-0.5 active:scale-[0.98] animate-fade-up ${
                  isFeatured
                    ? 'col-span-2 aspect-[16/10] sm:aspect-[16/9] rounded-[22px] border-[#8b5cf6]/50 hover:border-[#a78bfa] bg-[#130f1e] shadow-[0_14px_34px_rgba(124,58,237,0.22)]'
                    : 'aspect-square rounded-[20px] border-white/[0.1] hover:border-[#8b5cf6] bg-[#130f1e] shadow-[0_10px_26px_rgba(0,0,0,0.3)]'
                }`}
              >
                <GameBannerArt
                  game={game}
                  className="group-hover:scale-105 transition-transform duration-300"
                />
                <div
                  aria-hidden="true"
                  className={`absolute inset-0 ${
                    isFeatured
                      ? 'bg-gradient-to-t from-[#080510]/95 via-[#080510]/55 to-black/15'
                      : 'bg-gradient-to-t from-black/90 via-black/25 to-transparent'
                  }`}
                />
                <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 backdrop-blur-md border border-white/25 text-white flex items-center justify-center group-hover:bg-[#7c3aed] group-hover:border-[#a78bfa] transition-colors">
                  <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                </div>
                <div className={`absolute inset-x-0 bottom-0 ${isFeatured ? 'p-4' : 'p-3'}`}>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#c4b5fd] truncate">
                    {game.tag}
                  </div>
                  <div className="flex items-end justify-between gap-2 mt-0.5">
                    <div
                      className={`${
                        isFeatured ? 'text-base sm:text-lg' : 'text-sm sm:text-[15px]'
                      } font-extrabold text-white truncate leading-tight`}
                    >
                      {game.title}
                    </div>
                    {isFeatured && (
                      <span className="shrink-0 px-2.5 py-1 rounded-lg bg-[#7c3aed] text-white text-[10.5px] font-bold">
                        Play Now
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
