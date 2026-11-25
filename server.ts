import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { GoogleGenAI, Type } from '@google/genai';

const ADMIN_OWNER_EMAIL = 'karnajoydas@gmail.com';
const MODEL_NAME = 'gemini-4-hydrogen';

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    throw new Error('GEMINI_API_KEY is missing in environment secrets.');
  }
  return new GoogleGenAI({
    apiKey: apiKey.trim(),
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function isOwnerEmail(email: unknown): boolean {
  return typeof email === 'string' && email.trim().toLowerCase() === ADMIN_OWNER_EMAIL;
}

function extractJsonObject(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim();
  const candidates: string[] = [trimmed];
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced && fenced[1]) {
    candidates.unshift(fenced[1].trim());
  }
  const braceStart = trimmed.indexOf('{');
  const braceEnd = trimmed.lastIndexOf('}');
  if (braceStart !== -1 && braceEnd > braceStart) {
    candidates.push(trimmed.slice(braceStart, braceEnd + 1));
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Try next candidate
    }
  }
  return null;
}

function formatGeminiApiError(
  err: unknown,
  fallbackMessage: string
): { status: number; message: string } {
  const rawMessage = err instanceof Error ? err.message : fallbackMessage;
  if (rawMessage.includes('GEMINI_API_KEY')) {
    return {
      status: 500,
      message: 'GEMINI_API_KEY is not configured in Settings > Secrets.',
    };
  }

  let parsedCode: number | undefined;
  let parsedStatus = '';
  let cleanMessage = rawMessage;

  const parsedOuter = extractJsonObject(rawMessage);
  if (parsedOuter) {
    const inner =
      parsedOuter.error && typeof parsedOuter.error === 'object'
        ? (parsedOuter.error as Record<string, unknown>)
        : parsedOuter;
    if (typeof inner.code === 'number') parsedCode = inner.code;
    if (typeof inner.status === 'string') parsedStatus = inner.status;
    if (typeof inner.message === 'string' && inner.message.trim()) {
      cleanMessage = inner.message.trim();
    }
  }

  if (parsedCode === 403 || parsedStatus === 'PERMISSION_DENIED') {
    return {
      status: 403,
      message: `${cleanMessage} Please configure a billing-enabled GEMINI_API_KEY in Settings > Secrets.`,
    };
  }
  if (parsedCode === 400 || parsedStatus === 'INVALID_ARGUMENT') {
    return {
      status: 400,
      message: `${cleanMessage} Verify your GEMINI_API_KEY in Settings > Secrets.`,
    };
  }
  if (parsedCode === 429 || parsedStatus === 'RESOURCE_EXHAUSTED') {
    return {
      status: 429,
      message: `${cleanMessage} Please check quota or billing in Settings > Secrets.`,
    };
  }
  if (parsedCode === 404 || parsedStatus === 'NOT_FOUND') {
    return { status: 404, message: cleanMessage };
  }

  return {
    status: parsedCode && parsedCode >= 400 && parsedCode < 600 ? parsedCode : 502,
    message: cleanMessage || fallbackMessage,
  };
}

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'ouroboros-desk' });
  });

  // Owner-only: Convert Hindi/Hinglish/English spoken dictation into a structured Prediction Market
  app.post('/api/admin/parse-voice-bet', async (req, res) => {
    try {
      const { transcript, ownerEmail } = req.body ?? {};
      if (!isOwnerEmail(ownerEmail)) {
        res.status(403).json({
          error: 'Unauthorized: Only the platform owner can create voice prediction bets.',
        });
        return;
      }
      if (typeof transcript !== 'string' || transcript.trim().length < 5) {
        res.status(400).json({
          error: 'Please speak or enter a clear prediction command first.',
        });
        return;
      }

      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: `Convert this Owner voice command into a clean binary YES/NO prediction market:\n"${transcript.trim()}"`,
        config: {
          systemInstruction:
            'You structure spoken prediction market ideas (which may be in Hindi, Hinglish, or English) into a crisp binary YES/NO prediction question for an Indian & global prediction desk. Output valid JSON matching the schema. Pick category strictly from: "Political", "Sports", "Crypto", "Famous Games", "Mobile Brands", "All Markets". Set endsInSeconds realistically (e.g. 3600 for 1h, 86400 for 24h, 604800 for 7d). Make question clear and unbiased ending with a question mark.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              question: {
                type: Type.STRING,
                description: 'Clear binary Yes/No prediction question ending with ?',
              },
              category: {
                type: Type.STRING,
                description:
                  'One of: Political, Sports, Crypto, Famous Games, Mobile Brands, All Markets',
              },
              subLabel: {
                type: Type.STRING,
                description: 'Short topic badge e.g. India Elections, Cricket Live, Crypto Desk',
              },
              endLabel: {
                type: Type.STRING,
                description: 'Short human-readable deadline label e.g. Ends in 24h or Result Awaited',
              },
              endsInSeconds: {
                type: Type.INTEGER,
                description: 'Seconds until betting locks (minimum 300, default 86400)',
              },
              resolutionCriteria: {
                type: Type.STRING,
                description: 'Objective real-world criteria for deciding YES vs NO via live web search',
              },
              yesPoolSeed: {
                type: Type.INTEGER,
                description: 'Initial YES liquidity seed in INR (between 2000 and 15000)',
              },
              noPoolSeed: {
                type: Type.INTEGER,
                description: 'Initial NO liquidity seed in INR (between 2000 and 15000)',
              },
            },
            required: [
              'question',
              'category',
              'subLabel',
              'endLabel',
              'endsInSeconds',
              'resolutionCriteria',
              'yesPoolSeed',
              'noPoolSeed',
            ],
          },
        },
      });

      const rawText = (response.text ?? '').trim();
      const parsed = extractJsonObject(rawText);
      if (!parsed || typeof parsed.question !== 'string') {
        res.status(502).json({
          error: 'Gemini could not structure this voice command. Please try speaking more clearly.',
        });
        return;
      }

      const allowedCategories = new Set([
        'All Markets',
        'Mobile Brands',
        'Famous Games',
        'Crypto',
        'Sports',
        'Political',
      ]);
      const rawCat = String(parsed.category ?? 'Political').trim();
      const category = allowedCategories.has(rawCat) ? rawCat : 'Political';

      const draftPayload = {
        question: parsed.question.trim(),
        category,
        subLabel: String(parsed.subLabel ?? `${category} · Voice Desk`).trim(),
        endLabel: String(parsed.endLabel ?? 'Live Web Settled').trim(),
        endsInSeconds: Math.max(300, Math.min(2592000, Number(parsed.endsInSeconds) || 86400)),
        resolutionCriteria: String(
          parsed.resolutionCriteria ??
            'Verify official outcome via reputable news or government/exchange announcement.'
        ).trim(),
        yesPoolSeed: Math.max(1000, Math.min(50000, Number(parsed.yesPoolSeed) || 5000)),
        noPoolSeed: Math.max(1000, Math.min(50000, Number(parsed.noPoolSeed) || 5000)),
      };

      res.json({
        draft: draftPayload,
        ...draftPayload,
      });
    } catch (err) {
      const formatted = formatGeminiApiError(err, 'Voice bet parsing failed.');
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // Owner-only: Browse live web with Google Search Grounding to check outcome & auto-settle
  app.post('/api/admin/resolve-prediction', async (req, res) => {
    try {
      const { market, ownerEmail, question, subLabel, resolutionCriteria } = req.body ?? {};
      if (!isOwnerEmail(ownerEmail)) {
        res.status(403).json({
          error: 'Unauthorized: Only the platform owner can resolve prediction markets.',
        });
        return;
      }

      const resolvedQuestion =
        typeof market?.question === 'string'
          ? market.question.trim()
          : typeof question === 'string'
            ? question.trim()
            : '';
      const resolvedSubLabel =
        typeof market?.subLabel === 'string'
          ? market.subLabel
          : typeof subLabel === 'string'
            ? subLabel
            : '';
      const resolvedCriteria =
        typeof market?.resolutionCriteria === 'string'
          ? market.resolutionCriteria
          : typeof resolutionCriteria === 'string'
            ? resolutionCriteria
            : '';

      if (!resolvedQuestion) {
        res.status(400).json({ error: 'Valid prediction market payload is required.' });
        return;
      }

      const ai = getGeminiClient();
      const todayIso = new Date().toISOString();
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: [
          `Today UTC timestamp: ${todayIso}`,
          `Prediction Question: "${resolvedQuestion}"`,
          resolvedSubLabel ? `Category / Desk: ${resolvedSubLabel}` : '',
          resolvedCriteria ? `Resolution Criteria: ${resolvedCriteria}` : '',
          'Search the live web for verified current facts and return ONLY raw JSON with keys: outcome ("yes" | "no" | "pending"), confidence ("high" | "medium" | "low"), summary (concise 1-2 sentence explanation citing verified facts). Do NOT wrap in markdown.',
        ]
          .filter(Boolean)
          .join('\n'),
        config: {
          systemInstruction:
            'You are an impartial live-web market adjudicator. Use Google Search to check real-world status as of today. Return outcome="yes" ONLY if authoritative web results clearly confirm the condition happened/holds true. Return outcome="no" ONLY if authoritative web results confirm it failed/did not happen. If the event is in the future, ongoing, or inconclusive from search results, strictly return outcome="pending". Respond ONLY with a valid JSON object: {"outcome":"yes"|"no"|"pending","confidence":"high"|"medium"|"low","summary":"..."}.',
          tools: [{ googleSearch: {} }],
        },
      });

      const rawText = (response.text ?? '').trim();
      const parsed = extractJsonObject(rawText);

      const rawChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
      const sources: Array<{ title: string; uri: string }> = [];
      const seenUris = new Set<string>();
      for (const chunk of rawChunks) {
        const uri = chunk?.web?.uri;
        const title = chunk?.web?.title;
        if (typeof uri === 'string' && uri.startsWith('http') && !seenUris.has(uri)) {
          seenUris.add(uri);
          sources.push({
            title: typeof title === 'string' && title.trim() ? title.trim() : uri,
            uri,
          });
        }
      }

      const rawOutcome = String(parsed?.outcome ?? 'pending').trim().toLowerCase();
      const outcome: 'yes' | 'no' | 'pending' =
        rawOutcome === 'yes' || rawOutcome === 'no' ? rawOutcome : 'pending';
      const rawConf = String(parsed?.confidence ?? 'medium').trim().toLowerCase();
      const confidence =
        rawConf === 'high' || rawConf === 'low' ? rawConf : 'medium';
      const summary =
        typeof parsed?.summary === 'string' && parsed.summary.trim()
          ? parsed.summary.trim()
          : rawText || 'Checked live web sources; outcome status updated.';

      res.json({
        outcome,
        confidence,
        summary,
        resolvedAt: todayIso,
        sources: sources.slice(0, 6),
      });
    } catch (err) {
      const formatted = formatGeminiApiError(err, 'Live web verification failed.');
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  const isProd = process.env.NODE_ENV === 'production';
  const rootDir = import.meta.dirname || path.resolve();

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(rootDir, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexPath = path.join(distDir, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Build output not found. Run npm run build first.');
      }
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Ouroboros server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Ouroboros server:', err);
  process.exit(1);
});
