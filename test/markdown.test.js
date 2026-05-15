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

test('parse divider produces divider block', () => {
  const blocks = parse('---\n');
  assert.deepStrictEqual(blocks, [{ type: 'divider' }]);
});

test('parse divider with surrounding blocks', () => {
  const blocks = parse('# Title\n\n---\n\nSome text\n');
  assert.strictEqual(blocks.length, 3);
  assert.strictEqual(blocks[0].type, 'heading');
  assert.strictEqual(blocks[1].type, 'divider');
  assert.strictEqual(blocks[2].type, 'paragraph');
});

test('serialize divider produces ---', () => {
  const md = serialize([{ type: 'divider' }]);
  assert.strictEqual(md, '---\n');
});

test('divider round-trip: parse → serialize → parse', () => {
  const original = '# Intro\n\n---\n\nBody text\n';
  const ast = parse(original);
  const serialized = serialize(ast);
  const reparsed = parse(serialized);
  assert.deepStrictEqual(reparsed, ast);
});

test('renderHtml divider emits hr', () => {
  const html = renderHtml('---\n');
  assert.ok(html.includes('<hr>'));
});

test('parse does not treat frontmatter --- as divider', () => {
  const md = '---\nkey: value\n---\n\n# Title\n';
  const blocks = parse(md);
  assert.strictEqual(blocks[0].type, 'frontmatter');
  assert.strictEqual(blocks[1].type, 'heading');
  assert.strictEqual(blocks.length, 2);
});

test('paragraph immediately followed by --- (no blank line) parses as [paragraph, divider]', () => {
  // setext 헤딩 미지원: paragraph 뒤 --- 는 항상 divider 로 처리한다.
  const blocks = parse('Some text\n---\n');
  assert.strictEqual(blocks.length, 2);
  assert.deepStrictEqual(blocks[0], { type: 'paragraph', text: 'Some text' });
  assert.deepStrictEqual(blocks[1], { type: 'divider' });
});

test('list immediately followed by --- closes list and leaves divider standalone', () => {
  const blocks = parse('- a\n- b\n---\n');
  assert.strictEqual(blocks.length, 2);
  assert.deepStrictEqual(blocks[0], { type: 'list', ordered: false, items: ['a', 'b'] });
  assert.deepStrictEqual(blocks[1], { type: 'divider' });
});

test('--- after heading parses as [heading, divider, paragraph]', () => {
  const blocks = parse('# Title\n---\nbody\n');
  assert.strictEqual(blocks.length, 3);
  assert.deepStrictEqual(blocks[0], { type: 'heading', level: 1, text: 'Title' });
  assert.deepStrictEqual(blocks[1], { type: 'divider' });
  assert.deepStrictEqual(blocks[2], { type: 'paragraph', text: 'body' });
});

test('*** and ___ parse as divider and serialize back to ---', () => {
  const asterisk = parse('***\n');
  assert.deepStrictEqual(asterisk, [{ type: 'divider' }]);
  assert.strictEqual(serialize(asterisk), '---\n');

  const underscore = parse('___\n');
  assert.deepStrictEqual(underscore, [{ type: 'divider' }]);
  assert.strictEqual(serialize(underscore), '---\n');
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
