(async () => {
  const results = [],
    check = (value, label) => {
      if (!value) throw Error(label);
      results.push(`PASS ${label}`);
    };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms)),
    root = document.getElementById('notion-links-local-panel').shadowRoot;
  const h2Number = () => document.querySelector('h2');
  try {
    const button = document.getElementById('nlx-toolbar').shadowRoot.querySelector('button');
    check(
      root.querySelector('#pane').hidden &&
        button.textContent === '' &&
        button.querySelector('svg'),
      '初期状態はPaneを閉じ、上部バーへアイコンを配置',
    );
    {
      const host = document.getElementById('nlx-toolbar');
      check(
        host.previousElementSibling?.id === 'edited' &&
          host.nextElementSibling?.querySelector('[aria-label="共有"]'),
        '開閉アイコンは編集時刻の右・共有ボタンの左',
      );
    }
    button.click();
    await wait(1400);
    check(
      !root.querySelector('#pane').hidden && button.getAttribute('aria-expanded') === 'true',
      'LinksでPaneを開く',
    );
    check(
      getComputedStyle(document.getElementById('native-toc')).display === 'none',
      'Outlineを表示中はNotion標準のアウトラインを隠す',
    );
    check(
      root.querySelector('#page-error').hidden && !root.querySelector('#refresh,.tools'),
      'ページ名と再取得ボタンを置かない',
    );
    const sections = [...root.querySelectorAll('.section')];
    check(
      sections.length === 3 && sections[0].querySelectorAll('li').length === 4,
      '3セクションとH1〜H4のOutline',
    );
    check(sections[1].querySelectorAll('li').length === 1, 'Forward linksを自動収集して重複排除');
    check(sections[2].querySelectorAll('li').length === 1, 'LinksクリックだけでBacklinksも取得');
    check(
      !window.nativeBacklinksOpened && !document.querySelector('[role=dialog]'),
      'Notion標準のBacklinks一覧を開かない',
    );
    check(
      sections[2].textContent.includes('<img src=x') && !root.querySelector('img'),
      'ページ由来のHTMLを文字列として安全に描画',
    );
    {
      const h4 = document.querySelector('h4');
      check(
        getComputedStyle(document.querySelector('h2'), '::before').content ===
          'counter(nlx-line)' &&
          (getComputedStyle(h4, '::before').backgroundImage.match(/linear-gradient/g) || [])
            .length === 3 &&
          !document.querySelector(
            '.notion-page-content [data-nlx-number],.notion-page-content [data-nlx-level],.notion-page-content[data-nlx-managed]',
          ),
        '本文に書き込まずCSSで行番号と見出し装飾',
      );
    }
    {
      const a = getComputedStyle(h2Number(), '::before'),
        b = getComputedStyle(document.getElementById('code-inner'), '::before');
      check(
        a.fontSize === b.fontSize &&
          a.fontFamily === b.fontFamily &&
          /monospace/.test(b.fontFamily) &&
          (
            getComputedStyle(document.getElementById('h4'), '::before').backgroundImage.match(
              /linear-gradient/g,
            ) || []
          ).length === 4,
        '行番号は等幅で、見出しと本文で同じ大きさ。H4は縦棒4本',
      );
    }
    check(
      getComputedStyle(document.getElementById('nested')).getPropertyValue('--nlx-dx').trim() ===
        '26px' &&
        getComputedStyle(document.getElementById('row1')).getPropertyValue('--nlx-dx').trim() ===
          '10px',
      '入れ子・表の行は外側のブロックとの差を補正して同じ列にそろえる',
    );
    check(
      getComputedStyle(document.getElementById('cell'), '::before').content === 'none' &&
        getComputedStyle(document.getElementById('cell')).counterIncrement === 'none' &&
        getComputedStyle(document.getElementById('row1')).counterIncrement === 'nlx-line 1',
      '表のセルには番号を出さず、数えない（行を数える）',
    );
    {
      const r = document.querySelector('.notion-page-content'),
        inc = (e) => getComputedStyle(e).counterIncrement;
      check(
        getComputedStyle(r).counterReset === 'nlx-line 0' &&
          inc(document.getElementById('code-outer')) === 'none' &&
          inc(document.getElementById('code-inner')) === 'nlx-line 1',
        '番号はCSSカウンター（コードブロックは内側だけ数える）',
      );
      const b = document.createElement('div');
      b.className = 'notion-selectable notion-text-block';
      b.dataset.blockId = 'dddddddd-0000-4000-8000-000000000001';
      b.innerHTML = '<div contenteditable="true" data-content-editable-leaf="true">追加</div>';
      document.querySelector('[data-block-id="22222222-2222-2222-2222-222222222222"]').after(b);
      const leaf = b.firstChild;
      check(
        inc(leaf) === 'nlx-line 1' &&
          getComputedStyle(leaf, '::before').content === 'counter(nlx-line)',
        '追加したブロックはその場で数えられる',
      );
      b.remove();
    }
    {
      const blk = document.querySelector('[data-block-id="22222222-2222-2222-2222-222222222222"]'),
        leaf = blk.querySelector('[contenteditable]'),
        n = getComputedStyle(leaf, '::before'),
        h = getComputedStyle(h2Number(), '::before'),
        hb = h2Number().closest('[data-block-id]');
      check(
        Math.round(parseFloat(n.right) - blk.clientWidth) === 56 &&
          Math.round(parseFloat(h.right) - hb.clientWidth) === -4 &&
          h.paddingRight === '60px',
        '行番号はブロックの56px左（Notionの＋・⋮⋮より左）、見出しの縦棒は本文の直前',
      );
      check(
        getComputedStyle(document.getElementById('row1'), '::before').marginTop === '7px',
        '表の行番号はセルの1行目にそろえる',
      );
    }
    {
      const r = document.querySelector('#col2 [contenteditable]'),
        rb = getComputedStyle(r, '::before'),
        blk = document.getElementById('col2');
      check(
        rb.content === 'counter(nlx-line)' &&
          Math.round(parseFloat(rb.right) - blk.clientWidth) === 24 &&
          getComputedStyle(r, '::after').content === 'none',
        `段組みの2段目は番号をブロックの24px左に出す ${rb.right}`,
      );
    }
    check(
      sections[0].textContent.includes('見出し3'),
      'トグル見出しの名前を開閉ボタンではなく本文から読む',
    );
    check(
      getComputedStyle(document.getElementById('code-outer'), '::before').content === 'none' &&
        getComputedStyle(document.getElementById('code-inner'), '::before').content !== 'none',
      '入れ子の対象要素（コードブロック）は内側だけに番号',
    );
    {
      const inner = document.getElementById('code-inner');
      const after = () => getComputedStyle(inner, '::after').content;
      check(after() === '"1"', 'コードブロックの各行に番号（1行）');
      Object.assign(inner.style, {
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
        width: '200px',
        fontFamily: 'monospace',
        fontSize: '14px',
        lineHeight: '20px',
      });
      inner.textContent = `a = 1\n${'x'.repeat(60)}\n\nb = 2`;
      // Normally the next frame; a hidden tab has no frames, so the delayed update is awaited.
      const rows = () => Math.round(inner.getBoundingClientRect().height / 20);
      const expected = () => `"1\\a 2${'\\a '.repeat(rows() - 4)}\\a 3\\a 4"`;
      for (let i = 0; i < 30 && after() !== expected(); i++) await wait(100);
      check(
        rows() > 4 && after() === expected(),
        'コードの折り返した行の続きには番号を振らない（編集で更新）',
      );
      check(
        parseFloat(getComputedStyle(inner).paddingLeft) >
          parseFloat(getComputedStyle(inner).getPropertyValue('--nlx-code-pad')) &&
          getComputedStyle(inner, '::after').pointerEvents === 'none',
        'コードの番号の分だけ左に余白を取り、番号は操作の対象外',
      );
      inner.removeAttribute('style');
      inner.textContent = 'print(1)';
      await wait(100);
    }
    {
      const leaves = [
        ...document.querySelectorAll('.notion-page-content [data-block-id] > [contenteditable]'),
      ];
      check(
        leaves.length >= 4 &&
          leaves.every(
            (l) =>
              getComputedStyle(l).position === 'static' &&
              getComputedStyle(l.closest('[data-block-id]')).position === 'relative',
          ),
        '行番号はブロック基準（文字要素は配置を変えない）',
      );
    }
    {
      const bars = [...root.querySelectorAll('.splitter')],
        bodies = sections.map((s) => s.querySelector('.body'));
      check(
        bars.length === 2 && bodies.every((b) => getComputedStyle(b).overflowY === 'auto'),
        'セクション間に境界があり、各セクション内をスクロール',
      );
      const h = () => sections.map((s) => Math.round(s.getBoundingClientRect().height)),
        before = h(),
        r = bars[0].getBoundingClientRect(),
        y = r.top + r.height / 2,
        opt = { bubbles: true, pointerId: 1, button: 0, clientX: r.left + 20 };
      bars[0].dispatchEvent(new PointerEvent('pointerdown', { ...opt, clientY: y }));
      bars[0].dispatchEvent(new PointerEvent('pointermove', { ...opt, clientY: y + 60 }));
      bars[0].dispatchEvent(new PointerEvent('pointerup', { ...opt, clientY: y + 60 }));
      await wait(50);
      const after = h();
      check(
        after[0] - before[0] >= 50 &&
          before[1] - after[1] >= 50 &&
          Math.abs(after[2] - before[2]) <= 1,
        `境界のドラッグで隣の2セクションだけ高さが変わる ${before}→${after}`,
      );
      const drag = async (bar, dy) => {
        const r = bar.getBoundingClientRect(),
          y = r.top + r.height / 2,
          o = { bubbles: true, pointerId: 1, button: 0, clientX: r.left + 20 };
        bar.dispatchEvent(new PointerEvent('pointerdown', { ...o, clientY: y }));
        bar.dispatchEvent(new PointerEvent('pointermove', { ...o, clientY: y + dy }));
        bar.dispatchEvent(new PointerEvent('pointerup', { ...o, clientY: y + dy }));
        await wait(50);
      };
      sections[1].querySelector('.summary').click();
      await wait(50);
      {
        const live = [...root.querySelectorAll('.splitter')],
          b1 = h();
        check(
          live.length === 2 && live.every((b) => !b.hidden && !b.hasAttribute('data-inert')),
          '畳んだセクションの両側にも境界を残す',
        );
        await drag(live[0], -40);
        const a1 = h();
        check(
          b1[0] - a1[0] >= 30 && a1[2] - b1[2] >= 30 && a1[1] === b1[1],
          `畳んだForwardの上の境界でOutlineとBackwardの高さが変わる ${b1}→${a1}`,
        );
      }
      sections[2].querySelector('.summary').click();
      await wait(50);
      {
        const live = [...root.querySelectorAll('.splitter')],
          box = root.querySelector('.content').getBoundingClientRect(),
          last = sections[2].getBoundingClientRect();
        check(
          live.every((b) => b.hasAttribute('data-inert')) && box.bottom - last.bottom <= 14,
          'ForwardとBackwardを畳むと一番下に置き、境界は動かない',
        );
      }
      sections[1].querySelector('.summary').click();
      sections[2].querySelector('.summary').click();
      await wait(50);
    }
    {
      const pane = root.querySelector('#pane'),
        rz = root.querySelector('.resizer'),
        w0 = pane.getBoundingClientRect().width,
        r = rz.getBoundingClientRect(),
        x = r.left + r.width / 2,
        o = { bubbles: true, pointerId: 1, button: 0, clientY: r.top + 50 };
      rz.dispatchEvent(new PointerEvent('pointerdown', { ...o, clientX: x }));
      rz.dispatchEvent(new PointerEvent('pointermove', { ...o, clientX: x + 60 }));
      rz.dispatchEvent(new PointerEvent('pointerup', { ...o, clientX: x + 60 }));
      await wait(50);
      const w1 = pane.getBoundingClientRect().width;
      check(
        Math.round(w0 - w1) === 60 &&
          getComputedStyle(document.querySelector('.notion-frame'))
            .getPropertyValue('--nlx-pane-width')
            .trim() === `${Math.round(w1)}px`,
        `Pane左端のドラッグで幅が変わり本文の予約幅も追従 ${Math.round(w0)}→${Math.round(w1)}`,
      );
    }
    check(
      !root.querySelector('header') &&
        !root.querySelector('[aria-label="表示設定"]') &&
        !root.querySelector('select,input'),
      'Pane内に見出し行と設定画面を置かない',
    );
    button.click();
    check(
      root.querySelector('#pane').hidden &&
        !document.querySelector('.notion-frame').hasAttribute('data-nlx-pane'),
      '上部バーのアイコンで閉じるとPaneと本文の予約幅を解除',
    );
    check(
      getComputedStyle(document.getElementById('native-toc')).display !== 'none',
      'Paneを閉じるとNotion標準のアウトラインを戻す',
    );
    button.click();
    await wait(900);
    check(sections[2].querySelectorAll('li').length === 1, '再オープンでも自動再取得');
    {
      // List items contain an empty element with the same data-block-id (observed 2026-11-13).
      const body = document.createElement('div');
      body.innerHTML =
        '<div data-block-id="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"><a href="https://app.notion.com/p/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb">B</a>' +
        '<div data-block-id="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"></div></div>';
      const snap = NotionLinksSnapshot.create();
      snap.collect({ root: body }, 'https://app.notion.com/p/cccccccccccccccccccccccccccccccc');
      check(
        snap.forwardItems.length === 1 &&
          snap.forwardItems[0].id === 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        '同じblock idの空要素があっても箇条書きのリンクを保持',
      );
    }
    {
      const link = sections[2].querySelector('li a'),
        id = link.href.match(/[0-9a-f]{32}$/)[0],
        start = location.href;
      let popped = false;
      addEventListener('popstate', () => (popped = true), { once: true });
      // Record whether the pane's handler cancelled it, then stop the real new-tab navigation.
      let leftToBrowser = false;
      link.addEventListener(
        'click',
        (e) => {
          leftToBrowser = !e.defaultPrevented;
          e.preventDefault();
        },
        { once: true },
      );
      link.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true, metaKey: true }),
      );
      check(
        leftToBrowser && !link.target && location.href === start,
        '⌘/Ctrlクリックはブラウザの既定動作（新しいタブ）に任せる',
      );
      const plain = new MouseEvent('click', { bubbles: true, cancelable: true });
      link.dispatchEvent(plain);
      check(
        plain.defaultPrevented && popped && location.pathname === `/p/${id}`,
        '通常クリックは同じタブでページ移動（pushStateとpopstate）',
      );
      history.replaceState(history.state, '', start);
    }
    results.push(`完了: ${results.length}件成功`);
  } catch (error) {
    results.push(`FAIL ${error.message}`);
  }
  document.getElementById('results').textContent = results.join('\n');
})();
