/* Pure helpers; no browser state, persistence or network. */
(() => {
  'use strict';
  const ID = /(?:^|-)([a-f0-9]{32}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/i;
  const hosts = new Set(['www.notion.so', 'notion.so', 'app.notion.com']);

  function pageLink(raw, base) {
    try {
      const url = new URL(raw, base);
      if (
        url.protocol !== 'https:' ||
        !hosts.has(url.hostname) ||
        url.username ||
        url.password ||
        url.port
      )
        return null;
      const segment = decodeURIComponent(url.pathname).split('/').filter(Boolean).at(-1) || '';
      const id = segment.match(ID)?.[1]?.replaceAll('-', '').toLowerCase();
      if (!id) return null;
      // Canonical page URL: query parameters and block anchors cannot create duplicates.
      return { id, href: `${url.origin}${url.pathname}` };
    } catch {
      return null;
    }
  }

  function dedupe(items) {
    const result = new Map();
    for (const item of items) {
      if (!result.has(item.id)) result.set(item.id, item);
    }
    return [...result.values()];
  }

  globalThis.NotionLinksCore = Object.freeze({ pageLink, dedupe });
})();
