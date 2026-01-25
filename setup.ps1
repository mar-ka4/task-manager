# Скрипт для установки зависимостей и запуска проекта

Write-Host "Установка зависимостей..." -ForegroundColor Green

# Удаляем переменную окружения offline
$env:npm_config_offline = $null
Remove-Item Env:npm_config_offline -ErrorAction SilentlyContinue

# Устанавливаем зависимости фронтенда
Write-Host "`nУстановка зависимостей Frontend..." -ForegroundColor Yellow
npm install --no-offline

# Устанавливаем зависимости бэкенда
Write-Host "`nУстановка зависимостей Backend..." -ForegroundColor Yellow
cd backend
npm install --no-offline
cd ..

Write-Host "`nЗависимости установлены!" -ForegroundColor Green
Write-Host "`nДля запуска проекта используйте:" -ForegroundColor Cyan
Write-Host "  npm run dev:all" -ForegroundColor White
