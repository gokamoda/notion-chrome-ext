// Stub for the Notion API (the fixture is not on a Notion origin). Parsing is tested in page-data.test.cjs.
globalThis.NotionLinksPageData = {
  ...NotionLinksPageData,
  loadBacklinks: async () => ({
    items: [
      {
        id: 'c'.repeat(32),
        href: `https://app.notion.com/p/${'c'.repeat(32)}`,
        title: '<img src=x onerror=alert(1)>',
      },
    ],
    inaccessible: 0,
    unresolved: 0,
    partial: false,
    capped: false,
    time: '',
  }),
};
