// OG / Twitter Card 이미지 생성기 (1200×630, @2x).
// 앱 브랜드 토큰(css/style.css)에 맞춘 다크 카드 — bg #0E0E0E / accent #4361EE / text #F8F9FA.
// X·카카오·슬랙 링크 프리뷰의 회색 플레이스홀더 방지용 대표 이미지.
// 재생성: node scripts/generate-og-image.mjs  → og-image.png
//
// 이 레포엔 playwright-core가 없으므로 autoIMG node_modules에서 절대경로 require로 가져온다.
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(
  "/Users/seungkoolee/ai-secretary/projects/autoIMG/node_modules/playwright-core/index.js"
);

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "../og-image.png");

const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 1200px; height: 630px; }
  body {
    position: relative; overflow: hidden;
    background: #0E0E0E; color: #F8F9FA;
    font-family: "Apple SD Gothic Neo", "Pretendard", -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans KR", sans-serif;
    -webkit-font-smoothing: antialiased;
    padding: 84px 92px;
    display: flex; flex-direction: column;
  }
  /* 우상단 accent 앰비언트 글로우 */
  .glow {
    position: absolute; top: -240px; right: -200px; width: 820px; height: 820px;
    background: radial-gradient(circle at center, rgba(67,97,238,0.16) 0%, rgba(67,97,238,0) 64%);
    pointer-events: none;
  }
  /* 우하단 미묘한 바닥 글로우 — 차량을 떠받치는 느낌 */
  .glow-floor {
    position: absolute; bottom: -160px; right: -40px; width: 720px; height: 360px;
    background: radial-gradient(ellipse at center, rgba(67,97,238,0.10) 0%, rgba(67,97,238,0) 70%);
    pointer-events: none;
  }
  .brand { display: flex; align-items: center; gap: 17px; position: relative; z-index: 2; }
  .squircle {
    width: 60px; height: 60px; border-radius: 15px;
    background: linear-gradient(135deg, #4361EE 0%, #324AD1 100%);
    box-shadow: 0 10px 24px -8px rgba(67,97,238,0.55);
    display: flex; align-items: center; justify-content: center;
  }
  .wordmark { font-size: 40px; font-weight: 800; letter-spacing: -0.02em; color: #F8F9FA; }
  .wordmark .accent { color: #6A82F2; }
  .headline {
    margin-top: auto; position: relative; z-index: 2;
    font-size: 84px; font-weight: 800; line-height: 1.1; letter-spacing: -0.03em;
  }
  .headline .accent { color: #6A82F2; }
  .sub {
    margin-top: 24px; position: relative; z-index: 2;
    font-size: 30px; font-weight: 500; line-height: 1.4; color: #A1A1AA; letter-spacing: -0.01em;
  }
  .pills { margin-top: auto; padding-top: 42px; display: flex; align-items: center; gap: 12px; position: relative; z-index: 2; }
  .pill {
    padding: 11px 22px; border-radius: 999px; font-size: 22px; font-weight: 600;
    border: 1.5px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.03);
    color: #E4E4E7; white-space: nowrap;
  }
  .pill.primary { background: #4361EE; color: #fff; border-color: #4361EE; }
  .domain {
    position: absolute; bottom: 84px; right: 92px; z-index: 2;
    font-size: 24px; font-weight: 600; color: #71717A; letter-spacing: -0.01em;
  }
  /* 우측 스타일라이즈드 Tesla 측면 실루엣 + accent 랩 */
  .car {
    position: absolute; right: -118px; top: 188px; z-index: 1;
    opacity: 0.95;
    filter: drop-shadow(0 24px 48px rgba(0,0,0,0.5));
  }
</style></head>
<body>
  <div class="glow"></div>
  <div class="glow-floor"></div>

  <!-- 우측 차량 실루엣 (인라인 SVG, 외부 에셋 없음) -->
  <svg class="car" width="640" height="300" viewBox="0 0 640 300" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="wrap" x1="80" y1="40" x2="600" y2="230" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#5A75F0"/>
        <stop offset="0.55" stop-color="#4361EE"/>
        <stop offset="1" stop-color="#2C3FBE"/>
      </linearGradient>
      <linearGradient id="glass" x1="200" y1="60" x2="430" y2="120" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#0E0E0E"/>
        <stop offset="1" stop-color="#23252E"/>
      </linearGradient>
    </defs>
    <!-- 바닥 그림자 -->
    <ellipse cx="320" cy="246" rx="262" ry="20" fill="#000" opacity="0.45"/>
    <!-- 차체 (모델3/Y 측면 실루엣) -->
    <path d="M58 192
             C58 176 74 168 96 166
             C118 130 150 110 196 104
             C236 78 300 72 350 78
             C404 84 452 102 486 132
             C530 138 566 150 582 170
             C594 184 590 198 576 200
             L548 200
             A40 40 0 0 0 468 200
             L214 200
             A40 40 0 0 0 134 200
             L78 200
             C66 200 58 198 58 192 Z"
          fill="url(#wrap)"/>
    <!-- 그린하우스/유리 -->
    <path d="M204 104
             C242 80 300 75 348 80
             C392 85 432 100 462 126
             C420 122 372 120 320 121
             C272 122 232 122 204 104 Z"
          fill="url(#glass)" opacity="0.92"/>
    <!-- 캐릭터 라인 (랩 광택 하이라이트) -->
    <path d="M120 158 C220 138 420 138 540 164" stroke="#A8B6F8" stroke-width="3" stroke-linecap="round" opacity="0.7"/>
    <path d="M150 178 C260 168 430 168 552 184" stroke="#1B2552" stroke-width="3" stroke-linecap="round" opacity="0.55"/>
    <!-- 휠 -->
    <circle cx="174" cy="200" r="42" fill="#0B0B0B"/>
    <circle cx="174" cy="200" r="42" fill="none" stroke="#4361EE" stroke-width="3" opacity="0.6"/>
    <circle cx="174" cy="200" r="19" fill="#1A1A1A" stroke="#3A3A3A" stroke-width="2"/>
    <circle cx="508" cy="200" r="42" fill="#0B0B0B"/>
    <circle cx="508" cy="200" r="42" fill="none" stroke="#4361EE" stroke-width="3" opacity="0.6"/>
    <circle cx="508" cy="200" r="19" fill="#1A1A1A" stroke="#3A3A3A" stroke-width="2"/>
  </svg>

  <div class="brand">
    <div class="squircle">
      <!-- 차량 + 랩(붓) 느낌 아이콘 -->
      <svg viewBox="0 0 32 32" width="34" height="34" fill="none">
        <path d="M5 19 C5 17.3 6 16.6 7.4 16.4 C9 13.6 11.4 12.2 15 12 C18 11 22.5 11.3 25.4 13.4 C27.4 13.7 28.7 14.6 29 16 C29.2 17 28.6 17.6 27.6 17.6 L25.4 17.6 A3.1 3.1 0 0 0 19.2 17.6 L12.8 17.6 A3.1 3.1 0 0 0 6.6 17.6 L6 17.6 C5.4 17.6 5 17.4 5 17 Z"
              fill="#fff"/>
        <circle cx="9.8" cy="17.6" r="2.7" fill="#fff"/>
        <circle cx="22.3" cy="17.6" r="2.7" fill="#fff"/>
        <path d="M3 23.5 C8 21.8 16 21.8 21 23.5" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity="0.85"/>
      </svg>
    </div>
    <div class="wordmark">Tesla <span class="accent">Custom Wraps</span></div>
  </div>

  <div class="headline">나만의 Tesla<br><span class="accent">랩 디자인</span></div>
  <div class="sub">사진 한 장으로 커스텀 랩을 입히고 · USB로 Paint Shop에 바로 적용</div>

  <div class="pills">
    <div class="pill primary">무료</div>
    <div class="pill">브라우저 로컬 처리</div>
    <div class="pill">Tesla Paint Shop 호환</div>
  </div>

  <div class="domain">mighty0109.github.io</div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1200, height: 630 },
  deviceScaleFactor: 2,
});
await page.setContent(html, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: OUT });
await browser.close();
console.log("✓ OG image →", OUT);
