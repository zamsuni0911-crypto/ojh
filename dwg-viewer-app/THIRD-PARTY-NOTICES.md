# 제3자 구성요소 및 라이선스 고지

이 뷰어(`DWG_뷰어_단일파일.html` 및 `dist/` 폴더 빌드)는 다음 오픈소스
구성요소를 포함하여 빌드됩니다.

| 구성요소 | 용도 | 라이선스 |
|---|---|---|
| [@mlightcad/cad-simple-viewer](https://github.com/mlightcad/cad-viewer) 외 mlightcad 패키지 | 뷰어 런타임 · DXF 변환 · 렌더러 | MIT |
| [three.js](https://github.com/mrdoob/three.js) | WebGL 렌더링 | MIT |
| [@mlightcad/libredwg-converter](https://github.com/mlightcad/realdwg-web) | DWG → 내부 모델 변환 | **GPL-3.0** |
| [LibreDWG](https://github.com/LibreDWG/libredwg) (WebAssembly 빌드, `@mlightcad/libredwg-web`) | DWG 바이너리 파서 | **GPL-3.0** |
| mlightcad `cad-data` 서브셋 (SHX 폰트, `fonts.json`) | 문자 렌더링 폰트 | 각 폰트 배포 조건 |

## GPL-3.0 관련 의무

`libredwg-converter` 와 `LibreDWG` 는 GPL-3.0 입니다. 이 파일을 사내
직원 등 제3자에게 전달(배포)하는 것은 GPL 상 "conveying" 에 해당하므로:

1. 라이선스 고지(본 문서 및 HTML 파일 상단 주석)를 함께 유지할 것.
2. 수령자가 요청하면 대응하는 소스 코드를 제공할 것.
   - LibreDWG: https://github.com/LibreDWG/libredwg
   - libredwg-web / converter: https://github.com/mlightcad/realdwg-web
   - 본 뷰어 빌드 소스: 사내 저장소 `바이브코딩/dwg-viewer-app`
3. 순수 사내(법인 내부) 사용은 일반적으로 의무가 가볍지만, 계열사·외부
   협력사 등 별도 법인으로 전달할 경우 위 조건을 반드시 충족할 것.

판단이 애매하면 법무 검토를 권장합니다.

## 소스 코드 보관

`@mlightcad/libredwg-web` 의 WebAssembly 바이너리(`libredwg-web.wasm`)는
`node_modules/@mlightcad/libredwg-converter/dist/` 에 있으며, 그 소스는
위 GitHub 저장소에서 받을 수 있습니다. 배포본과 함께 해당 소스 스냅샷을
사내 저장소에 보관해 두는 것을 권장합니다.
