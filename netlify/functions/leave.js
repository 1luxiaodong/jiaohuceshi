const { db } = require('./_db');

exports.handler = async (event) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    const { session_id, leave_time, image_clicks, cart_clicks } = JSON.parse(event.body);

    // 先查 enter_time
    const rows = await db(`/sessions?id=eq.${session_id}&select=enter_time`);
    if (!rows || !rows.length) return { statusCode: 404, headers: cors, body: '{"error":"not found"}' };

    const dwell_seconds = (leave_time - rows[0].enter_time) / 1000;

    await db(`/sessions?id=eq.${session_id}`, {
      method: 'PATCH',
      body: JSON.stringify({ leave_time, dwell_seconds, image_clicks: image_clicks || 0, cart_clicks: cart_clicks || 0 })
    });

    return { statusCode: 200, headers: cors, body: '{"ok":true}' };
  } catch (e) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: e.message }) };
  }
};
