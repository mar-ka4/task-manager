@echo off
echo ========================================
echo Исправление Tailwind CSS
echo ========================================
echo.

REM Отключаем offline режим
set npm_config_offline=
set NPM_CONFIG_OFFLINE=

echo Удаление старой версии Tailwind CSS v4...
call npm uninstall tailwindcss

echo.
echo Ожидание 2 секунды...
timeout /t 2 /nobreak >nul

echo.
echo Установка Tailwind CSS v3.4.1...
call npm install tailwindcss@3.4.1 --legacy-peer-deps --no-offline --save-exact

echo.
echo ========================================
if %errorlevel% equ 0 (
    echo Успешно! Tailwind CSS v3 установлен.
    echo Перезапустите проект командой: npm run dev:all
) else (
    echo ОШИБКА при установке. Попробуйте вручную:
    echo   npm uninstall tailwindcss
    echo   npm install tailwindcss@3.4.1 --legacy-peer-deps
)
echo ========================================
pause
