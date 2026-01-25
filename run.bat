@echo off
echo ========================================
echo Запуск Task Manager
echo ========================================
echo.

REM Отключаем offline режим
set npm_config_offline=
set NPM_CONFIG_OFFLINE=

echo Остановка старых процессов...
REM Завершаем процессы на портах 3000 и 3001
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" 2^>nul') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001" 2^>nul') do taskkill /F /PID %%a >nul 2>&1

REM Очищаем блокировку Next.js
if exist ".next\dev\lock" del /f /q ".next\dev\lock" >nul 2>&1

echo.
echo Запуск Frontend и Backend...
call npm run dev:all
