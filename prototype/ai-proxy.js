// Minimal local proxy: keeps the Gemini API key off the client.
// Run: GEMINI_API_KEY=... node ai-proxy.js
// Frontend calls http://localhost:8787/extract with { emailText }.
const http = require('http');
const https = require('https');

const KEY = process.env.GEMINI_API_KEY;
if (!KEY) { console.error('Set GEMINI_API_KEY first.'); process.exit(1); }

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

const MODEL = 'gemini-flash-latest';

http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  if (req.method !== 'POST' || req.url !== '/extract') { res.writeHead(404); return res.end(); }

  let body = '';
  req.on('data', c => body += c);
  req.on('end', () => {
    const { emailText } = JSON.parse(body || '{}');
    const payload = JSON.stringify({
      contents: [{ parts: [{ text: '这封邮件/通知描述了一件带时间性的事——可能是要到场的活动（面试/聚餐/看病）、线上会议（有会议链接）、或者只是一个截止日期（交房租、交文件、续费，没有具体地点）。先判断是哪一种，再按对应方式提取字段。不要预设是面试，也不要在没地点的事情上编一个地点出来：\n\n' + emailText }] }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA }
    });

    const apiReq = https.request(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEY}`,
      { method: 'POST', headers: { 'content-type': 'application/json' } },
      apiRes => {
        let data = '';
        apiRes.on('data', c => data += c);
        apiRes.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.error) {
              res.writeHead(apiRes.statusCode || 500, { 'content-type': 'application/json' });
              return res.end(JSON.stringify({ error: json.error.message }));
            }
            const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end(text || JSON.stringify({ error: 'no candidates in response', raw: json }));
          } catch (e) {
            res.writeHead(500, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ error: e.message, raw: data }));
          }
        });
      }
    );
    apiReq.on('error', e => { res.writeHead(500); res.end(JSON.stringify({ error: e.message })); });
    apiReq.write(payload);
    apiReq.end();
  });
}).listen(8787, () => console.log('AI proxy on http://localhost:8787'));
