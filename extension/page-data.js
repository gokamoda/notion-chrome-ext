// Load page chunks and missing children. Keep the public facade shared by the controller and tests.
(() => {
  'use strict';
  const { normalize, uuid } = NotionLinksRecords;
  const { ORIGINS, post } = NotionLinksAPI;
  const { parse } = NotionLinksStructure;
  const { loadBacklinks } = NotionLinksBacklinks;

  async function load(pageId, { origin = location.origin, signal } = {}) {
    if (!ORIGINS.includes(origin)) throw Error('Notion以外への通信は拒否しました。');
    if (!/^[a-f0-9]{32}$/.test(normalize(pageId))) throw Error('ページIDが不正です。');
    const map = {},
      cursors = new Set();
    let cursor = { stack: [] },
      complete = false,
      chunks = 0;
    for (; chunks < 20; chunks++) {
      const key = JSON.stringify(cursor);
      if (cursors.has(key)) throw Error('ページの読み込みカーソルが進みません。');
      cursors.add(key);
      const data = await post(
        origin,
        'loadPageChunk',
        {
          pageId: uuid(pageId),
          limit: 100,
          cursor,
          chunkNumber: chunks,
          verticalColumns: false,
        },
        signal,
      );
      if (
        !data?.recordMap?.block ||
        typeof data.recordMap.block !== 'object' ||
        !Array.isArray(data.cursor?.stack)
      )
        throw Error('Notionの応答形式が変わった可能性があります。');
      Object.assign(map, data.recordMap.block);
      cursor = data.cursor;
      if (Object.keys(map).length > 10000) break;
      if (cursor.stack.length === 0) {
        complete = true;
        chunks++;
        break;
      }
    }
    /* Children of closed toggles are not in loadPageChunk's response (observed 2026-11-12).
     * Read them with syncRecordValues (same request as in loadBacklinks), a few levels deep. */
    let parsed = parse(map, pageId, origin);
    for (
      let round = 0;
      round < 6 && parsed.missingIds.length && Object.keys(map).length < 10000;
      round++
    ) {
      const before = Object.keys(map).length;
      for (let i = 0; i < parsed.missingIds.length; i += 100) {
        const reply = await post(
          origin,
          'syncRecordValues',
          {
            requests: parsed.missingIds.slice(i, i + 100).map((id) => ({
              pointer: {
                table: 'block',
                id: uuid(id),
                ...(parsed.spaceId ? { spaceId: parsed.spaceId } : {}),
              },
              version: -1,
            })),
          },
          signal,
        );
        Object.assign(map, reply?.recordMap?.block || {});
      }
      parsed = parse(map, pageId, origin);
      if (Object.keys(map).length === before) break;
    }
    return {
      ...parsed,
      complete,
      chunks,
      recordCount: Object.keys(map).length,
      time: new Date().toLocaleTimeString('ja-JP'),
    };
  }

  globalThis.NotionLinksPageData = Object.freeze({ parse, load, loadBacklinks, normalize });
})();
