@echo off
chcp 65001 >nul
cd /d "%~dp0"
set "NODEEXE="
for /d %%D in ("..\..\*") do if exist "%%D\runtime\node.exe" set "NODEEXE=%%D\runtime\node.exe"
if not defined NODEEXE set "NODEEXE=node"
"%NODEEXE%" "%~dp0sync.mjs" %*
echo.
pause
