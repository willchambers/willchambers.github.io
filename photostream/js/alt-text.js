// Alt text drafts from Claude, from the 960px copy of the photo.
//
// Optional: it needs an Anthropic API key in Settings. Without one (or if a
// draft fails), the composer suggests a plain starting point from the title
// instead. A draft is only ever a suggestion; posting never waits for it.
//
// The SDK is vendored (npm run vendor) and loaded only when it's first
// needed, so the feed never pays for it.

import { config } from './config.js';
import { settings } from './settings.js';

const MODEL = 'claude-opus-5-5';

const PROMPT = [
  'Write alt text for this photo, for someone using a screen reader.',
  'One sentence, under 150 characters.',
  'Describe what is visible: the subject, the setting, and anything notable about the light or colour.',
  'Do not start with "Image of" or "Photo of", and do not guess at names or places you cannot see.',
  'Reply with the alt text only.',
].join(' ');

let sdk = null;
const loadSdk = () => (sdk ??= import('../vendor/anthropic-sdk.js').then((module) => module.default));

async function clientFor(apiKey) {
  const Anthropic = await loadSdk();
  return {
    Anthropic,
    client: new Anthropic({
      apiKey,
      baseURL: config.anthropicBase,
      // The key lives only on this phone and is sent only to Anthropic.
      dangerouslyAllowBrowser: true,
      maxRetries: 1,
    }),
  };
}

const toBase64 = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result).split(',')[1]);
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(blob);
});

/** Plain-English reason a key or request failed. */
function explain(Anthropic, err) {
  if (err instanceof Anthropic.AuthenticationError) return "Anthropic didn't accept the API key. Check it in Settings.";
  if (err instanceof Anthropic.PermissionDeniedError) return "This API key isn't allowed to use Claude. Check it in the Anthropic Console.";
  if (err instanceof Anthropic.RateLimitError) return 'Claude is busy right now (rate limit). Try again in a minute.';
  if (err instanceof Anthropic.APIConnectionError) return "Couldn't reach Anthropic. Check your connection.";
  if (err instanceof Anthropic.APIError) return `Anthropic had a problem (error ${err.status ?? 'unknown'}).`;
  return "Couldn't draft alt text.";
}

/**
 * A draft from Claude, or null when there's no key or Claude declined.
 * Throws an Error with a plain-English message if the request failed.
 */
export async function draftAltText(thumb, { title = '', signal } = {}) {
  const apiKey = settings.anthropicKey;
  if (!apiKey) return null;
  const { Anthropic, client } = await clientFor(apiKey);
  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 4096,
      // A one-sentence description is a small job.
      output_config: { effort: 'low' },
      // If Claude's safeguards decline, the API retries on the model
      // Anthropic recommends for that case, inside the same call.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: thumb.type || 'image/webp', data: await toBase64(thumb) } },
          { type: 'text', text: title ? `${PROMPT} The photographer's title is "${title}".` : PROMPT },
        ],
      }],
    }, { signal });

    if (response.stop_reason === 'refusal') return null;
    const text = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^["“]|["”]$/g, '');
    return text || null;
  } catch (err) {
    if (err instanceof Anthropic.APIUserAbortError) return null;
    throw new Error(explain(Anthropic, err));
  }
}

/** Check a key before keeping it (looking up the model costs nothing). */
export async function checkAnthropicKey(apiKey) {
  const { Anthropic, client } = await clientFor(apiKey);
  try {
    await client.models.retrieve(MODEL);
  } catch (err) {
    throw new Error(explain(Anthropic, err));
  }
}

/** The fallback suggestion when there's no draft from Claude. */
export const plainAltText = ({ title, location }) =>
  [title && `Photo: ${title}`, location].filter(Boolean).join(', ');
