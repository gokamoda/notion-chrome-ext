/* Settings popup. Writes to chrome.storage.local; content.js applies changes via storage.onChanged. */
(() => {
  'use strict';
  const prefs = globalThis.NotionLinksSettings;
  const form = document.getElementById('form'), status = document.getElementById('status');
  let settings = {...prefs.defaults}, queue = Promise.resolve();
  function fill() {
    for (const input of form.elements) {
      if (!(input.name in settings)) continue;
      if (input.type === 'checkbox') input.checked = settings[input.name];
      else input.value = settings[input.name];
    }
  }
  function valueOf(input) {
    return input.type === 'checkbox' ? input.checked : input.type === 'number' ? Number(input.value) : input.value;
  }
  form.addEventListener('change', event => {
    const input = event.target;
    if (!(input.name in settings)) return;
    settings = prefs.sanitize({...settings, [input.name]: valueOf(input)});
    fill(); // Show the clamped / rejected value.
    const snapshot = {...settings};
    queue = queue.catch(() => {}).then(() => prefs.write(snapshot));
    queue.then(() => { status.textContent = '保存しました'; }, error => { status.textContent = `保存できません：${error.message}`; });
  });
  prefs.read().then(value => { settings = value; fill(); }, () => { fill(); status.textContent = '保存設定を読めません。初期設定を表示しています。'; });
})();
