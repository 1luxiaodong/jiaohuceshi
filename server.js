const express = require('express');
const Database = require('better-sqlite3');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// 确保 data 目录存在
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

// 初始化数据库
const db = new Database(path.join(dataDir, 'interactions.db'));

// 建表
db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip TEXT NOT NULL,
    page TEXT NOT NULL,
    page_label TEXT NOT NULL,
    enter_time INTEGER NOT NULL,
    leave_time INTEGER,
    dwell_seconds REAL,
    image_clicks INTEGER DEFAULT 0,
    cart_clicks INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

app.use(express.json());
app.use(express.static(__dirname));

// 获取客户端真实 IP
function getClientIP(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.socket.remoteAddress || req.ip || 'unknown';
}

// ============ API: 记录进入页面 ============
app.post('/api/enter', (req, res) => {
  const ip = getClientIP(req);
  const { page, page_label, enter_time } = req.body;
  if (!page || !enter_time) return res.status(400).json({ error: 'missing fields' });

  const stmt = db.prepare(
    'INSERT INTO sessions (ip, page, page_label, enter_time) VALUES (?, ?, ?, ?)'
  );
  const result = stmt.run(ip, page, page_label || page, enter_time);
  res.json({ session_id: result.lastInsertRowid });
});

// ============ API: 记录离开页面 ============
app.post('/api/leave', (req, res) => {
  const { session_id, leave_time, image_clicks, cart_clicks } = req.body;
  if (!session_id || !leave_time) return res.status(400).json({ error: 'missing fields' });

  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(session_id);
  if (!session) return res.status(404).json({ error: 'session not found' });

  const dwell = (leave_time - session.enter_time) / 1000;
  db.prepare(
    'UPDATE sessions SET leave_time=?, dwell_seconds=?, image_clicks=?, cart_clicks=? WHERE id=?'
  ).run(leave_time, dwell, image_clicks || 0, cart_clicks || 0, session_id);

  res.json({ ok: true });
});

// ============ API: 实时更新点击计数 ============
app.post('/api/click', (req, res) => {
  const { session_id, type } = req.body;
  if (!session_id || !type) return res.status(400).json({ error: 'missing fields' });

  if (type === 'image') {
    db.prepare('UPDATE sessions SET image_clicks = image_clicks + 1 WHERE id = ?').run(session_id);
  } else if (type === 'cart') {
    db.prepare('UPDATE sessions SET cart_clicks = cart_clicks + 1 WHERE id = ?').run(session_id);
  }
  res.json({ ok: true });
});

// ============ API: 查询所有数据 ============
app.get('/api/data', (req, res) => {
  const rows = db.prepare('SELECT * FROM sessions ORDER BY created_at DESC').all();
  res.json(rows);
});

// ============ API: 按页面汇总统计 ============
app.get('/api/stats', (req, res) => {
  const stats = db.prepare(`
    SELECT
      page,
      page_label,
      COUNT(*) as visit_count,
      COUNT(DISTINCT ip) as unique_visitors,
      ROUND(AVG(dwell_seconds), 2) as avg_dwell_seconds,
      SUM(image_clicks) as total_image_clicks,
      SUM(cart_clicks) as total_cart_clicks
    FROM sessions
    WHERE dwell_seconds IS NOT NULL
    GROUP BY page
    ORDER BY page
  `).all();
  res.json(stats);
});

// ============ API: 导出 Excel ============
app.get('/api/export', (req, res) => {
  const rows = db.prepare('SELECT * FROM sessions ORDER BY created_at DESC').all();

  const detail = rows.map(r => ({
    '记录ID': r.id,
    'IP地址': r.ip,
    '页面': r.page,
    '页面名称': r.page_label,
    '进入时间': r.enter_time ? new Date(r.enter_time).toLocaleString('zh-CN') : '',
    '离开时间': r.leave_time ? new Date(r.leave_time).toLocaleString('zh-CN') : '',
    '停留时长(秒)': r.dwell_seconds || '',
    '衣服点击次数': r.image_clicks,
    '购物车点击次数': r.cart_clicks,
    '记录时间': r.created_at
  }));

  const stats = db.prepare(`
    SELECT page, page_label,
      COUNT(*) as visit_count,
      COUNT(DISTINCT ip) as unique_visitors,
      ROUND(AVG(dwell_seconds), 2) as avg_dwell_seconds,
      ROUND(MAX(dwell_seconds), 2) as max_dwell_seconds,
      ROUND(MIN(dwell_seconds), 2) as min_dwell_seconds,
      SUM(image_clicks) as total_image_clicks,
      SUM(cart_clicks) as total_cart_clicks
    FROM sessions WHERE dwell_seconds IS NOT NULL GROUP BY page ORDER BY page
  `).all();

  const summary = stats.map(s => ({
    '页面': s.page,
    '页面名称': s.page_label,
    '访问次数': s.visit_count,
    '独立访客数': s.unique_visitors,
    '平均停留时长(秒)': s.avg_dwell_seconds,
    '最长停留时长(秒)': s.max_dwell_seconds,
    '最短停留时长(秒)': s.min_dwell_seconds,
    '衣服总点击次数': s.total_image_clicks,
    '购物车总点击次数': s.total_cart_clicks
  }));

  const wb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.json_to_sheet(detail);
  const ws2 = XLSX.utils.json_to_sheet(summary);
  XLSX.utils.book_append_sheet(wb, ws2, '汇总统计');
  XLSX.utils.book_append_sheet(wb, ws1, '详细记录');

  // 设置列宽
  ws1['!cols'] = [
    {wch:8},{wch:18},{wch:8},{wch:20},{wch:22},{wch:22},
    {wch:14},{wch:14},{wch:16},{wch:22}
  ];
  ws2['!cols'] = [
    {wch:8},{wch:20},{wch:10},{wch:12},{wch:18},
    {wch:18},{wch:18},{wch:16},{wch:18}
  ];

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const filename = `ux_test_${new Date().toISOString().slice(0,10)}.xlsx`;

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
  res.send(buffer);
});

// ============ API: 清空数据 ============
app.delete('/api/data', (req, res) => {
  db.prepare('DELETE FROM sessions').run();
  res.json({ ok: true });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ 用户体验测试服务器已启动`);
  console.log(`📱 本机访问: http://localhost:${PORT}`);
  console.log(`📊 数据管理: http://localhost:${PORT}/admin.html`);

  // 获取本机局域网IP
  const { networkInterfaces } = require('os');
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        console.log(`📱 手机访问: http://${net.address}:${PORT}`);
      }
    }
  }
});
