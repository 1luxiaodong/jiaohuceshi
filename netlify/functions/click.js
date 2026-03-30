const { readSessions, writeSessions } = require('./_store');

exports.handler = async (event) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    const { session_id, type } = JSON.parse(event.body);
    const sessions = await readSessions();
    const s = sessions.find(s => s.id === session_id);
    if (!s) return { statusCode: 404, headers: cors, body: '{"error":"not found"}' };

    if (type === 'image') s.image_clicks = (s.image_clicks || 0) + 1;
    else if (type === 'cart') s.cart_clicks = (s.cart_clicks || 0) + 1;
    await writeSessions(sessions);

    return { statusCode: 200, headers: cors, body: '{"ok":true}' };
  } catch (e) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: e.message }) };
  }
};
