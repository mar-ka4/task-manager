@echo off
echo ========================================
echo Остановка всех серверов Task Manager
echo ========================================
echo.

echo Поиск процессов на портах 3000 и 3001...
echo.

REM Находим и завершаем процессы на порту 3000
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000"') do (
    echo Завершение процесса %%a на порту 3000...
    taskkill /F /PID %%a >nul 2>&1
)

REM Находим и завершаем процессы на порту 3001
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001"') do (
    echo Завершение процесса %%a на порту 3001...
    taskkill /F /PID %%a >nul 2>&1
)

REM Завершаем все процессы node.exe (осторожно!)
echo.
echo Завершение процессов Node.js...
taskkill /F /IM node.exe >nul 2>&1
taskkill /F /IM ts-node-dev.exe >nul 2>&1

echo.
echo Очистка блокировок Next.js...
if exist ".next\dev\lock" del /f /q ".next\dev\lock" >nul 2>&1

echo.
echo ========================================
echo Готово! Все серверы остановлены.
echo Теперь можно запустить проект заново.
echo ========================================
timeout /t 3
