@echo off
echo ========================================
echo Полное исправление Tailwind CSS
echo ========================================
echo.

REM Отключаем offline режим
set npm_config_offline=
set NPM_CONFIG_OFFLINE=

echo [1/4] Удаление старой версии Tailwind CSS v4...
call npm uninstall tailwindcss

echo.
echo [2/4] Удаление папки tailwindcss из node_modules...
if exist "node_modules\tailwindcss" (
    rmdir /s /q "node_modules\tailwindcss"
    echo Папка удалена.
) else (
    echo Папка не найдена.
)

echo.
echo [3/4] Ожидание 2 секунды...
timeout /t 2 /nobreak >nul

echo.
echo [4/4] Установка Tailwind CSS v3.4.1...
call npm install tailwindcss@3.4.1 --legacy-peer-deps --no-offline --save-exact --force

echo.
echo ========================================
if %errorlevel% equ 0 (
    echo УСПЕШНО! Tailwind CSS v3 установлен.
    echo.
    echo Проверка версии:
    call npm list tailwindcss
    echo.
    echo Теперь перезапустите проект: npm run dev:all
) else (
    echo ОШИБКА при установке.
    echo Попробуйте удалить весь node_modules и переустановить:
    echo   rmdir /s /q node_modules
    echo   npm install --legacy-peer-deps
)
echo ========================================
pause
