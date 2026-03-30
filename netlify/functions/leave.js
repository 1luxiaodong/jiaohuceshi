const { readSessions, writeSessions } = require('./_store');

exports.handler = async (event) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    const { session_id, leave_time, image_clicks, cart_clicks } = JSON.parse(event.body);
    const sessions = await readSessions();
    const idx = sessions.findIndex(s => s.id === session_id);
    if (idx === -1) return { statusCode: 404, headers: cors, body: '{"error":"not found"}' };

    const s = sessions[idx];
    s.leave_time = leave_time;
    s.dwell_seconds = Math.round((leave_time - s.enter_time) / 100) / 10;
    s.image_clicks = image_clicks || 0;
    s.cart_clicks = cart_clicks || 0;
    await writeSessions(sessions);

    return { statusCode: 200, headers: cors, body: '{"ok":true}' };
  } catch (e) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: e.message }) };
  }
};
