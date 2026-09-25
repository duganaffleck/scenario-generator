// Seals a scenario into a short string that rides inside the pre-filled ACR (a hidden field), so a student's upload
// brings its own answer key with it. No database, no scenario IDs. AES-256-GCM, so students can't read the expected
// management out of the PDF, and can't edit it without the review noticing.
//
// Key: ACR_SCENARIO_KEY if set (any long random string). Otherwise derived from OPENAI_API_KEY, so it works with no
// extra setup on Render. If the OpenAI key is rotated and ACR_SCENARIO_KEY isn't set, older pre-filled ACRs can still
// be reviewed, just without their scenario. With neither set (local testing), a per-process key is used.

import crypto from 'crypto';
import zlib from 'zlib';

const PREFIX = 'acr1.';
let devKey = null;

function key() {
  if (process.env.ACR_SCENARIO_KEY) return crypto.createHash('sha256').update(process.env.ACR_SCENARIO_KEY).digest();
  if (process.env.OPENAI_API_KEY) {
    return Buffer.from(crypto.hkdfSync('sha256', process.env.OPENAI_API_KEY, 'vitalnotes-acr-review', 'scenario-token-v1', 32));
  }
  if (!devKey) {
    devKey = crypto.randomBytes(32);
    console.warn('[acr-review] No ACR_SCENARIO_KEY or OPENAI_API_KEY. Scenario links only work until this process restarts.');
  }
  return devKey;
}

function seal(obj) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const body = Buffer.concat([c.update(zlib.gzipSync(Buffer.from(JSON.stringify(obj)))), c.final()]);
  return PREFIX + Buffer.concat([iv, c.getAuthTag(), body]).toString('base64url');
}

// Returns the object, or null if the token is missing, damaged, edited, or sealed with another key.
function open(token) {
  if (!token || typeof token !== 'string' || !token.startsWith(PREFIX)) return null;
  try {
    const raw = Buffer.from(token.slice(PREFIX.length), 'base64url');
    const d = crypto.createDecipheriv('aes-256-gcm', key(), raw.subarray(0, 12));
    d.setAuthTag(raw.subarray(12, 28));
    return JSON.parse(zlib.gunzipSync(Buffer.concat([d.update(raw.subarray(28)), d.final()])).toString('utf8'));
  } catch (e) {
    return null;
  }
}

export { seal, open };
