/* Synthetic fixtures, NOT an assertion that these variants were observed in Notion. */
(() => {
  const out = document.getElementById('results'),
    fixture = document.getElementById('fixture');
  const a = 'a'.repeat(32),
    b = 'b'.repeat(32),
    c = 'c'.repeat(32);
  const base = `https://app.notion.com/p/${a}`,
    adapter = NotionLinksDOM;
  const lines = [];
  const assert = (value, name) => {
    if (!value) throw Error(name);
    lines.push(`PASS ${name}`);
  };
  const make = (tag, parent, cls, text) => {
    const n = document.createElement(tag);
    n.className = cls || '';
    n.textContent = text || '';
    parent.append(n);
    return n;
  };
  const link = (parent, href, text, cls) => {
    const n = make('a', parent, cls, text);
    n.setAttribute('href', href);
    return n;
  };
  try {
    const frame = make('div', fixture, 'notion-frame');
    const title = make('div', frame, 'notion-page-block');
    title.dataset.blockId = a;
    make('div', title, '', 'Fixture page').contentEditable = 'true';
    const body = make('div', frame, 'notion-page-content');
    const block = make('div', body, 'notion-text-block');
    block.dataset.blockId = 'block';
    link(block, `/p/${b}?pvs=24`, 'ページメンション', 'notion-page-mention-token');
    link(block, `https://www.notion.so/Other-${b}#different`, '重複');
    link(block, `https://example.org/${c}`, '外部');
    link(block, 'javascript:alert(1)', '危険');
    link(frame, `/p/${c}`, 'パンくず');
    const db = make('div', body, 'notion-collection_view-block');
    link(db, `/p/${c}`, 'DB');
    const alias = make('div', body, 'notion-alias-block');
    link(alias, `/p/${c}`, 'ページへのリンク');
    const ctx = adapter.context(document, base);
    assert(!ctx.error && ctx.title === 'Fixture page', '本文とタイトルの識別');
    const toolbar = make('div', fixture, 'notion-topbar-action-buttons');
    assert(adapter.toolbar(document) === toolbar, '上部バーの挿入先を検出');
    const hid = (i) => `0000000${i}-0000-4000-8000-00000000000${i}`;
    for (let i = 1; i <= 4; i++) {
      const h = make(
        'div',
        body,
        `notion-selectable notion-${['header', 'sub_header', 'sub_sub_header', 'header_4'][i - 1]}-block`,
      );
      h.dataset.blockId = hid(i);
      const e = make(`h${i + 1}`, h, '', `見出し${i}`);
      e.contentEditable = 'true';
      e.setAttribute('data-content-editable-leaf', 'true');
    }
    {
      const e = body.querySelector(`[data-block-id="${hid(1)}"] h2`);
      e.textContent = '';
      const tok = make('span', e, 'notion-text-equation-token');
      const k = make('span', tok, 'katex');
      const ml = make('span', k, 'katex-mathml');
      const an = document.createElementNS('http://www.w3.org/1998/Math/MathML', 'annotation');
      an.setAttribute('encoding', 'application/x-tex');
      an.textContent = '\\Gamma(1/2)';
      ml.append('Γ(1/2)', an);
      make('span', k, 'katex-html', 'Γ(1/2)');
      e.append(' の値');
    }
    const hs = adapter.headings(ctx);
    assert(hs[0].title === '\\Gamma(1/2) の値', '見出し内の数式はLaTeXソースで表示');
    assert(
      hs.length === 4 && hs.map((h) => h.level).join() === '1,2,3,4',
      'NotionのH1〜H4をネイティブのh2〜h5から分類',
    );
    const on = {
      lineNumbers: true,
      headingMarkers: true,
      paneWidth: 340,
      accent: '#197d34',
      numberColor: '#888888',
    };
    const before = body.outerHTML;
    NotionLinksDecorations.apply(ctx, on, true);
    const h3 = body.querySelector(`[data-block-id="${hid(3)}"] h4`);
    assert(
      body.outerHTML === before && !body.hasAttribute('data-nlx-managed'),
      '本文の要素には属性を書き込まない',
    );
    assert(
      getComputedStyle(h3, '::before').content === 'counter(nlx-line)' &&
        getComputedStyle(h3).counterIncrement === 'nlx-line 1' &&
        getComputedStyle(h3, '::before').backgroundImage.includes('linear-gradient'),
      '行番号（CSSカウンター）と見出しの縦棒をCSSで表示',
    );
    {
      const bars = (e) =>
        (getComputedStyle(e, '::before').backgroundImage.match(/linear-gradient/g) || []).length;
      assert(
        [2, 3, 4, 5]
          .map((i) => bars(body.querySelector(`[data-block-id="${hid(i - 1)}"] h${i}`)))
          .join() === '1,2,3,4',
        '見出しの縦棒はH1〜H4で1〜4本',
      );
    }
    NotionLinksDecorations.apply(ctx, on, true, new Map([[hid(3).replaceAll('-', ''), 42]]));
    {
      const before = [...body.querySelectorAll('*')].filter(
        (e) => getComputedStyle(e).counterIncrement === 'nlx-line 1',
      );
      const i = before.indexOf(h3) + 1;
      assert(
        i > 0 && getComputedStyle(body).counterReset === `nlx-line ${42 - i}`,
        `カウンターはページ構造の番号から数え始める（${getComputedStyle(body).counterReset}）`,
      );
    }
    {
      // H2 stands for a closed toggle: 8 numbered descendants (12-19) with no rendered block.
      const key = (i) => hid(i).replaceAll('-', '');
      const map = new Map([
        [key(1), 10],
        [key(2), 11],
        [key(3), 20],
        [key(4), 21],
      ]);
      NotionLinksDecorations.apply(ctx, on, true, map, new Map([[key(2), 8]]));
      const set = (i) =>
        getComputedStyle(body.querySelector(`[data-block-id="${hid(i)}"]`)).counterSet;
      const gapOnly = new Map([...map].map(([k, v]) => [k, k === key(4) ? v + 3 : v]));
      NotionLinksDecorations.apply(ctx, on, true, gapOnly, new Map([[key(2), 8]]));
      const later = set(4);
      NotionLinksDecorations.apply(ctx, on, true, map, new Map([[key(2), 8]]));
      assert(
        set(3) === 'nlx-line 19' &&
          set(1) === 'none' &&
          set(2) === 'none' &&
          set(4) === 'none' &&
          later === 'none',
        `閉じたトグルの後は中のブロックの数だけ番号を進める（${[1, 2, 3, 4].map(set).join(' / ')}）`,
      );
    }
    NotionLinksDecorations.apply(ctx, { ...on, lineNumbers: false, headingMarkers: false }, false);
    assert(
      getComputedStyle(h3, '::before').content === 'none' &&
        getComputedStyle(h3, '::before').backgroundImage === 'none' &&
        !frame.hasAttribute('data-nlx-pane') &&
        !frame.hasAttribute('data-nlx-numbers'),
      '設定OFFで装飾とPane用余白を解除',
    );
    for (const h of body.querySelectorAll('[data-block-id^="heading"]')) h.remove();
    const items = adapter.forward(ctx, base);
    assert(
      items.length === 2 && items[0].id === b && items[1].id === c,
      '本文リンク・メンション・リンクブロックと重複排除',
    );
    alias.remove();
    assert(adapter.forward(ctx, base).length === 1, 'DBと外部とナビゲーションを除外');
    block.replaceChildren();
    assert(adapter.forward(ctx, base).length === 0, '本文を取得できた場合の範囲内0件');
    assert(
      adapter.context(document, `https://app.notion.com/p/${b}`).error,
      '移動中の古い本文を拒否',
    );
    const second = make('div', frame, 'notion-page-content', '別ページ');
    assert(adapter.context(document, base).error, '複数本文は曖昧として拒否');
    second.remove();
    {
      // Side peek: the peeked page (?p=) is drawn in .notion-peek-renderer beside the page.
      const peekURL = `${base}?p=${c}&pm=s`;
      assert(
        adapter.target(peekURL).id === c && adapter.target(base).id === a,
        'サイドピーク中はURLのpのページを対象にする',
      );
      assert(adapter.context(document, peekURL).error, 'サイドピークの描画前は読まない');
      const peek = make('div', fixture, 'notion-peek-renderer');
      const peekTitle = make('div', peek, 'notion-page-block');
      peekTitle.dataset.blockId = c;
      make('div', peekTitle, '', 'Peek page').contentEditable = 'true';
      const peekBody = make('div', peek, 'notion-page-content', 'ピークの本文');
      const peekCtx = adapter.context(document, peekURL);
      assert(
        !peekCtx.error &&
          peekCtx.root === peekBody &&
          peekCtx.title === 'Peek page' &&
          peekCtx.frame === peek &&
          peekCtx.peek === peek,
        'サイドピーク中はピーク側の本文とタイトルを読み、装飾の切り替えはピークに付ける',
      );
      const bar = make('div', peek);
      for (const label of ['a', 'b']) make('div', bar, '', label);
      const share = make('div', make('div', bar), '', '共有');
      share.setAttribute('role', 'button');
      share.setAttribute('aria-label', '共有');
      assert(
        adapter.toolbar(document) === bar && adapter.shareAnchor(bar) === share,
        'サイドピーク中はペインの開閉アイコンをピーク上部の共有の左に置く',
      );
      peek.remove();
    }
    body.remove();
    assert(adapter.context(document, base).error, '本文の取得失敗と0件を区別');
    lines.push(`完了: ${lines.length}件成功`);
  } catch (error) {
    lines.push(`FAIL ${error.message}`);
  }
  out.textContent = lines.join('\n');
})();
