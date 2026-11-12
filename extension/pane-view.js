// Pane structure, section heights, width resizing and list rendering.
(() => {
  'use strict';
  const { el } = NotionLinksUI;

  function create({ applyDecorations, onOutlineClick }) {
    const prefs = NotionLinksSettings;
    let settings = { ...prefs.defaults },
      saveQueue = Promise.resolve();
    const renderKeys = new WeakMap();
    const host = el('div');
    host.id = 'notion-links-local-panel';
    const shadow = host.attachShadow({ mode: 'open' });
    el('style', NotionLinksPanelStyle, shadow);
    const pane = el('aside', '', shadow);
    pane.id = 'pane';
    pane.hidden = true;
    pane.setAttribute('aria-label', 'Notionナビゲーション');
    // Left edge of the pane: drag to change its width (settings.paneWidth, also in the popup).
    const resizer = el('div', '', pane);
    resizer.className = 'resizer';
    resizer.setAttribute('role', 'separator');
    resizer.setAttribute('aria-orientation', 'vertical');
    resizer.tabIndex = 0;
    resizer.title = 'ドラッグで幅を変更';
    const content = el('div', '', pane);
    content.className = 'content';
    // Shown only when the page cannot be read; the page name itself is already visible in Notion.
    const title = el('p', '', content);
    title.id = 'page-error';
    title.hidden = true;
    // No refresh button: opening the pane always re-reads the page structure and backlinks.
    // Heights are split by weight. A splitter skips collapsed sections and resizes the nearest open ones.

    function section(name, index) {
      const box = el('div', '', content);
      box.className = 'section';
      box.style.setProperty('--w', '1');
      const summary = el('button', '', box);
      summary.className = 'summary';
      summary.setAttribute('aria-expanded', 'true');
      el('span', name, summary);
      const count = el('small', '', summary),
        body = el('div', '', box);
      body.className = 'body';
      const status = el('p', '', body);
      status.className = 'status';
      summary.onclick = () => {
        const open = box.hasAttribute('data-collapsed');
        box.toggleAttribute('data-collapsed', !open);
        summary.setAttribute('aria-expanded', String(open));
        layout();
      };
      return { details: box, index, count, status, list: el('ul', '', body) };
    }

    const outline = section('Outline', 0),
      forward = section('Forward links', 1),
      backward = section('Backward links', 2);
    const sections = [outline, forward, backward],
      MIN_SECTION = 64;

    function layout() {
      for (const s of sections) s.details.style.setProperty('--w', String(settings.sizes[s.index]));
      for (const n of content.querySelectorAll('.splitter')) n.remove();
      const shown = sections.filter((s) => !s.details.hidden);
      for (let i = 1; i < shown.length; i++) {
        const a = shown[i - 1],
          b = shown[i],
          bar = el('div');
        bar.className = 'splitter';
        bar.setAttribute('role', 'separator');
        bar.setAttribute('aria-orientation', 'horizontal');
        bar.tabIndex = 0;
        bar.title = 'ドラッグで高さを変更';
        const open = (s) => !s.details.hasAttribute('data-collapsed'),
          above = shown.slice(0, i).reverse().find(open),
          below = shown.slice(i).find(open);
        bar.toggleAttribute('data-inert', !above || !below);
        if (!above || !below) {
          bar.tabIndex = -1;
          bar.title = '';
        }
        b.details.before(bar);
        if (above && below) bindSplitter(bar, above, below);
      }
    }

    function bindSplitter(bar, a, b) {
      let start = null;
      const resize = (dy) => {
        const { hA, hB, wA, wB } = start,
          total = hA + hB,
          next = Math.min(total - MIN_SECTION, Math.max(MIN_SECTION, hA + dy)),
          sizes = [...settings.sizes];
        sizes[a.index] = ((wA + wB) * next) / total;
        sizes[b.index] = wA + wB - sizes[a.index];
        settings = { ...settings, sizes };
        a.details.style.setProperty('--w', String(sizes[a.index]));
        b.details.style.setProperty('--w', String(sizes[b.index]));
      };
      const begin = () => {
        start = {
          hA: a.details.getBoundingClientRect().height,
          hB: b.details.getBoundingClientRect().height,
          wA: settings.sizes[a.index],
          wB: settings.sizes[b.index],
        };
      };
      const save = () => {
        start = null;
        const snapshot = { ...settings };
        saveQueue = saveQueue
          .catch(() => {})
          .then(() => prefs.write(snapshot))
          .catch(() => {});
      };
      bar.onpointerdown = (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        bar.setPointerCapture(e.pointerId);
        begin();
        start.y = e.clientY;
        bar.setAttribute('data-dragging', '');
      };
      bar.onpointermove = (e) => {
        if (start) resize(e.clientY - start.y);
      };
      bar.onpointerup = bar.onpointercancel = () => {
        if (!start) return;
        bar.removeAttribute('data-dragging');
        save();
      };
      bar.onkeydown = (e) => {
        const dy = e.key === 'ArrowUp' ? -24 : e.key === 'ArrowDown' ? 24 : 0;
        if (!dy) return;
        e.preventDefault();
        begin();
        resize(dy);
        save();
      };
    }

    {
      let start = null;
      const width = (w) => Math.round(Math.max(240, Math.min(720, innerWidth - 200, w))),
        set = (w) => {
          settings = { ...settings, paneWidth: width(w) };
          host.style.setProperty('--pane-width', `${settings.paneWidth}px`);
          applyDecorations();
        },
        save = () => {
          start = null;
          const snapshot = { ...settings };
          saveQueue = saveQueue
            .catch(() => {})
            .then(() => prefs.write(snapshot))
            .catch(() => {});
        };
      resizer.onpointerdown = (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        resizer.setPointerCapture(e.pointerId);
        start = { x: e.clientX, w: pane.getBoundingClientRect().width };
        resizer.setAttribute('data-dragging', '');
      };
      resizer.onpointermove = (e) => {
        if (start) set(start.w + start.x - e.clientX);
      };
      resizer.onpointerup = resizer.onpointercancel = () => {
        if (!start) return;
        resizer.removeAttribute('data-dragging');
        save();
      };
      resizer.onkeydown = (e) => {
        const dx = e.key === 'ArrowLeft' ? 20 : e.key === 'ArrowRight' ? -20 : 0;
        if (!dx) return;
        e.preventDefault();
        set(settings.paneWidth + dx);
        save();
      };
    }
    document.documentElement.append(host);

    /* Notion routes its pages on the client: after pushState, a popstate event makes it render
     * the page at the new URL without reloading (observed 2026-11-13; the back button returns
     * the same way). The path is on the current host, so links saved with another Notion host
     * stay in this tab too. If pushState fails, the page is loaded normally. */
    function openInPlace(item) {
      try {
        history.pushState(history.state, '', `/p/${item.id}`);
        dispatchEvent(new PopStateEvent('popstate', { state: history.state }));
      } catch {
        location.assign(item.href);
      }
    }

    function renderList(list, items, kind) {
      const key = JSON.stringify(items);
      if (renderKeys.get(list) === key) return;
      renderKeys.set(list, key);
      const frag = document.createDocumentFragment();
      for (const item of items) {
        const li = el('li', '', frag),
          a = el('a', item.title, li);
        if (kind === 'outline') {
          a.href = `#${item.id.replaceAll('-', '')}`;
          a.className = 'outline-link';
          a.dataset.blockId = item.id;
          a.style.paddingInlineStart = `${6 + (item.level - 1) * 14}px`;
          a.onclick = (e) => {
            e.preventDefault();
            void onOutlineClick(item);
          };
        } else {
          a.href = item.href;
          a.rel = 'noreferrer';
          // A plain click moves in this tab like Notion's own links; modified and middle clicks
          // keep the browser's default (new tab or window).
          a.onclick = (e) => {
            if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            e.preventDefault();
            openInPlace(item);
          };
        }
      }
      list.replaceChildren(frag);
    }

    function clearLists() {
      for (const section of sections) {
        section.list.replaceChildren();
        renderKeys.delete(section.list);
        section.count.textContent = '';
      }
    }

    return {
      host,
      shadow,
      pane,
      content,
      title,
      outline,
      forward,
      backward,
      sections,
      layout,
      renderList,
      clearLists,
      get settings() {
        return settings;
      },
      set settings(value) {
        settings = value;
      },
    };
  }

  globalThis.NotionLinksPane = Object.freeze({ create });
})();
