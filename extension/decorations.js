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
  const { F, LINE, DB, COUNT, text } = NotionLinksDecorationStyle;
  const base = document.createElement('style');
  base.id = 'nlx-document-styles';
  base.textContent = text;
  const numbers = document.createElement('style');
  numbers.id = 'nlx-number-styles';
  document.documentElement.append(base, numbers);
  const UUID = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;
  const hyphenate = (id) =>
    id
      .replaceAll('-', '')
      .toLowerCase()
      .replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');
  let previousFrame = null;

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

  function apply(ctx, settings, paneOpen, numberMap) {
    const frame = ctx?.frame || null;
    if (previousFrame && previousFrame !== frame)
      for (const key of [
        'data-nlx-pane',
        'data-nlx-outline',
        'data-nlx-managed',
        'data-nlx-numbers',
        'data-nlx-headings',
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
    if (!frame) return;
    setAttr(frame, 'data-nlx-pane', paneOpen);
    setAttr(frame, 'data-nlx-outline', paneOpen && settings.outline);
    setAttr(frame, 'data-nlx-managed', !!ctx.root);
    setAttr(frame, 'data-nlx-numbers', settings.lineNumbers);
    setAttr(frame, 'data-nlx-headings', settings.headingMarkers);
    setVar(frame, '--nlx-pane-width', `${settings.paneWidth}px`);
    setVar(frame, '--nlx-number-color', settings.numberColor);
    setVar(frame, '--nlx-heading-color', settings.accent);
  }

  globalThis.NotionLinksDecorations = Object.freeze({
    apply,
    isOwnNode: (n) => n === base || n === numbers,
  });
})();
