// JohanMusic request service. Stores a shared catalog in Cloudflare D1.
const API = 'https://discoveryprovider.audius.co/v1';
const validId = /^[A-Za-z0-9_-]{1,80}$/;
function words(value) {
  return new Set(value.toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '').match(/[\p{L}\p{N}]+/gu) || []);
}
function overlap(requested, found) {
  const wanted = words(requested), actual = words(found);
  return [...wanted].filter(word => actual.has(word)).length / Math.max(1, wanted.size);
}
export function chooseTrack(data, title, artist) {
  const matches = [];
  for (const track of Array.isArray(data) ? data : []) {
    if (!track || typeof track.id !== 'string' || !validId.test(track.id) || typeof track.title !== 'string' || typeof track.user?.name !== 'string') continue;
    if (track.is_streamable === false || track.is_stream_gated || track.stream_conditions || track.is_delete || track.is_unlisted) continue;
    const titleScore = overlap(title, track.title), artistScore = overlap(artist, track.user.name);
    if (titleScore < .75 || artistScore < .75) continue;
    let url = 'https://audius.co';
    try {
      const parsed = new URL(track.permalink, 'https://audius.co');
      if (parsed.protocol === 'https:' && ['audius.co', 'www.audius.co'].includes(parsed.hostname) && !parsed.username && !parsed.password && !parsed.port) url = parsed.href;
    } catch { /* Use the platform homepage if the permalink is invalid. */ }
    matches.push({ score: titleScore + artistScore, track: {
      id: track.id, title: track.title.slice(0, 200), artist: track.user.name.slice(0, 200),
      source: 'Audius', stream: `${API}/tracks/${track.id}/stream?app_name=JohanMusic`, url
    }});
  }
  matches.sort((a, b) => b.score - a.score);
  return matches[0]?.track || null;
}
async function search(title, artist) {
  const query = new URLSearchParams({ query: `${title} ${artist}`, limit: '10', app_name: 'JohanMusic' });
  const response = await fetch(`${API}/tracks/search?${query}`, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error('Catalog unavailable');
  const data = await response.json();
  return chooseTrack(data.data, title, artist);
}
function json(status, data, origin, allowedOrigin) {
  const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
  if (origin === allowedOrigin) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers.Vary = 'Origin';
  }
  return new Response(JSON.stringify(data), { status, headers });
}
export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const allowedOrigin = env.ALLOWED_ORIGIN || 'https://albertojohan88.github.io';
    const reply = (status, data) => json(status, data, origin, allowedOrigin);
    const path = new URL(request.url).pathname;
    if (origin && origin !== allowedOrigin) return reply(403, { error: 'Origen no permitido.' });
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: {
        'Access-Control-Allow-Origin': allowedOrigin, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type', Vary: 'Origin'
      }});
    }
    if (request.method === 'GET' && path === '/api/health') return reply(200, { service: 'JohanMusic', catalog: 'Audius' });
    try {
      if (request.method === 'GET' && path === '/api/tracks') {
        const result = await env.CATALOG.prepare('SELECT data FROM tracks ORDER BY created').all();
        return reply(200, { tracks: result.results.map(row => JSON.parse(row.data)) });
      }
      if (request.method !== 'POST' || path !== '/api/requests') return reply(404, { error: 'Ruta no encontrada.' });
      if (request.headers.get('Content-Type')?.split(';')[0] !== 'application/json') return reply(415, { error: 'Se requiere JSON.' });
      // A limited stream reader bounds the body even when Content-Length is absent.
      const reader = request.body?.getReader();
      if (!reader) return reply(400, { error: 'Petición vacía.' });
      const chunks = []; let size = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 4096) { await reader.cancel(); return reply(413, { error: 'Petición demasiado grande.' }); }
        chunks.push(value);
      }
      let input;
      try {
        const buffer = new Uint8Array(size); let offset = 0;
        for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.byteLength; }
        input = JSON.parse(new TextDecoder().decode(buffer));
      } catch { return reply(400, { error: 'Petición inválida.' }); }
      const { title, artist } = input || {};
      if (![title, artist].every(value => typeof value === 'string' && value.trim().length > 0 && value.length <= 120 && !/[\r\n]/.test(value))) {
        return reply(400, { error: 'Escribe canción y artista, de hasta 120 caracteres.' });
      }
      const normalizedTitle = title.trim(), normalizedArtist = artist.trim();
      const bytes = new TextEncoder().encode(normalizedTitle.toLowerCase() + '\0' + normalizedArtist.toLowerCase());
      const key = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join('');
      const existing = await env.CATALOG.prepare('SELECT data FROM tracks WHERE request_key = ?').bind(key).first();
      if (existing) return reply(200, { track: JSON.parse(existing.data), created: false });
      const bucket = Math.floor(Date.now() / 60000);
      await env.CATALOG.prepare('DELETE FROM rate_limits WHERE bucket < ?').bind(bucket - 1).run();
      const budget = await env.CATALOG.prepare('INSERT INTO rate_limits (bucket, count) VALUES (?, 1) ON CONFLICT(bucket) DO UPDATE SET count = count + 1 RETURNING count').bind(bucket).first();
      if (budget.count > 20) return reply(429, { error: 'Hay muchas peticiones. Espera un minuto e inténtalo de nuevo.' });
      let track;
      try { track = await search(normalizedTitle, normalizedArtist); }
      catch { return reply(502, { error: 'Audius no respondió. Inténtalo de nuevo más tarde.' }); }
      if (!track) return reply(404, { error: 'No encontré esa canción y artista disponibles en Audius. No se añadió ningún tema.' });
      const saved = await env.CATALOG.prepare('INSERT OR IGNORE INTO tracks (request_key, provider_id, data, created) VALUES (?, ?, ?, ?)')
        .bind(key, track.id, JSON.stringify(track), Date.now()).run();
      const row = await env.CATALOG.prepare('SELECT data FROM tracks WHERE request_key = ? OR provider_id = ? LIMIT 1').bind(key, track.id).first();
      if (!row) throw new Error('Database write failed');
      const created = saved.meta.changes > 0;
      return reply(created ? 201 : 200, { track: JSON.parse(row.data), created });
    } catch {
      return reply(503, { error: 'No se pudo guardar o cargar la canción. Inténtalo más tarde.' });
    }
  }
};
