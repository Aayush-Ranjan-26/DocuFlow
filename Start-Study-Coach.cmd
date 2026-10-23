@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 22.13 or newer from https://nodejs.org/
  pause
  exit /b 1
)
if not exist node_modules call npm ci
if errorlevel 1 exit /b 1
echo Open http://127.0.0.1:4317 after the server starts.
echo Start-Local-AI.cmd or Ollama must be running with qwen2.5:1.5b.
call npm start
pause
