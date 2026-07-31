// Echo Worker entry point

// Hash helper using Web Crypto
export async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Constant-time string compare
export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

// Get password hash from DB; if missing, seed from env var
async function getPasswordHash(db, env) {
  const row = await db.prepare('SELECT value FROM meta WHERE key = ?').bind('password_hash').first();
  if (row && row.value) return row.value;
  // Seed initial password from env
  const initial = env.PASSWORD || 'change-me-please';
  const hash = await sha256(initial);
  await db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').bind('password_hash', hash).run();
  return hash;
}

// Cookie helpers
function getCookie(req, name) {
  const header = req.headers.get('Cookie') || '';
  const re = new RegExp('(?:^|; )' + name.replace(/[.$?*|{}()[\]\\/+^]/g, '\\$&') + '=([^;]*)');
  const m = header.match(re);
  return m ? decodeURIComponent(m[1]) : null;
}

export async function isAuthenticated(req, db, env) {
  const token = getCookie(req, 'echo_session');
  if (!token) return false;
  const hash = await getPasswordHash(db, env);
  return safeEqual(token, hash);
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
  });
}

function setSessionCookie(hash) {
  // 10 years
  const maxAge = 60 * 60 * 24 * 365 * 10;
  return `echo_session=${encodeURIComponent(hash)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

function clearSessionCookie() {
  return `echo_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

async function handleLogin(req, db, env) {
  let body;
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  const password = body && typeof body.password === 'string' ? body.password : '';
  if (!password) return json({ error: 'Password required' }, 400);
  if (password.length > 1024) return json({ error: 'Password too long' }, 400);

  const hash = await getPasswordHash(db, env);
  const candidate = await sha256(password);
  if (!safeEqual(candidate, hash)) return json({ error: 'Wrong password' }, 401);

  return json({ ok: true }, 200, { 'Set-Cookie': setSessionCookie(hash) });
}

async function handleLogout() {
  return json({ ok: true }, 200, { 'Set-Cookie': clearSessionCookie() });
}

async function handleChangePassword(req, db, env) {
  let body;
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  const { current, next, confirm } = body || {};
  if (typeof current !== 'string' || typeof next !== 'string' || typeof confirm !== 'string')
    return json({ error: 'All fields required' }, 400);
  if (next !== confirm) return json({ error: 'Passwords do not match' }, 400);
  if (next.length < 1) return json({ error: 'Password cannot be empty' }, 400);
  if (next.length > 1024) return json({ error: 'Password too long' }, 400);

  const currentHash = await getPasswordHash(db, env);
  const candidate = await sha256(current);
  if (!safeEqual(candidate, currentHash)) return json({ error: 'Current password is wrong' }, 401);

  const newHash = await sha256(next);
  await db.prepare('UPDATE meta SET value = ? WHERE key = ?').bind(newHash, 'password_hash').run();

  // Issue new session cookie bound to new hash — old sessions invalidated automatically
  return json({ ok: true }, 200, { 'Set-Cookie': setSessionCookie(newHash) });
}

async function handleStatus(req, db, env) {
  const ok = await isAuthenticated(req, db, env);
  return json({ authenticated: ok });
}

// ---- Message endpoints ----

const MAX_BYTES = 600 * 1024; // 600 KiB

async function handleListMessages(req, db, env) {
  const url = new URL(req.url);
  const before = parseInt(url.searchParams.get('before') || '0', 10) || 0;
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '30', 10) || 30, 100);

  let stmt;
  if (before > 0) {
    stmt = db.prepare('SELECT id, content, format, language, created_at, updated_at, is_edited FROM messages WHERE id < ? ORDER BY id DESC LIMIT ?').bind(before, limit);
  } else {
    stmt = db.prepare('SELECT id, content, format, language, created_at, updated_at, is_edited FROM messages ORDER BY id DESC LIMIT ?').bind(limit);
  }
  const { results } = await stmt.all();
  const hasMore = results.length === limit;
  return json({ messages: results, hasMore });
}

async function handleCreateMessage(req, db, env) {
  let body;
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  const content = body && typeof body.content === 'string' ? body.content : '';
  const format = ['plain', 'markdown', 'code'].includes(body?.format) ? body.format : 'plain';
  const language = typeof body?.language === 'string' ? body.language.slice(0, 64) : null;

  if (!content) return json({ error: 'Content required' }, 400);
  // byte-length check
  const bytes = new TextEncoder().encode(content).length;
  if (bytes > MAX_BYTES) return json({ error: `Message exceeds 600KiB (got ${bytes} bytes)` }, 413);

  const now = Date.now();
  const res = await db.prepare(
    'INSERT INTO messages (content, format, language, created_at, updated_at, is_edited) VALUES (?, ?, ?, ?, ?, 0)'
  ).bind(content, format, language, now, now).run();

  const row = await db.prepare('SELECT id, content, format, language, created_at, updated_at, is_edited FROM messages WHERE id = ?').bind(res.meta.last_row_id).first();
  return json({ message: row }, 201);
}

async function handleUpdateMessage(req, db, env, id) {
  let body;
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  const content = body && typeof body.content === 'string' ? body.content : null;
  const format = ['plain', 'markdown', 'code'].includes(body?.format) ? body.format : null;
  const language = typeof body?.language === 'string' ? body.language.slice(0, 64) : null;

  if (content === null) return json({ error: 'Content required' }, 400);
  const bytes = new TextEncoder().encode(content).length;
  if (bytes > MAX_BYTES) return json({ error: `Message exceeds 600KiB (got ${bytes} bytes)` }, 413);

  const now = Date.now();
  await db.prepare(
    'UPDATE messages SET content = ?, format = ?, language = ?, updated_at = ?, is_edited = 1 WHERE id = ?'
  ).bind(content, format || 'plain', language, now, id).run();

  const row = await db.prepare('SELECT id, content, format, language, created_at, updated_at, is_edited FROM messages WHERE id = ?').bind(id).first();
  if (!row) return json({ error: 'Not found' }, 404);
  return json({ message: row });
}

async function handleDeleteMessage(db, id) {
  await db.prepare('DELETE FROM messages WHERE id = ?').bind(id).run();
  return json({ ok: true });
}

async function handleBatchDelete(req, db) {
  let body;
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  const ids = Array.isArray(body?.ids) ? body.ids.filter(x => Number.isInteger(x)) : [];
  if (!ids.length) return json({ error: 'No ids provided' }, 400);
  if (ids.length > 1000) return json({ error: 'Too many ids' }, 400);

  const placeholders = ids.map(() => '?').join(',');
  await db.prepare(`DELETE FROM messages WHERE id IN (${placeholders})`).bind(...ids).run();
  return json({ ok: true, deleted: ids.length });
}

async function handleSearch(req, db) {
  const url = new URL(req.url);
  const q = (url.searchParams.get('q') || '').trim();
  if (!q) return json({ messages: [], hasMore: false });
  if (q.length > 256) return json({ error: 'Query too long' }, 400);

  const before = parseInt(url.searchParams.get('before') || '0', 10) || 0;
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '30', 10) || 30, 100);

  // Sanitize FTS query: wrap each token in quotes to avoid special syntax.
  // Use OR so multi-word queries match any word (more forgiving).
  const safe = q.split(/\s+/).filter(Boolean)
    .map(t => '"' + t.replace(/"/g, '""') + '"')
    .join(' OR ');

  let sql, binds;
  try {
    if (before > 0) {
      sql = `SELECT m.id, m.content, m.format, m.language, m.created_at, m.updated_at, m.is_edited
             FROM messages_fts f
             JOIN messages m ON m.id = f.rowid
             WHERE messages_fts MATCH ? AND m.id < ?
             ORDER BY m.id DESC LIMIT ?`;
      binds = [safe, before, limit];
    } else {
      sql = `SELECT m.id, m.content, m.format, m.language, m.created_at, m.updated_at, m.is_edited
             FROM messages_fts f
             JOIN messages m ON m.id = f.rowid
             WHERE messages_fts MATCH ?
             ORDER BY m.id DESC LIMIT ?`;
      binds = [safe, limit];
    }
    const { results } = await db.prepare(sql).bind(...binds).all();
    const hasMore = results.length === limit;
    return json({ messages: results, hasMore });
  } catch (err) {
    // FTS may fail on weird inputs; fall back to LIKE search
    const like = '%' + q + '%';
    let sql2, binds2;
    if (before > 0) {
      sql2 = `SELECT id, content, format, language, created_at, updated_at, is_edited
              FROM messages WHERE content LIKE ? AND id < ? ORDER BY id DESC LIMIT ?`;
      binds2 = [like, before, limit];
    } else {
      sql2 = `SELECT id, content, format, language, created_at, updated_at, is_edited
              FROM messages WHERE content LIKE ? ORDER BY id DESC LIMIT ?`;
      binds2 = [like, limit];
    }
    const { results } = await db.prepare(sql2).bind(...binds2).all();
    const hasMore = results.length === limit;
    return json({ messages: results, hasMore });
  }
}

async function handleStats(db) {
  const row = await db.prepare('SELECT COUNT(*) AS count, MAX(created_at) AS last FROM messages').first();
  return json({ count: row?.count || 0, last: row?.last || null });
}

// ---- Settings endpoints ----

async function handleGetSettings(db) {
  const row = await db.prepare('SELECT value FROM meta WHERE key = ?').bind('settings').first();
  if (!row || !row.value) return json({ settings: {} });
  try { return json({ settings: JSON.parse(row.value) }); }
  catch { return json({ settings: {} }); }
}

async function handleSaveSettings(req, db) {
  let body;
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return json({ error: 'Expected settings object' }, 400);
  }
  // Allow only JSON-serializable, size-capped settings
  const serialized = JSON.stringify(body);
  if (serialized.length > 64 * 1024) return json({ error: 'Settings too large' }, 413);
  await db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').bind('settings', serialized).run();
  return json({ ok: true, settings: body });
}

// ---- Draft endpoints (cross-device sync) ----

async function handleGetDraft(db) {
  const row = await db.prepare('SELECT value FROM meta WHERE key = ?').bind('draft').first();
  if (!row || !row.value) return json({ draft: null });
  try { return json({ draft: JSON.parse(row.value) }); }
  catch { return json({ draft: null }); }
}

async function handleSaveDraft(req, db) {
  let body;
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return json({ error: 'Expected draft object' }, 400);
  }
  const draft = {
    content: typeof body.content === 'string' ? body.content : '',
    format: ['plain', 'markdown', 'code'].includes(body.format) ? body.format : 'plain',
    language: typeof body.language === 'string' ? body.language.slice(0, 64) : null,
    updated_at: Date.now(),
  };
  if (new TextEncoder().encode(draft.content).length > MAX_BYTES) {
    return json({ error: 'Draft exceeds 600KiB' }, 413);
  }
  await db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').bind('draft', JSON.stringify(draft)).run();
  return json({ ok: true, draft });
}

async function handleClearDraft(db) {
  await db.prepare('DELETE FROM meta WHERE key = ?').bind('draft').run();
  return json({ ok: true });
}

// ---- Router ----

async function apiRouter(req, db, env, url) {
  const path = url.pathname;
  const method = req.method.toUpperCase();

  // Public auth endpoints
  if (path === '/api/status' && method === 'GET') return handleStatus(req, db, env);
  if (path === '/api/login' && method === 'POST') return handleLogin(req, db, env);
  if (path === '/api/logout' && method === 'POST') return handleLogout();

  // Everything below requires auth
  const authed = await isAuthenticated(req, db, env);
  if (!authed) return json({ error: 'Unauthorized' }, 401);

  if (path === '/api/password' && method === 'POST') return handleChangePassword(req, db, env);
  if (path === '/api/messages' && method === 'GET') return handleListMessages(req, db, env);
  if (path === '/api/messages' && method === 'POST') return handleCreateMessage(req, db, env);
  if (path === '/api/messages/batch-delete' && method === 'POST') return handleBatchDelete(req, db);

  const m = path.match(/^\/api\/messages\/(\d+)$/);
  if (m) {
    const id = parseInt(m[1], 10);
    if (method === 'PUT') return handleUpdateMessage(req, db, env, id);
    if (method === 'DELETE') return handleDeleteMessage(db, id);
  }

  if (path === '/api/search' && method === 'GET') return handleSearch(req, db);
  if (path === '/api/stats' && method === 'GET') return handleStats(db);

  if (path === '/api/settings' && method === 'GET') return handleGetSettings(db);
  if (path === '/api/settings' && method === 'POST') return handleSaveSettings(req, db);

  if (path === '/api/draft' && method === 'GET') return handleGetDraft(db);
  if (path === '/api/draft' && method === 'POST') return handleSaveDraft(req, db);
  if (path === '/api/draft' && method === 'DELETE') return handleClearDraft(db);

  return json({ error: 'Not found' }, 404);
}

// ---- Main fetch handler ----

export default {
  async fetch(req, env, ctx) {
    const db = env.DB;
    const url = new URL(req.url);

    // Healthcheck
    if (url.pathname === '/api/health') return json({ ok: true, name: 'echo' });

    // API routes
    if (url.pathname.startsWith('/api/')) {
      try {
        return await apiRouter(req, db, env, url);
      } catch (err) {
        console.error('API error', err);
        return json({ error: 'Server error', detail: String(err && err.message || err) }, 500);
      }
    }

    // Static assets (HTML/CSS/JS)
    // If ASSETS binding exists, delegate to it
    if (env.ASSETS) {
      return env.ASSETS.fetch(req);
    }

    return new Response('Not found', { status: 404 });
  },
};
