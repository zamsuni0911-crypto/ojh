# DWG / DXF viewer - local static server (no install, Windows 10/11).
# Opening the single HTML via file:// can make the browser block the DWG
# parser Web Worker, so this serves it from localhost briefly instead.
# ASCII-only on purpose so it reads correctly under Windows PowerShell 5.1.
#
# Hardening notes:
#  - Binds to "localhost" only (loopback); never network-exposed.
#  - Ignores the request path: always returns the one bundled HTML, else 404.
#    No path traversal / arbitrary file disclosure is possible.
#  - Random high port each run (not a predictable fixed range).
#  - Sends nosniff / no-store / DENY-frame / no-referrer headers.

$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch { }

$dir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Definition }

$htmlFile = Get-ChildItem -LiteralPath $dir -Filter *.html -File |
            Sort-Object Length -Descending | Select-Object -First 1
if (-not $htmlFile) {
    Write-Host ''
    Write-Host '[ERROR] No .html file found in this folder.' -ForegroundColor Red
    Write-Host '        Put this script next to the DWG viewer HTML file.'
    exit 1
}

# Try random high ports so the endpoint is not predictable.
$listener = $null
$port     = 0
$rand     = [System.Random]::new()
for ($i = 0; $i -lt 40 -and -not $listener; $i++) {
    $p = $rand.Next(20000, 60000)
    try {
        $t = [System.Net.HttpListener]::new()
        $t.Prefixes.Add("http://localhost:$p/")
        $t.Start()
        $listener = $t
        $port = $p
    } catch {
        try { $t.Close() } catch { }
    }
}
if (-not $listener) {
    Write-Host 'Could not bind a local port after 40 attempts.' -ForegroundColor Red
    exit 1
}

$url   = "http://localhost:$port/"
$bytes = [System.IO.File]::ReadAllBytes($htmlFile.FullName)

Write-Host ''
Write-Host ("  DWG/DXF viewer running  ->  $url") -ForegroundColor Green
Write-Host ("  file: " + $htmlFile.Name) -ForegroundColor DarkGray
Write-Host '  Your browser opens automatically. Close this window to stop.' -ForegroundColor DarkGray
Write-Host ''

try { Start-Process $url } catch {
    Write-Host '  (Could not auto-open a browser. Open the URL above manually.)' -ForegroundColor Yellow
}

while ($listener.IsListening) {
    $ctx = $null
    try {
        $ctx = $listener.GetContext()
    } catch {
        break
    }
    try {
        $req = $ctx.Request
        $res = $ctx.Response
        $res.Headers.Add('Cache-Control', 'no-store')
        $res.Headers.Add('X-Content-Type-Options', 'nosniff')
        $res.Headers.Add('X-Frame-Options', 'DENY')
        $res.Headers.Add('Referrer-Policy', 'no-referrer')

        $method = $req.HttpMethod
        $path   = $req.Url.AbsolutePath

        if ($method -ne 'GET' -and $method -ne 'HEAD') {
            $res.StatusCode = 405
        }
        elseif ($path -eq '/' -or $path -match '\.html?$') {
            $res.ContentType = 'text/html; charset=utf-8'
            $res.ContentLength64 = $bytes.Length
            if ($method -eq 'GET') {
                $res.OutputStream.Write($bytes, 0, $bytes.Length)
            }
        }
        else {
            $res.StatusCode = 404
        }
    } catch {
    } finally {
        if ($ctx) { try { $ctx.Response.OutputStream.Close() } catch { } }
    }
}
