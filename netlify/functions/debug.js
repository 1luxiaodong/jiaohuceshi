exports.handler = async () => {
  const info = {
    node_version: process.version,
    netlify_site_id: process.env.NETLIFY_SITE_ID ? '✓' : '❌ 未设置',
    blobs_test: null,
    blobs_error: null
  };

  try {
    const { getStore } = require('@netlify/blobs');
    const store = getStore('ux-sessions');
    await store.set('test-key', 'hello');
    const val = await store.get('test-key', { type: 'text' });
    info.blobs_test = val === 'hello' ? '✓ 读写正常' : `❌ 读到: ${val}`;
    await store.delete('test-key');
  } catch (e) {
    info.blobs_error = e.message;
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(info, null, 2)
  };
};
