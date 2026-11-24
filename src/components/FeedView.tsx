import React, { useState } from 'react';
import {
  ArrowLeft,
  MessageSquare,
  MessagesSquare,
  Newspaper,
  Send,
  TrendingUp,
  Trophy,
} from 'lucide-react';
import { AppState, MarketAsset } from '../types/trading';
import {
  DAILY_COMMUNITY_CHAT_LIMIT,
  getCommunityRemainingCount,
} from '../utils/chartPatterns';
import { t } from '../utils/i18n';

interface FeedViewProps {
  state: AppState;
  onBack?: () => void;
  onTradeAsset: (asset: MarketAsset) => void;
  onViewAllBets?: () => void;
  onAddComment: (newsId: string, text: string) => void;
  onSendCommunityMessage: (text: string) => { ok: boolean; error?: string };
}

type FeedTab = 'news' | 'community';
type NewsFilter = 'ALL' | 'STOCKS' | 'BETS' | 'BULLISH';

export const FeedView: React.FC<FeedViewProps> = ({
  state,
  onBack,
  onTradeAsset,
  onViewAllBets,
  onAddComment,
  onSendCommunityMessage,
}) => {
  const [activeTab, setActiveTab] = useState<FeedTab>('news');
  const [newsFilter, setNewsFilter] = useState<NewsFilter>('ALL');
  const [openThreadId, setOpenThreadId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [chatError, setChatError] = useState<string | null>(null);

  const lang = state.profile.language;
  const communityMessages = state.communityMessages ?? [];
  const remainingToday = getCommunityRemainingCount(state.communityChatUsage);
  const myUsername =
    state.profile.name.trim().replace(/\s+/g, '_') || 'Trader';

  const filteredNews = state.news.filter((item) => {
    if (newsFilter === 'ALL') return true;
    if (newsFilter === 'STOCKS') return item.topicKind !== 'bet';
    if (newsFilter === 'BETS') return item.topicKind === 'bet';
    return item.sentiment === 'BULLISH';
  });

  const handlePostComment = (newsId: string, e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    onAddComment(newsId, commentText.trim());
    setCommentText('');
  };

  const handleCommunitySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setChatError(null);
    const res = onSendCommunityMessage(chatInput);
    if (!res.ok) {
      setChatError(res.error ?? 'Unable to send message.');
      return;
    }
    setChatInput('');
  };

  return (
    <div className="space-y-5 animate-fade-up">
      {/* Top Bar + Two Top Switcher Buttons: News & Community */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label="Back to home"
              className="btn-press w-10 h-10 rounded-xl bg-[#15101f] border border-white/10 flex items-center justify-center text-white shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div>
            <h1 className="font-display text-xl font-extrabold text-white">
              {t(lang, 'pageFeed')}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {activeTab === 'news'
                ? 'Auto-publishing updates for all listed stocks & prediction bets'
                : 'Live trader discussion · Username only · 2 messages/day'}
            </p>
          </div>
        </div>

        <div
          className="inline-flex p-1 rounded-xl bg-[#15101f] border border-white/[0.08] self-start"
          role="tablist"
          aria-label="News and Community sections"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'news'}
            onClick={() => setActiveTab('news')}
            className={`btn-press min-h-[38px] px-4 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 ${
              activeTab === 'news'
                ? 'preserve-white bg-[#7c3aed] text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Newspaper className="w-3.5 h-3.5" />
            {t(lang, 'newsTab')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'community'}
            onClick={() => setActiveTab('community')}
            className={`btn-press min-h-[38px] px-4 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 ${
              activeTab === 'community'
                ? 'preserve-white bg-[#7c3aed] text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <MessagesSquare className="w-3.5 h-3.5" />
            {t(lang, 'communityTab')}
          </button>
        </div>
      </div>

      {/* TAB 1: AUTO-PUBLISHING STOCKS & BETS NEWS */}
      {activeTab === 'news' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex p-1 rounded-xl bg-[#15101f] border border-white/[0.08]">
              {(
                [
                  { id: 'ALL', label: 'All Updates' },
                  { id: 'STOCKS', label: 'Stocks' },
                  { id: 'BETS', label: 'Bets' },
                  { id: 'BULLISH', label: 'Bullish' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setNewsFilter(f.id)}
                  className={`btn-press min-h-[32px] px-3 rounded-lg text-xs font-semibold transition-colors ${
                    newsFilter === f.id
                      ? 'preserve-white bg-[#7c3aed] text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <span className="text-[11px] font-semibold text-emerald-400">
              Auto-publishing live · {state.news.length} stories
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredNews.map((item) => {
              const linkedAsset = state.assets.find((a) => a.id === item.assetId);
              const isBetStory = item.topicKind === 'bet' || Boolean(item.marketId);
              const isOpen = openThreadId === item.id;

              return (
                <article
                  key={item.id}
                  className="rounded-2xl bg-[#15101f] border border-white/[0.08] p-5 flex flex-col justify-between gap-4 animate-fade-up"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span
                        className={`font-bold ${
                          item.sentiment === 'BULLISH'
                            ? 'text-emerald-400'
                            : item.sentiment === 'BEARISH'
                            ? 'text-rose-400'
                            : 'text-[#a78bfa]'
                        }`}
                      >
                        {item.sentiment} · {isBetStory ? 'BET POOL' : 'STOCK'}
                      </span>
                      <span className="text-slate-400 font-mono-nums">
                        {item.ticker} · {item.date}
                      </span>
                    </div>

                    <h2 className="text-base font-bold text-white leading-snug">
                      {item.title}
                    </h2>
                    <p className="text-xs text-slate-300 leading-relaxed">{item.summary}</p>
                  </div>

                  <div className="space-y-3 pt-2 border-t border-white/[0.06]">
                    <div className="flex flex-wrap items-center gap-2">
                      {linkedAsset && (
                        <button
                          type="button"
                          onClick={() => onTradeAsset(linkedAsset)}
                          className="preserve-white btn-press min-h-[38px] px-3.5 rounded-xl bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-xs font-bold inline-flex items-center gap-1.5"
                        >
                          <TrendingUp className="w-3.5 h-3.5" />
                          Trade {linkedAsset.symbol}
                        </button>
                      )}
                      {isBetStory && onViewAllBets && (
                        <button
                          type="button"
                          onClick={onViewAllBets}
                          className="btn-press min-h-[38px] px-3.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-xs font-bold inline-flex items-center gap-1.5"
                        >
                          <Trophy className="w-3.5 h-3.5" />
                          Open Bet Pool
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setOpenThreadId(isOpen ? null : item.id)}
                        className="btn-press min-h-[38px] px-3.5 rounded-xl bg-[#1c1c2c] hover:bg-[#25253a] text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        Discuss ({item.comments.length})
                      </button>
                    </div>

                    {isOpen && (
                      <div className="pt-2 space-y-2.5">
                        {item.comments.map((c) => (
                          <div key={c.id} className="rounded-xl bg-[#191928] p-3 text-xs">
                            <div className="font-semibold text-slate-200 mb-0.5">
                              @{c.author}
                            </div>
                            <p className="text-slate-300">{c.text}</p>
                          </div>
                        ))}
                        <form onSubmit={(e) => handlePostComment(item.id, e)} className="flex gap-2">
                          <input
                            type="text"
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            placeholder="Add note..."
                            aria-label="Add market comment"
                            className="flex-1 min-w-0 h-10 px-3 rounded-xl bg-[#191928] border border-white/10 text-xs text-white focus:outline-none focus:border-[#7c3aed]"
                          />
                          <button
                            type="submit"
                            aria-label="Post comment"
                            className="preserve-white btn-press min-h-[40px] min-w-[40px] rounded-xl bg-[#7c3aed] text-white flex items-center justify-center"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>
                        </form>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: COMMUNITY CHAT (USERNAME ONLY + STRICT 2 MESSAGES / DAY LIMIT) */}
      {activeTab === 'community' && (
        <section className="rounded-[24px] bg-[#15101f] border border-white/[0.08] p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/[0.06]">
            <div>
              <h2 className="text-base font-bold text-white">{t(lang, 'communityChat')}</h2>
              <p className="text-xs text-slate-400">
                Anonymous chat — only usernames appear, no personal details shown
              </p>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold font-mono-nums ${
                remainingToday > 0
                  ? 'bg-[#7c3aed]/20 text-[#a78bfa]'
                  : 'bg-rose-500/20 text-rose-400'
              }`}
            >
              {remainingToday}/{DAILY_COMMUNITY_CHAT_LIMIT} left today
            </span>
          </div>

          {/* Messages Stream — Username & Message ONLY */}
          <div
            className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1"
            aria-label="Community chat messages"
          >
            {communityMessages.map((msg) => {
              const isMine = msg.username === myUsername;
              return (
                <div
                  key={msg.id}
                  className={`rounded-2xl px-4 py-3 border ${
                    isMine
                      ? 'bg-[#7c3aed]/15 border-[#7c3aed]/35'
                      : 'bg-[#0b0814] border-white/[0.06]'
                  }`}
                >
                  <div className="text-xs font-extrabold text-[#a78bfa] mb-1">
                    @{msg.username}
                  </div>
                  <p className="text-sm text-white leading-snug">{msg.text}</p>
                </div>
              );
            })}
          </div>

          {/* Chat Input (Enforces 2 messages/day limit) */}
          <form onSubmit={handleCommunitySubmit} className="space-y-2 pt-2 border-t border-white/[0.06]">
            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                disabled={remainingToday <= 0}
                maxLength={220}
                placeholder={
                  remainingToday > 0
                    ? `Message as @${myUsername} (${remainingToday} left today)...`
                    : 'Daily limit reached (2/2 sent today). Come back tomorrow.'
                }
                aria-label="Community chat message input"
                className="flex-1 min-w-0 h-11 px-3.5 rounded-xl bg-[#0b0814] border border-white/10 text-sm text-white placeholder:text-slate-400/70 focus:outline-none focus:border-[#7c3aed] disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={remainingToday <= 0 || !chatInput.trim()}
                aria-label="Send community message"
                className="preserve-white btn-press min-h-[44px] px-4 rounded-xl bg-[#7c3aed] hover:bg-[#6d28d9] disabled:opacity-45 text-white text-xs font-bold inline-flex items-center gap-1.5 shrink-0"
              >
                <Send className="w-4 h-4" />
                Send
              </button>
            </div>
            {chatError && <p className="text-xs text-rose-400 font-medium">{chatError}</p>}
          </form>
        </section>
      )}
    </div>
  );
};
