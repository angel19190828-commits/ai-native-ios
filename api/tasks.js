const { createClient } = require('@supabase/supabase-js');
const { authorizeRequest } = require('./_auth');

const PHASES = new Set(['draft', 'planning', 'needs_decision', 'ready', 'executing', 'completed', 'partially_completed', 'failed', 'stopped']);

function parseBody(req) {
  if (typeof req.body !== 'string') return req.body || {};
  try { return JSON.parse(req.body); } catch { return {}; }
}

function validTask(task) {
  return Boolean(task
    && typeof task === 'object'
    && typeof task.id === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(task.id)
    && typeof task.request === 'string'
    && task.request.length > 0
    && task.request.length <= 20000
    && PHASES.has(task.phase)
    && Number.isInteger(task.revision)
    && task.revision >= 0
    && task.facts && typeof task.facts === 'object'
    && Array.isArray(task.steps)
    && typeof task.stopRequested === 'boolean'
    && typeof task.updatedAt === 'string'
    && !Number.isNaN(Date.parse(task.updatedAt)));
}

function toTask(row) {
  return {
    id: row.id,
    syncVersion: row.sync_version,
    request: row.request,
    phase: row.phase,
    revision: row.revision,
    facts: row.facts,
    steps: row.steps,
    ...(row.pending_decision ? { pendingDecision: row.pending_decision } : {}),
    ...(row.confirmed_plan ? { confirmedPlan: row.confirmed_plan } : {}),
    stopRequested: row.stop_requested,
    updatedAt: row.updated_at,
  };
}

function createUserClient(token, createClientImpl = createClient) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key || !token) return undefined;
  return createClientImpl(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

function createHandler({ authorize = authorizeRequest, createClientImpl = createClient } = {}) {
  return async function handler(req, res) {
    if (!['GET', 'PUT'].includes(req.method)) return res.status(405).json({ error: { code: 'method_not_allowed' } });
    const auth = await authorize(req);
    if (!auth.ok) return res.status(auth.status).json({ error: { code: auth.code } });
    const supabase = createUserClient(auth.token, createClientImpl);
    if (!supabase) return res.status(503).json({ error: { code: 'task_store_not_configured' } });

    if (req.method === 'GET') {
      let query = supabase.from('tasks').select('*').is('deleted_at', null);
      if (typeof req.query?.id === 'string') query = query.eq('id', req.query.id).limit(1);
      else query = query.order('updated_at', { ascending: false }).limit(50);
      const { data, error } = await query;
      if (error) return res.status(502).json({ error: { code: 'task_store_read_failed' } });
      const rows = Array.isArray(data) ? data : [];
      return res.status(200).json({ tasks: rows.map(toTask) });
    }

    const body = parseBody(req);
    if (!validTask(body.task)) return res.status(400).json({ error: { code: 'invalid_task' } });
    const expected = body.task.syncVersion ?? 0;
    if (!Number.isInteger(expected) || expected < 0) return res.status(400).json({ error: { code: 'invalid_sync_version' } });
    const event = body.event == null ? null : body.event;
    if (event !== null && (!event || typeof event !== 'object' || typeof event.type !== 'string')) {
      return res.status(400).json({ error: { code: 'invalid_event' } });
    }
    const { data, error } = await supabase.rpc('sync_task_snapshot', {
      p_task: body.task,
      p_event: event,
      p_expected_sync_version: expected,
    }).single();
    if (error) {
      const conflict = error.code === '40001' || /task_version_conflict/.test(error.message || '');
      return res.status(conflict ? 409 : 502).json({ error: { code: conflict ? 'task_version_conflict' : 'task_store_write_failed' } });
    }
    return res.status(200).json({ task: toTask(data) });
  };
}

module.exports = createHandler();
module.exports.createHandler = createHandler;
module.exports.validTask = validTask;
module.exports.toTask = toTask;
