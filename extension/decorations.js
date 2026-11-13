/* Line numbers and heading markers.
 * Notion reverts attribute changes inside .notion-page-content (observed 2026-11-12:
 * "Reverting mutation of attribute ..." warnings). So nothing is written inside the
 * body. Switches live on .notion-frame; everything else is CSS in our own <style> elements.
 * Numbers are a CSS counter over the rendered text elements, so edits (added, deleted or
 * moved blocks) renumber at once. Notion does not render a long page's distant blocks, so the
 * counter starts from the page-structure number of the first rendered block (see start()).
 * Children of closed toggles are not rendered and therefore not counted.
 */
(() => {
  'use strict';
  const { F, LINE, DB, COUNT, CODE, CODE_TEXT, text } = NotionLinksDecorationStyle;
  const { lines, measure, gutterContent } = NotionLinksCodeNumbers;
  const base = document.createElement('style');
  base.id = 'nlx-document-styles';
  base.textContent = text;
  const numbers = document.createElement('style');
  numbers.id = 'nlx-number-styles';
  const code = document.createElement('style');
  code.id = 'nlx-code-styles';
  const wide = document.createElement('style');
  wide.id = 'nlx-wide-styles';
  document.documentElement.append(base, numbers, code, wide);
  const UUID = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;
  const hyphenate = (id) =>
    id
      .replaceAll('-', '')
      .toLowerCase()
      .replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');
  let previousFrame = null;
  let codeRoot = null;
  // Notion's own left padding of each code text element, read before our padding applies.
  const codePads = new Map();
  let codeAfter = '';

  function setAttr(node, key, on) {
    if (!on) {
      if (node.hasAttribute(key)) node.removeAttribute(key);
    } else if (!node.hasAttribute(key)) node.setAttribute(key, '');
  }

  function setVar(node, key, value) {
    if (node.style.getPropertyValue(key) !== value) node.style.setProperty(key, value);
  }

  /* Counter start: the page-structure number of the first rendered block that has one, minus
   * the elements counted before and including it. 0 without the page structure (numbers then
   * count from the first rendered element). numberMap: Map(normalized id -> ordinal). */

  function start(root, numberMap) {
    if (!root || !numberMap?.size) return 0;
    let i = 0;
    for (const el of root.querySelectorAll(COUNT)) {
      i++;
      if (el.classList.contains('notion-table-row')) continue;
      const n = numberMap.get(
        el
          .closest('[data-block-id]')
          ?.getAttribute('data-block-id')
          ?.replaceAll('-', '')
          .toLowerCase(),
      );
      if (Number.isInteger(n)) return Math.max(0, n - i);
    }
    return 0;
  }

  /* Offset of each mounted block's number box from the shared column: the distance between the
   * box's containing block (nearest positioned ancestor of the text element) and the anchor
   * (the nearest column block, otherwise the left edge of the body's content box). Zero is the default. */

  function offsets(root) {
    const out = [];
    if (!root) return '';
    const rootLeft =
      root.getBoundingClientRect().left +
      root.clientLeft +
      (parseFloat(getComputedStyle(root).paddingLeft) || 0);
    for (const block of root.querySelectorAll('[data-block-id]')) {
      if (block.closest(DB)) continue;
      const leaf = [...block.querySelectorAll(LINE)].find(
        (e) => e.closest('[data-block-id]') === block,
      );
      if (!leaf) continue;
      // Not the outermost block: a table is three nested elements with the same data-block-id,
      // the outer one as wide as the window (observed 2026-11-12). The body's own left edge is
      // the text column (observed: .notion-page-content 383px = top-level text block 383px).
      const column = block.parentElement?.closest('.notion-column-block');
      const later =
        !!column &&
        column.closest('.notion-column_list-block')?.querySelector('.notion-column-block') !==
          column;
      const anchorLeft =
        column && root.contains(column) ? column.getBoundingClientRect().left : rootLeft;
      let box = leaf;
      while (box && box !== root && getComputedStyle(box).position === 'static')
        box = box.parentElement;
      if (!box || box === root) continue;
      const boxRect = box.getBoundingClientRect(),
        boxLeft = boxRect.left + box.clientLeft;
      const dx = Math.round(boxLeft - anchorLeft);
      let decl = dx ? `--nlx-dx:${dx}px;` : '';
      if (later) decl += '--nlx-gutter:24px;';
      if (decl && UUID.test(block.getAttribute('data-block-id')))
        out.push(
          `${F}:is([data-nlx-numbers],[data-nlx-headings]) .notion-page-content [data-block-id="${hyphenate(block.getAttribute('data-block-id'))}"]{${decl}}`,
        );
    }
    return out.join('\n');
  }

  /* Code line numbers. Two passes: first the padding for the number column (it depends only
   * on the number of digits), then, with that padding in place, the rows of each line are
   * measured (the padding changes the wrap width) and the gutter content and position written.
   * The column: Notion's own padding of the text element (0 in observed code blocks), the
   * digits, then a 12px gap; numbers end at the gap. */

  function codeBlocks(root) {
    const out = [];
    for (const block of root.querySelectorAll(CODE)) {
      const raw = block.getAttribute('data-block-id');
      const leaf = block.querySelector(CODE_TEXT);
      if (!leaf || !UUID.test(raw) || leaf.closest('[data-block-id]') !== block) continue;
      out.push({ block, leaf, id: hyphenate(raw) });
    }
    return out;
  }

  /* The colour behind a code block's text, composited from the backgrounds of its ancestors
   * (Notion's code background is nearly transparent, observed 2026-11-13: rgba(252,252,252,0.03)
   * over the page). The number column is filled with it so that code scrolled sideways
   * passes under the numbers. Colours that are not rgb()/rgba() end the walk. */
  function opaqueBackground(node) {
    const layers = [];
    for (let n = node; n; n = n.parentElement) {
      const m = getComputedStyle(n).backgroundColor.match(
        /^rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)$/,
      );
      if (!m) break;
      const a = m[4] === undefined ? 1 : Number(m[4]);
      if (a > 0) layers.push([+m[1], +m[2], +m[3], a]);
      if (a >= 1) break;
    }
    if (!layers.length || layers.at(-1)[3] < 1) return 'transparent';
    let [r, g, b] = layers.pop();
    for (const [lr, lg, lb, a] of layers.reverse()) {
      r = lr * a + r * (1 - a);
      g = lg * a + g * (1 - a);
      b = lb * a + b * (1 - a);
    }
    return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
  }

  function refreshCode() {
    const root = codeRoot?.isConnected ? codeRoot : null;
    if (!root) {
      if (code.textContent) code.textContent = '';
      codeAfter = '';
      return;
    }
    const sel = (id) =>
      `${F}[data-nlx-code] .notion-page-content ${CODE}[data-block-id="${id}"] ${CODE_TEXT}`;
    const blocks = codeBlocks(root);
    const pads = [];
    for (const b of blocks) {
      const style = getComputedStyle(b.leaf);
      if (!style.getPropertyValue('--nlx-code-pad'))
        codePads.set(b.id, parseFloat(style.paddingInlineStart) || 0);
      b.pad = codePads.get(b.id) ?? 0;
      b.digits = String(Math.max(1, lines(b.leaf).length)).length;
      pads.push(
        `${sel(b.id)}{--nlx-code-pad:${b.pad}px;padding-inline-start:calc(${b.pad}px + ${b.digits}ch + 12px) !important}`,
      );
    }
    const padText = pads.join('\n');
    if (code.textContent !== `${padText}\n${codeAfter}`)
      code.textContent = `${padText}\n${codeAfter}`;
    const after = [];
    for (const b of blocks) {
      const rows = measure(b.leaf);
      const cb = b.leaf.offsetParent || b.block;
      const lr = b.leaf.getBoundingClientRect(),
        cr = cb.getBoundingClientRect();
      const style = getComputedStyle(b.leaf);
      const top =
        lr.top +
        b.leaf.clientTop +
        (parseFloat(style.paddingTop) || 0) -
        (cr.top + cb.clientTop) +
        cb.scrollTop;
      const left = lr.left + b.leaf.clientLeft - (cr.left + cb.clientLeft) + cb.scrollLeft;
      after.push(
        `${sel(b.id)}::after{content:"${gutterContent(rows)}" !important;top:${Math.round(top)}px;left:${Math.round(left)}px;width:calc(${b.pad}px + ${b.digits}ch + 12px);background:${opaqueBackground(b.leaf)}}`,
      );
    }
    codeAfter = after.join('\n');
    const full = `${padText}\n${codeAfter}`;
    if (code.textContent !== full) code.textContent = full;
  }

  function apply(ctx, settings, paneOpen, numberMap) {
    const frame = ctx?.frame || null;
    if (previousFrame && previousFrame !== frame)
      for (const key of [
        'data-nlx-pane',
        'data-nlx-outline',
        'data-nlx-managed',
        'data-nlx-numbers',
        'data-nlx-headings',
        'data-nlx-code',
      ])
        setAttr(previousFrame, key, false);
    previousFrame = frame;
    const text = frame
      ? [
          settings.lineNumbers && ctx.root
            ? `${F}[data-nlx-numbers] .notion-page-content{counter-reset:nlx-line ${start(ctx.root, numberMap)}}`
            : '',
          settings.lineNumbers || settings.headingMarkers ? offsets(ctx.root) : '',
        ]
          .filter(Boolean)
          .join('\n')
      : '';
    if (numbers.textContent !== text) numbers.textContent = text;
    if (!frame && wide.textContent) wide.textContent = '';
    codeRoot = frame && settings.codeLineNumbers ? ctx.root || null : null;
    if (frame) setAttr(frame, 'data-nlx-code', !!codeRoot);
    refreshCode();
    if (!frame) return;
    setAttr(frame, 'data-nlx-pane', paneOpen);
    setAttr(frame, 'data-nlx-outline', paneOpen && settings.outline);
    setAttr(frame, 'data-nlx-managed', !!ctx.root);
    setAttr(frame, 'data-nlx-numbers', settings.lineNumbers);
    setAttr(frame, 'data-nlx-headings', settings.headingMarkers);
    setVar(frame, '--nlx-pane-width', `${settings.paneWidth}px`);
    setVar(frame, '--nlx-number-color', settings.numberColor);
    setVar(frame, '--nlx-heading-color', settings.accent);
    // After the pane's padding applies: the rules measure the scroller's width with it.
    const wideText =
      paneOpen && ctx.root
        ? NotionLinksWideBlocks.rules(frame, ctx.root, `${F}[data-nlx-pane] .notion-page-content`)
        : '';
    if (wide.textContent !== wideText) wide.textContent = wideText;
  }

  globalThis.NotionLinksDecorations = Object.freeze({
    apply,
    refreshCode,
    isOwnNode: (n) => n === base || n === numbers || n === code || n === wide,
  });
})();
