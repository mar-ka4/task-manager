# Task Manager

Веб-приложение для управления задачами с визуальным канбан-доском, построенное на Next.js 16 и PostgreSQL (Neon).

## Технологии

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS
- **Backend**: Node.js, Express, TypeScript
- **База данных**: PostgreSQL (Neon)
- **Realtime**: Socket.io
- **Аутентификация**: JWT

## Установка

### 1. Установка зависимостей

```bash
# Frontend
npm install

# Backend
cd backend
npm install
```

### 2. Настройка переменных окружения

**Frontend** (`.env.local`):
```
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

**Backend** (`backend/.env`):
```
DATABASE_URL=postgresql://user:password@host:port/database
JWT_SECRET=your-secret-key-here
PORT=3001
FRONTEND_URL=http://localhost:3000
```

### 3. Запуск

**Разработка (оба сервера одновременно):**
```bash
npm run dev:all
```

**Или отдельно:**

Backend:
```bash
cd backend
npm run dev
```

Frontend:
```bash
npm run dev
```

## Структура проекта

```
task-manager/
├── app/                    # Next.js App Router
│   ├── auth/               # Страницы аутентификации
│   ├── projects/           # Список проектов
│   └── board/              # Доска задач
├── backend/                # Backend API
│   └── src/
│       ├── routes/         # API маршруты
│       ├── middleware/     # Middleware
│       └── db/             # Подключение к БД
├── lib/                    # Утилиты
│   ├── api/               # API клиент
│   ├── websocket.ts       # WebSocket клиент
│   └── types.ts           # TypeScript типы
└── components/            # React компоненты
```

## Функциональность

- ✅ Регистрация и вход пользователей
- ✅ Создание и управление проектами
- ✅ Визуальная доска задач с перетаскиванием
- ✅ Иерархические задачи
- ✅ Система участников проектов (owner, editor, viewer)
- ✅ Публичные/приватные проекты с кодами доступа
- ✅ Реалтайм синхронизация изменений
- ✅ Профили пользователей

## API Endpoints

### Auth
- `POST /api/auth/register` - Регистрация
- `POST /api/auth/login` - Вход
- `GET /api/auth/me` - Текущий пользователь

### Projects
- `GET /api/projects` - Список проектов
- `POST /api/projects` - Создать проект
- `GET /api/projects/:id` - Получить проект
- `PUT /api/projects/:id` - Обновить проект
- `DELETE /api/projects/:id` - Удалить проект
- `POST /api/projects/:id/generate-code` - Генерация кода доступа
- `POST /api/projects/join-by-code` - Присоединение по коду

### Tasks
- `GET /api/projects/:id/tasks` - Список задач
- `POST /api/projects/:id/tasks` - Создать задачу
- `PUT /api/tasks/:id` - Обновить задачу
- `DELETE /api/tasks/:id` - Удалить задачу

## База данных

База данных создана в Neon и включает следующие таблицы:
- `users` - Пользователи
- `profiles` - Профили пользователей
- `projects` - Проекты
- `project_members` - Участники проектов
- `tasks` - Задачи
- `task_content_items` - Содержимое задач
- `task_connections` - Связи между задачами
- `project_invites` - Приглашения
- `online_users` - Онлайн статус

## Лицензия

MIT
