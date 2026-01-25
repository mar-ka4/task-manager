@echo off
echo ========================================
echo Установка зависимостей Task Manager
echo ========================================
echo.

REM Отключаем offline режим
set npm_config_offline=
set NPM_CONFIG_OFFLINE=

echo [1/2] Установка зависимостей Frontend...
call npm install --no-offline --legacy-peer-deps
if %errorlevel% neq 0 (
    echo ОШИБКА: Не удалось установить зависимости Frontend
    pause
    exit /b 1
)

echo.
echo [2/2] Установка зависимостей Backend...
cd backend
call npm install --no-offline --legacy-peer-deps
if %errorlevel% neq 0 (
    echo ОШИБКА: Не удалось установить зависимости Backend
    cd ..
    pause
    exit /b 1
)
cd ..

echo.
echo ========================================
echo Установка завершена успешно!
echo ========================================
echo.
echo Для запуска проекта используйте:
echo   npm run dev:all
echo.
pause
