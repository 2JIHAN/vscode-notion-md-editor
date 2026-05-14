/**
 * Notion 스타일 callout 정의.
 *
 * extension host와 webview script 양쪽에서 동일한 값을 사용하기 위해
 * 별도 모듈로 분리한다. webview 쪽에서는 JSON으로 직렬화해 전달한다.
 */

const CALLOUTS = {
  success: { icon: '✅', color: 'green_bg', title: '성공 기준' },
  warning: { icon: '⚠️', color: 'yellow_bg', title: '주의' },
  info: { icon: '💡', color: 'blue_bg', title: '정보' }
};

const QUICK_PICK_ITEMS = [
  { label: '✅ Success', kind: 'success' },
  { label: '⚠️ Warning', kind: 'warning' },
  { label: '💡 Info', kind: 'info' }
];

module.exports = { CALLOUTS, QUICK_PICK_ITEMS };
