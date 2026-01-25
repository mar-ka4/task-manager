# Исправление ошибки Tailwind CSS

## Проблема
Ошибка: `It looks like you're trying to use tailwindcss directly as a PostCSS plugin`

Причина: Установлена Tailwind CSS v4, которая требует отдельный пакет `@tailwindcss/postcss`, но проект настроен на v3.

## Решение

### Автоматическое исправление (РЕКОМЕНДУЕТСЯ)

**Двойной клик на файл `fix-tailwind-final.bat`**

Этот скрипт:
1. Удалит Tailwind CSS v4
2. Установит Tailwind CSS v3.4.1
3. Обновит package.json

### Ручное исправление

Откройте **CMD** (не PowerShell!) и выполните:

```cmd
cd c:\Users\RAZER\Desktop\task-manager
set npm_config_offline=
npm uninstall tailwindcss
npm install tailwindcss@3.4.1 --legacy-peer-deps --save-exact
```

## После исправления

1. **Перезапустите проект:**
   ```cmd
   npm run dev:all
   ```
   или двойной клик на `run.bat`

2. **Проверьте, что ошибка исчезла**

3. **Откройте браузер:** http://localhost:3000

## Проверка версии

Чтобы проверить установленную версию:
```cmd
npm list tailwindcss
```

Должно показать: `tailwindcss@3.4.1`

## Что было изменено

✅ `package.json` - версия изменена на `3.4.1` (без ^)  
✅ `postcss.config.mjs` - использует стандартный плагин `tailwindcss`  
✅ Создан скрипт `fix-tailwind-final.bat` для автоматического исправления

## Если проблема сохраняется

1. Удалите папку `node_modules`:
   ```cmd
   rmdir /s /q node_modules
   ```

2. Удалите `package-lock.json`:
   ```cmd
   del package-lock.json
   ```

3. Переустановите все зависимости:
   ```cmd
   npm install --legacy-peer-deps
   ```
