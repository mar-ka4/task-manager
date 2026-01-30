# Task Manager Backend API

Backend API для Task Manager приложения на Express.js + PostgreSQL + Socket.io

## Технологии

- **Runtime**: Node.js
- **Framework**: Express.js
- **База данных**: PostgreSQL (Neon)
- **Realtime**: Socket.io
- **Аутентификация**: JWT
- **Язык**: TypeScript

## Установка

```bash
npm install
```

## Настройка переменных окружения

Создайте файл `.env` на основе `.env.example`:

```env
DATABASE_URL=postgresql://user:password@host:port/database
JWT_SECRET=your-secret-key-here-change-in-production
PORT=3001
FRONTEND_URL=http://localhost:3000
```

## Запуск

### Разработка

```bash
npm run dev
```

### Продакшн

```bash
npm run build
npm start
```

## API Endpoints

- `GET /` - Health check
- `POST /api/auth/register` - Регистрация
- `POST /api/auth/login` - Вход
- `GET /api/auth/me` - Текущий пользователь
- `GET /api/projects` - Список проектов
- `POST /api/projects` - Создать проект
- `GET /api/projects/:id/tasks` - Задачи проекта
- И другие...

## Миграции базы данных

Миграции находятся в папке `migrations/`. Применяйте их вручную через SQL клиент или используйте скрипты из `scripts/`.

## WebSocket

Backend поддерживает WebSocket соединения через Socket.io для realtime обновлений.
