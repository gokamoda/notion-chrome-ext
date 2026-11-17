const { test } = require('node:test');
const assert = require('node:assert/strict');
require('../extension/core.js');
require('../extension/notion-records.js');
require('../extension/notion-api.js');
require('../extension/page-structure.js');
require('../extension/backlinks.js');
require('../extension/page-data.js');
const id = (n) => n.toString(16).padStart(32, '0');
const entry = (n, type, properties = {}, content) => ({
  value: { id: id(n), type, properties, ...(content ? { content: content.map(id) } : {}) },
});
const fixture = () => ({
  [id(1)]: entry(1, 'page', {}, [2, 3, 4, 7, 8, 13]),
  [id(2)]: entry(2, 'header', { title: [['見出し']] }),
  [id(3)]: entry(3, 'text', {
    title: [
      ['‣', [['p', id(9)]]],
      ['‣', [['p', id(9)]]],
    ],
  }),
  [id(4)]: entry(4, 'toggle', {}, [5, 6]),
  [id(5)]: {
    value: {
      value: {
        id: id(5),
        type: 'sub_header',
        properties: { title: [['‣', [['p', id(9)]]], [' の節']] },
      },
    },
  },
  [id(6)]: entry(6, 'sub_sub_header', { title: [['小見出し']] }),
  [id(7)]: entry(7, 'collection_view', {}, [10]),
  [id(8)]: {
    value: { id: id(8), type: 'alias', format: { alias_pointer: { id: id(12), table: 'block' } } },
  },
  [id(12)]: entry(12, 'page', { title: [['リンク先ブロック']] }),
  [id(13)]: entry(13, 'text', {
    title: [
      ['外部', [['a', 'https://example.org/' + id(14)]]],
      ['表示名', [['a', 'https://app.notion.com/p/' + id(14) + '?pvs=4']]],
    ],
  }),
  [id(9)]: entry(9, 'page', { title: [['参照先']] }),
  [id(10)]: entry(10, 'header', { title: [['DB内部は除外']] }),
});
test('未描画の階層を読み、ページメンション名と見出しレベルを解決', () => {
  const data = NotionLinksPageData.parse(fixture(), id(1), 'https://app.notion.com');
  assert.deepEqual(
    data.headings.map((h) => h.level),
    [1, 2, 3],
  );
  assert.equal(data.headings[1].title, '参照先 の節');
  assert.deepEqual(
    data.links.map((l) => [l.id, l.title]),
    [
      [id(9), '参照先'],
      [id(12), 'リンク先ブロック'],
      [id(14), '表示名'],
    ],
  );
  assert.equal(data.headings[1].topIndex, 2);
  assert.equal(data.numbers.get(id(5)), 4);
  assert.deepEqual(data.unsupported, []);
});
test('欠落・循環を検出し、未取得を完全取得と扱わない', () => {
  const records = fixture();
  records[id(4)].value.content.push(id(4), id(11));
  const data = NotionLinksPageData.parse(records, id(1), 'https://app.notion.com');
  assert.equal(data.missing, 1);
  assert.equal(data.headings.length, 3);
  assert.throws(() => NotionLinksPageData.parse({}, id(1), 'https://app.notion.com'), /形式/);
});
test('構造のない応答を拒否し、Notion以外へ通信しない', async () => {
  await assert.rejects(NotionLinksPageData.load(id(1), { origin: 'https://evil.test' }), /拒否/);
});
test('検証済みのリクエスト形式でページネーションを完了', async () => {
  const previous = globalThis.fetch,
    calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, ...options, body: JSON.parse(options.body) });
    return {
      ok: true,
      json: async () => ({
        recordMap: { block: fixture() },
        cursor: { stack: calls.length === 1 ? [{ id: 'next' }] : [] },
      }),
    };
  };
  try {
    const result = await NotionLinksPageData.load(id(1), { origin: 'https://app.notion.com' });
    assert.equal(result.complete, true);
    assert.equal(result.chunks, 2);
    assert.equal(calls[0].credentials, 'include');
    assert.equal(calls[0].body.limit, 100);
    assert.equal(calls[1].body.chunkNumber, 1);
    assert.deepEqual(calls[1].body.cursor.stack, [{ id: 'next' }]);
  } finally {
    globalThis.fetch = previous;
  }
});
test('インライン数式を含む見出しはLaTeXソースで表示', () => {
  const records = fixture();
  records[id(2)].value.properties.title = [['⁍', [['e', '\\Gamma(1/2)']]], [' の値']];
  assert.equal(
    NotionLinksPageData.parse(records, id(1), 'https://app.notion.com').headings[0].title,
    '\\Gamma(1/2) の値',
  );
});
// Backlinks: response shapes observed on app.notion.com (2026-11-12).
test('Backlinksを標準一覧を開かずAPIから取得し、親をたどってページ単位にまとめる', async () => {
  const uuid = (h) => h.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');
  const self = id(100),
    calls = [];
  const rec = (n, type, parent, extra = {}) => ({
    value: {
      value: { id: uuid(id(n)), type, parent_id: uuid(parent), parent_table: 'block', ...extra },
    },
  });
  global.fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push([url.split('/').pop(), body]);
    if (url.endsWith('getBacklinksForBlockInitial'))
      return {
        ok: true,
        json: async () => ({
          backlinks: [
            {
              block_id: uuid(self),
              mentioned_from: {
                type: 'property_mention',
                block_id: uuid(id(101)),
                pointer: { id: uuid(id(101)), spaceId: 's', table: 'block' },
              },
            },
            {
              block_id: uuid(self),
              mentioned_from: {
                type: 'property_mention',
                block_id: uuid(id(102)),
                pointer: { id: uuid(id(102)), spaceId: 's', table: 'block' },
              },
            },
            {
              block_id: uuid(self),
              mentioned_from: {
                type: 'alias',
                pointer: { id: uuid(id(103)), spaceId: 's', table: 'block' },
              },
            },
            {
              block_id: uuid(self),
              mentioned_from: {
                type: 'property_mention',
                block_id: uuid(id(104)),
                pointer: { id: uuid(id(104)), spaceId: 's', table: 'block' },
              },
            },
          ],
          inaccessibleBacklinkCount: 1,
          fanoutData: [],
          recordMap: {
            block: {
              [uuid(id(101))]: rec(101, 'text', id(110)),
              [uuid(id(110))]: rec(110, 'toggle', id(111)),
              [uuid(id(111))]: rec(111, 'page', id(999), { properties: { title: [['元ページ']] } }),
              [uuid(id(102))]: rec(102, 'header', id(111)),
              [uuid(id(104))]: rec(104, 'text', self),
              [uuid(self)]: {
                value: {
                  value: {
                    id: uuid(self),
                    type: 'page',
                    parent_id: uuid(id(999)),
                    parent_table: 'collection',
                    properties: { title: [['自分']] },
                  },
                },
              },
            },
          },
        }),
      };
    if (url.endsWith('syncRecordValues'))
      return {
        ok: true,
        json: async () => ({
          recordMap: {
            block: Object.fromEntries(
              body.requests
                .map((r) => r.pointer.id)
                .flatMap((i) =>
                  i === uuid(id(103))
                    ? [[i, rec(103, 'alias', id(112))]]
                    : i === uuid(id(112))
                      ? [
                          [
                            i,
                            rec(112, 'page', id(999), {
                              properties: { title: [['リンクブロックの元', [['b']]]] },
                            }),
                          ],
                        ]
                      : [],
                ),
            ),
          },
        }),
      };
    throw Error('unexpected ' + url);
  };
  const r = await NotionLinksPageData.loadBacklinks(self, { origin: 'https://app.notion.com' });
  assert.deepEqual(
    r.items.map((i) => i.title),
    ['元ページ', 'リンクブロックの元'],
  );
  assert.equal(r.items[0].href, `https://app.notion.com/p/${id(111)}`);
  assert.equal(r.inaccessible, 1);
  assert.equal(r.unresolved, 0);
  assert.equal(r.partial, false);
  assert.deepEqual(
    calls.map((c) => c[0]),
    ['getBacklinksForBlockInitial', 'syncRecordValues', 'syncRecordValues'],
  );
  assert.deepEqual(calls[0][1], { block: { id: uuid(self) } });
  assert.equal(calls[1][1].requests[0].pointer.spaceId, 's');
});
test('Backlinksが0件ならそのまま0件、Notion以外への通信は拒否', async () => {
  global.fetch = async () => ({
    ok: true,
    json: async () => ({
      backlinks: [],
      inaccessibleBacklinkCount: 0,
      fanoutData: [],
      recordMap: {},
    }),
  });
  const r = await NotionLinksPageData.loadBacklinks(id(5), { origin: 'https://app.notion.com' });
  assert.deepEqual(r.items, []);
  assert.equal(r.partial, false);
  await assert.rejects(
    NotionLinksPageData.loadBacklinks(id(5), { origin: 'https://evil.example' }),
  );
});
test('空のコールアウト本体は番号なし、表の行は表内の位置を記録、閉じたトグルの中身を追加取得', async () => {
  const uuid = (h) => h.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');
  const P = id(200);
  const blocks = {
    [uuid(P)]: {
      value: {
        value: {
          id: uuid(P),
          type: 'page',
          space_id: 's',
          content: [uuid(id(201)), uuid(id(202)), uuid(id(205))],
        },
      },
    },
    [uuid(id(201))]: {
      value: {
        value: { id: uuid(id(201)), type: 'callout', properties: {}, content: [uuid(id(210))] },
      },
    },
    [uuid(id(210))]: {
      value: { value: { id: uuid(id(210)), type: 'text', properties: { title: [['中身']] } } },
    },
    [uuid(id(202))]: {
      value: {
        value: { id: uuid(id(202)), type: 'table', content: [uuid(id(203)), uuid(id(204))] },
      },
    },
    [uuid(id(203))]: { value: { value: { id: uuid(id(203)), type: 'table_row', properties: {} } } },
    [uuid(id(204))]: { value: { value: { id: uuid(id(204)), type: 'table_row', properties: {} } } },
    [uuid(id(205))]: {
      value: {
        value: {
          id: uuid(id(205)),
          type: 'sub_sub_header',
          properties: { title: [['トグル見出し']] },
          format: { toggleable: true },
          content: [uuid(id(206))],
        },
      },
    },
  };
  const hidden = {
    [uuid(id(206))]: {
      value: {
        value: { id: uuid(id(206)), type: 'header', properties: { title: [['中の見出し']] } },
      },
    },
  };
  const calls = [];
  global.fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push(url.split('/').pop());
    if (url.endsWith('loadPageChunk'))
      return {
        ok: true,
        json: async () => ({ recordMap: { block: blocks }, cursor: { stack: [] } }),
      };
    if (url.endsWith('syncRecordValues')) {
      assert.equal(body.requests[0].pointer.spaceId, 's');
      return {
        ok: true,
        json: async () => ({
          recordMap: {
            block: Object.fromEntries(
              body.requests
                .map((r) => r.pointer.id)
                .filter((i) => hidden[i])
                .map((i) => [i, hidden[i]]),
            ),
          },
        }),
      };
    }
    throw Error(url);
  };
  const r = await NotionLinksPageData.load(P, { origin: 'https://app.notion.com' });
  assert.equal(r.numbers.has(id(201)), false);
  assert.deepEqual(
    [id(210), id(203), id(204), id(205), id(206)].map((k) => r.numbers.get(k)),
    [1, 2, 3, 4, 5],
  );
  assert.deepEqual(
    [id(201), id(202), id(205), id(210)].map((k) => r.descendants.get(k)),
    [1, 2, 1, undefined],
  );
  assert.deepEqual(r.tableRows.get(id(204)), { table: id(202), index: 1 });
  assert.deepEqual(
    r.headings.map((h) => h.title),
    ['トグル見出し', '中の見出し'],
  );
  assert.equal(r.missing, 0);
  assert.deepEqual(calls, ['loadPageChunk', 'syncRecordValues']);
});
test('行番号は画面で番号が付くブロックにだけ割り当てる（区切り線・同期ブロックの枠なし、子ページあり）', () => {
  const records = {
    [id(1)]: entry(1, 'page', {}, [2, 3, 4, 5, 7, 8]),
    [id(2)]: entry(2, 'text', { title: [['a']] }),
    [id(3)]: entry(3, 'divider'),
    [id(4)]: entry(4, 'page', { title: [['子ページ']] }, [9]),
    [id(5)]: entry(5, 'transclusion_container', {}, [6]),
    [id(6)]: entry(6, 'text', { title: [['同期の中']] }),
    [id(7)]: entry(7, 'to_do', { title: [['やること']] }),
    [id(8)]: entry(8, 'text', { title: [['b']] }),
    [id(9)]: entry(9, 'text', { title: [['子ページの中']] }),
  };
  const data = NotionLinksPageData.parse(records, id(1), 'https://app.notion.com');
  assert.deepEqual(
    [2, 3, 4, 5, 6, 7, 8, 9].map((n) => data.numbers.get(id(n))),
    [1, undefined, 2, undefined, 3, 4, 5, undefined],
  );
});
