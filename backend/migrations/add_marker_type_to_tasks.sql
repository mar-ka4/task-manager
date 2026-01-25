-- Добавление поля marker_type в таблицу tasks
-- Это поле будет хранить тип пометки задачи: 'urgent', 'warning', 'time' или NULL

ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS marker_type TEXT CHECK (marker_type IN ('urgent', 'warning', 'time')) DEFAULT NULL;

-- Комментарий к полю
COMMENT ON COLUMN public.tasks.marker_type IS 'Тип пометки задачи: urgent (красный восклицательный знак), warning (желтый треугольник), time (иконка будильника)';
