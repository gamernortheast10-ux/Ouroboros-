(function (win) {
  var params = new URLSearchParams(win.location.search || '');
  var initialBal = parseFloat(params.get('bal') || '0');
  var currentBalance = Number.isFinite(initialBal) && initialBal >= 0 ? Math.round(initialBal * 100) / 100 : 0;
  var cfg = {
    gameId: 'unknown',
    gameTitle: 'Ouroboros Game',
    onBalanceChange: null,
    onDenied: null,
  };
  var inIframe = false;
  try {
    inIframe = win.top !== win.self;
  } catch (e) {
    inIframe = true;
  }

  function roundMoney(v) {
    return Math.round((Number(v) || 0) * 100) / 100;
  }

  function makeTxId(kind) {
    return 'gtx-' + Date.now() + '-' + kind + '-' + Math.random().toString(36).slice(2, 7);
  }

  function postToParent(payload) {
    if (win.parent && win.parent !== win) {
      win.parent.postMessage(payload, win.location.origin);
    }
  }

  win.addEventListener('message', function (ev) {
    if (ev.origin !== win.location.origin) return;
    var data = ev.data;
    if (!data || typeof data !== 'object') return;
    if (data.type === 'OURO_WALLET_SYNC' && typeof data.balance === 'number') {
      currentBalance = roundMoney(Math.max(0, data.balance));
      if (typeof cfg.onBalanceChange === 'function') {
        cfg.onBalanceChange(currentBalance);
      }
    } else if (data.type === 'OURO_GAME_TX_DENIED') {
      if (typeof data.balance === 'number') {
        currentBalance = roundMoney(Math.max(0, data.balance));
        if (typeof cfg.onBalanceChange === 'function') {
          cfg.onBalanceChange(currentBalance);
        }
      }
      if (typeof cfg.onDenied === 'function') {
        cfg.onDenied(data.error || 'Insufficient wallet balance');
      }
    }
  });

  win.OuroBridge = {
    init: function (options) {
      options = options || {};
      cfg.gameId = options.gameId || cfg.gameId;
      cfg.gameTitle = options.gameTitle || cfg.gameTitle;
      cfg.onBalanceChange = options.onBalanceChange || null;
      cfg.onDenied = options.onDenied || null;
      postToParent({ type: 'OURO_WALLET_READY', gameId: cfg.gameId });
      if (typeof cfg.onBalanceChange === 'function') {
        cfg.onBalanceChange(currentBalance);
      }
      return currentBalance;
    },
    getBalance: function () {
      return currentBalance;
    },
    canAfford: function (amt) {
      var n = roundMoney(amt);
      return Number.isFinite(n) && n > 0 && n <= currentBalance + 1e-6;
    },
    bet: function (amt, meta) {
      var n = roundMoney(amt);
      if (!Number.isFinite(n) || n <= 0) return false;
      if (n > currentBalance + 1e-6) {
        return false;
      }
      currentBalance = roundMoney(Math.max(0, currentBalance - n));
      if (typeof cfg.onBalanceChange === 'function') {
        cfg.onBalanceChange(currentBalance);
      }
      postToParent({
        type: 'OURO_GAME_TX',
        txId: makeTxId('bet'),
        gameId: cfg.gameId,
        gameTitle: cfg.gameTitle,
        kind: 'bet',
        deltaInr: n,
        meta: meta || '',
      });
      return true;
    },
    win: function (payout, meta) {
      var n = roundMoney(payout);
      if (!Number.isFinite(n) || n <= 0) return;
      currentBalance = roundMoney(currentBalance + n);
      if (typeof cfg.onBalanceChange === 'function') {
        cfg.onBalanceChange(currentBalance);
      }
      postToParent({
        type: 'OURO_GAME_TX',
        txId: makeTxId('win'),
        gameId: cfg.gameId,
        gameTitle: cfg.gameTitle,
        kind: 'win',
        deltaInr: n,
        meta: meta || '',
      });
    },
    refund: function (amt, meta) {
      var n = roundMoney(amt);
      if (!Number.isFinite(n) || n <= 0) return;
      currentBalance = roundMoney(currentBalance + n);
      if (typeof cfg.onBalanceChange === 'function') {
        cfg.onBalanceChange(currentBalance);
      }
      postToParent({
        type: 'OURO_GAME_TX',
        txId: makeTxId('refund'),
        gameId: cfg.gameId,
        gameTitle: cfg.gameTitle,
        kind: 'refund',
        deltaInr: n,
        meta: meta || '',
      });
    },
    openTopUp: function () {
      postToParent({ type: 'OURO_OPEN_TOPUP', gameId: cfg.gameId });
    },
    isEmbedded: function () {
      return inIframe;
    },
  };
})(window);
