/* Wide blocks (simple tables and database views) while the pane is open.
 * Notion gives these blocks the full width of the page scroller as an inline width, and inline
 * side paddings (about half the space beside the text column) that line their content up with
 * the text. Notion computes that width from its own frame width, which does not include the
 * pane's padding (observed 2026-11-13: frame 1276px, scroller 1266px, pane 320px; a database
 * view stayed 1266px wide, centred on the text column, so it reached 160px behind the sidebar
 * and 160px behind the pane, and so did its horizontal scrollbar).
 * While the pane is open, the inline values are overridden from our own <style> (nothing is
 * written inside the body): the width becomes the scroller's real width, and each side padding
 * shrinks by half the difference, so the block spans exactly the visible scroller and its
 * content stays on the text column. The elements are matched by their inline style text.
 */
(() => {
  'use strict';
  // Inline properties that carry the side space (observed: padding-left/right on a simple
  // table's content, padding-inline / inset-inline-start on a view's header row, padding-inline
  // or margin-inline on table, board, gallery and list views).
  const SIDE =
    /^(padding|margin)-(left|right|inline|inline-start|inline-end)$|^(inset-inline|inset-inline-start|inset-inline-end|left|right)$/;
  const SAFE = /^[\w\s.%(),+*/-]+$/;

  /* The value with every length of at least `min` px (in magnitude) moved `delta` px towards 0. */
  function shrink(value, delta, min) {
    return value.replace(/(-?)(\d+(?:\.\d+)?)px/g, (all, sign, n) => {
      const v = Number(n);
      return v >= min ? `${sign}${Math.max(0, Math.round((v - delta) * 100) / 100)}px` : all;
    });
  }

  /* Declarations of an inline style attribute, as [property, value] in source text. */
  function declarations(style) {
    return style
      .split(';')
      .map((d) => d.trim())
      .filter(Boolean)
      .map((d) => {
        const i = d.indexOf(':');
        return [d.slice(0, i).trim(), d.slice(i + 1).trim()];
      });
  }

  /* Selector for elements whose inline style has exactly this declaration. */
  function has(prop, value) {
    const d = `${prop}: ${value}`;
    return `:is([style="${d}"],[style="${d};"],[style^="${d};"],[style*="; ${d};"],[style$="; ${d}"])`;
  }

  /* CSS for the current layout. prefix: selector of the page content while the pane is open.
   * Returns '' when nothing needs to change. */
  function rules(frame, root, prefix) {
    const scroller = root?.closest('.notion-scroller.vertical');
    const inline = frame?.style.width.match(/^([\d.]+)px$/);
    if (!scroller || !inline) return '';
    // Notion's width: its frame width minus the scroller's scrollbar. Ours: the scroller's
    // content width with the pane's padding.
    const scrollbar = scroller.offsetWidth - scroller.clientWidth;
    const notionWidth = Math.round(Number(inline[1]) - scrollbar);
    const width = scroller.clientWidth;
    const delta = (notionWidth - width) / 2;
    if (!(delta > 0)) return '';
    const W = `${notionWidth}px`;
    const wide = `[style*="width: ${W}"]`;
    // Side spaces are about (width - text column) / 2; smaller lengths (cell paddings) stay.
    const min = Math.max(40, (notionWidth - root.clientWidth) / 2 - 40);
    const out = [
      `${prefix} ${has('width', W)}{width:${width}px !important}`,
      `${prefix} ${has('max-width', W)}{max-width:${width}px !important}`,
    ];
    const seen = new Set();
    for (const block of root.querySelectorAll(wide)) {
      for (const el of [block, ...block.querySelectorAll('[style]')]) {
        for (const [prop, value] of declarations(el.getAttribute('style') || '')) {
          if (!SIDE.test(prop) || !SAFE.test(value)) continue;
          const next = shrink(value, delta, min);
          const key = `${prop}: ${value}`;
          if (next === value || seen.has(key)) continue;
          seen.add(key);
          out.push(
            `${prefix} :is(${wide}, ${wide} *)${has(prop, value)}{${prop}:${next} !important}`,
          );
        }
      }
    }
    return out.join('\n');
  }

  globalThis.NotionLinksWideBlocks = Object.freeze({ rules, shrink, declarations });
})();
