# Скрипт для подключения проекта к GitHub репозиторию
# Выполните этот скрипт после установки Git

$ErrorActionPreference = "Stop"

Write-Host "Инициализация Git репозитория..." -ForegroundColor Green

# Переход в директорию проекта
Set-Location $PSScriptRoot

# Проверка наличия Git
try {
    $gitVersion = git --version
    Write-Host "Git найден: $gitVersion" -ForegroundColor Green
} catch {
    Write-Host "ОШИБКА: Git не установлен или не найден в PATH!" -ForegroundColor Red
    Write-Host "Пожалуйста, установите Git с https://git-scm.com/download/win" -ForegroundColor Yellow
    exit 1
}

# Инициализация репозитория (если еще не инициализирован)
if (-not (Test-Path .git)) {
    Write-Host "Инициализация нового Git репозитория..." -ForegroundColor Yellow
    git init
} else {
    Write-Host "Git репозиторий уже инициализирован" -ForegroundColor Green
}

# Добавление всех файлов
Write-Host "Добавление файлов в staging area..." -ForegroundColor Yellow
git add .

# Создание коммита
Write-Host "Создание начального коммита..." -ForegroundColor Yellow
git commit -m "initial commit"

# Переименование ветки в main (если нужно)
Write-Host "Настройка ветки main..." -ForegroundColor Yellow
git branch -M main

# Добавление удаленного репозитория
$remoteUrl = "https://github.com/mar-ka4/task-manager.git"
Write-Host "Добавление удаленного репозитория: $remoteUrl" -ForegroundColor Yellow

# Проверка, существует ли уже origin
$existingRemote = git remote get-url origin 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "Удаленный репозиторий 'origin' уже существует: $existingRemote" -ForegroundColor Yellow
    $response = Read-Host "Хотите заменить его? (y/n)"
    if ($response -eq "y" -or $response -eq "Y") {
        git remote set-url origin $remoteUrl
        Write-Host "Удаленный репозиторий обновлен" -ForegroundColor Green
    }
} else {
    git remote add origin $remoteUrl
    Write-Host "Удаленный репозиторий добавлен" -ForegroundColor Green
}

# Отправка в GitHub
Write-Host "Отправка кода в GitHub..." -ForegroundColor Yellow
Write-Host "ВНИМАНИЕ: Вам может потребоваться ввести учетные данные GitHub!" -ForegroundColor Cyan
git push -u origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nУспешно! Проект загружен в GitHub!" -ForegroundColor Green
} else {
    Write-Host "`nОШИБКА при отправке. Проверьте:" -ForegroundColor Red
    Write-Host "1. Правильность URL репозитория" -ForegroundColor Yellow
    Write-Host "2. Наличие прав доступа к репозиторию" -ForegroundColor Yellow
    Write-Host "3. Правильность учетных данных GitHub" -ForegroundColor Yellow
}
