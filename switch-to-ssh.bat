@echo off
chcp 65001 >nul
echo ========================================
echo Переключение на SSH (обход ошибки git-remote-https.exe)
echo ========================================
echo.

cd /d "%~dp0"

echo Шаг 1: Изменение URL репозитория на SSH...
"C:\Program Files\Git\cmd\git.exe" remote set-url origin git@github.com:mar-ka4/task-manager.git

echo.
echo Шаг 2: Проверка текущего URL...
"C:\Program Files\Git\cmd\git.exe" remote -v

echo.
echo ========================================
echo ВАЖНО: Перед отправкой кода нужно:
echo ========================================
echo 1. Создать SSH ключ (если еще нет):
echo    Откройте Git Bash и выполните:
echo    ssh-keygen -t ed25519 -C "mar-ka4@github"
echo    (нажмите Enter 3 раза)
echo.
echo 2. Скопировать публичный ключ:
echo    cat ~/.ssh/id_ed25519.pub
echo.
echo 3. Добавить ключ на GitHub:
echo    https://github.com/settings/keys
echo.
echo 4. После добавления ключа выполните:
echo    git push -u origin main
echo.
pause
