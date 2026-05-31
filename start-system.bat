@echo off
cd /d "%~dp0"
title SN Warranty System
echo Starting SN Warranty System...
echo.
echo Open this URL in your browser:
echo http://127.0.0.1:3000
echo.
echo Customer test page:
echo http://127.0.0.1:3000?customer=1
echo.
echo Keep this window open while using the system.
echo Press Ctrl+C to stop.
echo.
set "NODE_EXE=C:\Users\ormmm\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if exist "%NODE_EXE%" (
  start "" "http://127.0.0.1:3000"
  "%NODE_EXE%" server.js
) else (
  where node >nul 2>nul
  if errorlevel 1 (
    echo.
    echo ERROR: Cannot find Node.js.
    echo Please tell Codex to help install Node.js or use the bundled runtime.
    echo.
    pause
    exit /b 1
  )
  start "" "http://127.0.0.1:3000"
  node server.js
)
echo.
echo System stopped or failed to start.
pause
