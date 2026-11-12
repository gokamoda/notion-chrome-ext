// Fixture-only URL shim. Production files keep their strict Notion domain checks.
const realPageLink = NotionLinksCore.pageLink;
globalThis.NotionLinksCore = {
  ...NotionLinksCore,
  pageLink: (raw, base) => {
    const convert = (s) =>
      s === location.href
        ? 'https://app.notion.com/p/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
        : String(s).replace(location.origin, 'https://app.notion.com');
    return realPageLink(convert(raw), convert(base));
  },
};
// The extension must not open Notion's Backlinks list; record any click.
document.getElementById('native').onclick = () => {
  window.nativeBacklinksOpened = true;
};
