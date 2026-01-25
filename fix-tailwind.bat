@echo off
echo ========================================
echo Исправление Tailwind CSS
echo ========================================
echo.

REM Отключаем offline режим
set npm_config_offline=
set NPM_CONFIG_OFFLINE=

echo Удаление старой версии Tailwind CSS...
call npm uninstall tailwindcss

echo.
echo Установка Tailwind CSS v3...
call npm install tailwindcss@^3.4.1 --legacy-peer-deps --no-offline

echo.
echo ========================================
echo Готово! Теперь перезапустите проект.
echo ========================================
pause
