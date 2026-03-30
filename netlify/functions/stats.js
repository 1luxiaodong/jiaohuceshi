const { db } = require('./_db');

exports.handler = async (event) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors, body: '' };
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    // 拉取所有有完整数据的 session，在 JS 中做聚合
    const rows = await db('/sessions?dwell_seconds=not.is.null&select=page,page_label,dwell_seconds,image_clicks,cart_clicks');

    const grouped = {};
    for (const r of (rows || [])) {
      if (!grouped[r.page]) {
        grouped[r.page] = {
          page: r.page,
          page_label: r.page_label,
          visit_count: 0,
          dwell_sum: 0,
          total_image_clicks: 0,
          total_cart_clicks: 0
        };
      }
      const g = grouped[r.page];
      g.visit_count++;
      g.dwell_sum += r.dwell_seconds || 0;
      g.total_image_clicks += r.image_clicks || 0;
      g.total_cart_clicks += r.cart_clicks || 0;
    }

    const stats = Object.values(grouped).map(g => ({
      page: g.page,
      page_label: g.page_label,
      visit_count: g.visit_count,
      avg_dwell_seconds: g.visit_count ? Math.round((g.dwell_sum / g.visit_count) * 100) / 100 : 0,
      total_image_clicks: g.total_image_clicks,
      total_cart_clicks: g.total_cart_clicks
    })).sort((a, b) => a.page.localeCompare(b.page));

    return { statusCode: 200, headers: cors, body: JSON.stringify(stats) };
  } catch (e) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: e.message }) };
  }
};
