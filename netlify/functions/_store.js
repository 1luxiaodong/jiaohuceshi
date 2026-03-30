const { getStore } = require('@netlify/blobs');

const KEY = 'all';

function getBlobStore() {
  const siteID = process.env.NETLIFY_SITE_ID;
  const token  = process.env.NETLIFY_TOKEN;
  if (!siteID || !token) {
    throw new Error(`Blobs 配置缺失: NETLIFY_SITE_ID=${siteID ? '✓' : '❌'}, NETLIFY_TOKEN=${token ? '✓' : '❌'}`);
  }
  return getStore({ name: 'ux-sessions', siteID, token });
}

async function readSessions() {
  try {
    const store = getBlobStore();
    const raw = await store.get(KEY, { type: 'text' });
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function writeSessions(sessions) {
  const store = getBlobStore();
  await store.set(KEY, JSON.stringify(sessions));
}

module.exports = { readSessions, writeSessions };
