@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo [Antigravity 2.0 无损中文汉化引擎] 正在热附着到已开启 CDP 端口的实例...
node src\index.mjs attach
if errorlevel 1 (
  echo.
  pause
)
