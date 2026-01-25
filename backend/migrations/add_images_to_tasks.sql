-- Добавление поля images в таблицу tasks
-- Это поле будет хранить JSON массив base64 изображений

ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb;

-- Создаем индекс для быстрого поиска задач с изображениями (опционально)
CREATE INDEX IF NOT EXISTS idx_tasks_has_images ON public.tasks ((images IS NOT NULL AND jsonb_array_length(images) > 0));

-- Комментарий к полю
COMMENT ON COLUMN public.tasks.images IS 'Массив base64 изображений, прикрепленных к задаче';
