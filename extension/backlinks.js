// Resolve native backlink references to their nearest source page, fetching missing ancestors.
(() => {
  'use strict';
  const CAP = 2000;
  const { normalize, uuid, recordsFrom, plainTitle } = NotionLinksRecords;
  const { ORIGINS, post } = NotionLinksAPI;

  async function loadBacklinks(pageId, { origin = location.origin, signal } = {}) {
    if (!ORIGINS.includes(origin)) throw Error('Notion以外への通信は拒否しました。');
    const self = normalize(pageId);
    if (!/^[a-f0-9]{32}$/.test(self)) throw Error('ページIDが不正です。');
    const data = await post(
      origin,
      'getBacklinksForBlockInitial',
      { block: { id: uuid(self) } },
      signal,
    );
    if (!Array.isArray(data?.backlinks))
      throw Error('Notionの応答形式が変わった可能性があります。');
    const records = recordsFrom(data.recordMap?.block),
      space = new Map();
    const starts = data.backlinks
      .slice(0, CAP)
      .map((b) => {
        const from = b?.mentioned_from || {},
          id = normalize(from.block_id || from.pointer?.id);
        if (id) space.set(id, from.pointer?.spaceId || b.space_id);
        return id;
      })
      .filter((id) => /^[a-f0-9]{32}$/.test(id));
    const resolve = (start) => {
      let key = start;
      for (let depth = 0; depth < 40; depth++) {
        const r = records.get(key);
        if (!r) return { missing: key };
        if (r.alive === false) return { dead: true };
        if (r.type === 'page') return { page: r };
        if (r.parent_table !== 'block' || !r.parent_id) return { none: true };
        const next = normalize(r.parent_id);
        if (!space.has(next)) space.set(next, space.get(key) || r.space_id);
        key = next;
      }
      return { none: true };
    };
    for (let round = 0; round < 8; round++) {
      const missing = [
        ...new Set(
          starts
            .map(resolve)
            .map((r) => r.missing)
            .filter(Boolean),
        ),
      ];
      if (!missing.length) break;
      for (let i = 0; i < missing.length; i += 100) {
        const reply = await post(
          origin,
          'syncRecordValues',
          {
            requests: missing.slice(i, i + 100).map((id) => ({
              pointer: {
                table: 'block',
                id: uuid(id),
                ...(space.get(id) ? { spaceId: space.get(id) } : {}),
              },
              version: -1,
            })),
          },
          signal,
        );
        const got = recordsFrom(reply?.recordMap?.block);
        if (!got.size && round) break;
        for (const [k, v] of got) records.set(k, v);
      }
    }
    const items = new Map();
    let unresolved = 0;
    for (const start of starts) {
      const r = resolve(start);
      if (r.dead) continue;
      if (!r.page) {
        unresolved++;
        continue;
      }
      const id = normalize(r.page.id);
      if (id === self || items.has(id)) continue;
      items.set(id, {
        id,
        href: `${origin}/p/${id}`,
        title: plainTitle(records, r.page) || '無題のページ',
      });
    }
    return {
      items: [...items.values()],
      inaccessible: Number(data.inaccessibleBacklinkCount) || 0,
      unresolved,
      partial: Array.isArray(data.fanoutData) && data.fanoutData.length > 0,
      capped: data.backlinks.length > CAP,
      time: new Date().toLocaleTimeString('ja-JP'),
    };
  }

  globalThis.NotionLinksBacklinks = Object.freeze({ loadBacklinks });
})();
