import type { Config, Context } from '@netlify/functions';
import { getStore } from '@netlify/blobs';

const MODEL = 'claude-sonnet-4-5';
const MAX_TOKENS = 2600;
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

const RATE_LIMIT = 8; // requests
const RATE_WINDOW_MS = 60 * 60 * 1000; // per hour, per IP

interface RateRecord {
  count: number;
  windowStart: number;
}

async function checkRateLimit(ip: string): Promise<boolean> {
  const store = getStore('weekly-linkedin-engine-rate-limits');
  const now = Date.now();
  const existing = await store.get(ip, { type: 'json' }) as RateRecord | null;

  if (!existing || now - existing.windowStart > RATE_WINDOW_MS) {
    await store.setJSON(ip, { count: 1, windowStart: now } satisfies RateRecord);
    return true;
  }

  if (existing.count >= RATE_LIMIT) {
    return false;
  }

  await store.setJSON(ip, { count: existing.count + 1, windowStart: existing.windowStart } satisfies RateRecord);
  return true;
}

export default async (req: Request, context: Context) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const ip = context.ip || 'unknown';
  const allowed = await checkRateLimit(ip);
  if (!allowed) {
    return new Response(JSON.stringify({ error: 'rate-limited' }), {
      status: 429,
      headers: { 'content-type': 'application/json' },
    });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'not-configured' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }

  let body: { system?: string; messages?: Array<{ role: string; content: string }> };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid-request' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  if (!body.system || !Array.isArray(body.messages) || body.messages.length === 0) {
    return new Response(JSON.stringify({ error: 'invalid-request' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  let anthropicRes: Response;
  try {
    anthropicRes = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: body.system,
        messages: body.messages,
      }),
    });
  } catch {
    return new Response(JSON.stringify({ error: 'upstream-unreachable' }), {
      status: 502,
      headers: { 'content-type': 'application/json' },
    });
  }

  if (!anthropicRes.ok) {
    return new Response(JSON.stringify({ error: 'upstream-error' }), {
      status: 502,
      headers: { 'content-type': 'application/json' },
    });
  }

  const data = await anthropicRes.json();
  const text = data?.content?.[0]?.text;
  if (typeof text !== 'string') {
    return new Response(JSON.stringify({ error: 'upstream-error' }), {
      status: 502,
      headers: { 'content-type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ text }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};

export const config: Config = {
  path: '/api/generate-linkedin-posts',
};
