const { createClient } = require('@supabase/supabase-js');
const { authorizeRequest } = require('./_auth');

function createAdminClient(createClientImpl = createClient) {
  const url = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) return undefined;
  return createClientImpl(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

function createHandler({ authorize = authorizeRequest, createClientImpl = createClient } = {}) {
  return async function handler(req, res) {
    if (req.method !== 'DELETE') return res.status(405).json({ error: { code: 'method_not_allowed' } });
    const auth = await authorize(req);
    if (!auth.ok) return res.status(auth.status).json({ error: { code: auth.code } });
    if (auth.mode !== 'user' || typeof auth.userId !== 'string') {
      return res.status(403).json({ error: { code: 'account_deletion_requires_user_session' } });
    }

    const admin = createAdminClient(createClientImpl);
    if (!admin) return res.status(503).json({ error: { code: 'account_deletion_not_configured' } });
    const { error } = await admin.auth.admin.deleteUser(auth.userId, false);
    if (error) return res.status(502).json({ error: { code: 'account_deletion_failed' } });
    return res.status(204).end();
  };
}

module.exports = createHandler();
module.exports.createHandler = createHandler;
