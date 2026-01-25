@echo off
chcp 65001 >nul
echo ========================================
echo Подключение проекта к GitHub
echo ========================================
echo.

cd /d "%~dp0"

echo Проверка Git...
git --version >nul 2>&1
if errorlevel 1 (
    echo ОШИБКА: Git не установлен!
    echo Установите Git с https://git-scm.com/download/win
    pause
    exit /b 1
)

echo Git найден!
echo.

echo Инициализация репозитория...
if not exist .git (
    git init
) else (
    echo Репозиторий уже инициализирован
)
echo.

echo Добавление файлов...
git add .
echo.

echo Создание коммита...
git commit -m "initial commit"
if errorlevel 1 (
    echo ВНИМАНИЕ: Возможно, нет изменений для коммита или коммит уже создан
)
echo.

echo Настройка ветки main...
git branch -M main
echo.

echo Добавление удаленного репозитория...
git remote remove origin 2>nul
git remote add origin https://github.com/mar-ka4/task-manager.git
echo.

echo Отправка в GitHub...
echo ВНИМАНИЕ: Вам может потребоваться ввести учетные данные GitHub!
git push -u origin main

if errorlevel 1 (
    echo.
    echo ОШИБКА при отправке. Проверьте:
    echo 1. Правильность URL репозитория
    echo 2. Наличие прав доступа к репозиторию
    echo 3. Правильность учетных данных GitHub
) else (
    echo.
    echo Успешно! Проект загружен в GitHub!
)

echo.
pause
