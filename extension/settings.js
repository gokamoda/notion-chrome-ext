(() => {
  'use strict';
  const defaults = Object.freeze({
    theme: 'auto',
    accent: '#197d34',
    numberColor: '#777777',
    paneWidth: 320,
    outline: true,
    forward: true,
    backward: true,
    lineNumbers: true,
    headingMarkers: true,
    codeLineNumbers: true,
    sizes: Object.freeze([1, 1, 1]),
  });

  function sanitize(value) {
    const result = { ...defaults };
    if (!value || typeof value !== 'object') return result;
    for (const key of [
      'outline',
      'forward',
      'backward',
      'lineNumbers',
      'headingMarkers',
      'codeLineNumbers',
    ]) {
      if (typeof value[key] === 'boolean') result[key] = value[key];
    }
    if (['auto', 'light', 'dark'].includes(value.theme)) result.theme = value.theme;
    for (const key of ['accent', 'numberColor'])
      if (/^#[0-9a-f]{6}$/i.test(value[key])) result[key] = value[key];
    // Relative heights of Outline / Forward / Backward in the pane.
    if (
      Array.isArray(value.sizes) &&
      value.sizes.length === 3 &&
      value.sizes.every((n) => Number.isFinite(n) && n > 0)
    ) {
      const sum = value.sizes.reduce((a, b) => a + b, 0);
      result.sizes = value.sizes.map((n) => Math.min(0.9, Math.max(0.05, n / sum)) * 3);
    }
    if (Number.isFinite(value.paneWidth))
      result.paneWidth = Math.round(Math.min(720, Math.max(240, value.paneWidth)));
    return result;
  }

  const KEY = 'notionLinksPreferencesV2';

  async function read() {
    if (!globalThis.chrome?.storage?.local) return { ...defaults };
    return sanitize((await chrome.storage.local.get(KEY))[KEY]);
  }

  async function write(value) {
    if (!globalThis.chrome?.storage?.local)
      throw Error('設定保存はChrome拡張として読み込んだ場合に利用できます。');
    await chrome.storage.local.set({ [KEY]: sanitize(value) });
  }

  globalThis.NotionLinksSettings = Object.freeze({ defaults, sanitize, read, write, KEY });
})();
