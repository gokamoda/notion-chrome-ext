const { test } = require('node:test');
const assert = require('node:assert/strict');
require('../extension/wide-blocks.js');
const { shrink, declarations } = NotionLinksWideBlocks;
test('ペインを開いている間の幅広ブロック：側方の余白だけを縮める', () => {
  // Side spaces (observed 271-287px) move by half the pane width; cell paddings stay.
  assert.equal(shrink('279px', 160, 233), '119px');
  assert.equal(shrink('-279px', 160, 233), '-119px');
  assert.equal(shrink('279.5px 8px', 160, 233), '119.5px 8px');
  assert.equal(shrink('8px', 160, 233), '8px');
  assert.equal(shrink('100px', 160, 40), '0px');
});
test('インラインstyleを宣言に分ける', () => {
  assert.deepEqual(declarations('width: 1266px; padding-inline: 279px;'), [
    ['width', '1266px'],
    ['padding-inline', '279px'],
  ]);
});
