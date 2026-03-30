const { db } = require('./_db');

exports.handler = async (event) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    const { page, page_label, enter_time } = JSON.parse(event.body);
    const ip = (event.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';

    const data = await db('/sessions', {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify({ ip, page, page_label: page_label || page, enter_time })
    });

    return {
      statusCode: 200,
      headers: cors,
      body: JSON.stringify({ session_id: data[0]?.id })
    };
  } catch (e) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: e.message }) };
  }
};
