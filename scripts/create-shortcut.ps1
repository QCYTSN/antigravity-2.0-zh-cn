$ErrorActionPreference = 'Stop'
$ProjectDir = Split-Path -Parent $PSScriptRoot
$VbsPath = Join-Path $PSScriptRoot 'launcher-hidden.vbs'
$DesktopDir = [Environment]::GetFolderPath('Desktop')
$ShortcutPath = Join-Path $DesktopDir 'Antigravity 2.0 中文版.lnk'

# 尝试探测原版 Antigravity.exe 图标
$IconPath = $null
$Candidates = @(
  (Join-Path $env:LOCALAPPDATA 'Programs\Antigravity\Antigravity.exe'),
  (Join-Path $env:LOCALAPPDATA 'Antigravity\Antigravity.exe'),
  (Join-Path $env:LOCALAPPDATA 'Google\Antigravity\Antigravity.exe'),
  (Join-Path $env:ProgramFiles 'Antigravity\Antigravity.exe')
)

$ConfigFile = Join-Path $ProjectDir 'config.json'
if (Test-Path $ConfigFile) {
  try {
    $cfg = Get-Content $ConfigFile -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($cfg.exePath -and (Test-Path $cfg.exePath)) {
      $IconPath = $cfg.exePath
    }
  } catch {}
}

if (-not $IconPath) {
  foreach ($c in $Candidates) {
    if ($c -and (Test-Path $c)) {
      $IconPath = $c
      break
    }
  }
}

$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = 'wscript.exe'
$Shortcut.Arguments = "`"$VbsPath`""
$Shortcut.WorkingDirectory = $ProjectDir
$Shortcut.Description = '启动 Google Antigravity 2.0（无损动态中文汉化）'
if ($IconPath) {
  $Shortcut.IconLocation = "$IconPath,0"
}
$Shortcut.Save()

Write-Host "[成功] 已在桌面创建快捷方式：$ShortcutPath" -ForegroundColor Green
if ($IconPath) {
  Write-Host "[图标] 已绑定官方图标：$IconPath" -ForegroundColor Cyan
} else {
  Write-Host "[提示] 未自动检测到 Antigravity.exe，使用默认图标（可先在 config.json 配置 exePath 后重新运行）。" -ForegroundColor Yellow
}
