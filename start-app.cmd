@echo off
setlocal
cd /d "%~dp0"

set "NODE_DIR=%~dp0.tools\node-v22.12.0-win-x64"
set "PATH=%NODE_DIR%;%PATH%"

if not exist "%NODE_DIR%\node.exe" (
  echo Portable Node.js was not found in .tools.
  echo Please ask Codex to restore project tools.
  pause
  exit /b 1
)

if not exist "%~dp0node_modules" (
  call "%NODE_DIR%\npm.cmd" ci
  if errorlevel 1 (
    pause
    exit /b 1
  )
)

call "%NODE_DIR%\npm.cmd" run dev -- --host 127.0.0.1 --port 5173
