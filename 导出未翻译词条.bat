@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo [Antigravity 2.0 词条扫描器] 正在扫描当前界面尚未翻译的英文词条...
node src\index.mjs scan
echo.
pause
