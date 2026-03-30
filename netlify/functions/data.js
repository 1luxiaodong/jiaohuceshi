const { readSessions, writeSessions } = require('./_store');

exports.handler = async (event) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors, body: '' };

  try {
    if (event.httpMethod === 'GET') {
      const sessions = await readSessions();
      return { statusCode: 200, headers: cors, body: JSON.stringify(sessions.reverse()) };
    }
    if (event.httpMethod === 'DELETE') {
      await writeSessions([]);
      return { statusCode: 200, headers: cors, body: '{"ok":true}' };
    }
    return { statusCode: 405, body: 'Method Not Allowed' };
  } catch (e) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: e.message }) };
  }
};
