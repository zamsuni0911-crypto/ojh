# 한반도를 완성해요 — 통일 지도 퍼즐 게임

공공데이터포털 소재로 만든 **초·중학생용 통일 교육 게임**. 완전 오프라인 단일 HTML.

| 파일 | 설명 |
|---|---|
| `통일_지도퍼즐_게임.html` | 게임 본체. 더블클릭하면 브라우저에서 바로 실행. 위성지도 패널까지 이 한 파일에 포함 |
| `build/` | 지도 경계 데이터 생성 파이프라인 (재현용) |

## 게임 방법

| 단계 | 내용 |
|---|---|
| 난이도 | **초등**(북한 9도, 남한은 배경) / **중등**(남·북 18도 + 제주 전체) |
| 1단계 | 도(道) 조각을 지도의 알맞은 자리에 드래그 → 자석처럼 스냅. 정확히 놓으면 **✨ 완벽!** 추가 점수 |
| 2단계 | 제시되는 도시 위치에 깃발 꽂기. 빗나가면 **🔥 뜨거워요 / 🥶 차가워요** 힌트 + 방향 |
| **번개 퀴즈** | 실루엣만 보고 도 이름 맞히기 5문제(3지선다·8초). 빠를수록 보너스 |
| 결과 | 점수·최고 연속·시간·별점·도감, **개인 최고 기록**(브라우저 저장) 갱신 표시, **결과 복사** |
| **둘러보기** | 1·2단계 HUD의 "🔍 둘러보기" 또는 결과의 "지역 자세히 보기" → 도를 누르면 확대 + 위성지도 연결 |

**재미 요소**: 연속 정답 **콤보(🔥×N)** 로 점수 배수 + "N연속!" 팝업 + 상승음, 놓은 자리에 **+점수** 떠오름,
조각마다 **마스코트(🕊️)** 가 지역 상식(💡) 한마디, 지도 완성·종료 시 **색종이 + 승리 팡파르**,
무실수 **퍼펙트 +500** / 빠른 완성 **속도 보너스** / 번개 퀴즈 보너스, 난이도별 **최고 점수 기록**.

## 위성지도 연결 — 최종 사용자는 키 입력이 필요 없음

둘러보기에서 "위성지도로 보기"를 누르면 게임 화면 안에 위성지도 패널이 뜹니다.
**API 키·회원가입 없이 바로** 동작하고, 한 소스가 막히면 **자동으로 다음 소스로 전환**합니다.

| 버튼 | 소스 | 키 |
|---|---|---|
| **위성** | 자동 체인: (VWorld →) **Esri World Imagery** → **Sentinel-2 cloudless(EOX)** | 불필요 |
| **위성+지명** | Esri World Imagery + 지명 레이어 (지명 영문·로마자) | 불필요 |
| **일반** | OpenStreetMap | 불필요 |
| **VWorld** | 국토부 브이월드 위성+한글지명·국내 고해상 | `VWORLD_KEY` 있을 때만 표시 |

`leaflet-providers`(오픈소스 표준 목록) 기준 **키 없이 전 세계에서 쓸 수 있는 위성 타일은 Esri World Imagery 가
사실상 유일**하며, 이 게임의 기본값입니다. Sentinel-2(EOX)는 Esri 가 막힐 때의 자동 대체용입니다.

### 배포자가 한글 지도까지 넣고 싶을 때 (선택)

`통일_지도퍼즐_게임.html` 의 `const VWORLD_KEY = ""` 에 [vworld.kr](https://www.vworld.kr) 무료 키를
**한 번만** 넣어 두면, 모든 이용자에게 **VWorld** 버튼(한글 지명·국내 고해상)이 생깁니다.
이용자는 아무것도 입력하지 않습니다. VWorld 키는 발급 시 "사용 URL"에 등록한 도메인에서만 동작하고
호출 한도가 있으므로, 도메인이 안 맞거나 한도 초과 시 자동으로 Esri 로 되돌아갑니다.

> 공공데이터포털·VWorld 모두 "코드에서 키를 받아오는" 공개 엔드포인트는 없습니다(포털 웹에서 발급받는 방식만 존재).
> 키를 완전히 숨기려면 별도 프록시 서버가 필요하므로, 단일 HTML 배포에는 위 방식이 최선입니다.

※ 북한 지역은 **거리뷰(로드뷰)가 존재하지 않아** 위성영상만 제공됩니다.
※ 오프라인이면 위성 패널만 안내문으로 대체되고, 게임(조각·둘러보기)은 정상 동작합니다.
※ 타일 저작권: © Esri, Maxar, Earthstar Geographics / Sentinel-2 cloudless by EOX (CC BY-NC-SA 4.0) / © OpenStreetMap / © VWorld(국토교통부).

## 지도 데이터 출처

- **북한 지명·좌표**: [통일부 북한정보포털](https://nkinfo.unikorea.go.kr/NKMap/) NKMap 검색 API (키·로그인 불필요, EPSG:5186).
  공공데이터포털 [통일부_북한지도 … 지명 및 위치 정보(15088900)](https://www.data.go.kr/data/15088900/fileData.do)의 원본 시스템.
  북한 9개 도·8개 도시의 **공식 지명·좌표·지리적 위치 설명**을 사용 (도감에 출처 표기).
- **행정구역 경계**: [Natural Earth](https://www.naturalearthdata.com/) 1:10m `admin_1_states_provinces` — **Public Domain**
- **투영**: TM 중부원점 계열 `+proj=tmerc +lat_0=38 +lon_0=127.8 +k=0.9996 +ellps=GRS80`
- **가공**: [mapshaper](https://github.com/mbloch/mapshaper) 위상 유지 단순화
- **위성지도**: Esri World Imagery / Sentinel-2(EOX) / OpenStreetMap / [VWorld](https://www.vworld.kr)(국토교통부)

## 데이터 다시 만들기

```bash
cd build
npm install proj4@2.12.1  # nkinfo.js 좌표 변환용
node fetch.js      # Natural Earth 10m geojson 내려받기 (~40MB, .gitignore)
bash make.sh       # nkinfo.js(통일부 지명 수집) → 필터→병합→투영→단순화→regions.json
```

생성된 `build/regions.json` 을 `통일_지도퍼즐_게임.html` 의 `const REGIONS = {...}` 에 반영.
필요 도구: Node 18+, `npx`(mapshaper 자동 설치).

### 파이프라인 요약

1. `nkinfo.js` : 통일부 북한정보포털 NKMap API 로 북한 도·도시 공식 지명/좌표(EPSG:5186→WGS84) → `nkinfo.json`
2. `admin_1` 전 세계 파일에서 `adm0_a3 = KOR | PRK` 필터
3. 광역시(서울·부산·평양·라선 등 10곳)를 `iso_3166_2` 매핑으로 소속 도에 `-dissolve2` 병합 → **28 → 18 조각**
4. `-proj` 평면 좌표 변환 → `-filter-islands min-area=20km2` → `-simplify 18% keep-shapes`(위상 유지)
5. DMZ 선: `region`(n/s) dissolve 후 `-innerlines`
6. `build.js` : 투영좌표 → SVG `<path d>` + 라벨점 + bbox + `ll`(북한=통일부, 남한=시청) + `src`/`nknote`(통일부 출처) → `regions.json`

> `ne_50m_admin_1` 에는 한국 도 경계가 없음 — 반드시 10m.
> 군사분계선 선은 동쪽 구간만 나옴(Natural Earth의 남·북 폴리곤이 서쪽 한강하구에서 꼭짓점 불일치).
