-- 在 Supabase SQL Editor 中运行此脚本
-- 访问 https://app.supabase.com → 你的项目 → SQL Editor → New Query

CREATE TABLE IF NOT EXISTS sessions (
  id        BIGSERIAL PRIMARY KEY,
  ip        TEXT NOT NULL,
  page      TEXT NOT NULL,
  page_label TEXT NOT NULL,
  enter_time BIGINT NOT NULL,
  leave_time BIGINT,
  dwell_seconds REAL,
  image_clicks  INTEGER DEFAULT 0,
  cart_clicks   INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 关闭 RLS（实验数据，无需行级权限控制）
ALTER TABLE sessions DISABLE ROW LEVEL SECURITY;
