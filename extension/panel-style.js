globalThis.NotionLinksPanelStyle = `
:host {
  all: initial;
  /* Stacking (observed 2026-11-15): Notion sets isolation: isolate on every element, so a
   * z-index only competes with siblings. Its popups (Share, ••• menus) open in
   * .notion-overlay-container (fixed, z-index 999), a child of .notion-app-inner; the host is
   * placed in .notion-app-inner too (toolbar.js), and this z-index puts it above Notion's page,
   * side peek, sidebar and chat and below the popups. The host itself takes no space. */
  position: absolute;
  top: 0;
  left: 0;
  width: 0;
  height: 0;
  z-index: 998;
  font:
    13px/1.55 system-ui,
    sans-serif;
  color: #30302d;
  color-scheme: light;
  --bg: #fff;
  --hover: #f3f3f0;
  --line: #e8e8e4;
  --muted: #77776f;
  --accent: #197d34;
}
:host([data-dark]) {
  color: #e4e4df;
  color-scheme: dark;
  --bg: #20201f;
  --hover: #2b2b28;
  --line: #3b3b36;
  --muted: #aaa99f;
}
* {
  box-sizing: border-box;
}
[hidden] {
  display: none !important;
}
button,
input,
select {
  font: inherit;
  color: inherit;
}
button {
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: 5px;
  padding: 5px 8px;
}
button:hover {
  background: var(--hover);
}
button:disabled {
  opacity: 0.5;
  cursor: default;
}
button:focus-visible,
a:focus-visible,
input:focus-visible,
select:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
#pane {
  position: fixed;
  right: var(--pane-right, 0px);
  top: var(--pane-top, 52px);
  bottom: 0;
  width: min(var(--pane-width, 320px), 100vw);
  z-index: 998;
  background: var(--bg);
  border-left: 1px solid var(--line);
  display: flex;
  flex-direction: column;
  box-shadow: -5px 0 20px #00000009;
}
.content {
  padding: 10px 18px 12px;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
#page-error {
  color: var(--muted);
  font-size: 12px;
  margin: 0 0 8px;
  overflow-wrap: anywhere;
}
.section {
  flex: var(--w, 1) 1 0;
  min-height: 64px;
  display: flex;
  flex-direction: column;
}
.section[data-collapsed] {
  flex: none;
  min-height: 0;
}
.section[data-collapsed] > .body {
  display: none;
}
.summary {
  flex: none;
  width: 100%;
  text-align: start;
  padding: 8px 0;
  border-radius: 0;
  font-size: 11px;
  font-weight: 650;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  display: flex;
  gap: 6px;
  align-items: center;
}
.summary:hover {
  background: transparent;
  color: var(--accent);
}
.summary::before {
  content: '▾';
  color: var(--muted);
}
.section[data-collapsed] > .summary::before {
  content: '▸';
}
.summary small {
  margin-left: auto;
  color: var(--muted);
  font-weight: 400;
  letter-spacing: 0;
}
.body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
}
.status {
  color: var(--muted);
  font-size: 11px;
  line-height: 1.6;
  margin: 2px 0 6px;
}
.status:empty {
  display: none;
}
.splitter {
  flex: none;
  height: 9px;
  margin: 2px 0;
  cursor: row-resize;
  position: relative;
  touch-action: none;
}
.splitter::before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 4px;
  height: 1px;
  background: var(--line);
}
.splitter:hover::before,
.splitter[data-dragging]::before,
.splitter:focus-visible::before {
  height: 3px;
  top: 3px;
  background: var(--accent);
}
.splitter:focus-visible {
  outline: none;
}
.splitter[data-inert] {
  cursor: default;
}
.splitter[data-inert]:hover::before {
  height: 1px;
  top: 4px;
  background: var(--line);
}
.resizer {
  position: absolute;
  left: -4px;
  top: 0;
  bottom: 0;
  width: 8px;
  cursor: col-resize;
  z-index: 1;
  touch-action: none;
}
.resizer::before {
  content: '';
  position: absolute;
  left: 3px;
  top: 0;
  bottom: 0;
  width: 2px;
  background: transparent;
}
.resizer:hover::before,
.resizer[data-dragging]::before,
.resizer:focus-visible::before {
  background: var(--accent);
}
.resizer:focus-visible {
  outline: none;
}
ul {
  padding: 0;
  margin: 0 0 6px;
  list-style: none;
}
li {
  margin: 2px 0;
}
li a {
  display: block;
  padding: 5px 6px;
  border-radius: 5px;
  color: inherit;
  text-decoration: none;
  overflow-wrap: anywhere;
}
li a:hover {
  background: var(--hover);
  color: var(--accent);
}
li a[data-active] {
  color: var(--accent);
  background: var(--hover);
}
.outline-link {
  border-left: 2px solid transparent;
}
.outline-link[data-active] {
  border-left-color: var(--accent);
}
#fallback {
  position: fixed;
  right: 12px;
  top: 8px;
  z-index: 998;
  background: var(--bg);
  border: 1px solid var(--line);
}
#jump-top {
  position: fixed;
  right: calc(28px + var(--jump-offset, 0px));
  bottom: 76px;
  z-index: 997;
  width: 32px;
  height: 32px;
  padding: 0;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--bg);
  color: var(--muted);
  border: 1px solid var(--line);
  box-shadow: 0 4px 12px -2px #00000026;
}
#jump-top.low {
  bottom: 28px;
}
#jump-top:hover {
  background: var(--hover);
  color: inherit;
}
@media print {
  #pane,
  #jump-top,
  #fallback {
    display: none !important;
  }
}
`;
