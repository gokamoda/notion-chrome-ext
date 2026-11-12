const { test } = require('node:test');
const assert = require('node:assert/strict');
require('../extension/core.js');
const { pageLink, dedupe } = globalThis.NotionLinksCore;
const id = '0123456789abcdef0123456789abcdef';
const base = `https://app.notion.com/p/workspace/${id}`;
test('Notionの旧・新URL、UUID、相対リンクをページIDで正規化', () => {
  for (const url of [`https://www.notion.so/Title-${id}`, `https://notion.so/${id}`, `/p/${id}?pvs=24#block`, '/p/01234567-89ab-cdef-0123-456789abcdef']) {
    assert.equal(pageLink(url, base).id, id);
  }
  assert.equal(pageLink(`/p/${id}?v=other#block`, base).href, `https://app.notion.com/p/${id}`);
});
test('外部サイト、不正なID、危険なスキームを拒否', () => {
  for (const url of [`https://evil.test/${id}`, `https://notion.so.evil.test/${id}`, `javascript:alert(1)`, `http://www.notion.so/${id}`, 'https://www.notion.so/search', `https://user@www.notion.so/${id}`, `https://www.notion.so:8443/${id}`, `https://www.notion.so/x${id}`, '/p/%ZZ']) {
    assert.equal(pageLink(url, base), null, url);
  }
});
test('パス内のページIDを使い、DBビューIDやブロックIDを使わない', () => {
  assert.equal(pageLink(`/p/${id}?v=${'a'.repeat(32)}#${'b'.repeat(32)}`, base).id, id);
});
test('同一ページの表記違いを重複排除し、最初の名前を維持', () => {
  const a = { ...pageLink(`/p/${id}`, base), title: '名前' };
  const b = { ...pageLink(`https://www.notion.so/Page-${id}#block`, base), title: '別表記' };
  assert.deepEqual(dedupe([a,b]), [a]);
  assert.deepEqual(dedupe([]), []);
});
