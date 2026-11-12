// HTTP transport: session credentials, timeout and cancellation. No page writes.
(() => {
  'use strict';
  const ORIGINS = ['https://app.notion.com', 'https://www.notion.so', 'https://notion.so'];

  async function post(origin, endpoint, body, signal) {
    const controller = new AbortController(),
      abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) controller.abort();
    const timeout = setTimeout(abort, 12000);
    try {
      const response = await fetch(`${origin}/api/v3/${endpoint}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify(body),
      });
      if (!response.ok)
        throw Error(`Notionの読み取りに失敗しました（${endpoint}、HTTP ${response.status}）。`);
      return await response.json();
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
    }
  }

  globalThis.NotionLinksAPI = Object.freeze({ ORIGINS, post });
})();
