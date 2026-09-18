$processes = Get-Process -Name "kurokage-bot" -ErrorAction SilentlyContinue

if (-not $processes) {
  Write-Host "Kurokage nao esta rodando."
  exit 0
}

$processes | Stop-Process -Force
Write-Host "Kurokage parado. PID(s): $($processes.Id -join ', ')"
