/**
 * build_min.js
 * extension/ → extension-min/ 난독화 빌드 스크립트
 *
 * 처리 내용:
 *  - JS  : javascript-obfuscator (난독화 + 코드 압축)
 *  - HTML: html-minifier-terser  (공백/주석 제거)
 *  - CSS : clean-css             (공백/주석 제거)
 *  - JSON: JSON.parse+stringify  (공백 제거)
 *  - 그 외(png 등): 파일 그대로 복사
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const JavaScriptObfuscator = require('javascript-obfuscator');
const { minify: minifyHtml } = require('html-minifier-terser');
const CleanCSS = require('clean-css');

const SRC  = path.resolve(__dirname, 'extension');
const DEST = path.resolve(__dirname, 'extension-min');

// ─── 출력 폴더 초기화 ────────────────────────────────────────────────────────
function rimraf(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) rimraf(full);
    else fs.unlinkSync(full);
  }
  fs.rmdirSync(dir);
}

rimraf(DEST);
fs.mkdirSync(DEST, { recursive: true });

// ─── 재귀 빌드 ───────────────────────────────────────────────────────────────
async function processDir(srcDir, destDir) {
  fs.mkdirSync(destDir, { recursive: true });

  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath  = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    if (entry.isDirectory()) {
      await processDir(srcPath, destPath);
      continue;
    }

    const ext = path.extname(entry.name).toLowerCase();

    // ── JS 난독화 ─────────────────────────────────────────────────────────────
    if (ext === '.js') {
      const src = fs.readFileSync(srcPath, 'utf8');
      const result = JavaScriptObfuscator.obfuscate(src, {
        // 기본 난독화 옵션
        compact:                          true,   // 한 줄로 압축
        controlFlowFlattening:            true,   // 제어 흐름 평탄화 (코드 흐름 분석 어렵게)
        controlFlowFlatteningThreshold:   0.5,
        deadCodeInjection:                true,   // 실행 안 되는 가짜 코드 삽입
        deadCodeInjectionThreshold:       0.2,
        debugProtection:                  false,  // DevTools 열리면 무한루프 (사용자에게 불편 → off)
        disableConsoleOutput:             false,  // console.log 유지 (BG 로그 필요)
        identifierNamesGenerator:         'hexadecimal',  // 변수명 _0x1234 형태
        renameGlobals:                    false,  // 전역 변수 이름 변경 안 함 (크롬 API 깨짐 방지)
        rotateStringArray:                true,
        selfDefending:                    true,   // 코드 수정 시 동작 방해
        shuffleStringArray:               true,
        splitStrings:                     true,   // 문자열을 조각으로 분할
        splitStringsChunkLength:          8,
        stringArray:                      true,   // 문자열을 배열로 치환
        stringArrayCallsTransform:        true,
        stringArrayEncoding:              ['base64'],  // 문자열 base64 인코딩
        stringArrayIndexShift:            true,
        stringArrayRotate:                true,
        stringArrayShuffle:               true,
        stringArrayWrappersCount:         2,
        stringArrayWrappersParametersMaxCount: 4,
        stringArrayWrappersType:          'function',
        stringArrayThreshold:             0.75,
        transformObjectKeys:              true,   // 객체 키 난독화
        unicodeEscapeSequence:            false,  // 유니코드 이스케이프 (파일 크기 증가 → off)
        target:                           'browser',
      });
      fs.writeFileSync(destPath, result.getObfuscatedCode(), 'utf8');
      const srcSz  = Buffer.byteLength(src,                     'utf8');
      const destSz = Buffer.byteLength(result.getObfuscatedCode(), 'utf8');
      console.log(`[JS]  ${entry.name}: ${kb(srcSz)} → ${kb(destSz)}`);
    }

    // ── HTML 압축 ─────────────────────────────────────────────────────────────
    else if (ext === '.html') {
      const src = fs.readFileSync(srcPath, 'utf8');
      const out = await minifyHtml(src, {
        collapseWhitespace:    true,
        removeComments:        true,
        removeEmptyAttributes: true,
        minifyCSS:             true,
        minifyJS:              true,
      });
      fs.writeFileSync(destPath, out, 'utf8');
      console.log(`[HTML] ${entry.name}: ${kb(src)} → ${kb(out)}`);
    }

    // ── CSS 압축 ─────────────────────────────────────────────────────────────
    else if (ext === '.css') {
      const src = fs.readFileSync(srcPath, 'utf8');
      const out = new CleanCSS({ level: 2 }).minify(src).styles;
      fs.writeFileSync(destPath, out, 'utf8');
      console.log(`[CSS]  ${entry.name}: ${kb(src)} → ${kb(out)}`);
    }

    // ── JSON 공백 제거 ────────────────────────────────────────────────────────
    else if (ext === '.json') {
      const src = fs.readFileSync(srcPath, 'utf8');
      try {
        const out = JSON.stringify(JSON.parse(src));
        fs.writeFileSync(destPath, out, 'utf8');
        console.log(`[JSON] ${entry.name}: ${kb(src)} → ${kb(out)}`);
      } catch (e) {
        // 파싱 실패 시 그대로 복사
        fs.copyFileSync(srcPath, destPath);
        console.log(`[JSON] ${entry.name}: 파싱 실패, 그대로 복사`);
      }
    }

    // ── 나머지 (png 등): 그대로 복사 ─────────────────────────────────────────
    else {
      fs.copyFileSync(srcPath, destPath);
      console.log(`[COPY] ${entry.name}`);
    }
  }
}

function kb(input) {
  const bytes = typeof input === 'string' ? Buffer.byteLength(input, 'utf8') : input;
  return (bytes / 1024).toFixed(1) + 'KB';
}

// ─── 실행 ────────────────────────────────────────────────────────────────────
(async () => {
  console.log('=== NSP-Extractor 난독화 빌드 시작 ===');
  console.log(`SRC : ${SRC}`);
  console.log(`DEST: ${DEST}`);
  console.log('');

  try {
    await processDir(SRC, DEST);
    console.log('');
    console.log('=== 빌드 완료 ===');

    // 결과 요약
    function totalSize(dir) {
      let total = 0;
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) total += totalSize(p);
        else total += fs.statSync(p).size;
      }
      return total;
    }
    const srcTotal  = totalSize(SRC);
    const destTotal = totalSize(DEST);
    console.log(`원본 합계   : ${kb(srcTotal)}`);
    console.log(`난독화 합계 : ${kb(destTotal)}`);
    console.log(`크기 변화   : ${((destTotal / srcTotal - 1) * 100).toFixed(0)}%`);

  } catch (err) {
    console.error('빌드 오류:', err);
    process.exit(1);
  }
})();
