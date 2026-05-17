const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Password',
  'Access-Control-Max-Age': '86400',
};

// ── 비밀번호 (갠홈이랑 같은 거로 맞춰줘)
const PASSWORD = 'mittco';

function ok(data) {
  return new Response(JSON.stringify(data), {
    headers: { ...CORS, 'Content-Type': 'application/json' }
  });
}
function err(msg, status = 400) {
  return new Response(JSON.stringify({ error: msg }), {
    status, headers: { ...CORS, 'Content-Type': 'application/json' }
  });
}

async function initDB(db) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS entries (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      type      TEXT    NOT NULL DEFAULT 'text',
      title     TEXT    NOT NULL,
      content   TEXT    DEFAULT '',
      image_url TEXT    DEFAULT '',
      tags      TEXT    DEFAULT '[]',
      date      TEXT    NOT NULL,
      created_at TEXT   DEFAULT (datetime('now'))
    )
  `);
}

export default {
  async fetch(request, env) {
    // CORS preflight
    if (request.method === 'OPTIONS') {
    return new Response(null, { 
    status: 204,
    headers: CORS 
  });
}


    const url = new URL(request.url);
    const path = url.pathname;

    // 비밀번호 체크 (GET 제외)
    if (request.method !== 'GET') {
      const pw = request.headers.get('X-Password');
      if (pw !== PASSWORD) return err('비밀번호가 맞지 않아요', 401);
    }

    await initDB(env.DB);

    // ── GET /entries — 전체 목록
    if (request.method === 'GET' && path === '/entries') {
      const { results } = await env.DB.prepare(
        'SELECT * FROM entries ORDER BY date DESC, created_at DESC'
      ).all();
      const entries = results.map(r => ({
        ...r,
        tags: JSON.parse(r.tags || '[]')
      }));
      return ok(entries);
    }

    // ── POST /entries — 글 저장
    if (request.method === 'POST' && path === '/entries') {
      const body = await request.json();
      const { type, title, content, image_url, tags, date } = body;
      if (!title) return err('제목이 없어요');
      const stmt = env.DB.prepare(
        `INSERT INTO entries (type, title, content, image_url, tags, date)
         VALUES (?, ?, ?, ?, ?, ?)`
      );
      const result = await stmt.bind(
        type || 'text',
        title,
        content || '',
        image_url || '',
        JSON.stringify(tags || []),
        date || new Date().toISOString().slice(0, 10)
      ).run();
      return ok({ id: result.meta.last_row_id, message: '저장됐어요' });
    }

    // ── DELETE /entries/:id — 글 삭제
    const deleteMatch = path.match(/^\/entries\/(\d+)$/);
    if (request.method === 'DELETE' && deleteMatch) {
      const id = deleteMatch[1];
      await env.DB.prepare('DELETE FROM entries WHERE id = ?').bind(id).run();
      return ok({ message: '삭제됐어요' });
    }

    return err('없는 경로예요', 404);
  }
};
