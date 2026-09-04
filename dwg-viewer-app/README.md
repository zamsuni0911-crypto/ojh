# DWG · DXF 도면 뷰어

AutoCAD 도면 파일(`.dwg` / `.dxf` / `.dwt`)을 **캐드 프로그램 없이, 인터넷 없이**
웹브라우저만으로 열어 보는 뷰어. 블록·해치·치수·문자 포함. 파일은 브라우저
안에서만 처리되며 외부로 전송되지 않는다.

[mlightcad/cad-viewer](https://github.com/mlightcad/cad-viewer) (MIT) 런타임 위에
사내 배포용으로 한국어화 + **완전 오프라인 단일 HTML** 빌드를 얹은 것.

## 배포물

| 파일 | 설명 |
|---|---|
| `배포/DWG_뷰어_단일파일.html` | **최종 산출물.** 약 24MB, 외부 파일·인터넷 불필요 |
| `배포/도면뷰어_열기.bat` + `_뷰어서버.ps1` | 설치 없이 로컬에서 여는 런처 (Windows 10/11) |
| `배포/사용법.txt` | 직원 배포용 안내문 |
| `dist/` | 폴더형 빌드(HTML + `assets/`). 인트라넷 호스팅 시 가벼운 대안 |

### 여는 방법
1. **인트라넷 호스팅(권장)** — `DWG_뷰어_단일파일.html` 을 웹서버에 올리고 URL 공유.
2. **런처** — `배포/` 3개 파일을 같은 폴더에 두고 `도면뷰어_열기.bat` 더블클릭.
3. `file://` 직접 더블클릭도 화면은 뜨지만, 브라우저 보안정책상 DWG 파싱
   (Web Worker)이 막힐 수 있어 1·2 를 권장. (DXF 는 대체로 동작)

## 빌드

```bash
cd dwg-viewer-app
npm install
npm run build          # → dist/           (폴더형: index.html + assets/)
npm run build:single   # → dist-single/index.html  (JS·CSS 인라인)
node tools/inline-single.mjs   # → ../DWG_뷰어_단일파일.html  (워커·wasm·폰트까지 병합)
```

배포 폴더 갱신:

```bash
cp DWG_뷰어_단일파일.html 배포/
```

## 구조

- `src/` — 업로드 화면 UI 와 `AcApDocManager` 연결 (mlightcad 예제 기반, 한국어화)
  - `workerConfig.ts` — 단일 빌드에서 인라이너가 주입한 Blob URL 사용
  - `app.ts` — 단일 빌드 시: 워커 도달성 체크 skip, MTEXT 메인스레드 렌더,
    `baseUrl` 를 오프라인 센티널(`https://cad-data.local/`)로 지정, 경량 폰트 세트
- `vendor/fonts/` — 내장할 SHX 서브셋 + `fonts.json` (mlightcad `cad-data` 에서 발췌)
- `tools/inline-single.mjs` — 단일 HTML 조립기:
  - `libredwg-parser-worker.js` → Blob URL. 그 안의 `libredwg-web.wasm` 참조를
    `data:application/wasm;base64,...` 로 치환 (워커가 상대경로 해석 불가하므로)
  - `https://cad-data.local/fonts/*` 요청을 가로채는 `fetch` 인터셉터 주입
  - 데모 네비게이션 제거, GPL 고지 주석 삽입

## 라이선스

DWG 파서(LibreDWG / `@mlightcad/libredwg-converter`)는 **GPL-3.0**.
사내 배포 시 의무는 [`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md) 참고.
그 외 런타임은 MIT.

## 한계

- 렌더링 정밀도는 매우 높지만 AutoCAD 100% 재현은 아님(특수 SHX 폰트,
  일부 이형 해치/치수 스타일에서 차이 가능).
- 대용량 중국어 TrueType 폰트(simsun 등)는 미포함 → 해당 글자는 대체 폰트.
- 매우 큰 도면(수십 MB)은 변환에 시간이 걸리고 메모리를 많이 쓸 수 있음.
