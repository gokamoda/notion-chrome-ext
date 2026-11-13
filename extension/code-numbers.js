/* Line numbers inside code blocks.
 * Like the other decorations, nothing is written inside the body (Notion reverts it): the
 * numbers are the content of an ::after on the code text element, set per block in our own
 * <style>. One number per logical line (text between line breaks). With "wrap code" on, a long
 * line takes several visual rows; the rows of each line are measured with Range client rects
 * (no DOM changes), and the number column gets an empty row for each continuation row, so
 * every number stays on the first row of its line.
 */
(() => {
  'use strict';

  /* CSS content for the gutter: rows[i] is the number of visual rows of line i + 1.
   * Only digits and line breaks, so the string is safe inside the quotes. Each \A escape is
   * followed by a space, which ends the escape (otherwise "\A2" would read as one hex escape). */
  function gutterContent(rows) {
    return rows.map((n, i) => `${i + 1}${'\\A '.repeat(Math.max(1, n) - 1)}`).join('\\A ');
  }

  /* Logical lines of a code text element as lists of [text node, start, end] pieces.
   * Line breaks are "\n" in text nodes (white-space: pre-wrap) or <br> elements. */
  function lines(leaf) {
    const out = [[]];
    const walker = document.createTreeWalker(leaf, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.nodeType === 1) {
        if (node.tagName === 'BR') out.push([]);
        continue;
      }
      const text = node.data;
      let from = 0;
      for (let i = text.indexOf('\n'); i !== -1; i = text.indexOf('\n', from)) {
        if (i > from) out.at(-1).push([node, from, i]);
        out.push([]);
        from = i + 1;
      }
      if (from < text.length) out.at(-1).push([node, from, text.length]);
    }
    // Notion ends the code text with one extra line break (observed 2026-11-13: two lines of
    // code are "a\nb\n"), which is not a line of its own; drawn as an empty row only when
    // wrapping (white-space: break-spaces). A real empty last line leaves one more break.
    if (out.length > 1 && !out.at(-1).length) out.pop();
    return out;
  }

  /* Visual rows of one logical line: distinct tops of its text rects (an empty line is one row). */
  function rowsOf(pieces, lineHeight) {
    const tops = [];
    const range = document.createRange();
    for (const [node, start, end] of pieces) {
      range.setStart(node, start);
      range.setEnd(node, end);
      for (const rect of range.getClientRects()) {
        if (!rect.width && !rect.height) continue;
        if (!tops.some((t) => Math.abs(t - rect.top) < lineHeight / 2)) tops.push(rect.top);
      }
    }
    return Math.max(1, tops.length);
  }

  const cache = new WeakMap();

  /* Rows per logical line for a code text element. Cached while text and width are unchanged. */
  function measure(leaf) {
    const style = getComputedStyle(leaf);
    const key = `${leaf.textContent}\u0000${leaf.clientWidth}\u0000${style.font}\u0000${style.whiteSpace}`;
    const hit = cache.get(leaf);
    if (hit?.key === key) return hit.rows;
    const parts = lines(leaf);
    let lineHeight = parseFloat(style.lineHeight);
    if (!Number.isFinite(lineHeight)) {
      const first = parts.find((p) => p.length)?.[0];
      const range = document.createRange();
      if (first) {
        range.setStart(first[0], first[1]);
        range.setEnd(first[0], first[1] + 1);
      }
      lineHeight = (first && range.getClientRects()[0]?.height) || parseFloat(style.fontSize) * 1.5;
    }
    const wraps = !/^(pre|nowrap)$/.test(style.whiteSpace);
    const rows = parts.map((p) => (wraps && p.length ? rowsOf(p, lineHeight) : 1));
    cache.set(leaf, { key, rows });
    return rows;
  }

  globalThis.NotionLinksCodeNumbers = Object.freeze({ gutterContent, lines, measure });
})();
