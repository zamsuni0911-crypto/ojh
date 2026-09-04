import type { AcApWebworkerFiles } from '@mlightcad/cad-simple-viewer'

/** Local names — do not import from `@mlightcad/cad-simple-viewer` (keeps entry lean). */
export const LIBREDWG_PARSER_WORKER_FILE = 'libredwg-parser-worker.js'
export const LIBREDWG_PARSER_WASM_FILE = 'libredwg-web.wasm'
export const MTEXT_RENDERER_WORKER_FILE = 'mtext-renderer-worker.js'

/**
 * 단일 HTML 빌드에서 tools/inline-single.mjs 가 주입하는 전역.
 * DWG 파서 워커를 Blob URL(안에 wasm 을 data URI 로 내장)로 바꿔치기한다.
 * 폴더 빌드에서는 undefined → `./assets/*` 를 그대로 사용.
 */
declare global {
  // eslint-disable-next-line no-var
  var __DWG_WORKER_URLS__:
    | Partial<Record<'mtextRender' | 'dwgParser', string>>
    | undefined
}

const injected = globalThis.__DWG_WORKER_URLS__ ?? {}

/**
 * MTEXT + LibreDWG 워커 URL.
 *
 * 폴더 빌드: Vite 가 `dist/assets/` 로 복사한 파일 (wasm 이 워커 옆에 있어야 함).
 * 단일 빌드: 인라이너가 채워 넣은 Blob URL.
 */
export const WEBWORKER_FILE_URLS: Required<AcApWebworkerFiles> = {
  mtextRender: injected.mtextRender ?? `./assets/${MTEXT_RENDERER_WORKER_FILE}`,
  dwgParser: injected.dwgParser ?? `./assets/${LIBREDWG_PARSER_WORKER_FILE}`
}

/** 단일 HTML 로 실행 중인지 (인라이너가 전역 플래그를 세팅). */
export const IS_SINGLE_FILE_BUILD =
  typeof globalThis.__DWG_WORKER_URLS__ !== 'undefined'
