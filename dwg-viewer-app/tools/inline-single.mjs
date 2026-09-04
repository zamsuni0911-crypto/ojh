/**
 * dist-single/index.html (Vite viteSingleFile 결과: JS·CSS 인라인)에
 * 나머지 런타임 의존성을 모두 합쳐 "완전 단일 오프라인 HTML" 을 만든다.
 *
 *  - libredwg-parser-worker.js  → Blob URL (전역 __DWG_WORKER_URLS__.dwgParser)
 *  - libredwg-web.wasm (~10MB)  → 워커 소스 안에 data:application/wasm;base64 로 박음
 *  - vendor/fonts/*             → fetch 인터셉터로 https://cad-data.local/fonts/* 응답
 *  - 데모 네비게이션 제거, GPL 고지 삽입
 *
 * 사용:  node tools/inline-single.mjs
 * 출력:  ../DWG_뷰어_단일파일.html  (프로젝트 폴더 밖, 저장소 루트)
 *        ./DWG_뷰어_단일파일.html   (개발 확인용 사본)
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, basename } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const repoRoot = resolve(root, '..')

const NM = resolve(root, 'node_modules/@mlightcad')
const WORKER_SRC = resolve(NM, 'libredwg-converter/dist/libredwg-parser-worker.js')
const WASM_SRC = resolve(NM, 'libredwg-converter/dist/libredwg-web.wasm')
const HTML_SRC = resolve(root, 'dist-single/index.html')
const FONT_DIR = resolve(root, 'vendor/fonts')

const OUT_MAIN = resolve(repoRoot, 'DWG_뷰어_단일파일.html')
const OUT_COPY = resolve(root, 'DWG_뷰어_단일파일.html')

const mb = (n) => (n / 1048576).toFixed(1) + 'MB'

// ────────────────────────────────────────────────────────────────────────────
// 1) DWG 파서 워커 + wasm
// ────────────────────────────────────────────────────────────────────────────
const wasmB64 = readFileSync(WASM_SRC).toString('base64')
const wasmDataUri = `data:application/wasm;base64,${wasmB64}`

let workerSrc = readFileSync(WORKER_SRC, 'utf8')
const WASM_URL_EXPR =
  'new URL(""+new URL("libredwg-web.wasm",import.meta.url).href,import.meta.url).href'
if (!workerSrc.includes(WASM_URL_EXPR)) {
  throw new Error(
    'worker 안에서 wasm URL 해석 코드를 찾지 못했습니다. libredwg-converter 버전이 바뀌었을 수 있습니다.'
  )
}
workerSrc =
  `var __LIBREDWG_WASM_URL__=${JSON.stringify(wasmDataUri)};\n` +
  workerSrc.split(WASM_URL_EXPR).join('__LIBREDWG_WASM_URL__')

// ────────────────────────────────────────────────────────────────────────────
// 2) 폰트 번들 (fonts.json + 큐레이션한 SHX)
// ────────────────────────────────────────────────────────────────────────────
const fontMap = {}
let fontBytes = 0
for (const name of readdirSync(FONT_DIR)) {
  const buf = readFileSync(resolve(FONT_DIR, name))
  fontBytes += buf.length
  fontMap[basename(name).toLowerCase()] =
    name.toLowerCase().endsWith('.json')
      ? { t: 'text', d: buf.toString('utf8') }
      : { t: 'b64', d: buf.toString('base64') }
}

// ────────────────────────────────────────────────────────────────────────────
// 3) 부트스트랩 스크립트 (모듈 로드 전에 실행)
// ────────────────────────────────────────────────────────────────────────────
const bootstrap = `<script>
(function(){
  "use strict";
  // --- DWG 파서 워커: Blob URL (wasm 은 소스 안에 data URI 로 내장됨) ---
  try {
    var src = ${JSON.stringify(workerSrc)};
    var blob = new Blob([src], { type: "text/javascript" });
    window.__DWG_WORKER_URLS__ = { dwgParser: URL.createObjectURL(blob) };
  } catch (e) {
    window.__DWG_WORKER_URLS__ = {};
    console.error("DWG 워커 초기화 실패:", e);
  }

  // --- 오프라인 폰트: https://cad-data.local/fonts/* 요청을 내장 데이터로 응답 ---
  // FONTS 는 프로토타입 없는 객체 → __proto__/constructor 등으로 상속 프로퍼티가
  // 조회되지 않는다. key 는 소문자 파일명 문자셋으로 엄격 제한한다.
  var FONTS = Object.assign(Object.create(null), ${JSON.stringify(fontMap)});
  var PREFIX = "https://cad-data.local/fonts/";
  var SAFE_KEY = /^[a-z0-9@._-]{1,64}$/;
  function bytesFromB64(b64){
    var bin = atob(b64), n = bin.length, u = new Uint8Array(n);
    for (var i = 0; i < n; i++) u[i] = bin.charCodeAt(i);
    return u;
  }
  function notFound(msg){ return new Response(String(msg || ""), { status: 404 }); }
  function localFontResponse(url){
    var raw;
    try { raw = decodeURIComponent(url.slice(PREFIX.length)); }
    catch (e) { return notFound("bad url"); }
    var key = raw.toLowerCase().replace(/^.*\\//, "");
    if (!SAFE_KEY.test(key) || !(key in FONTS)) return notFound("not bundled: " + key);
    var rec = FONTS[key];
    if (!rec || typeof rec.d !== "string") return notFound("empty: " + key);
    if (rec.t === "text")
      return new Response(rec.d, { status: 200, headers: { "content-type": "application/json" } });
    return new Response(bytesFromB64(rec.d), {
      status: 200,
      headers: { "content-type": "application/octet-stream" }
    });
  }
  var _fetch = window.fetch ? window.fetch.bind(window) : null;
  window.fetch = function(input, init){
    var url = typeof input === "string"
      ? input
      : (input && (input.url || input.href)) || "";
    if (url.indexOf(PREFIX) === 0) {
      try { return Promise.resolve(localFontResponse(url)); }
      catch (e) { return Promise.resolve(notFound("error")); }
    }
    if (_fetch) return _fetch(input, init);
    return Promise.reject(new Error("offline: " + url));
  };
})();
</script>`

// ────────────────────────────────────────────────────────────────────────────
// 4) HTML 합성
// ────────────────────────────────────────────────────────────────────────────
let html = readFileSync(HTML_SRC, 'utf8')

// 데모 네비게이션 제거
html = html.replace(/<nav class="demo-nav"[\s\S]*?<\/nav>/i, '')

// GPL / 라이선스 고지 (HTML 주석)
const notice = `<!--
  DWG/DXF 뷰어 — 단일 오프라인 HTML
  포함 구성요소:
   - @mlightcad/cad-simple-viewer 등 (MIT)
   - three.js (MIT)
   - @mlightcad/libredwg-converter + LibreDWG (GPL-3.0)  ※ 아래 참고
  LibreDWG 및 libredwg-converter 는 GPL-3.0 입니다. 이 파일을 사내에 배포하는 것은
  GPL 상 "배포"에 해당하므로, 수령자가 요청하면 해당 구성요소의 소스를 제공해야 합니다.
  소스: https://github.com/LibreDWG/libredwg , https://github.com/mlightcad/realdwg-web
  빌드 프로젝트: (사내) 바이브코딩/dwg-viewer-app
-->
`

if (html.includes('<head>')) {
  html = html.replace('<head>', '<head>\n' + notice + bootstrap)
} else {
  html = notice + bootstrap + html
}

writeFileSync(OUT_MAIN, html)
writeFileSync(OUT_COPY, html)

const total = Buffer.byteLength(html)
console.log('완성:')
console.log('  ' + OUT_MAIN)
console.log('  ' + OUT_COPY)
console.log('크기 내역:')
console.log('  wasm(base64)      ~' + mb(wasmB64.length))
console.log('  폰트 원본          ' + mb(fontBytes) + ' (' + Object.keys(fontMap).length + '개 파일)')
console.log('  최종 HTML          ' + mb(total))
