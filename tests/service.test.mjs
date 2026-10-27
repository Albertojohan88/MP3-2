import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import worker, { chooseTrack } from '../cloudflare/worker.mjs';
const schema = readFileSync(new URL('../cloudflare/schema.sql', import.meta.url), 'utf8');
const example = { id: 'Track123', title: 'Mi canción', user: { name: 'Artista' }, permalink: '/artista/mi-cancion' };
function database(path = ':memory:') {
  const db = new DatabaseSync(path); db.exec(schema);
  return { db, prepare(sql) {
    function bound(values) { return {
      bind: (...next) => bound(next),
      first: async () => db.prepare(sql).get(...values) || null,
      all: async () => ({ results: db.prepare(sql).all(...values) }),
      run: async () => ({ meta: { changes: Number(db.prepare(sql).run(...values).changes) } })
    }; }
    return bound([]);
  }};
}
function request(path = '/api/requests', body = { title: 'Mi canción', artist: 'Artista' }, origin = 'https://albertojohan88.github.io') {
  return new Request('https://test.workers.dev' + path, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}
test('selects correct title and artist; excludes paywalled and irrelevant tracks', () => {
  assert.equal(chooseTrack([{ ...example, user: { name: 'Otro artista' }, title: 'Otro tema' }], 'Mi canción', 'Artista'), null);
  assert.equal(chooseTrack([{ ...example, is_stream_gated: true }], 'Mi canción', 'Artista'), null);
  assert.equal(chooseTrack([{ ...example, is_streamable: false }], 'Mi canción', 'Artista'), null);
  assert.equal(chooseTrack([example], 'Mi cancion', 'ARTISTA').id, 'Track123');
  assert.equal(chooseTrack([{ ...example, permalink: 'https://evil.example' }], 'Mi canción', 'Artista').url, 'https://audius.co');
});
test('anonymous request persists and is visible to another visitor without duplicate searches', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'johan-d1-')), path = join(dir, 'catalog.sqlite');
  const env = { CATALOG: database(path) }; const original = globalThis.fetch; let searches = 0;
  globalThis.fetch = async url => {
    assert.ok(String(url).startsWith('https://discoveryprovider.audius.co/v1/tracks/search?'));
    searches++; return Response.json({ data: [example] });
  };
  try {
    const first = await worker.fetch(request(), env);
    assert.equal(first.status, 201); assert.equal(first.headers.get('Access-Control-Allow-Origin'), 'https://albertojohan88.github.io');
    assert.equal((await first.json()).created, true);
    env.CATALOG.db.close(); env.CATALOG = database(path);
    const list = await worker.fetch(new Request('https://test.workers.dev/api/tracks'), env);
    assert.equal((await list.json()).tracks[0].title, 'Mi canción');
    assert.equal((await worker.fetch(request(), env)).status, 200); assert.equal(searches, 1);
  } finally { globalThis.fetch = original; env.CATALOG.db.close(); rmSync(dir, { recursive: true }); }
});
test('not-found and upstream failure never add fake songs', async () => {
  const env = { CATALOG: database() }; const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => Response.json({ data: [] });
    assert.equal((await worker.fetch(request(), env)).status, 404);
    globalThis.fetch = async () => { throw new Error('Network blocked'); };
    assert.equal((await worker.fetch(request(), env)).status, 502);
    assert.equal((await (await worker.fetch(new Request('https://test.workers.dev/api/tracks'), env)).json()).tracks.length, 0);
  } finally { globalThis.fetch = original; env.CATALOG.db.close(); }
});
test('rejects invalid fields, origins and oversized bodies before upstream calls', async () => {
  const env = { CATALOG: database() };
  try {
    assert.equal((await worker.fetch(request('/api/requests', { title: ' ', artist: 'Artista' }), env)).status, 400);
    assert.equal((await worker.fetch(request('/api/requests', {}, 'https://other.example'), env)).status, 403);
    assert.equal((await worker.fetch(request('/api/requests', { title: 'x'.repeat(5000) }), env)).status, 413);
    const response = await worker.fetch(new Request('https://test.workers.dev/api/requests', { method: 'OPTIONS', headers: { Origin: 'https://albertojohan88.github.io' } }), env);
    assert.equal(response.status, 204); assert.match(response.headers.get('Access-Control-Allow-Methods'), /POST/);
  } finally { env.CATALOG.db.close(); }
});
test('global request budget limits repeated unsuccessful searches', async () => {
  const env = { CATALOG: database() }; const original = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ data: [] });
  try {
    for (let i = 0; i < 20; i++) assert.equal((await worker.fetch(request(), env)).status, 404);
    assert.equal((await worker.fetch(request(), env)).status, 429);
  } finally { globalThis.fetch = original; env.CATALOG.db.close(); }
});
