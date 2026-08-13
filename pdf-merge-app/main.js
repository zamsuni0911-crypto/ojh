const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');

// 크로미움 엔진의 백그라운드 네트워크 통신(업데이트 확인, 안전 브라우징 등)을 차단
// - 이 프로그램은 파일을 어디로도 전송하지 않으며, 이 스위치들은 전부 크로미움/Electron
//   자체의 부가 네트워크 요청을 끄는 용도입니다.
app.commandLine.appendSwitch('disable-background-networking');
app.commandLine.appendSwitch('disable-component-update');
app.commandLine.appendSwitch('disable-domain-reliability');
app.commandLine.appendSwitch('disable-features', 'OptimizationHints,MediaRouter');

function createWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 900,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
    },
  });

  win.loadFile(path.join(__dirname, 'PDF_합본_도구.html'));

  win.webContents.session.on('will-download', (event, item) => {
    const defaultName = item.getFilename();
    const savePath = dialog.showSaveDialogSync(win, {
      title: '합본 파일 저장',
      defaultPath: defaultName,
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });
    if (savePath) {
      item.setSavePath(savePath);
    } else {
      item.cancel();
    }
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
