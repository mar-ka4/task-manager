# Скрипт для настройки SSH и отправки кода в GitHub
# Это решение обходит проблему с git-remote-https.exe

Write-Host "=== Настройка SSH для GitHub ===" -ForegroundColor Green
Write-Host ""

$sshKeyPath = "$env:USERPROFILE\.ssh\id_ed25519"
$sshPubKeyPath = "$env:USERPROFILE\.ssh\id_ed25519.pub"

# Шаг 1: Проверка существующего SSH ключа
if (Test-Path $sshPubKeyPath) {
    Write-Host "SSH ключ уже существует!" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Ваш публичный ключ:" -ForegroundColor Cyan
    Get-Content $sshPubKeyPath
    Write-Host ""
} else {
    Write-Host "Создание нового SSH ключа..." -ForegroundColor Yellow
    Write-Host "Нажмите Enter для всех вопросов (или укажите пароль)" -ForegroundColor Gray
    Write-Host ""
    
    ssh-keygen -t ed25519 -C "mar-ka4@github" -f $sshKeyPath -N '""'
    
    if (Test-Path $sshPubKeyPath) {
        Write-Host ""
        Write-Host "SSH ключ создан!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Ваш публичный ключ (скопируйте его):" -ForegroundColor Cyan
        Write-Host "========================================" -ForegroundColor Gray
        Get-Content $sshPubKeyPath
        Write-Host "========================================" -ForegroundColor Gray
        Write-Host ""
        
        # Копируем в буфер обмена
        Get-Content $sshPubKeyPath | Set-Clipboard
        Write-Host "Ключ скопирован в буфер обмена!" -ForegroundColor Green
    } else {
        Write-Host "ОШИБКА: Не удалось создать SSH ключ" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "=== Инструкции ===" -ForegroundColor Green
Write-Host "1. Перейдите на: https://github.com/settings/keys" -ForegroundColor Yellow
Write-Host "2. Нажмите 'New SSH key'" -ForegroundColor Yellow
Write-Host "3. Вставьте скопированный ключ (уже в буфере обмена)" -ForegroundColor Yellow
Write-Host "4. Нажмите 'Add SSH key'" -ForegroundColor Yellow
Write-Host ""
$response = Read-Host "После добавления ключа на GitHub, нажмите Enter для продолжения"

# Шаг 2: Изменение URL репозитория на SSH
Write-Host ""
Write-Host "Изменение URL репозитория на SSH..." -ForegroundColor Yellow
Set-Location $PSScriptRoot
& "C:\Program Files\Git\cmd\git.exe" remote set-url origin git@github.com:mar-ka4/task-manager.git

Write-Host "URL изменен на SSH" -ForegroundColor Green
Write-Host ""

# Шаг 3: Проверка подключения к GitHub
Write-Host "Проверка SSH подключения к GitHub..." -ForegroundColor Yellow
$testResult = ssh -T git@github.com 2>&1
if ($LASTEXITCODE -eq 1 -and $testResult -match "successfully authenticated") {
    Write-Host "SSH подключение работает!" -ForegroundColor Green
} else {
    Write-Host "Предупреждение: $testResult" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Отправка кода в GitHub..." -ForegroundColor Yellow
& "C:\Program Files\Git\cmd\git.exe" push -u origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Успешно! Код загружен в GitHub!" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "ОШИБКА при отправке. Проверьте:" -ForegroundColor Red
    Write-Host "1. Добавлен ли SSH ключ на GitHub" -ForegroundColor Yellow
    Write-Host "2. Правильность URL репозитория" -ForegroundColor Yellow
}

Write-Host ""
Read-Host "Нажмите Enter для выхода"
