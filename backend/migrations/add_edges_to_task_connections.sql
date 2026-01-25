-- Миграция: Добавление полей from_edge и to_edge в таблицу task_connections
-- Дата: 2026-01-25

-- Создаем таблицу task_connections если её нет
CREATE TABLE IF NOT EXISTS public.task_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    to_task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Создаем индексы если их нет
CREATE INDEX IF NOT EXISTS idx_task_connections_from ON public.task_connections(from_task_id);
CREATE INDEX IF NOT EXISTS idx_task_connections_to ON public.task_connections(to_task_id);
CREATE INDEX IF NOT EXISTS idx_task_connections_project ON public.task_connections(project_id);

-- Проверяем, существуют ли поля, и добавляем их если нет
DO $$
BEGIN
    -- Добавляем поле from_edge если его нет
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'task_connections' 
        AND column_name = 'from_edge'
    ) THEN
        ALTER TABLE public.task_connections 
        ADD COLUMN from_edge TEXT CHECK (from_edge IN ('top', 'bottom', 'left', 'right'));
    END IF;

    -- Добавляем поле to_edge если его нет
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'task_connections' 
        AND column_name = 'to_edge'
    ) THEN
        ALTER TABLE public.task_connections 
        ADD COLUMN to_edge TEXT CHECK (to_edge IN ('top', 'bottom', 'left', 'right'));
    END IF;
END $$;
