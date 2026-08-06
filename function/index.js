import crypto from 'node:crypto';
import OpenAI from 'openai';
import { initializeApp } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import { logger } from 'firebase-functions';
import { defineSecret } from 'firebase-functions/params';
import { onRequest } from 'firebase-functions/v2/https';

initializeApp({
  databaseURL: 'https://elian-s-chatbot-default-rtdb.firebaseio.com'
});

const OPENAI_API_KEY = defineSecret('OPENAI_API_KEY');
const DATABASE = getDatabase();

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 20;

function clientAddress(request) {
  return request.ip || request.socket?.remoteAddress || 'unknown';
}

async function useRateLimitSlot(request) {
  const hash = crypto
    .createHash('sha256')
    .update(clientAddress(request))
    .digest('hex');

  const ref = DATABASE.ref(`apiRateLimits/${hash}`);
  const now = Date.now();
  let allowed = false;

  await ref.transaction((current) => {
    if (!current || now - Number(current.windowStart || 0) >= RATE_LIMIT_WINDOW_MS) {
      allowed = true;
      return { windowStart: now, count: 1, lastRequest: now };
    }

    if (Number(current.count || 0) >= RATE_LIMIT_MAX_REQUESTS) {
      allowed = false;
      return;
    }

    allowed = true;
    return {
      windowStart: current.windowStart,
      count: Number(current.count || 0) + 1,
      lastRequest: now
    };
  });

  return allowed;
}

function safeError(error) {
  const status = Number(error?.status || 0);

  if (status === 401) return { status: 500, message: 'The server API key is invalid.' };
  if (status === 429) return { status: 429, message: 'The OpenAI API rate limit or account quota was reached.' };
  if (status >= 400 && status < 500) return { status: 400, message: error?.message || 'OpenAI rejected the request.' };
  return { status: 500, message: 'The AI service could not complete the request.' };
}

export const chatWithAI = onRequest(
  {
    region: 'us-central1',
    cors: [
      'https://ym3178-afk.github.io',
      /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/
    ],
    secrets: [OPENAI_API_KEY],
    timeoutSeconds: 60,
    memory: '256MiB',
    maxInstances: 3
  },
  async (request, response) => {
    response.set('Cache-Control', 'no-store');

    if (request.method === 'GET') {
      response.status(200).json({ ok: true, service: 'chatWithAI' });
      return;
    }

    if (request.method !== 'POST') {
      response.status(405).json({ error: 'Use POST for chat requests.' });
      return;
    }

    const message = typeof request.body?.message === 'string'
      ? request.body.message.trim()
      : '';

    if (!message) {
      response.status(400).json({ error: 'Message is required.' });
      return;
    }

    if (message.length > 500) {
      response.status(400).json({ error: 'Message must be 500 characters or fewer.' });
      return;
    }

    if (!(await useRateLimitSlot(request))) {
      response.status(429).json({
        error: 'This demo allows 20 AI requests per hour from each network. Please try again later.'
      });
      return;
    }

    const userMessageRef = DATABASE.ref('chat/messages').push();
    await userMessageRef.set({
      text: message,
      sender: 'user',
      timestamp: Date.now()
    });

    try {
      const client = new OpenAI({ apiKey: OPENAI_API_KEY.value() });
      const result = await client.responses.create({
        model: 'gpt-5',
        instructions: 'You are a helpful AI assistant. Keep your responses concise, clear, and friendly.',
        input: message,
        max_output_tokens: 220
      });

      const answer = String(result.output_text || '').trim();
      if (!answer) {
        throw new Error('OpenAI returned an empty response.');
      }

      await DATABASE.ref('chat/messages').push({
        text: answer,
        sender: 'bot',
        timestamp: Date.now()
      });

      response.status(200).json({ response: answer });
    } catch (error) {
      logger.error('OpenAI request failed', {
        status: error?.status,
        name: error?.name,
        message: error?.message
      });

      const publicError = safeError(error);
      response.status(publicError.status).json({ error: publicError.message });
    }
  }
);
