// 用 Netlify Blobs 存储数据（无需外部数据库）
const { getStore } = require('@netlify/blobs');

const STORE_NAME = 'ux-sessions';
const KEY = 'all';

async function readSessions() {
  try {
    const store = getStore(STORE_NAME);
    const raw = await store.get(KEY, { type: 'text' });
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function writeSessions(sessions) {
  const store = getStore(STORE_NAME);
  await store.set(KEY, JSON.stringify(sessions));
}

module.exports = { readSessions, writeSessions };
