// Server-side proxy for TheIntroDB.
//
// This runs on Netlify's servers, not in the browser, so the real
// INTRODB_API_KEY (set in Netlify → Site settings → Environment variables,
// never committed to git) is never shipped to anyone who visits the site
// or views the page source / GitHub repo.
//
// The browser only ever calls: /.netlify/functions/introdb?path=/media/...

const INTRODB_BASE = 'https://api.theintrodb.com';

// Only allow the exact path shapes the app actually needs, so this
// function can't be turned into an open proxy for arbitrary requests.
const ALLOWED_PATH = /^\/media\/(movie\/\d+|tv\/\d+\/\d+\/\d+)$/;

export default async (request) => {
  const apiKey = process.env.INTRODB_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Server is not configured with an INTRODB_API_KEY.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { searchParams } = new URL(request.url);
  const path = searchParams.get('path') || '';

  if (!ALLOWED_PATH.test(path)) {
    return new Response(JSON.stringify({ error: 'Invalid path.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const upstream = await fetch(`${INTRODB_BASE}${path}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: {
        'Content-Type': 'application/json',
        // Safe to cache briefly at the edge — skip-timestamp data for a
        // given episode doesn't change minute to minute.
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Upstream request failed.' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const config = { path: '/.netlify/functions/introdb' };
