(function (win) {
  var params = new URLSearchParams(win.location.search || '');
  var initialBal = parseFloat(params.get('bal') || '0');
  var currentBalance =
    Number.isFinite(initialBal) && initialBal >= 0
      ? Math.round(initialBal * 100) / 100
      : 0;

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

  function fmtInr(v) {
    return (Number(v) || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function makeTxId(kind) {
    return 'gtx-' + Date.now() + '-' + kind + '-' + Math.random().toString(36).slice(2, 7);
  }

  function postToParent(payload) {
    if (win.parent && win.parent !== win) {
      win.parent.postMessage(payload, win.location.origin);
    }
  }

  // =========================================================
  // DISTINCT PER-GAME AUDIO ENGINE + WIN/LOSS STAGE ANIMATIONS
  // =========================================================
  var audioCtx = null;
  var fxMuted = false;
  var noiseBuffer = null;
  var stylesInjected = false;
  var stageEl = null;
  var activeBannerTimer = null;

  function ensureAudioCtx() {
    if (fxMuted) return null;
    if (!audioCtx) {
      var Ctx = win.AudioContext || win.webkitAudioContext;
      if (!Ctx) return null;
      audioCtx = new Ctx();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(function () {});
    }
    return audioCtx;
  }

  function getNoiseBuffer(ctx) {
    if (noiseBuffer && noiseBuffer.sampleRate === ctx.sampleRate) {
      return noiseBuffer;
    }
    var len = Math.floor(ctx.sampleRate * 0.6);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    noiseBuffer = buf;
    return buf;
  }

  function osc(ctx, freq, dur, type, vol, delay, endFreq, filterFreq) {
    if (!ctx || fxMuted) return;
    var t0 = ctx.currentTime + (delay || 0);
    var o = ctx.createOscillator();
    var g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(Math.max(20, freq), t0);
    if (endFreq && endFreq > 0) {
      o.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t0 + dur);
    }
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol || 0.08, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    if (filterFreq) {
      var flt = ctx.createBiquadFilter();
      flt.type = 'lowpass';
      flt.frequency.setValueAtTime(filterFreq, t0);
      o.connect(flt);
      flt.connect(g);
    } else {
      o.connect(g);
    }
    g.connect(ctx.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.025);
  }

  function noiseBurst(ctx, dur, filterType, freqStart, freqEnd, vol, delay) {
    if (!ctx || fxMuted) return;
    var t0 = ctx.currentTime + (delay || 0);
    var src = ctx.createBufferSource();
    src.buffer = getNoiseBuffer(ctx);
    var flt = ctx.createBiquadFilter();
    flt.type = filterType || 'bandpass';
    flt.frequency.setValueAtTime(freqStart || 1000, t0);
    if (freqEnd && freqEnd > 0) {
      flt.frequency.exponentialRampToValueAtTime(Math.max(30, freqEnd), t0 + dur);
    }
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol || 0.12, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(flt);
    flt.connect(g);
    g.connect(ctx.destination);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  var GAME_PROFILES = {
    aviator: {
      bet: function (c) {
        osc(c, 380, 0.06, 'triangle', 0.07, 0, 560);
      },
      step: function (c, o) {
        osc(c, 440 + ((o && o.pitchStep) || 0) * 40, 0.07, 'sine', 0.06);
      },
      win: function (c) {
        [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach(function (f, i) {
          osc(c, f, 0.19, i % 2 === 0 ? 'triangle' : 'sine', 0.09, i * 0.055);
        });
      },
      loss: function (c) {
        noiseBurst(c, 0.48, 'lowpass', 1400, 110, 0.24, 0);
        osc(c, 150, 0.42, 'sawtooth', 0.14, 0, 28, 340);
        osc(c, 92, 0.48, 'triangle', 0.14, 0.03, 24);
      },
    },
    'color-predict': {
      bet: function (c) {
        osc(c, 640, 0.06, 'sine', 0.06, 0, 880);
      },
      step: function (c, o) {
        osc(c, 500 + ((o && o.pitchStep) || 0) * 90, 0.08, 'triangle', 0.06);
      },
      win: function (c) {
        [587.33, 739.99, 880, 1174.66].forEach(function (f, i) {
          osc(c, f, 0.18, 'triangle', 0.08, i * 0.06);
          osc(c, f * 2, 0.12, 'sine', 0.03, i * 0.06 + 0.02);
        });
      },
      loss: function (c) {
        osc(c, 311.13, 0.14, 'triangle', 0.08, 0, 261.63);
        osc(c, 220, 0.24, 'sine', 0.08, 0.11, 146.83);
      },
    },
    'chicken-road': {
      bet: function (c) {
        osc(c, 360, 0.07, 'triangle', 0.08, 0, 540);
        osc(c, 580, 0.07, 'triangle', 0.06, 0.06, 760);
      },
      step: function (c, o) {
        var s = (o && o.pitchStep) || 0;
        osc(c, 420 + s * 45, 0.055, 'triangle', 0.07, 0, 620 + s * 45);
        osc(c, 690 + s * 45, 0.045, 'sine', 0.04, 0.04);
      },
      win: function (c) {
        [523.25, 659.25, 783.99, 987.77, 1046.5].forEach(function (f, i) {
          osc(c, f, 0.14, 'triangle', 0.08, i * 0.055);
        });
      },
      loss: function (c) {
        noiseBurst(c, 0.18, 'bandpass', 900, 240, 0.16, 0);
        osc(c, 260, 0.14, 'sawtooth', 0.09, 0, 95, 700);
        osc(c, 180, 0.25, 'square', 0.06, 0.1, 75, 450);
      },
    },
    'crypto-jackpot': {
      bet: function (c) {
        for (var i = 0; i < 4; i++) {
          osc(c, 280 + i * 95, 0.04, 'square', 0.035, i * 0.045, 0, 1200);
        }
      },
      step: function (c, o) {
        osc(c, 740 + ((o && o.pitchStep) || 0) * 60, 0.035, 'square', 0.035, 0, 0, 1400);
      },
      win: function (c) {
        [659.25, 830.61, 987.77, 1318.51, 1661.22].forEach(function (f, i) {
          osc(c, f, 0.16, 'square', 0.05, i * 0.05, 0, 2200);
          osc(c, f * 0.5, 0.18, 'triangle', 0.07, i * 0.05);
        });
      },
      loss: function (c) {
        osc(c, 195, 0.12, 'sawtooth', 0.07, 0, 130, 500);
        osc(c, 130, 0.22, 'triangle', 0.08, 0.09, 82);
      },
    },
    'trade-live': {
      bet: function (c) {
        osc(c, 880, 0.05, 'sine', 0.06, 0, 1046.5);
      },
      step: function (c) {
        osc(c, 987.77, 0.04, 'sine', 0.04);
      },
      win: function (c) {
        [739.99, 932.33, 1108.73, 1479.98].forEach(function (f, i) {
          osc(c, f, 0.16, 'sine', 0.08, i * 0.05);
        });
      },
      loss: function (c) {
        osc(c, 277.18, 0.13, 'triangle', 0.07, 0, 220);
        osc(c, 196, 0.22, 'sawtooth', 0.05, 0.1, 146.83, 520);
      },
    },
    mines: {
      bet: function (c) {
        osc(c, 540, 0.08, 'sine', 0.06, 0, 420);
      },
      step: function (c, o) {
        var s = Math.min(14, (o && o.pitchStep) || 0);
        var base = 680 + s * 65;
        osc(c, base, 0.09, 'sine', 0.075);
        osc(c, base * 1.5, 0.12, 'triangle', 0.045, 0.045);
      },
      win: function (c) {
        [783.99, 987.77, 1174.66, 1567.98].forEach(function (f, i) {
          osc(c, f, 0.18, 'sine', 0.08, i * 0.055);
          osc(c, f * 2, 0.14, 'sine', 0.025, i * 0.055 + 0.02);
        });
      },
      loss: function (c) {
        noiseBurst(c, 0.4, 'lowpass', 1200, 95, 0.22, 0);
        osc(c, 145, 0.35, 'sawtooth', 0.12, 0, 34, 320);
        osc(c, 85, 0.4, 'triangle', 0.12, 0.03, 28);
      },
    },
    plinko: {
      bet: function (c) {
        osc(c, 520, 0.06, 'triangle', 0.07, 0, 320);
      },
      step: function (c, o) {
        var notePool = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];
        var idx = Math.floor(Math.random() * notePool.length);
        var freq = (o && o.freq) || notePool[idx];
        osc(c, freq, 0.045, 'triangle', 0.045, 0, freq * 0.92);
      },
      win: function (c) {
        [659.25, 783.99, 1046.5, 1318.51].forEach(function (f, i) {
          osc(c, f, 0.16, 'triangle', 0.085, i * 0.05);
        });
      },
      loss: function (c) {
        osc(c, 220, 0.11, 'triangle', 0.07, 0, 145);
        osc(c, 140, 0.16, 'sine', 0.06, 0.08, 95);
      },
    },
    'dragon-tiger': {
      bet: function (c) {
        osc(c, 130, 0.12, 'triangle', 0.11, 0, 72);
        noiseBurst(c, 0.06, 'bandpass', 600, 300, 0.07, 0);
      },
      step: function (c) {
        noiseBurst(c, 0.05, 'highpass', 1800, 900, 0.07, 0);
        osc(c, 340, 0.05, 'triangle', 0.05);
      },
      win: function (c) {
        osc(c, 110, 0.25, 'triangle', 0.12, 0, 78);
        [440, 554.37, 659.25, 880].forEach(function (f, i) {
          osc(c, f, 0.22, 'sawtooth', 0.045, 0.04 + i * 0.065, 0, 1800);
        });
      },
      loss: function (c) {
        osc(c, 118, 0.42, 'triangle', 0.13, 0, 58);
        osc(c, 176, 0.36, 'sine', 0.08, 0.02, 86);
      },
    },
    'lucky-wheel': {
      bet: function (c) {
        osc(c, 480, 0.07, 'sine', 0.07, 0, 720);
      },
      step: function (c, o) {
        var f = 920 + (((o && o.pitchStep) || 0) % 4) * 55;
        noiseBurst(c, 0.018, 'bandpass', 2400, 1400, 0.06, 0);
        osc(c, f, 0.025, 'triangle', 0.04);
      },
      win: function (c) {
        [523.25, 659.25, 783.99, 987.77, 1318.51].forEach(function (f, i) {
          osc(c, f, 0.17, 'triangle', 0.08, i * 0.06);
        });
      },
      loss: function (c) {
        [349.23, 311.13, 277.18, 220].forEach(function (f, i) {
          osc(c, f, 0.13, 'sawtooth', 0.045, i * 0.08, f * 0.94, 720);
        });
      },
    },
    roulette: {
      bet: function (c) {
        osc(c, 1450, 0.035, 'sine', 0.05, 0, 980);
      },
      step: function (c, o) {
        var s = (o && o.pitchStep) || 0;
        osc(c, 1280 + (s % 5) * 85, 0.022, 'sine', 0.045);
      },
      win: function (c) {
        [587.33, 739.99, 880, 1108.73, 1318.51].forEach(function (f, i) {
          osc(c, f, 0.22, 'sine', 0.075, i * 0.055);
        });
      },
      loss: function (c) {
        noiseBurst(c, 0.16, 'bandpass', 750, 320, 0.08, 0);
        osc(c, 165, 0.18, 'triangle', 0.07, 0.03, 105);
      },
    },
    hilo: {
      bet: function (c) {
        noiseBurst(c, 0.045, 'highpass', 1900, 1100, 0.08, 0);
      },
      step: function (c) {
        noiseBurst(c, 0.04, 'bandpass', 2100, 1200, 0.07, 0);
        osc(c, 420, 0.04, 'triangle', 0.04);
      },
      win: function (c) {
        [440, 554.37, 659.25, 830.61].forEach(function (f, i) {
          osc(c, f, 0.16, 'sine', 0.075, i * 0.055);
        });
      },
      loss: function (c) {
        osc(c, 260, 0.12, 'triangle', 0.08, 0, 150);
        osc(c, 140, 0.19, 'sawtooth', 0.055, 0.09, 82, 480);
      },
    },
    tower: {
      bet: function (c) {
        osc(c, 190, 0.09, 'triangle', 0.09, 0, 120);
      },
      step: function (c, o) {
        var fl = (o && o.pitchStep) || 1;
        osc(c, 330 + fl * 55, 0.08, 'triangle', 0.075);
        osc(c, 660 + fl * 55, 0.09, 'sine', 0.04, 0.04);
      },
      win: function (c) {
        [523.25, 783.99, 1046.5, 1318.51].forEach(function (f, i) {
          osc(c, f, 0.2, 'triangle', 0.08, i * 0.06);
        });
      },
      loss: function (c) {
        noiseBurst(c, 0.34, 'lowpass', 720, 95, 0.18, 0);
        osc(c, 135, 0.3, 'sawtooth', 0.09, 0, 42, 340);
      },
    },
    balloon: {
      bet: function (c) {
        osc(c, 280, 0.07, 'sine', 0.06, 0, 390);
      },
      step: function (c, o) {
        var p = Math.min(15, (o && o.pitchStep) || 1);
        var f = 190 + p * 38;
        noiseBurst(c, 0.08, 'bandpass', 900 + p * 80, 1500 + p * 90, 0.06, 0);
        osc(c, f, 0.09, 'sine', 0.06, 0, f + 70);
      },
      win: function (c) {
        [587.33, 739.99, 880, 1174.66].forEach(function (f, i) {
          osc(c, f, 0.16, 'triangle', 0.08, i * 0.055);
        });
      },
      loss: function (c) {
        noiseBurst(c, 0.14, 'highpass', 1600, 320, 0.24, 0);
        osc(c, 260, 0.12, 'sawtooth', 0.11, 0, 42, 650);
      },
    },
    stairs: {
      bet: function (c) {
        osc(c, 360, 0.07, 'sine', 0.07, 0, 480);
      },
      step: function (c, o) {
        var scale = [392, 440, 523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51];
        var idx = Math.min(scale.length - 1, Math.max(0, ((o && o.pitchStep) || 1) - 1));
        osc(c, scale[idx], 0.1, 'sine', 0.08);
        osc(c, scale[idx] * 2, 0.08, 'sine', 0.025, 0.03);
      },
      win: function (c) {
        [523.25, 659.25, 783.99, 1046.5, 1567.98].forEach(function (f, i) {
          osc(c, f, 0.18, 'sine', 0.075, i * 0.05);
        });
      },
      loss: function (c) {
        [440, 349.23, 261.63, 174.61, 110].forEach(function (f, i) {
          osc(c, f, 0.09, 'triangle', 0.07, i * 0.045);
        });
      },
    },
    treasure: {
      bet: function (c) {
        osc(c, 240, 0.08, 'triangle', 0.08, 0, 180);
        osc(c, 920, 0.04, 'square', 0.03, 0.05, 0, 1500);
      },
      step: function (c, o) {
        var s = (o && o.pitchStep) || 1;
        osc(c, 620 + s * 75, 0.09, 'sine', 0.07);
        osc(c, 1240 + s * 110, 0.12, 'triangle', 0.04, 0.04);
      },
      win: function (c) {
        [880, 1108.73, 1318.51, 1760, 2093].forEach(function (f, i) {
          osc(c, f, 0.16, 'sine', 0.065, i * 0.045);
        });
      },
      loss: function (c) {
        noiseBurst(c, 0.25, 'lowpass', 950, 120, 0.19, 0);
        osc(c, 150, 0.28, 'sawtooth', 0.11, 0, 48, 380);
      },
    },
    coinflip: {
      bet: function (c) {
        osc(c, 1950, 0.16, 'sine', 0.06, 0, 2250);
        osc(c, 2900, 0.12, 'sine', 0.03, 0.02);
      },
      step: function (c, o) {
        var f = 1750 + (((o && o.pitchStep) || 0) % 3) * 240;
        osc(c, f, 0.14, 'sine', 0.055);
      },
      win: function (c) {
        osc(c, 1318.51, 0.14, 'sine', 0.08, 0);
        osc(c, 1760, 0.16, 'sine', 0.08, 0.06);
        osc(c, 2093, 0.2, 'sine', 0.07, 0.12);
      },
      loss: function (c) {
        osc(c, 240, 0.12, 'triangle', 0.08, 0, 130);
        osc(c, 130, 0.18, 'sine', 0.07, 0.09, 85);
      },
    },
    rps: {
      bet: function (c) {
        osc(c, 330, 0.05, 'square', 0.045, 0, 440, 1400);
      },
      step: function (c) {
        osc(c, 280, 0.06, 'square', 0.045, 0, 160, 1200);
      },
      win: function (c) {
        [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) {
          osc(c, f, 0.12, 'square', 0.045, i * 0.06, 0, 2200);
        });
      },
      loss: function (c) {
        [392, 349.23, 311.13, 261.63].forEach(function (f, i) {
          osc(c, f, 0.11, 'square', 0.045, i * 0.07, 0, 1100);
        });
      },
    },
  };

  function getProfile() {
    return GAME_PROFILES[cfg.gameId] || GAME_PROFILES.aviator;
  }

  function injectFxStyles() {
    if (stylesInjected || !win.document || !win.document.head) return;
    stylesInjected = true;
    var style = win.document.createElement('style');
    style.id = 'ouro-fx-styles';
    style.textContent =
      '#ouro-fx-stage{position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden;display:flex;align-items:center;justify-content:center}' +
      '.ouro-fx-flash{position:absolute;inset:0;opacity:0;pointer-events:none}' +
      '.ouro-fx-flash.win{background:radial-gradient(circle at 50% 45%,rgba(16,185,129,.34),rgba(245,158,11,.16) 45%,transparent 75%);animation:ouroFlashWin .85s ease-out forwards}' +
      '.ouro-fx-flash.loss{background:radial-gradient(circle at 50% 45%,rgba(239,68,68,.38),rgba(185,28,28,.2) 48%,transparent 78%);animation:ouroFlashLoss .72s ease-out forwards}' +
      '.ouro-fx-banner{position:relative;padding:12px 22px;border-radius:18px;text-align:center;backdrop-filter:blur(10px);box-shadow:0 18px 45px rgba(0,0,0,.55);animation:ouroBannerPop 1.35s cubic-bezier(.16,1,.3,1) forwards;max-width:86vw}' +
      '.ouro-fx-banner.win{background:linear-gradient(135deg,rgba(6,78,59,.92),rgba(16,185,129,.88));border:1.5px solid rgba(110,231,183,.7);color:#ecfdf5}' +
      '.ouro-fx-banner.loss{background:linear-gradient(135deg,rgba(127,29,29,.92),rgba(220,38,38,.86));border:1.5px solid rgba(252,165,165,.7);color:#fef2f2}' +
      '.ouro-fx-kicker{font-size:10px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;opacity:.9;margin-bottom:2px}' +
      '.ouro-fx-amount{font-size:24px;font-weight:900;letter-spacing:-.02em;font-variant-numeric:tabular-nums;line-height:1.1}' +
      '.ouro-fx-sub{font-size:11px;font-weight:600;opacity:.9;margin-top:3px}' +
      '.ouro-fx-particle{position:absolute;left:50%;top:48%;border-radius:999px;will-change:transform,opacity;animation:ouroParticleBurst var(--dur,.95s) cubic-bezier(.15,.85,.25,1) forwards}' +
      '.ouro-stage-shake{animation:ouroStageShake .44s cubic-bezier(.36,.07,.19,.97) both}' +
      '.ouro-stage-win-pulse{animation:ouroStagePulse .5s ease-out both}' +
      '@keyframes ouroFlashWin{0%{opacity:0}18%{opacity:1}100%{opacity:0}}' +
      '@keyframes ouroFlashLoss{0%{opacity:0}15%{opacity:1}100%{opacity:0}}' +
      '@keyframes ouroBannerPop{0%{opacity:0;transform:translate3d(0,16px,0) scale(.84)}14%{opacity:1;transform:translate3d(0,0,0) scale(1.04)}24%{transform:translate3d(0,0,0) scale(1)}78%{opacity:1;transform:translate3d(0,-4px,0) scale(1)}100%{opacity:0;transform:translate3d(0,-18px,0) scale(.95)}}' +
      '@keyframes ouroParticleBurst{0%{opacity:1;transform:translate3d(0,0,0) scale(1) rotate(0deg)}100%{opacity:0;transform:translate3d(var(--tx,0px),var(--ty,-80px),0) scale(.35) rotate(var(--rot,180deg))}}' +
      '@keyframes ouroStageShake{0%,100%{transform:translate3d(0,0,0)}15%{transform:translate3d(-7px,2px,0)}30%{transform:translate3d(7px,-2px,0)}45%{transform:translate3d(-5px,1px,0)}60%{transform:translate3d(5px,-1px,0)}75%{transform:translate3d(-3px,0,0)}}' +
      '@keyframes ouroStagePulse{0%{transform:scale(1)}35%{transform:scale(1.012)}100%{transform:scale(1)}}';
    win.document.head.appendChild(style);
  }

  function ensureStage() {
    if (!win.document || !win.document.body) return null;
    injectFxStyles();
    if (!stageEl || !stageEl.parentNode) {
      stageEl = win.document.createElement('div');
      stageEl.id = 'ouro-fx-stage';
      stageEl.setAttribute('aria-hidden', 'true');
      win.document.body.appendChild(stageEl);
    }
    return stageEl;
  }

  function triggerBodyMotion(cls) {
    var target =
      win.document.getElementById('stage-container') ||
      win.document.getElementById('stage') ||
      win.document.querySelector('.game-wrap') ||
      win.document.querySelector('.shell') ||
      win.document.body;
    if (!target) return;
    target.classList.remove('ouro-stage-shake', 'ouro-stage-win-pulse');
    void target.offsetWidth;
    target.classList.add(cls);
    setTimeout(function () {
      target.classList.remove(cls);
    }, 520);
  }

  function spawnParticles(isWin, count) {
    var st = ensureStage();
    if (!st) return;
    var winColors = ['#34d399', '#fbbf24', '#a78bfa', '#38bdf8', '#ffffff'];
    var lossColors = ['#ef4444', '#f97316', '#fca5a5', '#991b1b'];
    var palette = isWin ? winColors : lossColors;
    for (var i = 0; i < count; i++) {
      var p = win.document.createElement('span');
      p.className = 'ouro-fx-particle';
      var angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.45;
      var dist = (isWin ? 75 : 55) + Math.random() * (isWin ? 140 : 95);
      var tx = Math.cos(angle) * dist;
      var ty = Math.sin(angle) * dist + (isWin ? -25 : 18);
      var size = (isWin ? 5 : 4) + Math.random() * 5;
      p.style.width = size + 'px';
      p.style.height = (isWin && i % 3 === 0 ? size * 1.6 : size) + 'px';
      p.style.background = palette[i % palette.length];
      p.style.setProperty('--tx', tx.toFixed(1) + 'px');
      p.style.setProperty('--ty', ty.toFixed(1) + 'px');
      p.style.setProperty('--rot', Math.round((Math.random() - 0.5) * 360) + 'deg');
      p.style.setProperty('--dur', (0.65 + Math.random() * 0.45).toFixed(2) + 's');
      st.appendChild(p);
      (function (el) {
        setTimeout(function () {
          if (el.parentNode) el.parentNode.removeChild(el);
        }, 1200);
      })(p);
    }
  }

  function showStageBanner(kind, amountOrLabel, subtitle) {
    var st = ensureStage();
    if (!st) return;
    if (activeBannerTimer) {
      clearTimeout(activeBannerTimer);
      activeBannerTimer = null;
    }
    st.innerHTML = '';

    var flash = win.document.createElement('div');
    flash.className = 'ouro-fx-flash ' + kind;
    st.appendChild(flash);

    spawnParticles(kind === 'win', kind === 'win' ? 24 : 14);
    triggerBodyMotion(kind === 'win' ? 'ouro-stage-win-pulse' : 'ouro-stage-shake');

    var banner = win.document.createElement('div');
    banner.className = 'ouro-fx-banner ' + kind;

    var numericAmt = typeof amountOrLabel === 'number' ? amountOrLabel : NaN;
    var mainText = Number.isFinite(numericAmt)
      ? (kind === 'win' ? '+₹' : '-₹') + fmtInr(Math.abs(numericAmt))
      : String(amountOrLabel || (kind === 'win' ? 'WINNER!' : 'ROUND LOST'));

    var kicker = kind === 'win' ? 'WIN CREDITED' : 'BUST / LOSS';
    banner.innerHTML =
      '<div class="ouro-fx-kicker">' +
      kicker +
      '</div>' +
      '<div class="ouro-fx-amount">' +
      mainText +
      '</div>' +
      (subtitle ? '<div class="ouro-fx-sub">' + String(subtitle) + '</div>' : '');

    st.appendChild(banner);
    activeBannerTimer = setTimeout(function () {
      if (st) st.innerHTML = '';
    }, 1450);
  }

  var fxApi = {
    play: function (eventName, opts) {
      if (fxMuted) return;
      var c = ensureAudioCtx();
      if (!c) return;
      var prof = getProfile();
      var key = eventName === 'bigwin' ? 'win' : eventName;
      if (key === 'crash') key = 'loss';
      var fn = prof[key] || prof.step;
      if (typeof fn === 'function') {
        try {
          fn(c, opts || {});
        } catch (e) {}
      }
    },
    showWin: function (amountOrLabel, subtitle) {
      showStageBanner('win', amountOrLabel, subtitle);
    },
    showLoss: function (amountOrLabel, subtitle) {
      showStageBanner('loss', amountOrLabel, subtitle);
    },
    setMuted: function (muted) {
      fxMuted = Boolean(muted);
    },
    isMuted: function () {
      return fxMuted;
    },
  };

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
    bet: function (amt, meta, opts) {
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
      if (!opts || !opts.silentFx) {
        fxApi.play('bet', { stake: n });
      }
      return true;
    },
    win: function (payout, meta, opts) {
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
      if (!opts || !opts.silentFx) {
        fxApi.play('win', { payout: n });
      }
      if (!opts || !opts.skipVisual) {
        fxApi.showWin(n, meta || cfg.gameTitle);
      }
    },
    loss: function (stakeOrLabel, meta, opts) {
      if (!opts || !opts.silentFx) {
        fxApi.play('loss', { stake: stakeOrLabel });
      }
      if (!opts || !opts.skipVisual) {
        fxApi.showLoss(stakeOrLabel, meta || cfg.gameTitle);
      }
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
    setMuted: function (muted) {
      fxApi.setMuted(muted);
    },
    isMuted: function () {
      return fxApi.isMuted();
    },
    fx: fxApi,
    openTopUp: function () {
      postToParent({ type: 'OURO_OPEN_TOPUP', gameId: cfg.gameId });
    },
    isEmbedded: function () {
      return inIframe;
    },
  };
})(window);
