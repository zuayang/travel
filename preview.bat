@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Travel Journal - Local Preview
set "NODEEXE="
for /d %%D in ("..\*") do if exist "%%D\runtime\node.exe" set "NODEEXE=%%D\runtime\node.exe"
if not defined NODEEXE set "NODEEXE=node"
"%NODEEXE%" "%~dp0tools\preview.mjs" %*
echo.
pause
