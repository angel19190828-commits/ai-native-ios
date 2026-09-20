const crypto = require('node:crypto');
const { verifyAuth } = require('@supabase/server/core');

function bearer(req) {
  return (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
}

function safeEqual(actual, expected) {
  const left = Buffer.from(actual);
  const right = Buffer.from(expected);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function asRequest(req) {
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers.host || 'taskspace.invalid';
  const url = `${protocol}://${host}${req.url || '/'}`;
  return new Request(url, { method: req.method || 'GET', headers: req.headers });
}

async function authorizeRequest(req) {
  const supabaseConfigured = Boolean(process.env.SUPABASE_URL && (process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEYS));
  if (supabaseConfigured) {
    const { data, error } = await verifyAuth(asRequest(req), { auth: 'user' });
    if (error || !data?.userClaims) return { ok: false, status: error?.status || 401, code: 'unauthorized' };
    const userId = data.userClaims.id || data.userClaims.sub;
    if (typeof userId !== 'string') return { ok: false, status: 401, code: 'unauthorized' };
    return { ok: true, mode: 'user', userId, token: data.token, keyName: data.keyName };
  }

  const expected = process.env.MOBILE_API_TOKEN;
  if (expected && safeEqual(bearer(req), expected)) return { ok: true, mode: 'development-token', userId: 'development-user' };
  if (!expected && process.env.NODE_ENV !== 'production') return { ok: true, mode: 'local-development', userId: 'local-user' };
  return { ok: false, status: 401, code: 'unauthorized' };
}

module.exports = { authorizeRequest };

