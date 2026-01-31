'use client';

import { useState, useEffect } from 'react';
import { Filter, X, User, CheckCircle2, Clock, Circle, PlayCircle, AlertTriangle, AlertCircle, ChevronRight, ChevronLeft, ArrowUpDown, Paperclip, ChevronDown, ChevronUp } from 'lucide-react';
import { Task, ProjectMember, TaskContentItem } from '@/lib/types';

export interface FiltersPanelProps {
  isOpen: boolean;
  onToggle: () => void;
  tasks: Task[];
  members: ProjectMember[];
  filters: {
    assignees: string[];
    statuses: string[];
    deadlineFilter: string;
  };
  onFiltersChange: (filters: {
    assignees: string[];
    statuses: string[];
    deadlineFilter: string;
  }) => void;
  currentUserId: string | null;
  onTaskClick?: (task: Task) => void;
  onTaskStatusChange?: (taskId: string, status: 'todo' | 'in_progress' | 'completed') => void;
  taskContentItems?: Record<string, TaskContentItem[]>;
  onLoadTaskContent?: (taskId: string) => void | Promise<void>;
}

export function FiltersPanel({
  isOpen,
  onToggle,
  tasks,
  members,
  filters,
  onFiltersChange,
  currentUserId,
  onTaskClick,
  onTaskStatusChange,
  taskContentItems = {},
  onLoadTaskContent,
}: FiltersPanelProps) {
  const [viewMode, setViewMode] = useState<'all' | 'my'>('all');
  const [sortBy, setSortBy] = useState<'none' | 'not_completed' | 'in_progress' | 'deadline'>('none');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set());
  const [expandedContentInPanel, setExpandedContentInPanel] = useState<Set<string>>(new Set());
  const CONTENT_PREVIEW_COUNT = 3;

  // Функция для нормализации формата изображения base64
  const normalizeImageSrc = (image: string | null | undefined): string | null => {
    if (!image) return null;
    
    // Если уже правильный формат data:image, возвращаем как есть
    if (image.startsWith('data:image')) {
      return image;
    }
    
    // Если это base64 без префикса, определяем тип и добавляем префикс
    if (image.startsWith('/9j/') || image.startsWith('/9j/4AAQ')) {
      // JPEG base64
      return `data:image/jpeg;base64,${image}`;
    } else if (image.startsWith('iVBORw0KGgo') || image.startsWith('PHN2Zy')) {
      // PNG или SVG base64
      const mimeType = image.startsWith('PHN2Zy') ? 'image/svg+xml' : 'image/png';
      return `data:${mimeType};base64,${image}`;
    } else if (image.length > 100) {
      // Длинная строка, вероятно base64 без префикса - предполагаем JPEG
      return `data:image/jpeg;base64,${image}`;
    }
    
    // Если ничего не подошло, возвращаем как есть (может быть URL)
    return image;
  };
  const toggleAssignee = (userId: string) => {
    const newAssignees = filters.assignees.includes(userId)
      ? filters.assignees.filter((id) => id !== userId)
      : [...filters.assignees, userId];
    onFiltersChange({ ...filters, assignees: newAssignees });
  };

  const toggleStatus = (status: string) => {
    const newStatuses = filters.statuses.includes(status)
      ? filters.statuses.filter((s) => s !== status)
      : [...filters.statuses, status];
    onFiltersChange({ ...filters, statuses: newStatuses });
  };

  const setDeadlineFilter = (filter: string) => {
    onFiltersChange({ ...filters, deadlineFilter: filter });
  };

  const clearFilters = () => {
    onFiltersChange({ assignees: [], statuses: [], deadlineFilter: 'all' });
  };

  const hasActiveFilters =
    filters.assignees.length > 0 || filters.statuses.length > 0 || filters.deadlineFilter !== 'all';

  const getMemberStats = (userId: string) => {
    const memberTasks = tasks.filter((t) => t.assignee_id === userId);
    return {
      total: memberTasks.length,
      done: memberTasks.filter((t) => t.status === 'completed').length,
      inProgress: memberTasks.filter((t) => t.status === 'in_progress').length,
      todo: memberTasks.filter((t) => t.status === 'todo').length,
    };
  };

  const getStatusCount = (status: string) => {
    return tasks.filter((t) => t.status === status).length;
  };

  // Получаем задачи текущего пользователя
  let myTasks = currentUserId
    ? tasks.filter((task) => task.assignee_id === currentUserId)
    : [];

  // По умолчанию задачи с пометкой (marker_type) — вверху списка
  const sortByMarkerFirst = (list: Task[]) => {
    return [...list].sort((a, b) => {
      const aHas = a.marker_type ? 1 : 0;
      const bHas = b.marker_type ? 1 : 0;
      if (bHas !== aHas) return bHas - aHas;
      return 0;
    });
  };

  // Применяем сортировку
  if (sortBy === 'not_completed') {
    myTasks = myTasks.filter((task) => task.status !== 'completed');
    myTasks = sortByMarkerFirst(myTasks);
  } else if (sortBy === 'in_progress') {
    myTasks = myTasks.filter((task) => task.status === 'in_progress');
    myTasks = sortByMarkerFirst(myTasks);
  } else if (sortBy === 'deadline') {
    myTasks = [...myTasks].sort((a, b) => {
      if (!a.deadline && !b.deadline) return 0;
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    });
    myTasks = sortByMarkerFirst(myTasks);
  } else {
    // sortBy === 'none' — по умолчанию с пометкой вверху
    myTasks = sortByMarkerFirst(myTasks);
  }

  // Форматирование даты
  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const tomorrowOnly = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate());
    
    if (dateOnly.getTime() === todayOnly.getTime()) {
      return 'Сегодня';
    } else if (dateOnly.getTime() === tomorrowOnly.getTime()) {
      return 'Завтра';
    } else {
      return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    }
  };

  // Проверка просроченности
  const isOverdue = (deadline: string | null) => {
    if (!deadline) return false;
    const deadlineDate = new Date(deadline);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    deadlineDate.setHours(0, 0, 0, 0);
    return deadlineDate < today;
  };

  // Получение цвета статуса
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-emerald-400';
      case 'in_progress':
        return 'text-blue-400';
      case 'blocked':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  // Получение иконки статуса
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
      case 'in_progress':
        return <PlayCircle className="h-4 w-4 text-amber-400" />;
      case 'blocked':
        return <AlertTriangle className="h-4 w-4 text-red-400" />;
      default:
        return <Circle className="h-4 w-4 text-gray-400" />;
    }
  };

  // Следующий статус по циклу: todo -> in_progress -> completed -> todo
  const getNextStatus = (current: string): 'todo' | 'in_progress' | 'completed' => {
    if (current === 'todo') return 'in_progress';
    if (current === 'in_progress') return 'completed';
    return 'todo';
  };

  // Получение названия статуса
  const getStatusName = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Выполнено';
      case 'in_progress':
        return 'В работе';
      case 'blocked':
        return 'Заблокировано';
      default:
        return 'Не начато';
    }
  };

  // При открытии «Мои задачи» подгружаем содержимое для задач с has_content
  useEffect(() => {
    if (!isOpen || viewMode !== 'my' || !onLoadTaskContent || !currentUserId) return;
    const my = tasks.filter((t) => t.assignee_id === currentUserId);
    my.forEach((task) => {
      if (task.has_content && !(taskContentItems[task.id]?.length)) {
        onLoadTaskContent(task.id);
      }
    });
  }, [isOpen, viewMode, currentUserId, tasks, taskContentItems, onLoadTaskContent]);

  return (
    <>
      {/* Бэкдроп на мобильных: затемнение и закрытие по тапу */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          aria-hidden
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggle();
          }}
        />
      )}
      {/* Панель фильтров */}
      <div
        className={`absolute left-0 top-0 h-full border-r border-border bg-card backdrop-blur-xl transition-all duration-300 ease-out z-50 overflow-hidden ${
          isOpen ? 'w-[min(320px,85vw)] sm:w-72 md:w-80' : 'w-10 sm:w-8'
        }`}
      >
        {/* Кнопка переключения - стрелка вправо в левой части (когда закрыто) */}
        {!isOpen && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggle();
            }}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-[60] flex h-6 w-6 items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer pointer-events-auto"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}

        {/* Кнопка переключения - стрелка влево в правой части (когда открыто) */}
        {isOpen && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggle();
            }}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-[60] flex h-6 w-6 items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer pointer-events-auto"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
        {/* Контент панели - виден только когда открыто */}
        {isOpen && (
          <div className="h-full flex flex-col overflow-hidden p-4">
            {/* Переключатель режимов */}
            <div className="flex-shrink-0 mb-6 flex gap-2 rounded-lg bg-muted/30 p-1">
              <button
                onClick={() => setViewMode('all')}
                className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-all ${
                  viewMode === 'all'
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:text-foreground/80'
                }`}
              >
                Все задачи
              </button>
              <button
                onClick={() => setViewMode('my')}
                className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-all ${
                  viewMode === 'my'
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:text-foreground/80'
                }`}
              >
                Мои задачи
              </button>
            </div>

            {viewMode === 'all' ? (
              <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin-ios">
              <>
                {/* Заголовок */}
                <div className="mb-6 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-foreground">Фильтры</h2>
                  {hasActiveFilters && (
                    <button
                      onClick={clearFilters}
                      className="text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      Очистить
                    </button>
                  )}
                </div>

            {/* Фильтр по исполнителям */}
            <div className="mb-6">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <User className="h-4 w-4" />
                <span>Исполнители</span>
              </div>
              <div className="space-y-2">
                {members.map((member) => {
                  const stats = getMemberStats(member.user_id);
                  const isSelected = filters.assignees.includes(member.user_id);
                  return (
                    <button
                      key={member.user_id}
                      onClick={() => toggleAssignee(member.user_id)}
                      className={`w-full rounded-lg border p-3 text-left transition-all ${
                        isSelected
                          ? 'border-blue-500/50 bg-blue-500/10'
                          : 'border-border bg-muted/30 hover:bg-muted'
                      }`}
                    >
                      <div className="mb-2 flex items-center gap-2">
                        <div
                          className="h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold text-foreground overflow-hidden"
                          style={{ backgroundColor: member.avatar_color || '#6b7280' }}
                        >
                          {member.avatar_image ? (
                            <img
                              src={member.avatar_image}
                              alt={member.display_name || 'Avatar'}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span>{member.display_name?.[0]?.toUpperCase() || '?'}</span>
                          )}
                        </div>
                        <span className="text-sm font-medium text-foreground">{member.display_name || 'Без имени'}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>Всего: {stats.total}</span>
                        <span className="text-emerald-400">✓ {stats.done}</span>
                        <span className="text-blue-400">⟳ {stats.inProgress}</span>
                        <span className="text-muted-foreground">○ {stats.todo}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Фильтр по статусам */}
            <div className="mb-6">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <CheckCircle2 className="h-4 w-4" />
                <span>Статус</span>
              </div>
              <div className="space-y-2">
                {/* Не начато */}
                <button
                  onClick={() => toggleStatus('todo')}
                  className={`flex w-full items-center gap-3 rounded-lg border p-3 transition-all ${
                    filters.statuses.includes('todo')
                      ? 'border-gray-500/50 bg-gray-500/10'
                      : 'border-border bg-muted/30 hover:bg-muted'
                  }`}
                >
                  <Circle className="h-4 w-4 text-gray-400" />
                  <span className="text-sm font-medium text-foreground">Не начато</span>
                  <span className="ml-auto text-xs text-muted-foreground">{getStatusCount('todo')}</span>
                </button>

                {/* В работе */}
                <button
                  onClick={() => toggleStatus('in_progress')}
                  className={`flex w-full items-center gap-3 rounded-lg border p-3 transition-all ${
                    filters.statuses.includes('in_progress')
                      ? 'border-blue-500/50 bg-blue-500/10'
                      : 'border-border bg-muted/30 hover:bg-muted'
                  }`}
                >
                  <PlayCircle className="h-4 w-4 text-blue-400" />
                  <span className="text-sm font-medium text-foreground">В работе</span>
                  <span className="ml-auto text-xs text-muted-foreground">{getStatusCount('in_progress')}</span>
                </button>

                {/* Выполнено */}
                <button
                  onClick={() => toggleStatus('completed')}
                  className={`flex w-full items-center gap-3 rounded-lg border p-3 transition-all ${
                    filters.statuses.includes('completed')
                      ? 'border-emerald-500/50 bg-emerald-500/10'
                      : 'border-border bg-muted/30 hover:bg-muted'
                  }`}
                >
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span className="text-sm font-medium text-foreground">Выполнено</span>
                  <span className="ml-auto text-xs text-muted-foreground">{getStatusCount('completed')}</span>
                </button>
              </div>
            </div>

            {/* Фильтр по дедлайнам */}
            <div>
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Дедлайн</span>
              </div>
              <div className="space-y-2">
                <button
                  onClick={() => setDeadlineFilter('overdue')}
                  className={`flex w-full items-center gap-3 rounded-lg border p-3 transition-all ${
                    filters.deadlineFilter === 'overdue'
                      ? 'border-red-500/50 bg-red-500/10'
                      : 'border-border bg-muted/30 hover:bg-muted'
                  }`}
                >
                  <AlertTriangle className="h-4 w-4 text-red-400" />
                  <span className="text-sm font-medium text-foreground">Просрочено</span>
                </button>

                <button
                  onClick={() => setDeadlineFilter('today')}
                  className={`flex w-full items-center gap-3 rounded-lg border p-3 transition-all ${
                    filters.deadlineFilter === 'today'
                      ? 'border-orange-500/50 bg-orange-500/10'
                      : 'border-border bg-muted/30 hover:bg-muted'
                  }`}
                >
                  <Clock className="h-4 w-4 text-orange-400" />
                  <span className="text-sm font-medium text-foreground">Сегодня</span>
                </button>

                <button
                  onClick={() => setDeadlineFilter('week')}
                  className={`flex w-full items-center gap-3 rounded-lg border p-3 transition-all ${
                    filters.deadlineFilter === 'week'
                      ? 'border-yellow-500/50 bg-yellow-500/10'
                      : 'border-border bg-muted/30 hover:bg-muted'
                  }`}
                >
                  <Clock className="h-4 w-4 text-yellow-400" />
                  <span className="text-sm font-medium text-foreground">На неделе</span>
                </button>

                {filters.deadlineFilter !== 'all' && (
                  <button
                    onClick={() => setDeadlineFilter('all')}
                    className="w-full rounded-lg border border-border bg-muted/30 p-3 text-left text-sm font-medium text-muted-foreground hover:bg-muted transition-all"
                  >
                    Все задачи
                  </button>
                )}
              </div>
            </div>
              </>
              </div>
            ) : (
              <>
                {/* Заголовок «Мои задачи» + сортировка — без скролла */}
                <div className="flex-shrink-0 mb-4 flex items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold text-foreground">Мои задачи</h2>
                  <div className="relative">
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                      className="filters-panel-select appearance-none w-full rounded-lg border border-border bg-muted px-3 py-1.5 pr-8 text-sm text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring cursor-pointer transition-colors"
                    >
                      <option value="none">Все</option>
                      <option value="not_completed">Не выполненные</option>
                      <option value="in_progress">В работе</option>
                      <option value="deadline">По дедлайну</option>
                    </select>
                    <ArrowUpDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  </div>
                </div>
                {/* Список задач — скролл только здесь, тонкий скроллбар */}
                <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin-ios pl-3 pt-2 pr-1">
                  {myTasks.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      У вас нет назначенных задач
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {myTasks.map((task) => {
                        const taskColor = task.color
                          ? task.color.split(',').map((c) => parseInt(c.trim()))
                          : [107, 114, 128];
                        const formattedDate = formatDate(task.deadline);
                        const overdue = isOverdue(task.deadline);

                        // Определяем цвет обводки в зависимости от маркера
                        const getBorderColor = () => {
                          if (task.marker_type === 'urgent') {
                            return 'border-red-500/40';
                          } else if (task.marker_type === 'warning') {
                            return 'border-yellow-500/40';
                          } else if (task.marker_type === 'time') {
                            return 'border-blue-500/40';
                          }
                          return 'border-border';
                        };

                        const contentItems = (taskContentItems[task.id] || []).sort((a, b) => a.position - b.position);
                        const showContentExpand = contentItems.length > CONTENT_PREVIEW_COUNT;
                        const visibleContentItems = expandedContentInPanel.has(task.id) ? contentItems : contentItems.slice(0, CONTENT_PREVIEW_COUNT);

                        return (
                          <div
                            key={task.id}
                            onClick={() => onTaskClick?.(task)}
                            className={`relative rounded-lg border ${getBorderColor()} bg-muted/30 p-3 cursor-pointer transition-all hover:bg-muted ${
                              task.marker_type === 'urgent' 
                                ? 'hover:border-red-500/60' 
                                : task.marker_type === 'warning'
                                ? 'hover:border-yellow-500/60'
                                : task.marker_type === 'time'
                                ? 'hover:border-blue-500/60'
                                : 'hover:border-border'
                            }`}
                          >
                            {/* Статус + дедлайн — иконки в правом верхнем углу; клик по статусу меняет статус по циклу */}
                            <div className="absolute top-2 right-2 flex items-center gap-1.5 z-10">
                              {task.deadline && (
                                <span className={`flex items-center gap-0.5 text-[10px] ${overdue ? 'text-red-400' : 'text-muted-foreground'}`} title={formattedDate ?? undefined}>
                                  <Clock className="h-3 w-3" />
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  const next = getNextStatus(task.status || 'todo');
                                  onTaskStatusChange?.(task.id, next);
                                }}
                                className="rounded p-0.5 hover:bg-muted transition-colors cursor-pointer touch-manipulation"
                                title={`${getStatusName(task.status)} — клик: ${getStatusName(getNextStatus(task.status || 'todo'))}`}
                              >
                                {getStatusIcon(task.status || 'todo')}
                              </button>
                            </div>

                            {/* Маркер задачи (пометка) */}
                            {task.marker_type && (
                              <div className="absolute -top-1.5 -left-1.5 z-40">
                                {task.marker_type === 'urgent' && (
                                  <div className="bg-red-500 rounded-full p-0.5 shadow-lg ring-2 ring-red-500/30">
                                    <AlertCircle className="h-4 w-4 text-foreground" strokeWidth={2.5} />
                                  </div>
                                )}
                                {task.marker_type === 'warning' && (
                                  <div className="bg-yellow-500 rounded-full p-0.5 shadow-lg ring-2 ring-yellow-500/30">
                                    <AlertTriangle className="h-4 w-4 text-foreground" strokeWidth={2} />
                                  </div>
                                )}
                                {task.marker_type === 'time' && (
                                  <div className="bg-blue-500 rounded-full p-0.5 shadow-lg ring-2 ring-blue-500/30">
                                    <Clock className="h-4 w-4 text-foreground" strokeWidth={2} />
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Заголовок */}
                            <div className="mb-1.5 pr-6">
                              <h3 className="text-sm font-medium text-foreground line-clamp-2">
                                {task.title || 'Без названия'}
                              </h3>
                            </div>

                            {/* Описание — стрелка в правом нижнем углу для разворота */}
                            {task.description && (
                              <div className="relative mb-2 pr-5">
                                <p className={`text-xs text-muted-foreground ${expandedDescriptions.has(task.id) ? '' : 'line-clamp-2'}`}>
                                  {task.description}
                                </p>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setExpandedDescriptions((prev) => {
                                      const next = new Set(prev);
                                      if (next.has(task.id)) next.delete(task.id);
                                      else next.add(task.id);
                                      return next;
                                    });
                                  }}
                                  className="absolute bottom-0 right-0 p-0.5 text-muted-foreground hover:text-foreground transition-colors"
                                  title={expandedDescriptions.has(task.id) ? 'Свернуть' : 'Развернуть'}
                                >
                                  {expandedDescriptions.has(task.id) ? (
                                    <ChevronUp className="h-3.5 w-3.5" />
                                  ) : (
                                    <ChevronDown className="h-3.5 w-3.5" />
                                  )}
                                </button>
                              </div>
                            )}

                            {/* Пункты без заголовка «Содержимое»: 3 шт + раскрытие вниз */}
                            {contentItems.length > 0 && (
                              <div className="space-y-0.5">
                                {visibleContentItems.map((item) => (
                                  <div key={item.id} className="flex items-start gap-2 text-xs text-muted-foreground">
                                    <span className={`shrink-0 mt-0.5 h-2.5 w-2.5 rounded-full border ${
                                      item.completed ? 'bg-emerald-500 border-emerald-400' : 'bg-muted border-border'
                                    }`} />
                                    <span className={item.completed ? 'line-through opacity-60' : ''}>
                                      {item.content || '—'}
                                    </span>
                                  </div>
                                ))}
                                {showContentExpand && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setExpandedContentInPanel((prev) => {
                                        const next = new Set(prev);
                                        if (next.has(task.id)) next.delete(task.id);
                                        else next.add(task.id);
                                        return next;
                                      });
                                    }}
                                    className="flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-muted-foreground transition-colors mt-0.5"
                                  >
                                    {expandedContentInPanel.has(task.id) ? (
                                      <>Свернуть <ChevronUp className="h-3 w-3" /></>
                                    ) : (
                                      <>Ещё {contentItems.length - CONTENT_PREVIEW_COUNT} <ChevronDown className="h-3 w-3" /></>
                                    )}
                                  </button>
                                )}
                              </div>
                            )}

                            {/* Изображения и файлы */}
                            {((task.images && task.images.length > 0) || (task.files && task.files.length > 0)) && (
                              <div>
                                <div className="flex flex-wrap gap-1.5">
                                  {task.images && task.images.length > 0 && task.images.map((image, index) => {
                                    const imageSrc = normalizeImageSrc(image);
                                    if (!imageSrc) return null;
                                    return (
                                      <div
                                        key={`img-${index}`}
                                        className="relative aspect-square w-10 rounded overflow-hidden bg-muted border border-border cursor-pointer"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedImage(imageSrc);
                                        }}
                                      >
                                        <img
                                          src={imageSrc}
                                          alt={`Изображение ${index + 1}`}
                                          className="h-full w-full object-cover"
                                          loading="lazy"
                                        />
                                      </div>
                                    );
                                  })}
                                  {task.files && task.files.length > 0 && task.files.map((file, index) => (
                                    <div
                                      key={`file-${index}`}
                                      className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted border border-border"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <Paperclip className="h-2.5 w-2.5 text-muted-foreground flex-shrink-0" />
                                      <a
                                        href={file.data}
                                        download={file.name}
                                        onClick={(e) => e.stopPropagation()}
                                        className="text-[10px] text-muted-foreground hover:text-foreground truncate max-w-[100px]"
                                        title={file.name}
                                      >
                                        {file.name}
                                      </a>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Модальное окно для просмотра изображений */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setSelectedImage(null)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setSelectedImage(null);
            }
          }}
          tabIndex={-1}
        >
          <div className="relative max-w-[90vw] max-h-[90vh] flex items-center justify-center p-4">
            <img
              src={selectedImage}
              alt="Просмотр изображения"
              className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedImage(null);
              }}
              className="absolute -top-3 -right-3 rounded-full p-2.5 bg-red-500/90 hover:bg-red-500 text-white transition-all shadow-lg z-10 border-2 border-border"
              title="Закрыть (Esc)"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
