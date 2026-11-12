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
  const F = '.notion-frame[data-nlx-managed]';
  // Elements that carry one number per block. Same targets as the user's former custom CSS.
  const LINE = '[data-content-editable-leaf="true"],div[contenteditable="true"]:not([placeholder=" "]),:is(h2,h3,h4,h5)[contenteditable="true"],[data-content-editable-void="true"]:not([data-text-edit-side]),.notion-table-row';
  // H1 to H4 (H4: .notion-header_4-block with an h5, observed 2026-11-12).
  const HEAD = '.notion-header-block,.notion-sub_header-block,.notion-sub_sub_header-block,.notion-header_4-block';
  // Monospace digits so that numbers of different lengths line up at the right edge.
  const FONT = 'font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-variant-numeric:tabular-nums;font-size:14px';
  const DB = '.notion-collection_view-block,.notion-collection_view_page-block';
  /* Counted elements: one per line of text, i.e. LINE minus
   * - anything inside a database view,
   * - table cells (the row is counted),
   * - an element containing another LINE element (code blocks nest two; void wrappers of code
   *   blocks and tables contain the real lines; observed 2026-11-12),
   * - the callout icon (a void element with an aria-labelled button inside the callout;
   *   a callout's text is in its child blocks, observed 2026-11-12).
   * The exclusions sit in :where() so the selector keeps the specificity of LINE alone; the
   * heading rules below must still win over the number rule. */
  const COUNT = `:is(${LINE}):where(:not(:is(${DB}) *):not(.notion-table-row *):not(:is(${LINE}):not(.notion-table-row):has(:is(${LINE}))):not(.notion-callout-block [data-content-editable-void="true"]:has([aria-label])))`;
  const base = document.createElement('style'); base.id = 'nlx-document-styles';
  base.textContent = `
    .notion-frame[data-nlx-pane]{padding-inline-end:var(--nlx-pane-width,320px)!important;box-sizing:border-box}
    @media(max-width:850px){.notion-frame[data-nlx-pane]{padding-inline-end:0!important}}
    /* Notion's own floating outline (short lines at the right edge of the body; class observed
     * 2026-11-12) is hidden while the pane shows our Outline. */
    .notion-frame[data-nlx-outline] .notion-floating-table-of-contents{display:none!important}
    /* Same specificity as the per-block rules, which come later in the document and win. */
    ${F}:is([data-nlx-numbers],[data-nlx-headings]) .notion-page-content [data-block-id]{--nlx-dx:0px}
    /* The counter. Notion's own counters (KaTeX equation numbers) are reset on body, so this
     * reset on the body element does not replace any of Notion's (observed 2026-11-12). The
     * start value is set in the per-page style. --nlx-num is the number, or nothing when numbers
     * are off (heading bars still use the same ::before). */
    ${F}[data-nlx-numbers]{--nlx-num:counter(nlx-line)}
    ${F}[data-nlx-numbers] .notion-page-content{counter-reset:nlx-line}
    ${F}[data-nlx-numbers] .notion-page-content :is(${COUNT}){counter-increment:nlx-line}
    /* Position: one ::before per text element, but measured from the block, not the text element.
     * Text elements start at different x per block type (observed: text 549px, equation 551px,
     * block 543px for all), while the block itself is common. The text element is kept static,
     * so the block is the containing block (horizontal), and top:auto keeps the box on the
     * text element's first line (vertical). line-height:1lh uses the text element's line height
     * (in line-height, lh refers to the parent), so the number is centred on that line.
     * Nested blocks (list children, callout contents, table rows) start further right; their
     * offset from the body's left edge (or from the column, in a column layout) is measured in
     * script and added as --nlx-dx, so all numbers share one column.
     * Horizontal order, left to right: number, Notion's block handles, heading bars, text.
     * Handles (observed 2026-11-12): + at 52-28px and the drag handle at 28-10px left of the
     * block, vertically centred on the first line like the number. So the number ends 56px left
     * of the block (--nlx-gutter).
     * In a column after the first, the gap to the previous column is only 46px (observed), so
     * there the number is 24px left of the block and may meet the handles on hover. (Numbers to
     * the right of the column were tried in v0.14.0; they do not work for 3 or more columns.) */
    ${F}:is([data-nlx-numbers],[data-nlx-headings]) .notion-page-content [data-block-id]:not(:is(${DB})):not(:is(${DB}) *){position:relative}
    /* Notion sets an inline position:relative on some text elements (block equations, observed),
     * which would make them the containing block again. Only a visually hidden MathML span is
     * positioned inside, so static is safe there. Elements with media keep Notion's positioning
     * (resize handles may depend on it); their numbers then follow the element. */
    ${F}:is([data-nlx-numbers],[data-nlx-headings]) .notion-page-content :is(${LINE}):not(:has(img,video,iframe,canvas)){position:static!important}
    ${F}[data-nlx-numbers] .notion-page-content :is(${COUNT})::before{content:counter(nlx-line)!important;position:absolute;top:auto;bottom:auto;inset-inline-start:auto;inset-inline-end:calc(100% + var(--nlx-gutter,56px) + var(--nlx-dx,0px));white-space:nowrap;text-align:end;${FONT};line-height:1lh;font-weight:400;font-style:normal;color:var(--nlx-number-color,#777);pointer-events:none;user-select:none}
    /* Table rows: cell text sits 7px below the row top with a 20px line (observed 2026-11-12);
     * the number takes the same line, which is also where Notion centres the row's handles. */
    ${F}[data-nlx-numbers] .notion-page-content .notion-table-row::before{margin-top:7px;height:20px;line-height:20px!important}
    /* Heading markers are drawn in the same ::before as backgrounds (1 to 4 bars by level,
     * 3px apart), and the number keeps its place through padding. Bars lie between the drag
     * handle's dots (end 15px left of the block) and the first character (starts 8px right of
     * the block; both observed 2026-11-12). The first bar is at the same x for every level
     * (starts 7px left of the block) and more bars extend to the right; the box ends 4px right of
     * the block, so H4's last bar ends 4px before the text. Even for H4 the gap to the dots (8px)
     * stays larger than the gap to the text (4px). Bars are 90% of the heading's line height (70% looked shorter than the text). */
    ${F}[data-nlx-headings] .notion-page-content :is(${HEAD}):not(:is(${DB}) *) :is(${LINE})::before{content:var(--nlx-num,"")!important;position:absolute;top:auto;bottom:auto;inset-inline-start:auto;inset-inline-end:calc(100% - 4px + var(--nlx-dx,0px));padding-inline-end:calc(var(--nlx-gutter,56px) + 4px);height:1lh;line-height:1lh;white-space:nowrap;text-align:end;${FONT};font-weight:400;font-style:normal;color:var(--nlx-number-color,#777);pointer-events:none;user-select:none;--nlx-bar:linear-gradient(var(--nlx-heading-color,#197d34),var(--nlx-heading-color,#197d34));background:var(--nlx-bar) right 9px center/2px 90% no-repeat}
    ${F}[data-nlx-headings] .notion-page-content .notion-sub_header-block:not(:is(${DB}) *) :is(${LINE})::before{background:var(--nlx-bar) right 9px center/2px 90% no-repeat,var(--nlx-bar) right 6px center/2px 90% no-repeat}
    ${F}[data-nlx-headings] .notion-page-content .notion-sub_sub_header-block:not(:is(${DB}) *) :is(${LINE})::before{background:var(--nlx-bar) right 9px center/2px 90% no-repeat,var(--nlx-bar) right 6px center/2px 90% no-repeat,var(--nlx-bar) right 3px center/2px 90% no-repeat}
    ${F}[data-nlx-headings] .notion-page-content .notion-header_4-block:not(:is(${DB}) *) :is(${LINE})::before{background:var(--nlx-bar) right 9px center/2px 90% no-repeat,var(--nlx-bar) right 6px center/2px 90% no-repeat,var(--nlx-bar) right 3px center/2px 90% no-repeat,var(--nlx-bar) right 0 center/2px 90% no-repeat}
    @media print{.notion-frame[data-nlx-pane]{padding-inline-end:0!important}${F} .notion-page-content :is(${LINE})::before{display:none!important}}
  `;
  const numbers = document.createElement('style'); numbers.id = 'nlx-number-styles';
  document.documentElement.append(base, numbers);
  const UUID = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;
  const hyphenate = id => id.replaceAll('-', '').toLowerCase().replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');
  let previousFrame = null;
  function setAttr(node, key, on) {
    if (!on) { if (node.hasAttribute(key)) node.removeAttribute(key); }
    else if (!node.hasAttribute(key)) node.setAttribute(key, '');
  }
  function setVar(node, key, value) { if (node.style.getPropertyValue(key) !== value) node.style.setProperty(key, value); }
  /* Counter start: the page-structure number of the first rendered block that has one, minus
   * the elements counted before and including it. 0 without the page structure (numbers then
   * count from the first rendered element). numberMap: Map(normalized id -> ordinal). */
  function start(root, numberMap) {
    if (!root || !numberMap?.size) return 0;
    let i = 0;
    for (const el of root.querySelectorAll(COUNT)) {
      i++;
      if (el.classList.contains('notion-table-row')) continue;
      const n = numberMap.get(el.closest('[data-block-id]')?.getAttribute('data-block-id')?.replaceAll('-', '').toLowerCase());
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
    const rootLeft = root.getBoundingClientRect().left + root.clientLeft + (parseFloat(getComputedStyle(root).paddingLeft) || 0);
    for (const block of root.querySelectorAll('[data-block-id]')) {
      if (block.closest(DB)) continue;
      const leaf = [...block.querySelectorAll(LINE)].find(e => e.closest('[data-block-id]') === block);
      if (!leaf) continue;
      // Not the outermost block: a table is three nested elements with the same data-block-id,
      // the outer one as wide as the window (observed 2026-11-12). The body's own left edge is
      // the text column (observed: .notion-page-content 383px = top-level text block 383px).
      const column = block.parentElement?.closest('.notion-column-block');
      const later = !!column && column.closest('.notion-column_list-block')?.querySelector('.notion-column-block') !== column;
      const anchorLeft = column && root.contains(column) ? column.getBoundingClientRect().left : rootLeft;
      let box = leaf;
      while (box && box !== root && getComputedStyle(box).position === 'static') box = box.parentElement;
      if (!box || box === root) continue;
      const boxRect = box.getBoundingClientRect(), boxLeft = boxRect.left + box.clientLeft;
      const dx = Math.round(boxLeft - anchorLeft);
      let decl = dx ? `--nlx-dx:${dx}px;` : '';
      if (later) decl += '--nlx-gutter:24px;';
      if (decl && UUID.test(block.getAttribute('data-block-id'))) out.push(`${F}:is([data-nlx-numbers],[data-nlx-headings]) .notion-page-content [data-block-id="${hyphenate(block.getAttribute('data-block-id'))}"]{${decl}}`);
    }
    return out.join('\n');
  }
  function apply(ctx, settings, paneOpen, numberMap) {
    const frame = ctx?.frame || null;
    if (previousFrame && previousFrame !== frame) for (const key of ['data-nlx-pane', 'data-nlx-outline', 'data-nlx-managed', 'data-nlx-numbers', 'data-nlx-headings']) setAttr(previousFrame, key, false);
    previousFrame = frame;
    const text = frame ? [settings.lineNumbers && ctx.root ? `${F}[data-nlx-numbers] .notion-page-content{counter-reset:nlx-line ${start(ctx.root, numberMap)}}` : '', settings.lineNumbers || settings.headingMarkers ? offsets(ctx.root) : ''].filter(Boolean).join('\n') : '';
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
  globalThis.NotionLinksDecorations = Object.freeze({ apply, isOwnNode: n => n === base || n === numbers });
})();
