-- Добавление поля files в таблицу tasks
-- Это поле будет хранить JSON массив файлов (name, data, type)

ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS files JSONB DEFAULT '[]'::jsonb;

-- Создаем индекс для быстрого поиска задач с файлами (опционально)
CREATE INDEX IF NOT EXISTS idx_tasks_has_files ON public.tasks ((files IS NOT NULL AND jsonb_array_length(files) > 0));

-- Комментарий к полю
COMMENT ON COLUMN public.tasks.files IS 'Массив файлов, прикрепленных к задаче (name, base64 data, mime type)';
