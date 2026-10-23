@echo off
cd /d "%~dp0"
if not exist .runtime\llama-server.exe (
  echo Run Setup-Local-AI.ps1 first, or use an existing local Ollama installation.
  pause
  exit /b 1
)
.runtime\llama-server.exe -m .runtime\qwen2.5-1.5b-instruct-q4_k_m.gguf --host 127.0.0.1 --port 11434 --alias qwen2.5:1.5b -c 8192 -np 1 -t 6 --no-webui --api-key-file .runtime\key.txt --cors-origins http://127.0.0.1:4317,http://localhost:4317 --no-cors-credentials
pause
