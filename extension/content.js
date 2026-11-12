// Entry point: coordinate settings, navigation and cancellable page reads.
(() => {
  'use strict';
  if (document.getElementById('notion-links-local-panel')) return;
  const { pageLink } = NotionLinksCore,
    dom = NotionLinksDOM,
    prefs = NotionLinksSettings;

  const view = NotionLinksPane.create({
    applyDecorations: () =>
      NotionLinksDecorations.apply(ctx, view.settings, !view.pane.hidden, pageData?.numbers),
    onOutlineClick: (item) => navigation.jump(item),
  });
  const { host, shadow, pane, content, title, outline, forward, backward, layout, renderList } =
    view;
  const snapshot = NotionLinksSnapshot.create();
  const navigation = NotionLinksOutline.create({
    outline,
    getState: () => ({ ctx, epoch, currentID, pageData, pane }),
  });
  const highlight = navigation.highlight;
  let ctx = null,
    currentID = '',
    route = '',
    timer = null,
    lastRun = 0,
    lastError = '';
  let backSnapshot = null,
    backMessage = '未取得';
  let backTask = null,
    epoch = 0,
    navAuto = '';
  let pageData = null,
    pageTask = null,
    pageRequest = '',
    pageError = '';

  const toolbar = NotionLinksToolbar.create({ host, shadow });
  const { linksButton, fallback } = toolbar;
  const media = matchMedia('(prefers-color-scheme: dark)');

  function applySettings() {
    const dark =
      view.settings.theme === 'dark' ||
      (view.settings.theme === 'auto' &&
        (!!document.querySelector('.notion-dark-theme') ||
          (media.matches && !document.querySelector('.notion-light-theme'))));
    host.toggleAttribute('data-dark', !!dark);
    host.style.setProperty('--accent', view.settings.accent);
    host.style.setProperty('--pane-width', `${view.settings.paneWidth}px`);
    outline.details.hidden = !view.settings.outline;
    forward.details.hidden = !view.settings.forward;
    backward.details.hidden = !view.settings.backward;
    if (!content.querySelector('.splitter[data-dragging]')) layout();
    NotionLinksDecorations.apply(ctx, view.settings, !pane.hidden, pageData?.numbers);
  }

  prefs
    .read()
    .then((value) => {
      view.settings = value;
      applySettings();
      schedule();
    })
    .catch(() => {});
  globalThis.chrome?.storage?.onChanged?.addListener((changes, area) => {
    if (area === 'local' && changes[prefs.KEY]) {
      view.settings = prefs.sanitize(changes[prefs.KEY].newValue);
      applySettings();
      schedule();
    }
  });
  media.addEventListener('change', applySettings);

  function reset() {
    // Keep async results started on the previous page from reaching the new one.
    epoch++;
    pageTask?.abort();
    pageTask = null;
    pageData = null;
    pageRequest = '';
    pageError = '';
    backTask?.abort();
    backTask = null;
    snapshot.reset();
    backSnapshot = null;
    backMessage = '未取得';

    view.clearLists();
    navAuto = '';
  }

  function collect() {
    snapshot.collect(ctx, location.href);
  }

  // Lists come from the page structure; status lines only note missing, partial or failed reads.

  function render() {
    title.hidden = !!ctx;
    if (!ctx) {
      title.textContent = `取得できません：${lastError || 'ページの描画待ち'}`;
      outline.status.textContent = '';
      forward.status.textContent = '';
      backward.status.textContent = '';
      return;
    }
    const partial = pageData
      ? `${pageData.complete ? '' : '途中までしか取得できませんでした。'}${pageData.missing ? '一部ブロックは取得できませんでした。' : ''}`
      : '';
    const h = snapshot.headings;
    outline.count.textContent = String(h.length);
    outline.status.textContent = pageData
      ? `${partial}${pageData.unsupported.length ? '未対応ブロック内の見出しは対象外。' : ''}`
      : pageTask
        ? '取得中…'
        : 'ページ構造を取得できないため、描画済みの見出しのみ。';
    renderList(outline.list, h, 'outline');
    forward.count.textContent = String(snapshot.forwardItems.length);
    forward.status.textContent = pageData
      ? `${partial}${snapshot.capped ? '上限2,000件。' : ''}`
      : pageTask
        ? '取得中…'
        : `ページ構造を取得できないため、描画済みの本文のみ。${snapshot.capped ? '上限2,000ブロック。' : ''}`;
    renderList(forward.list, snapshot.forwardItems, 'links');
    backward.count.textContent = backSnapshot ? String(backSnapshot.items.length) : '—';
    backward.status.textContent = backTask
      ? '取得中…'
      : backMessage ||
        (backSnapshot
          ? `${backSnapshot.inaccessible ? `閲覧権限のないページ${backSnapshot.inaccessible}件は表示していません。` : ''}${backSnapshot.partial || backSnapshot.unresolved ? '一部のリンク元を取得できませんでした。' : ''}${backSnapshot.capped ? '上限2,000件。' : ''}`
          : '未取得');
    renderList(backward.list, backSnapshot?.items || [], 'links');
    highlight();
  }

  function update() {
    lastRun = Date.now();
    toolbar.mount();
    const next = `${location.pathname}${location.search}`,
      id = pageLink(location.href, location.href)?.id || '';
    if (id !== currentID || next !== route) {
      reset();
      currentID = id;
      route = next;
    }
    const result = dom.context(document, location.href);
    lastError = result.error || '';
    ctx = result.error ? null : result;
    applySettings();
    if (ctx) {
      collect();
      if (pageRequest !== currentID) void loadPageData();
    } else {
      view.clearLists();
    }
    render();
    if (ctx && !pane.hidden && view.settings.backward && !backTask && navAuto !== currentID) {
      navAuto = currentID;
      void acquireBacklinks();
    }
  }

  async function loadPageData() {
    if (!ctx || pageTask) return;
    const controller = new AbortController(),
      ticket = epoch,
      id = currentID;
    pageTask = controller;
    pageRequest = id;
    pageError = '';
    try {
      const data = await NotionLinksPageData.load(id, { signal: controller.signal });
      if (ticket !== epoch || id !== currentID) return;
      pageData = data;
      snapshot.seed(data);
      collect();
      applySettings();
    } catch (error) {
      if (ticket === epoch && error.name !== 'AbortError') pageError = error.message;
    } finally {
      if (pageTask === controller) pageTask = null;
      if (ticket === epoch) render();
    }
  }

  function schedule() {
    if (timer || document.hidden) return;
    timer = setTimeout(
      () => {
        timer = null;
        update();
      },
      Math.max(200, 700 - (Date.now() - lastRun)),
    );
  }

  function setOpen(value) {
    pane.hidden = !value;
    linksButton.setAttribute('aria-expanded', String(value));
    fallback.setAttribute('aria-expanded', String(value));
    applySettings();
    if (!value) {
      backTask?.abort();
      backTask = null;
    } else {
      navAuto = '';
      pageRequest = '';
      update();
    }
  }

  linksButton.onclick = fallback.onclick = () => setOpen(pane.hidden);

  async function acquireBacklinks() {
    if (!ctx || !view.settings.backward || backTask) return;
    const controller = new AbortController(),
      ticket = epoch,
      id = currentID;
    backTask = controller;
    backSnapshot = null;
    backMessage = '';
    render();
    try {
      const data = await NotionLinksPageData.loadBacklinks(id, { signal: controller.signal });
      if (ticket === epoch && id === currentID) backSnapshot = data;
    } catch (error) {
      if (ticket === epoch && error.name !== 'AbortError')
        backMessage = `取得できません：${error.message}`;
    } finally {
      if (backTask === controller) backTask = null;
      if (ticket === epoch) render();
    }
  }

  const own = (n) => !!n && (NotionLinksDecorations.isOwnNode(n) || !!n.closest?.('#nlx-toolbar'));
  const observer = new MutationObserver((records) => {
    if (records.every((r) => own(r.target.nodeType === 1 ? r.target : r.target.parentElement)))
      return;
    schedule();
  });
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['href', 'class', 'aria-busy'],
  });
  window.addEventListener('popstate', schedule);
  window.addEventListener('resize', schedule);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) schedule();
  });
  setInterval(() => {
    if (
      !document.hidden &&
      (`${location.pathname}${location.search}` !== route ||
        (ctx &&
          (!ctx.root.isConnected || (ctx.frame && !ctx.frame.hasAttribute('data-nlx-managed')))))
    )
      schedule();
  }, 1000);
  update();
})();
