$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
New-Item -ItemType Directory -Path .runtime -Force | Out-Null
$taskRuntime = Join-Path $PSScriptRoot '.runtime'
$taskZip = Join-Path $taskRuntime 'runtime.zip'
$taskModel = Join-Path $taskRuntime 'qwen2.5-1.5b-instruct-q4_k_m.gguf'
$taskKey = Join-Path $taskRuntime 'key.txt'
if (-not (Test-Path -LiteralPath $taskKey)) {
  $taskRandom = New-Object byte[] 32
  $taskRng = [Security.Cryptography.RandomNumberGenerator]::Create()
  try { $taskRng.GetBytes($taskRandom) } finally { $taskRng.Dispose() }
  [IO.File]::WriteAllText($taskKey, [Convert]::ToBase64String($taskRandom))
}
Write-Host 'Downloading the official CPU runtime and 1.1 GB Qwen model. No account or payment required.'
if (-not (Test-Path -LiteralPath (Join-Path $taskRuntime 'llama-server.exe'))) {
  curl.exe -L --fail --show-error 'https://github.com/ggml-org/llama.cpp/releases/download/b11809/llama-b11809-bin-win-cpu-x64.zip' -o $taskZip
  if ($LASTEXITCODE -ne 0) { throw 'Runtime download failed; rerun setup.' }
  if ((Get-FileHash -LiteralPath $taskZip -Algorithm SHA256).Hash -ne 'EABEC16AF2B221639D865D17F7E3ED654E53DFE5F26FF7823B1F7010E6C90A1F') { throw 'Runtime hash mismatch.' }
  Expand-Archive -LiteralPath $taskZip -DestinationPath $taskRuntime -Force
}
if (-not (Test-Path -LiteralPath $taskModel) -or (Get-FileHash -LiteralPath $taskModel -Algorithm SHA256).Hash -ne '6A1A2EB6D15622BF3C96857206351BA97E1AF16C30D7A74EE38970E434E9407E') {
  curl.exe -L --fail --show-error 'https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf' -o $taskModel
  if ($LASTEXITCODE -ne 0) { throw 'Model download failed; rerun setup.' }
  if ((Get-FileHash -LiteralPath $taskModel -Algorithm SHA256).Hash -ne '6A1A2EB6D15622BF3C96857206351BA97E1AF16C30D7A74EE38970E434E9407E') { throw 'Model hash mismatch.' }
}
Write-Host 'Ready. Run Start-Local-AI.cmd, then Start-Study-Coach.cmd in a second window.'
