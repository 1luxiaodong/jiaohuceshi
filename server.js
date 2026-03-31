const express = require('express');
const { createClient } = require('@libsql/client');
const XLSX = require('xlsx');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// 初始化 Turso 客户端（libsql:// 转为 https:// 确保兼容 Render 网络）
const rawUrl = process.env.TURSO_URL || 'file:local.db';
const tursoUrl = rawUrl.startsWith('libsql://') ? rawUrl.replace('libsql://', 'https://') : rawUrl;
const db = createClient({
  url: tursoUrl,
  authToken: process.env.TURSO_TOKEN || undefined
});

// 建表
async function initDB() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS sessions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      ip          TEXT NOT NULL,
      page        TEXT NOT NULL,
      page_label  TEXT NOT NULL,
      enter_time  INTEGER NOT NULL,
      leave_time  INTEGER,
      dwell_seconds REAL,
      image_clicks  INTEGER DEFAULT 0,
      cart_clicks   INTEGER DEFAULT 0,
      created_at  TEXT DEFAULT (datetime('now'))
    )
  `);
  console.log('✅ 数据库已就绪');
}

app.use(express.json());
app.use(express.static(__dirname));

function getClientIP(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.socket.remoteAddress || req.ip || 'unknown';
}

// ============ API: 记录进入页面 ============
app.post('/api/enter', async (req, res) => {
  try {
    const ip = getClientIP(req);
    const { page, page_label, enter_time } = req.body;
    const result = await db.execute({
      sql: 'INSERT INTO sessions (ip, page, page_label, enter_time) VALUES (?,?,?,?)',
      args: [ip, page, page_label || page, enter_time]
    });
    res.json({ session_id: Number(result.lastInsertRowid) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============ API: 记录离开页面 ============
app.post('/api/leave', async (req, res) => {
  try {
    const { session_id, leave_time, image_clicks, cart_clicks } = req.body;
    const r = await db.execute({ sql: 'SELECT enter_time FROM sessions WHERE id=?', args: [session_id] });
    if (!r.rows.length) return res.status(404).json({ error: 'not found' });
    const dwell = (leave_time - Number(r.rows[0].enter_time)) / 1000;
    await db.execute({
      sql: 'UPDATE sessions SET leave_time=?,dwell_seconds=?,image_clicks=?,cart_clicks=? WHERE id=?',
      args: [leave_time, dwell, image_clicks || 0, cart_clicks || 0, session_id]
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============ API: 实时更新点击计数 ============
app.post('/api/click', async (req, res) => {
  try {
    const { session_id, type } = req.body;
    if (type === 'image') {
      await db.execute({ sql: 'UPDATE sessions SET image_clicks=image_clicks+1 WHERE id=?', args: [session_id] });
    } else if (type === 'cart') {
      await db.execute({ sql: 'UPDATE sessions SET cart_clicks=cart_clicks+1 WHERE id=?', args: [session_id] });
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============ API: 查询所有数据 ============
app.get('/api/data', async (req, res) => {
  try {
    const r = await db.execute('SELECT * FROM sessions ORDER BY id DESC');
    res.json(r.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============ API: 按页面汇总统计 ============
app.get('/api/stats', async (req, res) => {
  try {
    const r = await db.execute(`
      SELECT page, page_label,
        COUNT(*) as visit_count,
        ROUND(AVG(dwell_seconds),2) as avg_dwell_seconds,
        SUM(image_clicks) as total_image_clicks,
        SUM(cart_clicks) as total_cart_clicks
      FROM sessions
      WHERE dwell_seconds IS NOT NULL
      GROUP BY page ORDER BY page
    `);
    res.json(r.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============ 导出 Excel 公共函数 ============
function buildExcel(rows) {
  const detail = rows.map(r => ({
    '记录ID': Number(r.id),
    'IP地址': r.ip,
    '页面': r.page,
    '页面名称': r.page_label,
    '进入时间': r.enter_time ? new Date(Number(r.enter_time)).toLocaleString('zh-CN') : '',
    '离开时间': r.leave_time ? new Date(Number(r.leave_time)).toLocaleString('zh-CN') : '',
    '停留时长(秒)': r.dwell_seconds ?? '',
    '商品点击次数': Number(r.image_clicks) || 0,
    '购物车点击次数': Number(r.cart_clicks) || 0,
    '记录时间': r.created_at
  }));

  const completed = rows.filter(r => r.dwell_seconds != null);
  const byPage = {};
  completed.forEach(r => {
    if (!byPage[r.page]) byPage[r.page] = { page: r.page, page_label: r.page_label, rows: [] };
    byPage[r.page].rows.push(r);
  });
  const summary = Object.values(byPage).map(g => {
    const dwells = g.rows.map(r => Number(r.dwell_seconds));
    return {
      '页面': g.page,
      '页面名称': g.page_label,
      '访问次数': g.rows.length,
      '平均停留时长(秒)': +(dwells.reduce((a,b)=>a+b,0)/dwells.length).toFixed(2),
      '最长停留时长(秒)': +Math.max(...dwells).toFixed(2),
      '最短停留时长(秒)': +Math.min(...dwells).toFixed(2),
      '商品总点击次数': g.rows.reduce((s,r)=>s+(Number(r.image_clicks)||0),0),
      '购物车总点击次数': g.rows.reduce((s,r)=>s+(Number(r.cart_clicks)||0),0)
    };
  }).sort((a,b)=>a['页面'].localeCompare(b['页面']));

  const wb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.json_to_sheet(summary);
  const ws2 = XLSX.utils.json_to_sheet(detail);
  ws1['!cols'] = [{wch:8},{wch:22},{wch:10},{wch:16},{wch:16},{wch:16},{wch:16},{wch:18}];
  ws2['!cols'] = [{wch:8},{wch:18},{wch:8},{wch:22},{wch:22},{wch:22},{wch:14},{wch:14},{wch:16},{wch:22}];
  XLSX.utils.book_append_sheet(wb, ws1, '汇总统计');
  XLSX.utils.book_append_sheet(wb, ws2, '详细记录');
  return wb;
}

// ============ API: 导出 Excel（支持 ?page=pageX 单页导出）============
app.get('/api/export', async (req, res) => {
  try {
    const page = req.query.page;
    let rows, label;
    if (page) {
      const r = await db.execute({ sql: 'SELECT * FROM sessions WHERE page=? ORDER BY id DESC', args: [page] });
      rows = r.rows;
      label = rows.length ? rows[0].page_label : page;
    } else {
      const r = await db.execute('SELECT * FROM sessions ORDER BY id DESC');
      rows = r.rows;
      label = '全部';
    }
    const wb = buildExcel(rows);
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const filename = `ux_test_${label}_${new Date().toISOString().slice(0,10)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.send(buffer);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============ API: 清空数据 ============
app.delete('/api/data', async (req, res) => {
  try {
    await db.execute('DELETE FROM sessions');
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 启动
initDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`📱 服务器运行在 http://localhost:${PORT}`);
    console.log(`📊 数据库: ${process.env.TURSO_URL ? 'Turso 云端' : '本地文件'}`);
  });
}).catch(err => {
  console.error('数据库初始化失败:', err);
  process.exit(1);
});
