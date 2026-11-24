export type NotificationIconKey =
  | 'deposit'
  | 'withdraw'
  | 'check'
  | 'close'
  | 'clock'
  | 'news'
  | 'win'
  | 'trade'
  | 'refund'
  | 'alert'
  | 'system';

export type NotificationStyle =
  | 'success'
  | 'error'
  | 'warning'
  | 'info'
  | 'news'
  | 'money'
  | 'cyan';

export type NotificationRoute =
  | 'wallet'
  | 'markets'
  | 'trade'
  | 'portfolio'
  | 'news'
  | 'system';

export type NotificationTemplateKey =
  | 'deposit_ok'
  | 'deposit_pending'
  | 'deposit_fail'
  | 'withdraw_ok'
  | 'withdraw_pending'
  | 'withdraw_fail'
  | 'bet_ok'
  | 'bet_fail'
  | 'trade_ok'
  | 'trade_win'
  | 'refund'
  | 'news'
  | 'price'
  | 'system';

export interface AppNotification {
  id: string;
  title: string;
  msg: string;
  icon: NotificationIconKey;
  style: NotificationStyle;
  sound: NotificationStyle | 'system';
  route: NotificationRoute;
  createdAt: number;
  read: boolean;
}
