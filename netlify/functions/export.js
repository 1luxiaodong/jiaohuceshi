const XLSX = require('xlsx');
const { db } = require('./_db');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    const rows = await db('/sessions?select=*&order=created_at.desc') || [];

    // 详细记录
    const detail = rows.map(r => ({
      '记录ID': r.id,
      'IP地址': r.ip,
      '页面': r.page,
      '页面名称': r.page_label,
      '进入时间': r.enter_time ? new Date(r.enter_time).toLocaleString('zh-CN') : '',
      '离开时间': r.leave_time ? new Date(r.leave_time).toLocaleString('zh-CN') : '',
      '停留时长(秒)': r.dwell_seconds ?? '',
      '衣服点击次数': r.image_clicks,
      '购物车点击次数': r.cart_clicks,
      '记录时间': r.created_at
    }));

    // 汇总统计
    const grouped = {};
    for (const r of rows) {
      if (r.dwell_seconds == null) continue;
      if (!grouped[r.page]) grouped[r.page] = { page: r.page, page_label: r.page_label, visits: [], img: 0, cart: 0 };
      grouped[r.page].visits.push(r.dwell_seconds);
      grouped[r.page].img += r.image_clicks || 0;
      grouped[r.page].cart += r.cart_clicks || 0;
    }
    const summary = Object.values(grouped).map(g => {
      const avg = g.visits.reduce((a, b) => a + b, 0) / g.visits.length;
      return {
        '页面': g.page,
        '页面名称': g.page_label,
        '访问次数': g.visits.length,
        '平均停留时长(秒)': Math.round(avg * 100) / 100,
        '最长停留时长(秒)': Math.max(...g.visits),
        '最短停留时长(秒)': Math.min(...g.visits),
        '衣服总点击次数': g.img,
        '购物车总点击次数': g.cart
      };
    });

    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet(summary);
    const ws2 = XLSX.utils.json_to_sheet(detail);
    ws1['!cols'] = [{wch:8},{wch:22},{wch:10},{wch:18},{wch:18},{wch:18},{wch:16},{wch:18}];
    ws2['!cols'] = [{wch:8},{wch:18},{wch:8},{wch:22},{wch:22},{wch:22},{wch:14},{wch:14},{wch:16},{wch:22}];
    XLSX.utils.book_append_sheet(wb, ws1, '汇总统计');
    XLSX.utils.book_append_sheet(wb, ws2, '详细记录');

    const buf = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
    const filename = `ux_test_${new Date().toISOString().slice(0, 10)}.xlsx`;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`
      },
      body: buf,
      isBase64Encoded: true
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
