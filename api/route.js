const crypto = require('node:crypto');
const { authorizeRequest } = require('./_auth');

function parseDuration(value) {
  const match = typeof value === 'string' ? value.match(/^(\d+(?:\.\d+)?)s$/) : null;
  if (!match) throw new Error('invalid route duration');
  return Math.ceil(Number(match[1]));
}

function cleanAddress(value) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 500 ? value.trim() : undefined;
}

module.exports = async function handler(req, res) {
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  const origins = (process.env.ALLOWED_ORIGIN || '').split(',').map((value) => value.trim());
  if (origins.includes(req.headers.origin)) res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: { code: 'method_not_allowed' } });
  const auth = await authorizeRequest(req);
  if (!auth.ok) return res.status(auth.status).json({ error: { code: auth.code } });
  if (!process.env.GOOGLE_MAPS_API_KEY) return res.status(503).json({ error: { code: 'routes_not_configured' } });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const origin = cleanAddress(body?.origin);
  const destination = cleanAddress(body?.destination);
  const arriveBy = typeof body?.arriveBy === 'string' && !Number.isNaN(Date.parse(body.arriveBy)) ? body.arriveBy : undefined;
  if (!origin || !destination || !arriveBy) return res.status(400).json({ error: { code: 'invalid_route_input' } });

  const requestId = crypto.randomUUID();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const upstream = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        'X-Goog-Api-Key': process.env.GOOGLE_MAPS_API_KEY,
        'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline',
      },
      body: JSON.stringify({
        origin: { address: origin },
        destination: { address: destination },
        travelMode: 'TRANSIT',
        arrivalTime: new Date(arriveBy).toISOString(),
        computeAlternativeRoutes: false,
        languageCode: typeof body.locale === 'string' ? body.locale : 'zh-CN',
        units: 'METRIC',
      }),
    });
    const payload = await upstream.json();
    const route = payload.routes?.[0];
    if (!upstream.ok || !route) return res.status(502).json({ error: { code: 'route_unavailable', requestId } });
    const durationSeconds = parseDuration(route.duration);
    const arrivalAt = new Date(arriveBy);
    const departureAt = new Date(arrivalAt.getTime() - durationSeconds * 1000);
    return res.status(200).json({
      route: {
        departureAt: departureAt.toISOString(),
        arrivalAt: arrivalAt.toISOString(),
        durationSeconds,
        distanceMeters: route.distanceMeters,
        transportMode: 'transit',
        encodedPolyline: route.polyline?.encodedPolyline,
      },
      requestId,
    });
  } catch (error) {
    return res.status(error?.name === 'AbortError' ? 504 : 502).json({
      error: { code: error?.name === 'AbortError' ? 'route_timeout' : 'route_invalid_response', requestId },
    });
  } finally {
    clearTimeout(timer);
  }
};

module.exports.parseDuration = parseDuration;
