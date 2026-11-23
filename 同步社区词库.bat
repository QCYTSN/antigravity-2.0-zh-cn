@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo [Antigravity 2.0 词库同步] 正在从上游 MIT 社区仓库拉取最新词库...
node scripts\sync-upstream-dict.mjs
echo.
pause
