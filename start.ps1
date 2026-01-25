# Скрипт для запуска проекта

Write-Host "Запуск Task Manager..." -ForegroundColor Green

# Удаляем переменную окружения offline
$env:npm_config_offline = $null
Remove-Item Env:npm_config_offline -ErrorAction SilentlyContinue

# Запускаем оба сервера
Write-Host "`nЗапуск Frontend и Backend..." -ForegroundColor Yellow
npm run dev:all
