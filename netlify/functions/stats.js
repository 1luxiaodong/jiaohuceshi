const { readSessions } = require('./_store');

exports.handler = async (event) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors, body: '' };
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    const sessions = await readSessions();
    const grouped = {};

    for (const s of sessions) {
      if (s.dwell_seconds == null) continue;
      if (!grouped[s.page]) {
        grouped[s.page] = { page: s.page, page_label: s.page_label, visits: [], img: 0, cart: 0 };
      }
      grouped[s.page].visits.push(s.dwell_seconds);
      grouped[s.page].img += s.image_clicks || 0;
      grouped[s.page].cart += s.cart_clicks || 0;
    }

    const stats = Object.values(grouped).map(g => ({
      page: g.page,
      page_label: g.page_label,
      visit_count: g.visits.length,
      avg_dwell_seconds: g.visits.length
        ? Math.round(g.visits.reduce((a, b) => a + b, 0) / g.visits.length * 100) / 100
        : 0,
      total_image_clicks: g.img,
      total_cart_clicks: g.cart
    })).sort((a, b) => a.page.localeCompare(b.page));

    return { statusCode: 200, headers: cors, body: JSON.stringify(stats) };
  } catch (e) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: e.message }) };
  }
};
