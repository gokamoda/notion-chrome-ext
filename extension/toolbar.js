// Mount the pane toggle beside Notion Share, with a fallback when the toolbar is absent.
(() => {
  'use strict';
  const { el, paneToggle } = NotionLinksUI;

  function create({ host, shadow }) {
    const dom = NotionLinksDOM;
    const toolbarHost = el('span');
    toolbarHost.id = 'nlx-toolbar';
    const tbShadow = toolbarHost.attachShadow({ mode: 'open' });
    el(
      'style',
      `
:host {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  margin: 0 5px;
}
button {
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: inherit;
  font: 14px/1.4 system-ui;
  cursor: pointer;
  padding: 5px 8px;
}
button:hover,
button[aria-expanded='true'] {
  background: #8882;
}
button:focus-visible {
  outline: 2px solid #197d34;
  outline-offset: 2px;
}
`,
      tbShadow,
    );

    const linksButton = paneToggle(tbShadow);
    const fallback = paneToggle(shadow);
    fallback.id = 'fallback';
    fallback.hidden = true;

    function mountToolbar() {
      // The pane's host goes beside Notion's popup layer (see :host in panel-style.js).
      const app = document.querySelector('.notion-app-inner') || document.documentElement;
      if (host.parentElement !== app) app.append(host);
      const toolbar = dom.toolbar(document);
      if (toolbar) {
        const share = dom.shareAnchor(toolbar);
        if (share) {
          if (toolbarHost.nextSibling !== share) share.before(toolbarHost);
        } else if (toolbarHost.parentElement !== toolbar) toolbar.prepend(toolbarHost);
        fallback.hidden = true;
        /* The pane starts below the top bar: the page's, or in a side peek the peek's (where the
         * toggle then is), i.e. at the top of the peek's scroller. */
        const peek = toolbar.closest('.notion-peek-renderer');
        const top = peek
          ? peek.querySelector('.notion-scroller.vertical')?.getBoundingClientRect().top || 44
          : toolbar.closest('.notion-topbar')?.getBoundingClientRect().bottom || 48;
        host.style.setProperty('--pane-top', `${Math.max(0, top)}px`);
      } else {
        fallback.hidden = false;
        toolbarHost.remove();
      }
    }

    return { linksButton, fallback, mount: mountToolbar };
  }

  globalThis.NotionLinksToolbar = Object.freeze({ create });
})();
