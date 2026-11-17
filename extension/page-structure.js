// Parse block order, headings, links and line-number metadata from a page record map.
(() => {
  'use strict';
  const { normalize, recordsFrom } = NotionLinksRecords;

  function parse(map, pageId, origin) {
    const records = recordsFrom(map),
      root = records.get(normalize(pageId));
    if (!root || root.type !== 'page' || !Array.isArray(root.content))
      throw Error('ページ構造の形式が未対応です。');
    const headings = [],
      links = new Map(),
      blockLinks = new Map(),
      numbers = new Map(),
      // Numbered blocks below each block (counted for the children of closed toggles).
      descendants = new Map(),
      topIndex = new Map(),
      tableRows = new Map();
    const visited = new Set(),
      missing = new Set(),
      unsupported = new Set();
    let order = 0;
    const text = (rich, depth = 0) =>
      Array.isArray(rich) && depth < 4
        ? rich
            .map((token) => {
              if (!Array.isArray(token)) return '';
              const annotations = Array.isArray(token[1]) ? token[1] : [];
              // Inline equation: ['⁍', [['e', '<LaTeX>']]] (verified in the live response). Show the LaTeX source.
              const equation = annotations.find(
                (a) => Array.isArray(a) && a[0] === 'e' && typeof a[1] === 'string',
              );
              if (equation) return equation[1];
              const page = annotations.find((a) => Array.isArray(a) && a[0] === 'p');
              return page
                ? text(records.get(normalize(page[1]))?.properties?.title, depth + 1) ||
                    '無題のページ'
                : typeof token[0] === 'string'
                  ? token[0]
                  : '';
            })
            .join('')
        : '';
    const add = (id, label, result, fallback = '') => {
      const key = normalize(id);
      if (!/^[a-f0-9]{32}$/.test(key)) return;
      const item = {
        id: key,
        href: `${origin}/p/${key}`,
        title:
          label ||
          text(records.get(key)?.properties?.title) ||
          fallback ||
          `ページ ${key.slice(0, 8)}（名前未取得）`,
      };
      links.set(key, item);
      result.set(key, item);
    };

    function visit(id, top, depth) {
      const key = normalize(id);
      if (visited.has(key)) return;
      visited.add(key);
      if (depth > 50) {
        unsupported.add('深さ上限');
        return;
      }
      const block = records.get(key);
      if (!block) {
        missing.add(key);
        return;
      }
      if (block.alive === false) return;
      const result = new Map();
      topIndex.set(key, top);
      /* Line numbers: one per block the page shows with a number, i.e. with its own counted
       * text/void element (COUNT in decoration-style.js); the numbers of blocks that are not
       * rendered come from here, so the two must agree (observed 2026-11-17: dividers here but
       * not on the page shifted every number below them by one while scrolling).
       * Without a counted element (observed 2026-11-12/17): layout containers (column list,
       * column, table; table rows are counted), databases, dividers, the frame of a synced
       * block, and a callout whose own title is empty (its text is in child blocks). A child
       * page link is counted. */
      const emptyCallout =
        block.type === 'callout' &&
        !text(block.properties?.title) &&
        Array.isArray(block.content) &&
        block.content.length > 0;
      if (
        ![
          'column_list',
          'column',
          'table',
          'collection_view',
          'collection_view_page',
          'divider',
          'transclusion_container',
        ].includes(block.type) &&
        !emptyCallout
      )
        numbers.set(key, ++order);
      if (['page', 'collection_view', 'collection_view_page'].includes(block.type)) {
        if (block.type === 'page') add(block.id, text(block.properties?.title), result);
        blockLinks.set(key, [...result.values()]);
        return;
      }
      // Table rows have no data-block-id in the page; they are addressed by position in the table.
      if (block.type === 'table' && Array.isArray(block.content))
        block.content.forEach((child, index) =>
          tableRows.set(normalize(child), { table: key, index }),
        );
      const levels = { header: 1, sub_header: 2, sub_sub_header: 3, header_4: 4 },
        level = levels[block.type];
      if (level)
        headings.push({
          id: block.id,
          level,
          title: text(block.properties?.title) || '無題の見出し',
          order: headings.length,
          topIndex: top,
        });
      // Formats verified in the live response (2026-11-12):
      //   page mention   ['‣', [['p', '<page id>', '<space id>']]]
      //   text link      ['label', [['a', 'https://app.notion.com/p/<page id>']]]
      //   link-to-page   type 'alias', format.alias_pointer {id, table:'block'}
      for (const token of Array.isArray(block.properties?.title) ? block.properties.title : []) {
        if (!Array.isArray(token) || !Array.isArray(token[1])) continue;
        for (const annotation of token[1]) {
          if (!Array.isArray(annotation)) continue;
          if (annotation[0] === 'p') add(annotation[1], '', result);
          else if (annotation[0] === 'a' && typeof annotation[1] === 'string') {
            const link = globalThis.NotionLinksCore?.pageLink(annotation[1], origin);
            if (link) add(link.id, '', result, typeof token[0] === 'string' ? token[0] : '');
          }
        }
      }
      const alias = block.type === 'alias' ? block.format?.alias_pointer : null;
      if (alias && (alias.table === undefined || alias.table === 'block'))
        add(alias.id, '', result);
      if (['transclusion_reference', 'synced_block', 'unsupported'].includes(block.type))
        unsupported.add(block.type);
      blockLinks.set(key, [...result.values()]);
      const before = order;
      if (Array.isArray(block.content))
        for (const child of block.content) visit(child, top, depth + 1);
      if (order > before) descendants.set(key, order - before);
    }

    root.content.forEach((id, index) => visit(id, index, 0));
    return {
      headings,
      links: [...links.values()],
      blockLinks,
      numbers,
      descendants,
      tableRows,
      topIndex,
      topBlocks: root.content.map(normalize),
      missing: missing.size,
      missingIds: [...missing],
      spaceId: root.space_id,
      unsupported: [...unsupported],
      visited: visited.size,
    };
  }

  globalThis.NotionLinksStructure = Object.freeze({ parse });
})();
