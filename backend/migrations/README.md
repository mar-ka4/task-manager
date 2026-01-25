# Миграции базы данных

Этот файл содержит инструкции по применению миграций для добавления полей `images`, `files`, `marker_type`, `width`, `height` в таблицу `tasks`, а также полей `from_edge` и `to_edge` в таблицу `task_connections`.

## Важно!

Перед использованием функций прикрепления изображений и файлов к задачам, необходимо применить миграции к базе данных.

## Применение миграций

### 1. Миграция для поля `images`

Выполните SQL из файла `add_images_to_tasks.sql`:

```sql
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_tasks_has_images ON public.tasks ((images IS NOT NULL AND jsonb_array_length(images) > 0));

COMMENT ON COLUMN public.tasks.images IS 'Массив base64 изображений, прикрепленных к задаче';
```

### 2. Миграция для поля `files`

Выполните SQL из файла `add_files_to_tasks.sql`:

```sql
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS files JSONB DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_tasks_has_files ON public.tasks ((files IS NOT NULL AND jsonb_array_length(files) > 0));

COMMENT ON COLUMN public.tasks.files IS 'Массив файлов, прикрепленных к задаче (name, base64 data, mime type)';
```

## Как применить миграции

### Вариант 1: Через psql (командная строка PostgreSQL)

```bash
psql -U your_username -d your_database -f backend/migrations/add_images_to_tasks.sql
psql -U your_username -d your_database -f backend/migrations/add_files_to_tasks.sql
psql -U your_username -d your_database -f backend/migrations/add_edges_to_task_connections.sql
psql -U your_username -d your_database -f backend/migrations/add_marker_type_to_tasks.sql
```

### Вариант 1.5: Через Node.js скрипт (рекомендуется)

```bash
node backend/scripts/apply-marker-type-migration.js
```

### Вариант 2: Через pgAdmin или другой GUI клиент

1. Откройте pgAdmin или другой клиент PostgreSQL
2. Подключитесь к вашей базе данных
3. Откройте Query Tool
4. Скопируйте и выполните SQL из файлов миграций

### Вариант 3: Через Node.js скрипт

Создайте файл `backend/scripts/apply-migrations.js`:

```javascript
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  // Ваши настройки подключения к БД
  connectionString: process.env.DATABASE_URL,
});

async function applyMigration(filename) {
  const sql = fs.readFileSync(path.join(__dirname, '../migrations', filename), 'utf8');
  await pool.query(sql);
  console.log(`✓ Applied migration: ${filename}`);
}

async function main() {
  try {
    await applyMigration('add_images_to_tasks.sql');
    await applyMigration('add_files_to_tasks.sql');
    await applyMigration('add_edges_to_task_connections.sql');
    console.log('All migrations applied successfully!');
  } catch (error) {
    console.error('Migration error:', error);
  } finally {
    await pool.end();
  }
}

main();
```

Затем выполните:
```bash
node backend/scripts/apply-migrations.js
```

## Проверка применения миграций

После применения миграций, проверьте, что поля существуют:

### Проверка полей в таблице tasks:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'tasks' 
AND column_name IN ('images', 'files');
```

Ожидаемый результат:
- `images` | `jsonb`
- `files` | `jsonb`

### Проверка полей в таблице task_connections:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'task_connections' 
AND column_name IN ('from_edge', 'to_edge');
```

Ожидаемый результат:
- `from_edge` | `text`
- `to_edge` | `text`

### 3. Миграция для полей `from_edge` и `to_edge` в таблице `task_connections`

Выполните SQL из файла `add_edges_to_task_connections.sql`:

Этот файл создаст таблицу `task_connections` (если её нет) и добавит поля `from_edge` и `to_edge` для указания граней задач, между которыми создается соединение.

**Важно:** Эта миграция необходима для работы функции соединения задач через кружки на границах.

## Откат миграций (если нужно)

Если нужно удалить поля:

```sql
-- Удаление поля images
ALTER TABLE public.tasks DROP COLUMN IF EXISTS images;
DROP INDEX IF EXISTS idx_tasks_has_images;

-- Удаление поля files
ALTER TABLE public.tasks DROP COLUMN IF EXISTS files;
DROP INDEX IF EXISTS idx_tasks_has_files;

-- Удаление полей from_edge и to_edge из task_connections
ALTER TABLE public.task_connections DROP COLUMN IF EXISTS from_edge;
ALTER TABLE public.task_connections DROP COLUMN IF EXISTS to_edge;
```
