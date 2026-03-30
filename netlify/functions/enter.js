const { readSessions, writeSessions } = require('./_store');

exports.handler = async (event) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    const { page, page_label, enter_time } = JSON.parse(event.body);
    const ip = (event.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';

    const sessions = await readSessions();
    const id = Date.now() + Math.floor(Math.random() * 1000);
    sessions.push({
      id,
      ip,
      page,
      page_label: page_label || page,
      enter_time,
      leave_time: null,
      dwell_seconds: null,
      image_clicks: 0,
      cart_clicks: 0,
      created_at: new Date().toISOString()
    });
    await writeSessions(sessions);

    return { statusCode: 200, headers: cors, body: JSON.stringify({ session_id: id }) };
  } catch (e) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: e.message }) };
  }
};
