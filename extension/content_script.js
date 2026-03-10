/**
 * NSP-Extractor Content Script v2.2
 *
 * 역할:
 *  - background.js의 debugDom 요청에 응답 (페이지 DOM 스냅샷 반환)
 *  - 판매량 수집은 background.js에서 webNavigation.getAllFrames +
 *    scripting.executeScript(frameId)로 itemscout iframe 내부 직접 접근
 */

'use strict';

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'debugDom') {
    sendResponse({ dom: getDomSnapshot() });
    return true;
  }
});

function getDomSnapshot() {
  const snap = {};
  const selectors = [
    '#its-product-analysis',
    '#product-analysis-container',
    '[id*="product-analysis"]',
    '[id*="itemscout"]',
    '[id*="its-"]',
  ];
  snap.elements = {};
  for (const sel of selectors) {
    const els = document.querySelectorAll(sel);
    if (els.length) {
      snap.elements[sel] = Array.from(els).map(el => ({
        tag: el.tagName,
        id: el.id,
        innerTextSlice: (el.innerText || '').slice(0, 200),
        src: el.src || undefined,
      }));
    }
  }
  snap.bodyHasBuy = document.body.innerText.includes('구매');
  return snap;
}
