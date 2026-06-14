$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot

$node = "C:\Users\ormmm\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if (-not (Test-Path -LiteralPath $node)) {
  $node = "node"
}

Write-Host "Starting SN Warranty System..." -ForegroundColor Cyan
Write-Host ""
Write-Host "Please keep this window open while testing." -ForegroundColor Yellow
Write-Host "Staff login:   http://localhost:3000"
Write-Host "Customer QR:   http://localhost:3000/?sn=YOUR_SN"
Write-Host ""

Start-Job -Name "sn-warranty-server" -ScriptBlock {
  param($nodePath, $workDir)
  Set-Location -LiteralPath $workDir
  & $nodePath server.js
} -ArgumentList $node, $PSScriptRoot | Out-Null

for ($i = 0; $i -lt 20; $i++) {
  try {
    Invoke-WebRequest -Uri "http://localhost:3000/" -UseBasicParsing -TimeoutSec 1 | Out-Null
    Start-Process "http://localhost:3000"
    Write-Host "System is ready. Browser opened." -ForegroundColor Green
    Write-Host "Press Enter to stop the system."
    Read-Host | Out-Null
    Stop-Job -Name "sn-warranty-server" -ErrorAction SilentlyContinue
    Remove-Job -Name "sn-warranty-server" -Force -ErrorAction SilentlyContinue
    exit
  } catch {
    Start-Sleep -Milliseconds 500
  }
}

Write-Host "Could not start the system. Error log:" -ForegroundColor Red
Receive-Job -Name "sn-warranty-server" -Keep
Write-Host "Press Enter to close."
Read-Host | Out-Null
