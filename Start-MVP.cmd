@echo off
setlocal
cd /d "%~dp0"
echo ARTISTRY MVP - Open http://127.0.0.1:4173 in your browser.
echo Other devices on the same network can use this computer's LAN IP on port 4173.
echo Keep this window open. Press Ctrl+C to stop.
where node >nul 2>nul
if %errorlevel% equ 0 (
  node server.mjs
) else (
  if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" (
    "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" server.mjs
  ) else (
    echo Node.js 22 or later is required. Install it and try again.
  )
)
pause
