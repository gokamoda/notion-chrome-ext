const { test } = require('node:test');
const assert = require('node:assert/strict');
require('../extension/code-numbers.js');
const { gutterContent } = NotionLinksCodeNumbers;
test('コード行番号：折り返した行の続きには空行を入れる', () => {
  assert.equal(gutterContent([1]), '1');
  assert.equal(gutterContent([1, 1, 1]), '1\\A 2\\A 3');
  // Line 2 wraps into 3 rows: two empty rows follow its number.
  assert.equal(gutterContent([1, 3, 1]), '1\\A 2\\A \\A \\A 3');
  // "\A" is always followed by a space so that the next digit is not read as part of the escape.
  assert.ok(!/\\A[0-9a-f]/i.test(gutterContent([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1])));
});
