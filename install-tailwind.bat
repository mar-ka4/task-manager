@echo off
echo ========================================
echo Установка Tailwind CSS v3.4.1
echo ========================================
echo.

REM Отключаем offline режим
set npm_config_offline=
set NPM_CONFIG_OFFLINE=

echo Установка Tailwind CSS...
call npm install tailwindcss@3.4.1 --legacy-peer-deps --save-exact --force

echo.
echo ========================================
if %errorlevel% equ 0 (
    echo УСПЕШНО! Tailwind CSS установлен.
    echo.
    echo Проверка версии:
    call npm list tailwindcss
    echo.
    echo Теперь перезапустите проект: npm run dev:all
) else (
    echo ОШИБКА при установке.
    echo Убедитесь, что у вас есть интернет-соединение.
)
echo ========================================
pause
