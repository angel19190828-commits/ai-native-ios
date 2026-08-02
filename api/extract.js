// Vercel serverless function — POST /api/extract
// Deployed separately from the GitHub Pages frontend (split deployment).
//
// Required env var (set in Vercel project settings, never in code):
//   GEMINI_API_KEY   — your Gemini API key
// Optional env var:
//   ALLOWED_ORIGIN   — the exact frontend origin allowed to call this function,
//                      e.g. https://angel19190828-commits.github.io
//                      If unset, falls back to '*' (fine for local `vercel dev`, not for production).

// gemini-flash-latest's free-tier daily quota (20 requests/day) is too low for a public demo.
// gemini-flash-lite-latest has a much higher free-tier daily quota (500 requests/day) and is
// plenty capable for this structured-extraction task.
const MODEL = 'gemini-flash-lite-latest';

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    eventTitle: { type: 'STRING', description: '这件事是什么，简短短语，例如 "面试"、"朋友聚餐"、"团队周会"、"房租"、"提交报告"' },
    kind: { type: 'STRING', enum: ['appointment', 'meeting', 'deadline'], description: 'appointment=需要到场的实体活动（面试/聚餐/看病）；meeting=线上会议（有会议链接，不需要"到达"某地）；deadline=在某个时间点前完成的事，没有具体地点或到场时刻（交房租、交文件、续费）' },
    dateTime: { type: 'STRING', description: '例如 "7月28日（星期二）10:30"；deadline 类型没写具体时间就只给日期' },
    location: { type: 'STRING', description: 'appointment 给实体地址；meeting 给会议链接或"线上"；deadline 没有地点就写 "无"' },
    arrival: { type: 'STRING', description: 'appointment/meeting：需要提前多久到/加入，没提到写"无特别要求"；deadline：写"不适用"' },
    preparation: { type: 'STRING', description: '需要准备/携带/完成的东西，没提到就写 "无特别要求"' }
  },
  required: ['eventTitle', 'kind', 'dateTime', 'location', 'arrival', 'preparation']
};

function setCors(req, res) {
  const allowed = process.env.ALLOWED_ORIGIN;
  const origin = req.headers.origin || '';
  if (allowed) {
    if (origin === allowed) res.setHeader('Access-Control-Allow-Origin', origin);
    // origin not on the allow-list: omit the header, browser blocks the response client-side
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*'); // dev fallback only
  }
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
}

module.exports = async (req, res) => {
  setCors(req, res);
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(404).json({ error: 'not found' }); return; }

  const KEY = process.env.GEMINI_API_KEY;
  if (!KEY) { res.status(500).json({ error: 'GEMINI_API_KEY not configured' }); return; }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const emailText = (body && body.emailText) || '';

  const payload = {
    contents: [{ parts: [{ text: '这封邮件/通知描述了一件带时间性的事——可能是要到场的活动（面试/聚餐/看病）、线上会议（有会议链接）、或者只是一个截止日期（交房租、交文件、续费，没有具体地点）。先判断是哪一种，再按对应方式提取字段。不要预设是面试，也不要在没地点的事情上编一个地点出来：\n\n' + emailText }] }],
    generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA }
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const apiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEY}`,
      { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload), signal: controller.signal }
    );
    clearTimeout(timer);
    const json = await apiRes.json();
    if (json.error) { res.status(apiRes.status || 500).json({ error: json.error.message }); return; }
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) { res.status(502).json({ error: 'no candidates in response' }); return; }
    res.status(200).send(text);
  } catch (e) {
    clearTimeout(timer);
    const isTimeout = e.name === 'AbortError';
    res.status(isTimeout ? 504 : 500).json({ error: isTimeout ? 'timeout' : e.message });
  }
};
