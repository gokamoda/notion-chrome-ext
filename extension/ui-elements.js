// Shared DOM builders. Page-derived strings are always assigned through textContent.
(() => {
  'use strict';
  const el = (tag, text, parent) => {
    const n = document.createElement(tag);
    if (text) n.textContent = text;
    parent?.append(n);
    return n;
  };

  function paneToggle(parent) {
    const button = el('button', '', parent);
    button.setAttribute('aria-label', '右Paneを開閉');
    button.title = 'Outline・リンクのPaneを開閉';
    button.setAttribute('aria-expanded', 'false');
    const ns = 'http://www.w3.org/2000/svg',
      svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '18');
    svg.setAttribute('height', '18');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.7');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.display = 'block';
    const rect = document.createElementNS(ns, 'rect');
    for (const [k, v] of Object.entries({ x: 3, y: 4, width: 18, height: 16, rx: 2 }))
      rect.setAttribute(k, v);
    const divider = document.createElementNS(ns, 'path');
    divider.setAttribute('d', 'M16 4v16');
    svg.append(rect, divider);
    button.append(svg);
    return button;
  }

  globalThis.NotionLinksUI = Object.freeze({ el, paneToggle });
})();
