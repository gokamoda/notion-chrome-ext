/* Notion-specific DOM assumptions (body, headings, toolbar). No internal API calls.
 * Observed on app.notion.com, Japanese UI, 2026-11-12; see README.
 */
(() => {
  'use strict';
  const { pageLink, dedupe } = globalThis.NotionLinksCore;
  const BODY = '.notion-page-content';
  const EXCLUDED =
    '.notion-collection_view-block, .notion-collection_view_page-block, nav, aside, [role="navigation"]';

  /* The page the view is about. A side peek puts its page ID in the `p` query parameter
   * (observed 2026-11-14: `?p=<id>&pm=s`) and draws that page in .notion-peek-renderer, beside
   * the page of the path; the peeked page is the one being read, so it is the target. */
  const PEEK = '.notion-peek-renderer';
  /* The open side peek. After closing, the element stays for a while outside the window, to the
   * right (observed 2026-11-14: 1326-2210px in a 1326px window). */
  function openPeek(doc) {
    const view = doc.defaultView;
    return [...doc.querySelectorAll(PEEK)].find((n) => {
      const r = n.getBoundingClientRect();
      return r.width > 0 && r.left < (view?.innerWidth ?? Infinity) - 1;
    });
  }
  function target(url) {
    const page = pageLink(url, url);
    if (!page) return null;
    const peek = new URL(url).searchParams.get('p')?.replaceAll('-', '').toLowerCase();
    if (!peek || !/^[0-9a-f]{32}$/.test(peek) || peek === page.id) return { ...page, peek: false };
    return { id: peek, href: `${new URL(url).origin}/${peek}`, peek: true };
  }

  function context(doc, url) {
    const page = target(url);
    if (!page)
      return { error: 'NotionページIDを識別できません。通常のページURLで開いてください。' };
    const peek = page.peek ? openPeek(doc) : null;
    if (page.peek && !peek) return { error: 'サイドピークの描画待ちです。' };
    const roots = [...(peek || doc).querySelectorAll(BODY)].filter(
      (n) => n.isConnected && n.getClientRects().length,
    );
    if (roots.length !== 1)
      return {
        error: roots.length
          ? 'この表示（複数の本文）には対応していません。'
          : '本文を未検出。読み込み・ログイン・DOM変更を確認してください。',
      };
    const root = roots[0];
    /* A peeked page has no .notion-frame of its own; the peek takes its place for the
     * decorations: it holds the page, and Notion writes its width inline as it does for the frame
     * (observed 2026-11-14: 883.333px), which the wide-block rules use. */
    const frame = peek || root.closest('.notion-frame');
    // Prevent reading the previous page during an SPA navigation transition.
    const titles = [
      ...(peek || frame || doc).querySelectorAll('.notion-page-block[data-block-id]'),
    ].filter((n) => !n.closest(BODY) && n.querySelector('[contenteditable]'));
    const matching = titles.find(
      (n) => n.getAttribute('data-block-id').replaceAll('-', '').toLowerCase() === page.id,
    );
    if (!matching)
      return { error: 'ページの描画待ち、または未対応のDOMです。更新で再試行してください。' };
    return {
      page,
      root,
      frame,
      peek,
      title: matching.textContent.trim() || '無題',
      scroller: root.closest('.notion-scroller.vertical'),
    };
  }

  function links(container, base) {
    const items = [];
    for (const anchor of container.querySelectorAll('a[href]')) {
      if (anchor.closest(EXCLUDED)) continue;
      const link = pageLink(anchor.getAttribute('href'), base);
      if (!link) continue;
      const title = (anchor.textContent || '').trim().replace(/\s+/g, ' ');
      items.push({
        ...link,
        title: title || `ページ ${link.id.slice(0, 8)}（名前を取得できません）`,
      });
    }
    return dedupe(items);
  }

  function forward(ctx, base) {
    // Only links in body blocks. Page properties, header, breadcrumbs and sidebar are outside BODY.
    return links(ctx.root, base);
  }

  const SHARE = '[role="button"][aria-label="共有"],[role="button"][aria-label="Share"]';

  /* The bar for the pane toggle. While a side peek is open it covers the page's top bar, so the
   * toggle goes to the peek's own header: it has a Share button but no class for the bar
   * (observed 2026-11-14: the bar is the third ancestor of Share, with 5 children); the bar is
   * taken as the nearest ancestor of Share with at least 3 children. */
  function toolbar(doc) {
    const peek = openPeek(doc);
    let node = peek?.querySelector(SHARE);
    for (let i = 0; node && i < 6; i++, node = node.parentElement)
      if (node.childElementCount >= 3 && node !== peek) return node;
    return doc.querySelector('.notion-topbar-action-buttons');
  }

  /* Where the pane toggle goes: just before the Share button, i.e. right of "edited ..." time.
   * Observed 2026-11-12: .notion-topbar-action-buttons > div > (time, div{display:contents} > [role=button][aria-label=共有], ...). */

  function shareAnchor(bar) {
    let node = bar.querySelector(SHARE);
    while (
      node &&
      node.parentElement &&
      node.parentElement !== bar &&
      node.parentElement.parentElement !== bar
    )
      node = node.parentElement;
    return node && node.parentElement ? node : null;
  }

  function headingLevel(block) {
    if (block.classList.contains('notion-header_4-block')) return 4;
    if (block.classList.contains('notion-sub_sub_header-block')) return 3;
    if (block.classList.contains('notion-sub_header-block')) return 2;
    if (block.classList.contains('notion-header-block')) return 1;
    return 0;
  }

  // Inline equations render as KaTeX (visible glyphs + MathML). Use the LaTeX source from
  // the TeX annotation instead, matching the page-structure titles.

  function plainText(node) {
    if (!node.querySelector('.notion-text-equation-token')) return node.textContent;
    const copy = node.cloneNode(true);
    for (const token of copy.querySelectorAll('.notion-text-equation-token')) {
      token.replaceWith(
        token.querySelector('annotation[encoding="application/x-tex"]')?.textContent ??
          token.querySelector('.katex-html')?.textContent ??
          '',
      );
    }
    return copy.textContent;
  }

  function headings(ctx) {
    return [...ctx.root.querySelectorAll('[data-block-id]')].flatMap((block) => {
      const level = headingLevel(block);
      if (!level || block.closest(EXCLUDED)) return [];
      // Toggle headings start with a contenteditable="false" toggle button; use the text element.
      const editable =
        block.querySelector(
          '[data-content-editable-leaf="true"],:is(h2,h3,h4,h5)[contenteditable="true"]',
        ) || block.querySelector('[contenteditable="true"]');
      return [
        {
          id: block.getAttribute('data-block-id'),
          level,
          title:
            plainText(editable || block)
              .trim()
              .replace(/\s+/g, ' ') || '無題の見出し',
          top:
            (ctx.scroller?.scrollTop || 0) +
            block.getBoundingClientRect().top -
            (ctx.scroller?.getBoundingClientRect().top || 0),
        },
      ];
    });
  }

  globalThis.NotionLinksDOM = Object.freeze({
    context,
    target,
    forward,
    toolbar,
    shareAnchor,
    headingLevel,
    headings,
  });
})();
