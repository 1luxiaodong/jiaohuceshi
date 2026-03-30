const { db } = require('./_db');

exports.handler = async (event) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    const { session_id, type } = JSON.parse(event.body);

    // 先读当前值再 +1（Supabase REST 不支持原子自增，用 RPC 或读后写）
    const rows = await db(`/sessions?id=eq.${session_id}&select=image_clicks,cart_clicks`);
    if (!rows || !rows.length) return { statusCode: 404, headers: cors, body: '{"error":"not found"}' };

    const update = type === 'image'
      ? { image_clicks: (rows[0].image_clicks || 0) + 1 }
      : { cart_clicks: (rows[0].cart_clicks || 0) + 1 };

    await db(`/sessions?id=eq.${session_id}`, { method: 'PATCH', body: JSON.stringify(update) });

    return { statusCode: 200, headers: cors, body: '{"ok":true}' };
  } catch (e) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: e.message }) };
  }
};
