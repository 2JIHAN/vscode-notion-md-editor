/**
 * Notion Enhanced Markdown 파서, 렌더러, 시리얼라이저.
 *
 * 순수 함수 모듈이므로 VS Code API에 의존하지 않고 단독 테스트가 가능하다.
 *
 * 주요 API
 *   parse(markdown)        markdown 텍스트를 블록 AST 배열로 변환
 *   serialize(blocks)      블록 AST를 markdown 텍스트로 변환
 *   renderHtml(markdown)   markdown 텍스트를 미리보기/WYSIWYG용 HTML body 문자열로 변환
 *
 * 블록 AST 타입
 *   { type: 'frontmatter', raw }
 *   { type: 'heading', level, text }
 *   { type: 'paragraph', text }
 *   { type: 'list', ordered, items: string[] }
 *   { type: 'quote', text }
 *   { type: 'code', lang, content }
 *   { type: 'callout', icon, color, blocks: Block[] }
 *   { type: 'divider' }
 *   { type: 'html', raw }
 */

function parse(markdown) {
  const text = normalize(markdown);
  const lines = text.split('\n');
  const blocks = [];
  let i = 0;

  const frontmatter = tryParseFrontmatter(lines, i);
  if (frontmatter) {
    blocks.push({ type: 'frontmatter', raw: frontmatter.raw });
    i = frontmatter.nextIndex;
  }

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i++;
      continue;
    }

    const calloutOpen = matchCalloutOpen(line);
    if (calloutOpen) {
      const collected = collectCallout(lines, i, calloutOpen);
      blocks.push({
        type: 'callout',
        icon: calloutOpen.icon,
        color: calloutOpen.color,
        blocks: parse(collected.body)
      });
      i = collected.nextIndex;
      continue;
    }

    const fence = matchCodeFence(line);
    if (fence) {
      const code = collectCodeBlock(lines, i, fence);
      blocks.push({ type: 'code', lang: code.lang, content: code.content });
      i = code.nextIndex;
      continue;
    }

    const heading = matchHeading(line);
    if (heading) {
      blocks.push({ type: 'heading', level: heading.level, text: heading.text });
      i++;
      continue;
    }

    if (matchOrderedItem(line) || matchUnorderedItem(line)) {
      const list = collectList(lines, i);
      blocks.push({ type: 'list', ordered: list.ordered, items: list.items });
      i = list.nextIndex;
      continue;
    }

    const quote = matchQuote(line);
    if (quote !== null) {
      const block = collectQuote(lines, i);
      blocks.push({ type: 'quote', text: block.text });
      i = block.nextIndex;
      continue;
    }

    if (matchDivider(line)) {
      blocks.push({ type: 'divider' });
      i++;
      continue;
    }

    if (isStandaloneHtmlBlock(line)) {
      blocks.push({ type: 'html', raw: line });
      i++;
      continue;
    }

    const paragraph = collectParagraph(lines, i);
    blocks.push({ type: 'paragraph', text: paragraph.text });
    i = paragraph.nextIndex;
  }

  return blocks;
}

function serialize(blocks) {
  const parts = blocks.map((block) => serializeBlock(block));
  return parts.filter((part) => part !== '').join('\n\n') + '\n';
}

function serializeBlock(block) {
  switch (block.type) {
    case 'frontmatter':
      return block.raw.trimEnd();
    case 'heading':
      return '#'.repeat(block.level) + ' ' + block.text.trim();
    case 'paragraph':
      return block.text.trim();
    case 'list':
      return block.items
        .map((item, index) => (block.ordered ? `${index + 1}. ${item.trim()}` : `- ${item.trim()}`))
        .join('\n');
    case 'quote':
      return block.text
        .split('\n')
        .map((line) => (line ? `> ${line}` : '>'))
        .join('\n');
    case 'code':
      return '```' + (block.lang || '') + '\n' + block.content + '\n```';
    case 'callout': {
      const inner = serialize(block.blocks).trimEnd();
      return `<callout icon="${block.icon}" color="${block.color}">\n${inner}\n</callout>`;
    }
    case 'divider':
      return '---';
    case 'html':
      return block.raw.trim();
    default:
      return '';
  }
}

function renderHtml(markdown) {
  return renderBlocks(parse(markdown));
}

function renderBlocks(blocks) {
  return blocks.map(renderBlock).filter(Boolean).join('\n');
}

function renderBlock(block) {
  switch (block.type) {
    case 'frontmatter':
      return '';
    case 'heading': {
      const level = Math.min(Math.max(block.level, 1), 6);
      return `<h${level}>${renderInline(block.text)}</h${level}>`;
    }
    case 'paragraph':
      return `<p>${renderInline(block.text)}</p>`;
    case 'list': {
      const tag = block.ordered ? 'ol' : 'ul';
      const items = block.items.map((item) => `<li>${renderInline(item)}</li>`).join('');
      return `<${tag}>${items}</${tag}>`;
    }
    case 'quote':
      return `<blockquote>${renderInline(block.text)}</blockquote>`;
    case 'code':
      return `<pre><code>${escapeHtml(block.content)}</code></pre>`;
    case 'callout': {
      const icon = escapeHtml(block.icon || '💡');
      const color = sanitizeColor(block.color);
      const inner = renderBlocks(block.blocks);
      return `<div class="callout ${color}" data-icon="${icon}" data-color="${color}"><div class="callout-icon">${icon}</div><div class="callout-content">${inner}</div></div>`;
    }
    case 'divider':
      return '<hr>';
    case 'html':
      return block.raw;
    default:
      return '';
  }
}

function renderInline(text) {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

function normalize(text) {
  return String(text).replace(/\r\n/g, '\n');
}

function tryParseFrontmatter(lines, start) {
  if (start !== 0 || lines[0] !== '---') {
    return null;
  }
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') {
      const raw = lines.slice(0, i + 1).join('\n');
      return { raw, nextIndex: i + 1 };
    }
  }
  return null;
}

function matchCalloutOpen(line) {
  const match = /^<callout\b([^>]*)>\s*$/.exec(line);
  if (!match) {
    return null;
  }
  return {
    icon: getAttribute(match[1], 'icon') || '💡',
    color: getAttribute(match[1], 'color') || 'gray_bg'
  };
}

function collectCallout(lines, start, _openInfo) {
  const bodyLines = [];
  let depth = 1;
  let i = start + 1;
  while (i < lines.length) {
    const line = lines[i];
    if (/^<callout\b[^>]*>\s*$/.test(line)) {
      depth++;
      bodyLines.push(line);
    } else if (line.trim() === '</callout>') {
      depth--;
      if (depth === 0) {
        return { body: bodyLines.join('\n'), nextIndex: i + 1 };
      }
      bodyLines.push(line);
    } else {
      bodyLines.push(line);
    }
    i++;
  }
  // 닫는 태그가 없는 경우에도 본문은 보존한다.
  return { body: bodyLines.join('\n'), nextIndex: i };
}

function matchCodeFence(line) {
  const match = /^```\s*([\w.-]*)\s*$/.exec(line);
  if (!match) {
    return null;
  }
  return { lang: match[1] || '' };
}

function collectCodeBlock(lines, start, fence) {
  const content = [];
  let i = start + 1;
  while (i < lines.length) {
    if (/^```\s*$/.test(lines[i])) {
      return { lang: fence.lang, content: content.join('\n'), nextIndex: i + 1 };
    }
    content.push(lines[i]);
    i++;
  }
  return { lang: fence.lang, content: content.join('\n'), nextIndex: i };
}

function matchHeading(line) {
  const match = /^(#{1,6})\s+(.*)$/.exec(line);
  if (!match) {
    return null;
  }
  return { level: match[1].length, text: match[2] };
}

function matchUnorderedItem(line) {
  const match = /^[-*]\s+(.*)$/.exec(line);
  return match ? match[1] : null;
}

function matchOrderedItem(line) {
  const match = /^\d+\.\s+(.*)$/.exec(line);
  return match ? match[1] : null;
}

function collectList(lines, start) {
  const items = [];
  let ordered = null;
  let i = start;
  while (i < lines.length) {
    const line = lines[i];
    const unordered = matchUnorderedItem(line);
    const orderedItem = matchOrderedItem(line);
    if (unordered !== null) {
      if (ordered === true) {
        break;
      }
      ordered = false;
      items.push(unordered);
      i++;
      continue;
    }
    if (orderedItem !== null) {
      if (ordered === false) {
        break;
      }
      ordered = true;
      items.push(orderedItem);
      i++;
      continue;
    }
    break;
  }
  return { ordered: ordered === true, items, nextIndex: i };
}

function matchQuote(line) {
  const match = /^>\s?(.*)$/.exec(line);
  return match ? match[1] : null;
}

function collectQuote(lines, start) {
  const collected = [];
  let i = start;
  while (i < lines.length && matchQuote(lines[i]) !== null) {
    collected.push(matchQuote(lines[i]));
    i++;
  }
  return { text: collected.join('\n'), nextIndex: i };
}

function collectParagraph(lines, start) {
  const collected = [];
  let i = start;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) break;
    if (matchHeading(line)) break;
    if (matchCodeFence(line)) break;
    if (matchCalloutOpen(line)) break;
    if (line.trim() === '</callout>') break;
    if (matchUnorderedItem(line) !== null) break;
    if (matchOrderedItem(line) !== null) break;
    if (matchQuote(line) !== null) break;
    if (matchDivider(line)) break;
    if (isStandaloneHtmlBlock(line)) break;
    collected.push(line.trim());
    i++;
  }
  return { text: collected.join(' '), nextIndex: i };
}

function matchDivider(line) {
  return /^(-{3,}|\*{3,}|_{3,})\s*$/.test(line);
}

function isStandaloneHtmlBlock(line) {
  return /^<(?!callout\b|\/callout\b)[a-zA-Z][^>]*>.*<\/[a-zA-Z][^>]*>\s*$/.test(line);
}

function getAttribute(attributes, name) {
  const match = new RegExp(`${name}="([^"]*)"`).exec(attributes);
  return match ? match[1] : '';
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeColor(value) {
  return String(value || 'gray_bg').replace(/[^a-zA-Z0-9_-]/g, '');
}

module.exports = {
  parse,
  serialize,
  renderHtml,
  renderBlocks,
  escapeHtml,
  sanitizeColor
};
