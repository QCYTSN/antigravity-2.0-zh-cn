@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo [Antigravity 2.0 无损中文汉化引擎] 正在启动...
node src\index.mjs launch
if errorlevel 1 (
  echo.
  pause
)
