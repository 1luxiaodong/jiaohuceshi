exports.handler = async () => {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

  const info = {
    node_version: process.version,
    supabase_url: SUPABASE_URL || '❌ 未设置',
    supabase_key: SUPABASE_KEY ? `✓ 已设置 (${SUPABASE_KEY.slice(0, 12)}...)` : '❌ 未设置',
    fetch_test: null,
    fetch_error: null
  };

  if (SUPABASE_URL && SUPABASE_KEY) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/sessions?select=id&limit=1`, {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      });
      const text = await res.text();
      info.fetch_test = `HTTP ${res.status}`;
      info.fetch_response = text.slice(0, 200);
    } catch (e) {
      info.fetch_error = e.message;
      info.fetch_cause = e.cause?.message || String(e.cause);
    }
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(info, null, 2)
  };
};
