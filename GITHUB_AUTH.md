# Инструкция по аутентификации GitHub

## Текущий статус
✅ Git репозиторий инициализирован  
✅ Все файлы добавлены и закоммичены  
✅ Удаленный репозиторий подключен  
✅ Токен получен и настроен  
⚠️ Ошибка 403: Permission denied - требуется проверка прав токена или репозитория

## Способ 1: Personal Access Token (рекомендуется)

### Шаг 1: Создайте токен доступа

1. Перейдите по ссылке: **https://github.com/settings/personal-access-tokens/new**
   - Если ссылка не работает, попробуйте: https://github.com/settings/personal-access-tokens
   - Затем нажмите "Generate new token" → "Generate new token (classic)"

2. Настройте токен:
   - **Note**: Введите описание (например, "task-manager project")
   - **Expiration**: Выберите срок действия (рекомендуется 90 дней или custom)
   - **Scopes**: Отметьте `repo` (полный доступ к репозиториям)

3. Нажмите "Generate token" внизу страницы

4. **ВАЖНО**: Скопируйте токен сразу! Он показывается только один раз.

### Шаг 2: Отправьте код

Выполните в терминале:

```powershell
cd c:\Users\RAZER\Desktop\task-manager
git push -u origin main
```

При запросе:
- **Username**: ваш GitHub username (mar-ka4)
- **Password**: вставьте скопированный токен (НЕ ваш пароль GitHub!)

---

## Способ 2: Использовать SSH (альтернатива)

Если вы предпочитаете SSH вместо HTTPS:

### Шаг 1: Создайте SSH ключ (если еще нет)

```powershell
ssh-keygen -t ed25519 -C "your_email@example.com"
```

Нажмите Enter для всех вопросов (или укажите пароль для ключа).

### Шаг 2: Добавьте ключ в GitHub

1. Скопируйте публичный ключ:
```powershell
cat $env:USERPROFILE\.ssh\id_ed25519.pub
```

2. Перейдите на: https://github.com/settings/keys
3. Нажмите "New SSH key"
4. Вставьте скопированный ключ
5. Сохраните

### Шаг 3: Измените URL репозитория на SSH

```powershell
cd c:\Users\RAZER\Desktop\task-manager
git remote set-url origin git@github.com:mar-ka4/task-manager.git
git push -u origin main
```

---

## Способ 3: GitHub Desktop

Если у вас установлен GitHub Desktop:
1. Откройте GitHub Desktop
2. File → Add Local Repository
3. Выберите папку `c:\Users\RAZER\Desktop\task-manager`
4. Нажмите "Publish repository"

---

## Быстрая команда для отправки (после настройки токена)

```powershell
cd c:\Users\RAZER\Desktop\task-manager
git -c http.proxy= -c https.proxy= push -u origin main
```

---

## Полезные ссылки

- Создать токен: https://github.com/settings/personal-access-tokens/new
- Управление токенами: https://github.com/settings/personal-access-tokens
- SSH ключи: https://github.com/settings/keys
- Документация GitHub: https://docs.github.com/en/authentication
