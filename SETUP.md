# Инструкция по настройке Task Manager

## Быстрый старт

### 1. Установка зависимостей

```bash
# Установка зависимостей Frontend
npm install

# Установка зависимостей Backend
cd backend
npm install
cd ..
```

### 2. Настройка переменных окружения

**Файл `.env.local` (уже создан):**
```
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

**Файл `backend/.env` (уже создан с вашей строкой подключения Neon):**
```
DATABASE_URL=postgresql://neondb_owner:npg_HI0p3EXlaPhY@ep-divine-tooth-agbuem90-pooler.c-2.eu-central-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require
JWT_SECRET=your-secret-key-here-change-in-production
PORT=3001
FRONTEND_URL=http://localhost:3000
```

**⚠️ ВАЖНО:** Измените `JWT_SECRET` на случайную строку для безопасности!

### 3. Запуск проекта

**Вариант 1: Запуск обоих серверов одновременно**
```bash
npm run dev:all
```

**Вариант 2: Запуск отдельно**

Терминал 1 (Backend):
```bash
cd backend
npm run dev
```

Терминал 2 (Frontend):
```bash
npm run dev
```

### 4. Открытие приложения

Откройте браузер и перейдите на:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001

## Что уже настроено

✅ База данных PostgreSQL в Neon создана со всеми таблицами:
- users
- profiles
- projects
- project_members
- tasks
- task_content_items
- task_connections
- project_invites
- online_users

✅ Индексы и триггеры созданы

✅ Backend API готов:
- Аутентификация (регистрация, вход)
- Управление проектами
- Управление задачами
- WebSocket для realtime обновлений

✅ Frontend готов:
- Страницы входа и регистрации
- Страница списка проектов
- Страница доски задач

## Следующие шаги

1. **Измените JWT_SECRET** в `backend/.env` на безопасную случайную строку
2. Запустите проект командой `npm run dev:all`
3. Зарегистрируйте первого пользователя
4. Создайте проект и начните добавлять задачи

## Структура проекта

```
task-manager/
├── app/                    # Next.js App Router
│   ├── auth/              # Страницы аутентификации
│   ├── projects/          # Список проектов
│   └── board/             # Доска задач
├── backend/               # Backend API
│   └── src/
│       ├── routes/        # API маршруты
│       ├── middleware/    # Middleware
│       ├── db/            # Подключение к БД
│       └── websocket/    # WebSocket функции
└── lib/                   # Утилиты и API клиент
```

## Полезные команды

```bash
# Разработка (оба сервера)
npm run dev:all

# Только Frontend
npm run dev

# Только Backend
npm run server

# Сборка Frontend
npm run build

# Запуск продакшн версии Frontend
npm start
```

## Решение проблем

**Ошибка подключения к БД:**
- Проверьте строку подключения в `backend/.env`
- Убедитесь, что база данных Neon активна

**Ошибка CORS:**
- Проверьте `FRONTEND_URL` в `backend/.env`
- Убедитесь, что Frontend запущен на порту 3000

**WebSocket не работает:**
- Проверьте, что Backend запущен на порту 3001
- Проверьте `NEXT_PUBLIC_API_URL` в `.env.local`
