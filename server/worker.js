import { createPoem, deletePoem, importPoems, listPoems, updatePoem } from './poems-db.js';

const maxPoemLength = 10000;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const idPattern = /^[a-zA-Z0-9-]{1,80}$/;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/poems')) {
      // The worker asset binding needs an explicit file for the site root.
      // Keep normal asset paths untouched so styles, sections and images load
      // from the same published build.
      if (url.pathname === '/') {
        url.pathname = '/index.html';
        return env.ASSETS.fetch(new Request(url, request));
      }
      return env.ASSETS.fetch(request);
    }

    if (!env.DB) return json({ error: 'Poem storage is unavailable.' }, 503);

    const pathParts = url.pathname.split('/').filter(Boolean);
    const poemId = pathParts[2] ? decodeURIComponent(pathParts[2]) : null;

    if (request.method === 'GET' && !poemId) {
      return json({ poems: await listPoems(env.DB) });
    }

    if (request.method === 'POST' && pathParts[2] === 'import') {
      const body = await request.json().catch(() => null);
      const poems = Array.isArray(body?.poems) ? body.poems.map(normalisePoem).filter(Boolean) : [];
      await importPoems(env.DB, poems);
      return json({ imported: poems.length });
    }

    if (request.method === 'POST' && !poemId) {
      const poem = normalisePoem(await request.json().catch(() => null));
      if (!poem) return json({ error: 'A poem needs a date and text.' }, 400);
      return json({ poem: await createPoem(env.DB, poem) }, 201);
    }

    if (request.method === 'PATCH' && poemId) {
      const poem = normalisePoem({ ...(await request.json().catch(() => null)), id: poemId });
      if (!poem) return json({ error: 'A poem needs a date and text.' }, 400);
      return json({ poem: await updatePoem(env.DB, poem) });
    }

    if (request.method === 'DELETE' && poemId && idPattern.test(poemId)) {
      await deletePoem(env.DB, poemId);
      return new Response(null, { status: 204 });
    }

    return json({ error: 'Not found.' }, 404);
  },
};

function normalisePoem(value) {
  if (!value || typeof value !== 'object') return null;
  const id = typeof value.id === 'string' ? value.id.trim() : '';
  const date = typeof value.date === 'string' ? value.date.trim() : '';
  const content = typeof value.content === 'string' ? value.content.trim().slice(0, maxPoemLength) : '';
  if (!idPattern.test(id) || !datePattern.test(date) || !content) return null;
  return { id, date, content };
}

function json(body, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}
