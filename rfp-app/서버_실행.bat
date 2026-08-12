@echo off
chcp 65001 >nul
cd /d "%~dp0"

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo Node.js가 설치되어 있지 않습니다. 지금 설치를 시작합니다.
    echo ^(관리자 권한 설치 창이 뜨면 "예"를 눌러주세요^)
    echo.
    winget install --id OpenJS.NodeJS.LTS -e --source winget --accept-package-agreements --accept-source-agreements
    if %errorlevel% neq 0 (
        echo.
        echo 자동 설치에 실패했습니다.
        echo https://nodejs.org 에서 LTS 버전을 직접 다운로드해 설치한 뒤,
        echo 컴퓨터를 재부팅하고 이 파일을 다시 실행해주세요.
        pause
        exit /b 1
    )
    echo.
    echo Node.js 설치가 완료되었습니다.
    echo 지금 막 설치했기 때문에 컴퓨터를 한 번 재부팅해야 정상 인식됩니다.
    echo 재부팅 후 이 파일을 다시 실행해주세요.
    pause
    exit /b 0
)

if not exist "node_modules" (
    echo 처음 실행이라 필요한 구성요소를 내려받습니다. 1~2분 정도 걸릴 수 있습니다...
    call npm install
    if %errorlevel% neq 0 (
        echo.
        echo 구성요소 설치에 실패했습니다. 인터넷 연결(사내망 프록시 등)을 확인해주세요.
        pause
        exit /b 1
    )
)

echo.
echo 정보화사업 제안요청서 초안 도우미를 실행합니다...
echo 잠시 후 브라우저가 자동으로 열립니다. ^(안 열리면 http://localhost:5175 로 직접 접속^)
echo 사용을 마치면 이 창을 닫으면 됩니다.
echo.
start "" "http://localhost:5175"
call npm start
pause
