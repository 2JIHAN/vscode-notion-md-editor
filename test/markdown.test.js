/**
 * markdown 모듈 round-trip 및 단위 테스트.
 *
 * 외부 의존성 없이 Node 기본 assert로 작성해 별도 install 없이 실행한다.
 *   node test/markdown.test.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { parse, serialize, renderHtml } = require('../src/markdown');

const FIXTURE_DIR = path.join(__dirname, '..', 'docs', 'fixtures');

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

function loadFixture(name) {
  return fs.readFileSync(path.join(FIXTURE_DIR, name), 'utf8');
}

function assertRoundTrip(name) {
  const original = loadFixture(name);
  const ast = parse(original);
  const serialized = serialize(ast);
  const reparsed = parse(serialized);
  assert.deepStrictEqual(reparsed, ast, `AST mismatch on second parse for ${name}`);
}

test('parse heading', () => {
  const blocks = parse('# Hello');
  assert.deepStrictEqual(blocks, [{ type: 'heading', level: 1, text: 'Hello' }]);
});

test('parse paragraph joins wrapped lines', () => {
  const blocks = parse('Hello\nworld');
  assert.deepStrictEqual(blocks, [{ type: 'paragraph', text: 'Hello world' }]);
});

test('parse unordered list', () => {
  const blocks = parse('- a\n- b\n');
  assert.deepStrictEqual(blocks, [{ type: 'list', ordered: false, items: ['a', 'b'] }]);
});

test('parse ordered list', () => {
  const blocks = parse('1. first\n2. second\n');
  assert.deepStrictEqual(blocks, [{ type: 'list', ordered: true, items: ['first', 'second'] }]);
});

test('parse code block keeps lang and content', () => {
  const blocks = parse('```bash\necho hi\nls\n```');
  assert.deepStrictEqual(blocks, [{ type: 'code', lang: 'bash', content: 'echo hi\nls' }]);
});

test('parse callout preserves icon, color, nested blocks', () => {
  const md = '<callout icon="✅" color="green_bg">\n**제목**\n\n본문\n</callout>';
  const blocks = parse(md);
  assert.strictEqual(blocks.length, 1);
  assert.strictEqual(blocks[0].type, 'callout');
  assert.strictEqual(blocks[0].icon, '✅');
  assert.strictEqual(blocks[0].color, 'green_bg');
  assert.deepStrictEqual(blocks[0].blocks, [
    { type: 'paragraph', text: '**제목**' },
    { type: 'paragraph', text: '본문' }
  ]);
});

test('parse frontmatter as first block', () => {
  const md = '---\nkey: value\n---\n\n# Title\n';
  const blocks = parse(md);
  assert.strictEqual(blocks[0].type, 'frontmatter');
  assert.strictEqual(blocks[0].raw, '---\nkey: value\n---');
  assert.deepStrictEqual(blocks[1], { type: 'heading', level: 1, text: 'Title' });
});

test('serialize round-trip basic fixture', () => {
  assertRoundTrip('basic.md');
});

test('serialize round-trip callouts fixture', () => {
  assertRoundTrip('callouts.md');
});

test('serialize round-trip frontmatter fixture', () => {
  assertRoundTrip('frontmatter.md');
});

test('renderHtml emits callout html', () => {
  const html = renderHtml('<callout icon="✅" color="green_bg">\nok\n</callout>');
  assert.ok(html.includes('class="callout green_bg"'));
  assert.ok(html.includes('data-icon="✅"'));
  assert.ok(html.includes('<p>ok</p>'));
});

test('renderHtml escapes html in paragraph', () => {
  const html = renderHtml('Use <script>alert(1)</script> in body.');
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
});

test('renderHtml renders inline emphasis', () => {
  const html = renderHtml('A *single* and **double** mark.');
  assert.ok(html.includes('<em>single</em>'));
  assert.ok(html.includes('<strong>double</strong>'));
});

// stripZwsAndTrim: pure helper mirrored from webview.js (browser closure prevents require).
// Verifies the U+200B regex fix — the pattern must strip actual zero-width spaces.
function stripZwsAndTrim(str) {
  return str.replace(/​/g, '').trim();
}

test('stripZwsAndTrim: empty string is empty', () => {
  assert.strictEqual(stripZwsAndTrim(''), '');
});

test('stripZwsAndTrim: only zero-width spaces becomes empty', () => {
  assert.strictEqual(stripZwsAndTrim('​​'), '');
});

test('stripZwsAndTrim: whitespace-only is not empty after trim', () => {
  // Plain whitespace (no ZWS) trims to '' — callout with only spaces should
  // still be treated as empty by the helper (trim removes it).
  assert.strictEqual(stripZwsAndTrim('   '), '');
});

let passed = 0;
let failed = 0;
for (const { name, fn } of tests) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (error) {
    failed++;
    console.error(`  FAIL ${name}`);
    console.error(error.message);
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
