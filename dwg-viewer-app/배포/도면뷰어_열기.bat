@echo off
rem DWG / DXF viewer - local launcher (no install, Windows 10/11)
rem Keep this file, viewer-server.ps1 and the DWG viewer .html in one folder,
rem then double-click this file. Close the console window to stop.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0viewer-server.ps1"
if errorlevel 1 pause
