@echo off
cd /d "%~dp0"

set "NODE_EXE="

where node >nul 2>nul
if %errorlevel%==0 (
  for /f "delims=" %%N in ('where node') do (
    if not defined NODE_EXE set "NODE_EXE=%%N"
  )
)

if not defined NODE_EXE (
  set "CODEX_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
  if exist "%CODEX_NODE%" set "NODE_EXE=%CODEX_NODE%"
)

if not defined NODE_EXE (
  echo Nao encontrei o Node.js neste Windows.
  echo Instale Node.js ou abra este projeto pelo Codex para usar o runtime embutido.
  pause
  exit /b 1
)

start "" "http://localhost:8787"
"%NODE_EXE%" scanner-server.js
pause
