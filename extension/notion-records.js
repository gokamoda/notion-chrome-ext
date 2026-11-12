// Shared normalization and record/title decoding for Notion responses.
(() => {
  'use strict';
  const normalize = (id) => (typeof id === 'string' ? id.replaceAll('-', '').toLowerCase() : '');
  const uuid = (id) => normalize(id).replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');

  function recordsFrom(map) {
    const records = new Map();
    for (const entry of Object.values(map || {})) {
      const first = entry?.value,
        record = first?.value?.id ? first.value : first;
      if (record && typeof record.id === 'string' && typeof record.type === 'string')
        records.set(normalize(record.id), record);
    }
    return records;
  }

  const plainTitle = (records, record) =>
    (Array.isArray(record?.properties?.title) ? record.properties.title : [])
      .map((token) => {
        if (!Array.isArray(token)) return '';
        const a = Array.isArray(token[1]) ? token[1] : [];
        const eq = a.find((x) => Array.isArray(x) && x[0] === 'e');
        if (eq) return eq[1];
        const page = a.find((x) => Array.isArray(x) && x[0] === 'p');
        if (page) return plainTitle(new Map(), records.get(normalize(page[1]))) || '';
        return typeof token[0] === 'string' ? token[0] : '';
      })
      .join('');
  globalThis.NotionLinksRecords = Object.freeze({ normalize, uuid, recordsFrom, plainTitle });
})();
