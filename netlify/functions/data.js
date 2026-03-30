const { db } = require('./_db');

exports.handler = async (event) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors, body: '' };

  try {
    if (event.httpMethod === 'GET') {
      const rows = await db('/sessions?select=*&order=created_at.desc');
      return { statusCode: 200, headers: cors, body: JSON.stringify(rows || []) };
    }

    if (event.httpMethod === 'DELETE') {
      // 删除所有记录（id > 0）
      await db('/sessions?id=gt.0', { method: 'DELETE' });
      return { statusCode: 200, headers: cors, body: '{"ok":true}' };
    }

    return { statusCode: 405, body: 'Method Not Allowed' };
  } catch (e) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: e.message }) };
  }
};
