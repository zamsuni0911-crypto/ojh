import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, type PluginOption } from 'vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import { viteSingleFile } from 'vite-plugin-singlefile'

/**
 * DWG/DXF 뷰어 빌드 설정.
 *
 * 기본(`npm run build`)        : dist/  = index.html + assets/ 폴더
 * 단일(`npm run build:single`) : dist-single/index.html (JS·CSS 인라인)
 *                                → 이후 tools/inline-single.mjs 가 워커·wasm·폰트까지
 *                                  합쳐 최종 dwg-viewer_단일파일.html 생성
 *
 * DWG 파서(LibreDWG, GPL)는 Web Worker + libredwg-web.wasm 로 분리 실행된다.
 */
const LIBREDWG_CONVERTER_PACKAGE = '@mlightcad/libredwg-converter'
const LIBREDWG_PARSER_WORKER_FILE = 'libredwg-parser-worker.js'
const LIBREDWG_PARSER_WASM_FILE = 'libredwg-web.wasm'
const MTEXT_RENDERER_WORKER_FILE = 'mtext-renderer-worker.js'

function viewerManualChunk(id: string): string | undefined {
  const path = id.replace(/\\/g, '/')
  if (
    path.includes('vite/preload-helper') ||
    path.includes('vite/modulepreload-polyfill')
  ) {
    return 'vite-preload'
  }
  if (path.includes('/node_modules/three/')) return 'three'
  if (
    path.includes('/@mlightcad/three-renderer/') ||
    path.includes('/@mlightcad/mtext-renderer/') ||
    path.includes('/@mlightcad/mtext-parser/') ||
    path.includes('/@mlightcad/shx-parser/')
  ) {
    return 'three-renderer'
  }
  if (
    path.includes('/@mlightcad/data-model/') ||
    path.includes('/@mlightcad/geometry-engine/') ||
    path.includes('/@mlightcad/graphic-interface/') ||
    path.includes('/@mlightcad/common/')
  ) {
    return 'data-model'
  }
  if (path.includes('/@mlightcad/cad-simple-viewer/')) return 'cad-simple-viewer'
}

const libredwgDist = `./node_modules/${LIBREDWG_CONVERTER_PACKAGE}/dist`
const viewerRuntimeSrc = resolve(
  __dirname,
  'node_modules/@mlightcad/cad-html-plugin/dist/viewer-runtime.iife.js'
)
const hasViewerRuntime = existsSync(viewerRuntimeSrc)

export default defineConfig(({ mode }) => {
  const isSingle = mode === 'single'

  const staticCopyTargets = [
    {
      src: `./node_modules/@mlightcad/cad-simple-viewer/dist/${MTEXT_RENDERER_WORKER_FILE}`,
      dest: 'assets',
      rename: { stripBase: true }
    },
    {
      src: `${libredwgDist}/${LIBREDWG_PARSER_WORKER_FILE}`,
      dest: 'assets',
      rename: { stripBase: true }
    },
    {
      src: `${libredwgDist}/${LIBREDWG_PARSER_WASM_FILE}`,
      dest: 'assets',
      rename: { stripBase: true }
    },
    ...(hasViewerRuntime
      ? [
          {
            src: './node_modules/@mlightcad/cad-html-plugin/dist/viewer-runtime.iife.js',
            dest: 'assets',
            rename: { stripBase: true }
          }
        ]
      : [])
  ]

  return {
    base: './',
    build: {
      outDir: isSingle ? 'dist-single' : 'dist',
      modulePreload: false,
      assetsInlineLimit: isSingle ? 100_000_000 : 4096,
      cssCodeSplit: !isSingle,
      rollupOptions: isSingle
        ? {}
        : { output: { manualChunks: viewerManualChunk } }
    },
    plugins: [
      // 단일 모드: 워커/wasm 은 인라이너가 처리하므로 정적 복사 불필요.
      ...(isSingle ? [] : [viteStaticCopy({ targets: staticCopyTargets })]),
      ...(isSingle ? [viteSingleFile()] : [])
    ].filter(Boolean) as PluginOption[]
  }
})
