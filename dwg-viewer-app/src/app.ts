import type {
  AcApDocManager,
  AcApOpenDatabaseOptions,
  AcApOpenViewMode,
  AcEdOpenMode
} from '@mlightcad/cad-simple-viewer'
import {
  loadCadSimpleViewer,
  preloadViewerAppModules,
  scheduleViewerPreload
} from './viewerLoader'
import { IS_SINGLE_FILE_BUILD, WEBWORKER_FILE_URLS } from './workerConfig'

/**
 * 단일 HTML 빌드일 때 `baseUrl` 로 쓰는 오프라인 센티널.
 * 인라이너가 주입한 fetch 인터셉터가 이 접두사 요청을 내장 폰트로 응답한다.
 */
const OFFLINE_BASE_URL = 'https://cad-data.local/'

/**
 * Toast notification severity used by {@link CadViewerApp.showMessage}.
 */
type MessageType = 'success' | 'error' | 'info'

/**
 * Upload-screen value for initial view when the user leaves the choice on **Auto**.
 */
type OpenViewModeChoice = 'auto' | AcApOpenViewMode

/**
 * Open options collected from the upload screen before a file is loaded.
 */
interface OpenOptions {
  /** Database access mode passed to {@link AcApOpenDatabaseOptions.mode}. */
  mode: AcEdOpenMode
  /** Whether MTEXT is rendered on the main thread (fixed after first {@link CadViewerApp.initialize}). */
  useMainThreadDraw: boolean
  /** Whether non-plottable layers are drawn ({@link AcApOpenDatabaseOptions.drawNoPlotLayers}). */
  drawNoPlotLayers: boolean
  /** Whether geometry is shown incrementally while the file converts. */
  progressiveRendering: boolean
  /** How the view is framed after open; omitted when the user selects **Auto**. */
  openViewMode?: AcApOpenViewMode
}

/**
 * Options for {@link CadViewerApp}.
 */
export interface CadViewerAppOptions {
  /**
   * When `true` (default), registers lazy export plugins and the simple UI toolbar.
   * Set to `false` to run a bare `cad-simple-viewer` without any plugins.
   */
  enablePlugins?: boolean
}

/**
 * Application shell that wires the example HTML UI to `AcApDocManager`.
 *
 * Responsibilities:
 * - Keep the homepage free of a static `@mlightcad/cad-simple-viewer` import
 * - Preload viewer JS after first paint, then create the viewer on first file open
 * - Optionally register demo commands, lazy export plugins, and the simple UI plugin
 * - Handle local DXF/DWG file open with configurable open options
 * - Reflect document state in the DOM (upload screen vs viewer)
 *
 * The viewer package and `AcApDocManager.createInstance` are deferred until needed;
 * {@link scheduleViewerPreload} warms the module cache in the background.
 */
export class CadViewerApp {
  /**
   * Host element passed to `AcApDocManager.createInstance` as the WebGL/view canvas parent.
   * Corresponds to `#cad-container` in the page HTML.
   */
  private container: HTMLDivElement

  /**
   * Viewer pane that hosts the CAD canvas and (when enabled) simple UI plugin overlays.
   * Corresponds to `#viewerPane` in the page HTML.
   */
  private viewerPane: HTMLElement

  /**
   * Full-screen upload overlay shown before a drawing is opened.
   * Corresponds to `#uploadScreen` in the page HTML.
   */
  private uploadScreen: HTMLElement

  /**
   * Click/drop target inside the upload panel that triggers the hidden file input.
   * Corresponds to `#uploadDropzone` in the page HTML.
   */
  private uploadDropzone: HTMLElement

  /**
   * Hidden `<input type="file">` used to pick local `.dxf` / `.dwg` files.
   * Corresponds to `#fileInputElement`.
   */
  private fileInput: HTMLInputElement

  /**
   * Compact **Open** control shown in the viewer corner after a file loads successfully.
   * Corresponds to `#reopenButton` in the page HTML.
   */
  private reopenButton: HTMLButtonElement

  /**
   * **New Drawing** button on the upload screen.
   * Corresponds to `#newDrawingButton` in the page HTML.
   */
  private newDrawingButton: HTMLButtonElement

  /**
   * Whether {@link AcApDocManager.createInstance} has completed for this page session.
   * Stays false until the user opens a file for the first time.
   */
  private isInitialized: boolean = false

  /**
   * `useMainThreadDraw` value passed to the first {@link CadViewerApp.initialize} call.
   * Used to warn when the user changes text rendering after the viewer is already running.
   */
  private initUseMainThreadDraw: boolean = false

  /**
   * Whether the user has opened at least one drawing in this session.
   * Used to keep the corner **Open** button visible after subsequent opens.
   */
  private hasOpenedFile: boolean = false

  /**
   * Whether to register export + simple UI plugins after `createInstance`.
   */
  private readonly enablePlugins: boolean

  /**
   * Cached `AcApDocManager` class after the viewer module has been loaded.
   * Set during {@link CadViewerApp.initialize}.
   */
  private DocManager: typeof AcApDocManager | null = null

  /**
   * Binds DOM references from the page HTML and registers UI event listeners.
   *
   * Does not load `@mlightcad/cad-simple-viewer` or create the CAD viewer;
   * schedules a background preload and initializes on first file open /
   * new drawing.
   *
   * @param options - App options; set `enablePlugins: false` for a bare viewer
   */
  constructor(options: CadViewerAppOptions = {}) {
    this.enablePlugins = options.enablePlugins !== false

    this.container = document.getElementById('cad-container') as HTMLDivElement
    this.viewerPane = document.getElementById('viewerPane') as HTMLElement
    this.uploadScreen = document.getElementById('uploadScreen') as HTMLElement
    this.uploadDropzone = document.getElementById('uploadDropzone') as HTMLElement
    this.fileInput = document.getElementById('fileInputElement') as HTMLInputElement
    this.reopenButton = document.getElementById('reopenButton') as HTMLButtonElement
    this.newDrawingButton = document.getElementById(
      'newDrawingButton'
    ) as HTMLButtonElement

    this.setupOptionGroups()
    this.setupFileHandling()
    this.setupNewDrawingHandling()
    this.setupReopenHandling()
    this.checkEnvironment()
    scheduleViewerPreload(this.enablePlugins)
  }

  /**
   * DWG 파싱은 Web Worker 를 필수로 사용한다(LibreDWG 변환기에 메인 스레드 경로 없음).
   * `file://` 로 HTML 을 직접 열면 크로미엄 계열 브라우저가 Worker 생성을 차단하므로
   * DWG 를 열 수 없다(DXF 는 메인 스레드 처리라 가능). 이 경우 상단에 고정 경고를 띄운다.
   */
  private checkEnvironment(): void {
    let workerBlocked = false
    let reason = ''
    try {
      const probe = new Worker(
        URL.createObjectURL(
          new Blob(['self.close()'], { type: 'text/javascript' })
        )
      )
      probe.terminate()
    } catch (e) {
      workerBlocked = true
      reason = String(e)
    }

    const isFileProtocol = location.protocol === 'file:'
    if (!workerBlocked && !isFileProtocol) {
      return
    }

    const banner = document.createElement('div')
    banner.className = 'env-warning'
    banner.setAttribute('role', 'alert')
    banner.innerHTML = isFileProtocol
      ? '⚠ 이 파일을 <b>더블클릭(파일 열기)</b>으로 실행하면 브라우저 보안정책상 <b>DWG</b>를 열 수 없습니다.<br>' +
        '같은 폴더의 <b>도면뷰어_열기.bat</b> 으로 실행하거나, 사내 웹서버(인트라넷)에 올려 사용하세요. ' +
        '(DXF 는 이 상태에서도 열립니다.)'
      : '⚠ 이 브라우저 환경에서 <b>Web Worker</b> 가 차단되어 DWG 파싱이 되지 않을 수 있습니다.<br>' +
        '최신 Edge 또는 Chrome 으로 열거나 관리자에게 문의하세요. (' +
        reason +
        ')'

    const container = this.uploadScreen.querySelector('.file-upload-container')
    if (container) {
      this.uploadScreen.insertBefore(banner, container)
    } else {
      this.uploadScreen.prepend(banner)
    }
    this.uploadScreen.classList.add('has-env-warning')
    console.warn(
      '[환경 경고] workerBlocked=%s fileProtocol=%s %s',
      workerBlocked,
      isFileProtocol,
      reason
    )
  }

  /**
   * Wires click handlers on every `[data-option-group]` segment on the upload screen.
   *
   * Toggles the `is-active` class and `aria-checked` on the clicked option.
   */
  private setupOptionGroups(): void {
    document.querySelectorAll('[data-option-group]').forEach(group => {
      group.addEventListener('click', event => {
        const target = (event.target as HTMLElement).closest<HTMLButtonElement>(
          'button[data-value]'
        )
        if (!target || !group.contains(target)) {
          return
        }

        group.querySelectorAll('button[data-value]').forEach(button => {
          const isActive = button === target
          button.classList.toggle('is-active', isActive)
          button.setAttribute('aria-checked', String(isActive))
        })
      })
    })
  }

  /**
   * Returns the `data-value` of the active button inside an open-option group.
   *
   * @param groupName - Value of `data-option-group` on the segment container
   * @returns Selected option value, or an empty string when nothing is active
   */
  private getSelectedValue(groupName: string): string {
    const active = document.querySelector(
      `[data-option-group="${groupName}"] button.is-active`
    ) as HTMLButtonElement | null
    return active?.dataset.value ?? ''
  }

  /**
   * Reads the current upload-screen choices into an {@link OpenOptions} object.
   *
   * @returns Options applied on the next {@link CadViewerApp.loadFile} call
   */
  private readOpenOptions(): OpenOptions {
    const openViewChoice = this.getSelectedValue('openViewMode') as OpenViewModeChoice
    const openViewMode =
      openViewChoice === 'auto' ? undefined : (openViewChoice as AcApOpenViewMode)

    return {
      mode: Number(this.getSelectedValue('accessMode')) as AcEdOpenMode,
      // 단일 HTML: MTEXT 워커를 인라인하지 않으므로 항상 메인 스레드 렌더링.
      useMainThreadDraw:
        IS_SINGLE_FILE_BUILD || this.getSelectedValue('textRendering') === 'main',
      drawNoPlotLayers: this.getSelectedValue('noPlotLayers') === 'true',
      progressiveRendering: this.getSelectedValue('progressiveRendering') === 'true',
      openViewMode
    }
  }

  /**
   * Creates the singleton `AcApDocManager` and registers commands, plugins, and listeners.
   *
   * Dynamically imports `@mlightcad/cad-simple-viewer` (reusing any background preload)
   * before calling `createInstance`.
   *
   * Configuration highlights:
   * - LibreDWG DWG converter — host-registered via {@link registerLibreDwgConverter} (GPL opt-in)
   * - `webworkerFileUrls` — MTEXT + LibreDWG worker (+ wasm) copied to `dist/assets/`
   * - `checkWorkersOnInit` — probe worker URLs after registration (see {@link WEBWORKER_FILE_URLS})
   * - `baseUrl` — optional CDN root for built-in resources (demo override)
   * - `useMainThreadDraw` — MTEXT render mode; fixed for the lifetime of the page session
   *
   * HTML export runtime (`viewer-runtime.iife.js`) is configured on the HTML plugin via
   * {@link registerPlugins} / `registerLazyHtmlPlugin({ viewerRuntimeUrl })` — not here.
   *
   * Before `createInstance`, {@link AcApDocManager.checkWebworkerReadiness} verifies
   * that worker scripts respond without downloading large bundles (HEAD + ranged GET fallback).
   * DXF parsing uses the built-in converter in `@mlightcad/data-model` and needs no worker file.
   *
   * Idempotent: subsequent calls are no-ops once {@link CadViewerApp.isInitialized} is true.
   *
   * @param useMainThreadDraw - When `true`, MTEXT is rendered on the main thread instead of a worker
   * @returns `true` when the viewer is ready; `false` when worker checks or init failed
   * @remarks On failure, logs to the console and shows an error toast via {@link CadViewerApp.showMessage}.
   */
  private async initialize(useMainThreadDraw: boolean): Promise<boolean> {
    if (this.isInitialized) {
      return true
    }

    try {
      // Prefer the shared preload promise so first open awaits in-flight work
      await preloadViewerAppModules(this.enablePlugins)
      const { AcApDocManager, AcEdCommandStack, acedApplyUiTheme } =
        await loadCadSimpleViewer()
      this.DocManager = AcApDocManager

      acedApplyUiTheme('dark', this.viewerPane)

      // Dynamic import keeps LibreDWG / data-model out of the app entry until first open.
      const { registerLibreDwgConverter } = await import('./registerLibreDwg')
      registerLibreDwgConverter(String(WEBWORKER_FILE_URLS.dwgParser))

      // 단일 HTML 빌드: 워커가 Blob URL 이라 HTTP 도달성 체크가 무의미(그리고 실패)하므로 건너뛴다.
      if (!IS_SINGLE_FILE_BUILD) {
        const workersReachable = await AcApDocManager.checkWebworkerReadiness(
          WEBWORKER_FILE_URLS
        )
        if (!workersReachable) {
          console.error(
            'CAD worker scripts are missing or blocked:',
            WEBWORKER_FILE_URLS
          )
          this.showMessage(
            'CAD 워커 스크립트를 찾을 수 없습니다. assets/ 폴더가 함께 있는지 확인하세요.',
            'error'
          )
          return false
        }
      }

      AcApDocManager.createInstance({
        container: this.container,
        busyIndicatorHost: this.viewerPane,
        autoResize: true,
        baseUrl: IS_SINGLE_FILE_BUILD
          ? OFFLINE_BASE_URL
          : 'https://cdn.jsdelivr.net/gh/mlightcad/cad-data@main/',
        webworkerFileUrls: WEBWORKER_FILE_URLS,
        checkWorkersOnInit: !IS_SINGLE_FILE_BUILD,
        useMainThreadDraw
      })

      const docManager = AcApDocManager.instance

      // 단일 HTML(오프라인): 기본 폰트 프리셋(simsun/hztxt = 대용량 CJK)을
      // 내장한 경량 SHX 세트로 교체. 없는 폰트는 romans 로 폴백된다.
      if (IS_SINGLE_FILE_BUILD) {
        try {
          const { FontManager } = await import('@mlightcad/mtext-renderer')
          FontManager.instance.setDefaultFonts([
            'romans',
            'simplex',
            'whgtxt',
            'gbcbig'
          ])
        } catch (e) {
          console.warn('기본 폰트 세트 교체 실패(무시 가능):', e)
        }
      }

      docManager.events.workersReady.addEventListener(({ ready }) => {
        if (!ready) {
          console.error('CAD worker scripts are not reachable')
          this.showMessage('CAD 워커에 접근할 수 없습니다', 'error')
        }
      })

      docManager.events.documentToBeOpened.addEventListener(() => {
        this.setUploadLoading(true)
      })

      const { initializeLocale, applyKoreanUiLabels } = await import('./i8n')
      initializeLocale()
      await this.registerCommands(AcEdCommandStack)

      if (this.enablePlugins) {
        // Dynamic import keeps plugin `/register` stubs out of the bare-viewer entry
        const { registerPlugins } = await import('./register')
        await registerPlugins(this.viewerPane)
        // 플러그인이 등록한 영어 툴바 문구를 한국어로 덮어쓰고 툴바를 새로고침.
        applyKoreanUiLabels()
      }

      docManager.events.documentActivated.addEventListener(args => {
        document.title = args.doc.docTitle
        if (this.hasOpenedFile) {
          this.showReopenButton()
        }
      })

      this.isInitialized = true
      this.initUseMainThreadDraw = useMainThreadDraw
      return true
    } catch (error) {
      console.error('뷰어 초기화 실패:', error)
      this.showMessage('뷰어 초기화에 실패했습니다', 'error')
      return false
    }
  }

  /**
   * Registers example custom commands on the system command group.
   *
   * Currently adds `ellipsedemo` ({@link AcApEllipseCmd}) for interactive ellipse creation.
   *
   * @param AcEdCommandStack - Command stack class from the loaded viewer module
   * @remarks Must run after {@link CadViewerApp.initialize} so `commandManager` exists.
   */
  private async registerCommands(
    AcEdCommandStack: (typeof import('@mlightcad/cad-simple-viewer'))['AcEdCommandStack']
  ): Promise<void> {
    const { AcApEllipseCmd } = await import('./ellipseCmd')
    const register = this.requireDocManager().instance.commandManager
    register.addCommand(
      AcEdCommandStack.SYSTEMT_COMMAND_GROUP_NAME,
      'ellipsedemo',
      'ellipsedemo',
      new AcApEllipseCmd()
    )
  }

  /**
   * Returns the cached `AcApDocManager` class after successful initialization.
   */
  private requireDocManager(): typeof AcApDocManager {
    if (!this.DocManager) {
      throw new Error('CAD viewer is not initialized')
    }
    return this.DocManager
  }

  /**
   * Attaches drag-and-drop, keyboard, and `change` listeners for local file open.
   *
   * Clears the hidden file input value after each selection so the same file can be chosen again.
   */
  private setupFileHandling(): void {
    this.uploadDropzone.addEventListener('click', () => {
      this.fileInput.click()
    })

    this.uploadDropzone.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        this.fileInput.click()
      }
    })

    this.uploadDropzone.addEventListener('dragover', event => {
      event.preventDefault()
      this.uploadDropzone.classList.add('is-dragover')
    })

    this.uploadDropzone.addEventListener('dragleave', () => {
      this.uploadDropzone.classList.remove('is-dragover')
    })

    this.uploadDropzone.addEventListener('drop', event => {
      event.preventDefault()
      this.uploadDropzone.classList.remove('is-dragover')
      const file = event.dataTransfer?.files?.[0]
      if (file) {
        void this.loadFile(file)
      }
    })

    this.fileInput.addEventListener('change', event => {
      const file = (event.target as HTMLInputElement).files?.[0]
      if (file) {
        void this.loadFile(file)
      }
      this.fileInput.value = ''
    })
  }

  /**
   * Creates a blank drawing when the upload-screen **New Drawing** button is clicked.
   */
  private setupNewDrawingHandling(): void {
    this.newDrawingButton.addEventListener('click', () => {
      void this.createNewDrawing()
    })
  }

  /**
   * Runs the built-in **OPEN** command when the corner **Open** button is clicked.
   */
  private setupReopenHandling(): void {
    this.reopenButton.addEventListener('click', () => {
      if (!this.isInitialized) {
        return
      }
      this.requireDocManager().instance.sendStringToExecute('open')
    })
  }

  /**
   * Initializes the viewer (if needed) and creates a blank document with the
   * current upload-screen open options.
   */
  private async createNewDrawing(): Promise<void> {
    const openOptions = this.readOpenOptions()

    if (
      this.isInitialized &&
      openOptions.useMainThreadDraw !== this.initUseMainThreadDraw
    ) {
      this.showMessage(
        '텍스트 렌더링 모드는 첫 로드 시 적용됩니다. 변경하려면 페이지를 새로고침하세요.',
        'info'
      )
    }

    if (!(await this.initialize(openOptions.useMainThreadDraw))) {
      return
    }

    this.clearMessages()

    try {
      const options: AcApOpenDatabaseOptions = {
        mode: openOptions.mode,
        drawNoPlotLayers: openOptions.drawNoPlotLayers,
        progressiveRendering: openOptions.progressiveRendering,
        ...(openOptions.openViewMode != null
          ? { openViewMode: openOptions.openViewMode }
          : {})
      }

      const success = await this.requireDocManager().instance.newDocument(options)

      if (success) {
        this.hideUploadScreen()
        this.showMessage('새 도면을 만들었습니다', 'success')
      } else {
        this.showUploadScreen()
        this.showMessage('새 도면 만들기에 실패했습니다', 'error')
      }
    } catch (error) {
      console.error('Error creating new drawing:', error)
      this.showUploadScreen()
      this.showMessage(`새 도면 오류: ${error}`, 'error')
    }
  }

  /**
   * Hides the upload overlay while a document is opening so the viewer loading indicator is visible.
   *
   * Triggered from the `documentToBeOpened` event and when {@link CadViewerApp.loadFile}
   * begins opening a file.
   *
   * @param loading - When `true`, hides the upload screen
   */
  private setUploadLoading(loading: boolean): void {
    if (loading) {
      this.uploadScreen.classList.add('is-hidden')
    }
  }

  /**
   * Restores the full upload screen (home page) after a failed open from the upload flow.
   */
  private showUploadScreen(): void {
    this.uploadScreen.classList.remove('is-hidden')
    this.reopenButton.classList.remove('is-visible')
  }

  /**
   * Shows the compact corner **Open** button while keeping the upload screen hidden.
   */
  private showReopenButton(): void {
    this.uploadScreen.classList.add('is-hidden')
    this.reopenButton.classList.add('is-visible')
  }

  /**
   * Hides the upload screen and shows the compact corner **Open** button after a successful load.
   */
  private hideUploadScreen(): void {
    this.hasOpenedFile = true
    this.showReopenButton()
  }

  /**
   * Reads a local file, validates extension, and opens it in the viewer.
   *
   * Flow:
   * 1. {@link CadViewerApp.readOpenOptions} → {@link CadViewerApp.initialize}
   * 2. Reject non-`.dxf` / non-`.dwg` names with an error toast
   * 3. Hide the upload screen via `documentToBeOpened` while the viewer shows its loading indicator
   * 4. {@link CadViewerApp.readFile} → `openDocument` with upload-screen options
   * 5. On success, {@link CadViewerApp.hideUploadScreen} and a success toast; on failure, {@link CadViewerApp.showUploadScreen}
   *
   * @param file - User-selected file from the file input or drop zone
   */
  private async loadFile(file: File): Promise<void> {
    const openOptions = this.readOpenOptions()

    if (
      this.isInitialized &&
      openOptions.useMainThreadDraw !== this.initUseMainThreadDraw
    ) {
      this.showMessage(
        '텍스트 렌더링 모드는 첫 로드 시 적용됩니다. 변경하려면 페이지를 새로고침하세요.',
        'info'
      )
    }

    if (!(await this.initialize(openOptions.useMainThreadDraw))) {
      return
    }

    const fileName = file.name.toLowerCase()
    // DWT(도면 템플릿)는 DWG 와 내부 포맷이 동일 → DWG 로 취급.
    const isTemplate = fileName.endsWith('.dwt')
    if (
      !fileName.endsWith('.dxf') &&
      !fileName.endsWith('.dwg') &&
      !isTemplate
    ) {
      this.showMessage('DWG, DXF 또는 DWT 파일을 선택하세요.', 'error')
      return
    }
    const openName = isTemplate
      ? file.name.replace(/\.dwt$/i, '.dwg')
      : file.name

    this.clearMessages()

    try {
      const docManager = this.requireDocManager().instance
      if (!IS_SINGLE_FILE_BUILD && !(await docManager.areWorkersReady())) {
        this.showMessage(
          'CAD 워커 스크립트에 접근할 수 없습니다. assets/*-worker.js 배포를 확인하세요.',
          'error'
        )
        return
      }

      const fileContent = await this.readFile(file)

      const options: AcApOpenDatabaseOptions = {
        minimumChunkSize: 1000,
        mode: openOptions.mode,
        drawNoPlotLayers: openOptions.drawNoPlotLayers,
        progressiveRendering: openOptions.progressiveRendering,
        ...(openOptions.openViewMode != null
          ? { openViewMode: openOptions.openViewMode }
          : {})
      }

      const success = await docManager.openDocument(
        openName,
        fileContent,
        options
      )

      if (success) {
        this.hideUploadScreen()
        this.showMessage(`불러오기 완료: ${file.name}`, 'success')
      } else {
        this.showUploadScreen()
        this.showMessage(this.loadFailureHint(fileName), 'error')
      }
    } catch (error) {
      console.error('Error loading file:', error)
      this.showUploadScreen()
      const isDwg = fileName.endsWith('.dwg') || fileName.endsWith('.dwt')
      if (isDwg && this.looksLikeWorkerFailure(error)) {
        this.showMessage(this.loadFailureHint(fileName), 'error')
      } else {
        this.showMessage(`불러오기 오류: ${error}`, 'error')
      }
    }
  }

  /** 워커 생성/실행 실패로 보이는 오류인지. */
  private looksLikeWorkerFailure(error: unknown): boolean {
    const s = String(
      (error as { message?: string })?.message ?? error
    ).toLowerCase()
    return (
      s.includes('worker') ||
      s.includes("origin 'null'") ||
      s.includes('securityerror') ||
      s.includes('can run in web worker only')
    )
  }

  /** DWG 불러오기 실패 시 원인에 맞춘 안내 문구. */
  private loadFailureHint(fileNameLower: string): string {
    const isDwg =
      fileNameLower.endsWith('.dwg') || fileNameLower.endsWith('.dwt')
    if (isDwg && location.protocol === 'file:') {
      return (
        'DWG 를 열지 못했습니다. 이 HTML 을 더블클릭으로 열면 브라우저가 DWG 변환기(Web Worker)를 차단합니다. ' +
        "같은 폴더의 '도면뷰어_열기.bat' 으로 실행하거나 사내 서버에 올려 사용하세요."
      )
    }
    if (isDwg) {
      return (
        'DWG 변환에 실패했습니다. 브라우저가 최신 Edge/Chrome 인지 확인하고, ' +
        '그래도 안 되면 파일이 손상되었거나 지원되지 않는 형식일 수 있습니다.'
      )
    }
    return '파일을 불러오지 못했습니다. 파일이 손상되었거나 지원되지 않는 형식일 수 있습니다.'
  }

  /**
   * Reads a `File` as raw binary via `FileReader.readAsArrayBuffer`.
   *
   * @param file - Browser `File` object from the file picker or drop zone
   * @returns Promise that resolves to the file contents as `ArrayBuffer`
   * @throws Rejects with the `FileReader` error if reading fails
   */
  private readFile(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as ArrayBuffer)
      reader.onerror = () => reject(reader.error)
      reader.readAsArrayBuffer(file)
    })
  }

  /**
   * Shows a short-lived centered toast at the top of the viewport.
   *
   * Replaces any existing `.popup-message` elements before creating a new one.
   * Fades out after ~1s and removes the node from the DOM.
   *
   * @param message - Text shown to the user
   * @param type - Controls background and border colors (`success`, `error`, or `info`)
   */
  private showMessage(message: string, type: MessageType = 'info'): void {
    this.clearMessages()

    const popup = document.createElement('div')
    popup.className = `popup-message ${type}`
    popup.textContent = message
    popup.style.position = 'fixed'
    popup.style.top = '2rem'
    popup.style.left = '50%'
    popup.style.transform = 'translateX(-50%)'
    popup.style.zIndex = '1000'
    popup.style.padding = '1rem 2rem'
    popup.style.borderRadius = '8px'
    popup.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)'
    popup.style.fontSize = '1.05rem'
    popup.style.lineHeight = '1.5'
    popup.style.maxWidth = 'min(680px, 90vw)'
    popup.style.textAlign = 'center'
    popup.style.opacity = '0.98'
    popup.style.transition = 'opacity 0.2s'
    if (type === 'error') {
      popup.style.background = '#ffe6e6'
      popup.style.color = '#dc3545'
      popup.style.border = '1px solid #ffcccc'
    } else if (type === 'success') {
      popup.style.background = '#e6ffe6'
      popup.style.color = '#28a745'
      popup.style.border = '1px solid #ccffcc'
    } else {
      popup.style.background = '#f0f0f0'
      popup.style.color = '#333'
      popup.style.border = '1px solid #ccc'
    }

    document.body.appendChild(popup)

    // 오류 안내는 읽을 시간이 필요하므로 길게 유지하고, 클릭하면 즉시 닫힌다.
    const holdMs = type === 'error' ? 9000 : 1000
    popup.style.cursor = 'pointer'
    popup.title = '클릭하면 닫힙니다'
    const dismiss = () => {
      popup.style.opacity = '0'
      setTimeout(() => popup.parentNode?.removeChild(popup), 200)
    }
    popup.addEventListener('click', dismiss)
    setTimeout(dismiss, holdMs)
  }

  /**
   * Removes all in-flight toast elements (class `popup-message`) from `document.body`.
   */
  private clearMessages(): void {
    document.querySelectorAll('.popup-message').forEach(el => el.remove())
  }
}

/**
 * Starts {@link CadViewerApp} once the DOM is ready.
 *
 * @param options - Passed to {@link CadViewerApp}
 */
export function bootCadViewerApp(options: CadViewerAppOptions = {}): void {
  const start = () => {
    new CadViewerApp(options)
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start)
  } else {
    start()
  }
}
