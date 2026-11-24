import React, { useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  Bell,
  CheckCircle2,
  Clock,
  FileText,
  RotateCcw,
  Settings,
  Trash2,
  TrendingUp,
  X,
  XCircle,
} from 'lucide-react';
import {
  AppNotification,
  NotificationIconKey,
  NotificationStyle,
  NotificationTemplateKey,
} from '../types/notifications';
import { formatRelativeTime, getUnreadCount } from '../utils/notifications';

interface NotificationCenterProps {
  open: boolean;
  notifications: AppNotification[];
  onClose: () => void;
  onMarkAllRead: () => void;
  onClearAll: () => void;
  onDeleteOne: (id: string) => void;
  onOpenItem: (item: AppNotification) => void;
  onTriggerDemo?: (key: NotificationTemplateKey) => void;
}

const STYLE_COLORS: Record<
  NotificationStyle,
  { bar: string; iconBg: string; iconColor: string }
> = {
  success: {
    bar: 'bg-[#22c55e]',
    iconBg: 'bg-[#22c55e]/15',
    iconColor: 'text-[#22c55e]',
  },
  error: {
    bar: 'bg-[#ef4444]',
    iconBg: 'bg-[#ef4444]/15',
    iconColor: 'text-[#ef4444]',
  },
  warning: {
    bar: 'bg-[#f97316]',
    iconBg: 'bg-[#f97316]/15',
    iconColor: 'text-[#f97316]',
  },
  info: {
    bar: 'bg-[#7c5cfc]',
    iconBg: 'bg-[#7c5cfc]/15',
    iconColor: 'text-[#9b7dff]',
  },
  news: {
    bar: 'bg-[#3b82f6]',
    iconBg: 'bg-[#3b82f6]/15',
    iconColor: 'text-[#3b82f6]',
  },
  money: {
    bar: 'bg-[#eab308]',
    iconBg: 'bg-[#eab308]/15',
    iconColor: 'text-[#eab308]',
  },
  cyan: {
    bar: 'bg-[#06b6d4]',
    iconBg: 'bg-[#06b6d4]/15',
    iconColor: 'text-[#06b6d4]',
  },
};

function renderNotifIcon(icon: NotificationIconKey) {
  switch (icon) {
    case 'deposit':
      return <ArrowDown className="w-5 h-5" />;
    case 'withdraw':
      return <ArrowUp className="w-5 h-5" />;
    case 'check':
      return <CheckCircle2 className="w-5 h-5" />;
    case 'close':
      return <XCircle className="w-5 h-5" />;
    case 'clock':
      return <Clock className="w-5 h-5" />;
    case 'news':
      return <FileText className="w-5 h-5" />;
    case 'win':
      return <TrendingUp className="w-5 h-5" />;
    case 'trade':
      return <BarChart3 className="w-5 h-5" />;
    case 'refund':
      return <RotateCcw className="w-5 h-5" />;
    case 'alert':
      return <Bell className="w-5 h-5" />;
    case 'system':
    default:
      return <Settings className="w-5 h-5" />;
  }
}

const SwipeableNotifCard: React.FC<{
  item: AppNotification;
  index: number;
  onDelete: (id: string) => void;
  onOpenItem: (item: AppNotification) => void;
}> = ({ item, index, onDelete, onOpenItem }) => {
  const [dragX, setDragX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [removing, setRemoving] = useState(false);
  const startXRef = useRef(0);
  const movedRef = useRef(false);

  const palette = STYLE_COLORS[item.style];

  const triggerRemove = () => {
    setRemoving(true);
    window.setTimeout(() => onDelete(item.id), 260);
  };

  const handlePointerStart = (clientX: number) => {
    startXRef.current = clientX;
    movedRef.current = false;
    setIsSwiping(true);
  };

  const handlePointerMove = (clientX: number) => {
    if (!isSwiping) return;
    const dx = clientX - startXRef.current;
    if (Math.abs(dx) > 6) movedRef.current = true;
    if (dx < 0) {
      const clamped = dx < -95 ? -95 + (dx + 95) * 0.25 : dx;
      setDragX(clamped);
    }
  };

  const handlePointerEnd = () => {
    if (!isSwiping) return;
    setIsSwiping(false);
    if (movedRef.current && dragX < -70) {
      triggerRemove();
    } else {
      setDragX(0);
    }
  };

  return (
    <div
      className={`relative mb-2.5 rounded-[18px] overflow-hidden bg-[#14141f] shadow-[0_2px_12px_rgba(0,0,0,0.25)] animate-notif-in transition-all duration-300 ${
        removing ? 'opacity-0 translate-x-full scale-95 !h-0 !mb-0' : ''
      }`}
      style={{ animationDelay: `${index * 30}ms` }}
    >
      {/* Left Unread Colored Strip */}
      {!item.read && (
        <span
          aria-hidden="true"
          className={`absolute left-0 top-0 bottom-0 w-[3.5px] z-20 ${palette.bar}`}
        />
      )}

      {/* Red Swipe-to-Delete Backdrop */}
      <div
        className={`absolute inset-0 bg-gradient-to-r from-transparent via-[#dc2626]/70 to-[#dc2626] flex items-center justify-end pr-5 text-white text-xs font-semibold transition-opacity ${
          isSwiping && dragX < -10 ? 'opacity-100' : 'opacity-0'
        }`}
        aria-hidden="true"
      >
        Delete
      </div>

      {/* Card Body */}
      <div
        onTouchStart={(e) => handlePointerStart(e.touches[0].clientX)}
        onTouchMove={(e) => handlePointerMove(e.touches[0].clientX)}
        onTouchEnd={handlePointerEnd}
        onMouseDown={(e) => handlePointerStart(e.clientX)}
        onMouseMove={(e) => handlePointerMove(e.clientX)}
        onMouseUp={handlePointerEnd}
        onMouseLeave={handlePointerEnd}
        style={{ transform: `translateX(${dragX}px)` }}
        className={`relative z-10 flex items-start gap-3.5 p-3.5 rounded-[18px] select-none bg-[#14141f] ${
          isSwiping ? '' : 'transition-transform duration-200'
        } ${
          item.read
            ? ''
            : 'ring-1 ring-[#7c5cfc]/25'
        }`}
      >
        <div
          className={`w-11 h-11 rounded-[13px] flex items-center justify-center shrink-0 ${palette.iconBg} ${palette.iconColor}`}
          aria-hidden="true"
        >
          {renderNotifIcon(item.icon)}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                if (!movedRef.current) onOpenItem(item);
              }}
              className="text-left flex-1 min-w-0"
            >
              <div className="text-[14px] font-semibold text-[#f0f0f5] flex items-center gap-2 leading-snug">
                {!item.read && (
                  <span
                    aria-hidden="true"
                    className="w-1.5 h-1.5 rounded-full bg-[#7c5cfc] shrink-0 shadow-[0_0_6px_rgba(124,92,252,0.7)]"
                  />
                )}
                <span className="truncate">{item.title}</span>
              </div>
              <p className="text-xs text-[#8b8ba0] leading-relaxed mt-0.5 line-clamp-2">
                {item.msg}
              </p>
            </button>

            <button
              type="button"
              onClick={triggerRemove}
              aria-label={`Delete ${item.title} notification`}
              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-white/5 transition-colors shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center justify-between mt-2">
            <span className="text-[11px] text-[#8b8ba0]/80 font-medium font-mono-nums">
              {formatRelativeTime(item.createdAt)}
            </span>
            <button
              type="button"
              onClick={() => onOpenItem(item)}
              className="text-[11px] font-semibold text-[#9b7dff] bg-[#7c5cfc]/15 hover:bg-[#7c5cfc]/25 px-2.5 py-0.5 rounded-full transition-colors"
            >
              Open →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  open,
  notifications,
  onClose,
  onMarkAllRead,
  onClearAll,
  onDeleteOne,
  onOpenItem,
}) => {
  const unread = getUnreadCount(notifications);

  return (
    <>
      {/* Slide-up Notification Panel Overlay (triggered by single header bell) */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-end md:items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="notifications-panel-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <div className="w-full max-w-[480px] bg-[#111118] border border-white/[0.08] rounded-t-3xl md:rounded-3xl max-h-[86vh] flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.45)] animate-notif-in">
            <div className="w-9 h-1 bg-white/15 rounded-full mx-auto mt-3 mb-1.5 md:hidden" />

            <div className="flex items-center justify-between gap-2 px-4 sm:px-5 py-3 border-b border-white/[0.07]">
              <div className="flex items-center gap-1.5 min-w-0">
                <h2 id="notifications-panel-title" className="text-[15px] sm:text-lg font-bold text-[#f0f0f5] whitespace-nowrap">
                  Notifications
                </h2>
                {unread > 0 && (
                  <span className="text-[11px] font-mono-nums font-semibold text-[#b8a2ff] bg-[#7c5cfc]/20 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                    {unread}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={onMarkAllRead}
                  className="bg-[#1a1a27] border border-white/[0.08] text-[#8b8ba0] hover:text-white text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors whitespace-nowrap"
                >
                  Mark read
                </button>
                <button
                  type="button"
                  onClick={onClearAll}
                  className="bg-[#1a1a27] border border-red-500/25 text-red-400 text-[11px] font-semibold px-2.5 py-1 rounded-full hover:bg-red-500/10 transition-colors whitespace-nowrap"
                >
                  Clear all
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close notifications"
                  className="w-7 h-7 rounded-full bg-[#1a1a27] border border-white/[0.08] text-[#8b8ba0] hover:text-white flex items-center justify-center transition-colors shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-3 pb-7">
              {notifications.length === 0 ? (
                <div className="text-center py-14 px-6 text-sm text-[#8b8ba0]">
                  No notifications yet
                </div>
              ) : (
                notifications.map((item, idx) => (
                  <SwipeableNotifCard
                    key={item.id}
                    item={item}
                    index={idx}
                    onDelete={onDeleteOne}
                    onOpenItem={onOpenItem}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
