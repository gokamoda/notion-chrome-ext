const { test } = require('node:test');
const assert = require('node:assert/strict');
require('../extension/settings.js');
const { sanitize, defaults } = NotionLinksSettings;
test('設定の不正値とCSS注入を拒否し初期値へ戻す', () => {
  assert.deepEqual(sanitize(null), { ...defaults });
  const value = sanitize({
    theme: 'bad',
    accent: 'red;display:none',
    numberColor: '#123456',
    lineNumbers: 'true',
    backward: false,
    paneWidth: 900,
  });
  assert.equal(value.theme, 'auto');
  assert.equal(value.accent, defaults.accent);
  assert.equal(value.numberColor, '#123456');
  assert.equal(value.lineNumbers, true);
  assert.equal(value.backward, false);
  assert.equal(value.paneWidth, 720);
});
test('Pane幅を許可範囲へ制限し未知のキーを保存しない', () => {
  assert.equal(sanitize({ paneWidth: 10 }).paneWidth, 240);
  assert.equal(sanitize({ paneWidth: Infinity }).paneWidth, 320);
  assert.equal(sanitize({ token: 'do not store' }).token, undefined);
});
test('セクションの高さ配分を3つの正の数として保存', () => {
  assert.deepEqual(sanitize({}).sizes, [1, 1, 1]);
  const sizes = sanitize({ sizes: [2, 1, 1] }).sizes;
  assert.ok(Math.abs(sizes[0] - 1.5) < 1e-9 && Math.abs(sizes[0] + sizes[1] + sizes[2] - 3) < 1e-9);
  assert.deepEqual(sanitize({ sizes: [1, -1, 1] }).sizes, [1, 1, 1]);
  assert.deepEqual(sanitize({ sizes: '1,1,1' }).sizes, [1, 1, 1]);
});
