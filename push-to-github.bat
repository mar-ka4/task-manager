@echo off
chcp 65001 >nul
cd /d "%~dp0"

set "GIT_SSL_BACKEND=openssl"
set "http_proxy="
set "https_proxy="

"C:\Program Files\Git\cmd\git.exe" config http.sslBackend openssl
"C:\Program Files\Git\cmd\git.exe" remote set-url origin https://mar-ka4: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@github.com/mar-ka4/task-manager.git

echo Отправка кода в GitHub...
"C:\Program Files\Git\cmd\git.exe" push -u origin main

if errorlevel 1 (
    echo.
    echo ОШИБКА при отправке!
    pause
) else (
    echo.
    echo Успешно! Код загружен в GitHub!
    pause
)
