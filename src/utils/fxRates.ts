import { BaseCurrency, FxRatesMap } from '../types/trading';
import { DEFAULT_FX_RATES } from './tradingEngine';

const FX_CODES: BaseCurrency[] = ['INR', 'USD', 'JPY', 'EUR', 'GBP', 'AED', 'SGD', 'AUD'];

export async function fetchLiveFxRates(): Promise<{
  rates: FxRatesMap;
  updatedAt: string;
  source: 'live' | 'market-tick';
}> {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller ? window.setTimeout(() => controller.abort(), 4500) : null;

  try {
    const res = await fetch('https://open.er-api.com/v6/latest/INR', {
      signal: controller?.signal,
    });
    if (timeoutId) window.clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as {
      result?: string;
      rates?: Record<string, number>;
    };

    if (!data?.rates || typeof data.rates.USD !== 'number') {
      throw new Error('Malformed FX response');
    }

    const nextRates: FxRatesMap = { ...DEFAULT_FX_RATES };
    for (const code of FX_CODES) {
      const apiVal = data.rates[code];
      if (typeof apiVal === 'number' && Number.isFinite(apiVal) && apiVal > 0) {
        nextRates[code] = code === 'INR' ? 1 : apiVal;
      }
    }

    return {
      rates: nextRates,
      updatedAt: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      source: 'live',
    };
  } catch {
    if (timeoutId) window.clearTimeout(timeoutId);
    return {
      rates: { ...DEFAULT_FX_RATES },
      updatedAt: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      source: 'market-tick',
    };
  }
}
