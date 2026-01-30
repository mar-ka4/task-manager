'use client';

import { useEffect, useState, useRef, useMemo, useLayoutEffect } from 'react';

// Стили для скрытия подчеркивания ошибок орфографии, когда поле не в фокусе
// и для улучшения качества рендеринга при масштабировании
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    [contenteditable]:not(.spellcheck-active)::spelling-error,
    [contenteditable]:not(.spellcheck-active) *::spelling-error,
    textarea:not(.spellcheck-active)::spelling-error {
      text-decoration: none !important;
      border-bottom: none !important;
      text-decoration-line: none !important;
      text-decoration-color: transparent !important;
    }
    
    /* Улучшение качества рендеринга при масштабировании */
    [data-canvas-content] {
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      text-rendering: optimizeLegibility;
      backface-visibility: hidden;
      -webkit-backface-visibility: hidden;
      transform: translate3d(0, 0, 0);
      -webkit-transform: translate3d(0, 0, 0);
      will-change: transform;
    }
    
    [data-canvas-content] * {
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      text-rendering: optimizeLegibility;
    }
    
    [data-canvas-content] img {
      image-rendering: auto;
      -ms-interpolation-mode: bicubic;
    }
    
    [data-canvas-content] svg {
      shape-rendering: geometricPrecision;
      text-rendering: optimizeLegibility;
    }
    
    [data-task-id] {
      backface-visibility: hidden;
      -webkit-backface-visibility: hidden;
      transform: translate3d(0, 0, 0);
      -webkit-transform: translate3d(0, 0, 0);
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      text-rendering: optimizeLegibility;
      will-change: transform;
    }
    
    [data-task-id] * {
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      text-rendering: optimizeLegibility;
    }
    
    [data-task-id] img {
      image-rendering: auto;
      -ms-interpolation-mode: bicubic;
    }
  `;
  document.head.appendChild(style);
}
import { useRouter, useParams } from 'next/navigation';
import { getTasks, createTask, updateTask, deleteTask, getProject, getProjectMembers, updateProject, getTaskContent, createTaskContentItem, updateTaskContentItem, deleteTaskContentItem, enableTaskContent, getTaskConnections, createTaskConnection, deleteTaskConnection } from '@/lib/api/client';
import { Task, Project, ProjectMember, TaskContentItem, TaskConnection } from '@/lib/types';
import { subscribeToProject, unsubscribeFromProject } from '@/lib/websocket';
import { ArrowLeft, Settings, ChevronUp, ChevronDown, Globe, Lock, Users, Edit2, Check, X, Filter, Trash2, Plus, User, Bold, Italic, Calendar, List, Paperclip, AlertCircle, AlertTriangle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FiltersPanel } from '@/components/board/FiltersPanel';
import { OnlineUsersDropdown } from '@/components/online-users-dropdown';
import { ProjectSettingsDialog } from '@/components/project-settings-dialog';
import { toast } from 'sonner';
import { compressImage, getImageFromClipboard } from '@/lib/utils/image-compression';

const CANVAS_WIDTH = 5000;
const CANVAS_HEIGHT = 5000;
const GRID_SIZE = 20;

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

// Функция для преобразования текста с ссылками в HTML с кликабельными ссылками
const linkifyText = (text: string): string => {
  if (!text) return '';
  
  // Регулярное выражение для поиска URL
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}[^\s]*)/g;
  
  return text.replace(urlRegex, (url) => {
    // Добавляем протокол, если его нет
    let href = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      href = 'https://' + url;
    }
    
    return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:text-blue-300 underline" onclick="event.stopPropagation(); window.open('${href}', '_blank'); return false;">${url}</a>`;
  });
};

// Функция для извлечения текста из HTML (для сохранения)
const extractTextFromHTML = (html: string): string => {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
};

// Функция для получения цвета линии соединения на основе цветов задач
// Окрашивается только если обе задачи имеют одинаковый цвет
const getConnectionColor = (task1: Task | null, task2: Task | null): string => {
  const defaultColor = 'rgba(107, 114, 128, 0.3)'; // Серый по умолчанию
  
  if (!task1 || !task2) return defaultColor;
  
  // Получаем цвета задач
  const color1 = task1?.color;
  const color2 = task2?.color;
  
  // Окрашиваем только если обе задачи имеют цвет И цвета одинаковые
  if (color1 && color2 && color1 === color2) {
    const rgb = color1.split(',').map(Number);
    return `rgba(${rgb.join(',')}, 0.3)`;
  }
  
  return defaultColor;
};

// Функция для получения цвета кружков соединения
const getConnectionCircleColor = (task1: Task | null, task2: Task | null): string => {
  const defaultColor = 'rgba(107, 114, 128, 0.4)'; // Серый по умолчанию
  
  if (!task1 || !task2) return defaultColor;
  
  const color1 = task1?.color;
  const color2 = task2?.color;
  
  // Окрашиваем только если обе задачи имеют цвет И цвета одинаковые
  if (color1 && color2 && color1 === color2) {
    const rgb = color1.split(',').map(Number);
    return `rgba(${rgb.join(',')}, 0.4)`;
  }
  
  return defaultColor;
};

// Функция для получения цвета линии при hover
const getConnectionHoverColor = (task1: Task | null, task2: Task | null): string => {
  const defaultColor = 'rgba(107, 114, 128, 0.5)'; // Серый по умолчанию
  
  if (!task1 || !task2) return defaultColor;
  
  const color1 = task1?.color;
  const color2 = task2?.color;
  
  // Окрашиваем только если обе задачи имеют цвет И цвета одинаковые
  if (color1 && color2 && color1 === color2) {
    const rgb = color1.split(',').map(Number);
    return `rgba(${rgb.join(',')}, 0.6)`;
  }
  
  return defaultColor;
};

// Функция для получения цвета кружков при hover
const getConnectionCircleHoverColor = (task1: Task | null, task2: Task | null): string => {
  const defaultColor = 'rgba(107, 114, 128, 0.6)'; // Серый по умолчанию
  
  if (!task1 || !task2) return defaultColor;
  
  const color1 = task1?.color;
  const color2 = task2?.color;
  
  // Окрашиваем только если обе задачи имеют цвет И цвета одинаковые
  if (color1 && color2 && color1 === color2) {
    const rgb = color1.split(',').map(Number);
    return `rgba(${rgb.join(',')}, 0.7)`;
  }
  
  return defaultColor;
};

export default function BoardPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.projectId as string;

  const [tasks, setTasks] = useState<Task[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState({
    assignees: [] as string[],
    statuses: [] as string[],
    deadlineFilter: 'all' as string,
  });
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; type: 'canvas' | 'task' | null; taskId?: string }>({
    x: 0,
    y: 0,
    type: null,
  });
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [settingsPanelPosition, setSettingsPanelPosition] = useState<{ x: number; y: number } | null>(null);
  const [taskTitles, setTaskTitles] = useState<Record<string, string>>({});
  const [hoveredTask, setHoveredTask] = useState<string | null>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [openAssigneeMenu, setOpenAssigneeMenu] = useState<string | null>(null);
  const [draggingTask, setDraggingTask] = useState<Task | null>(null);
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  const [isTaskDragging, setIsTaskDragging] = useState(false);
  const [clickStartPos, setClickStartPos] = useState({ x: 0, y: 0 });
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [taskContentItems, setTaskContentItems] = useState<Record<string, TaskContentItem[]>>({});
  const [expandedContentTasks, setExpandedContentTasks] = useState<Set<string>>(new Set());
  const [expandedDescriptionTasks, setExpandedDescriptionTasks] = useState<Set<string>>(new Set());
  const [taskImages, setTaskImages] = useState<Record<string, string[]>>({});
  const [isResizing, setIsResizing] = useState(false);
  const [resizingTask, setResizingTask] = useState<Task | null>(null);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [taskFiles, setTaskFiles] = useState<Record<string, Array<{ name: string; data: string; type: string }>>>({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement>>({});
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [hoveredBorder, setHoveredBorder] = useState<{ taskId: string; edge: 'top' | 'bottom' | 'left' | 'right' } | null>(null);
  const [connectingFrom, setConnectingFrom] = useState<{ taskId: string; edge: 'top' | 'bottom' | 'left' | 'right' } | null>(null);
  const [connectingTo, setConnectingTo] = useState<{ x: number; y: number } | null>(null);
  const [taskConnections, setTaskConnections] = useState<TaskConnection[]>([]);

  const canvasRef = useRef<HTMLDivElement>(null);
  const taskRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const isDraggingRef = useRef(false);
  const taskHeightsRef = useRef<Map<string, number>>(new Map());
  const TASK_WIDTH = 240; // Фиксированная ширина задачи (с padding)
  const CORNER_RADIUS = 8; // Радиус скругления углов
  const MIN_EXIT_DISTANCE = 20; // Минимальное расстояние перпендикулярного выхода от блока задачи

  // Функция для получения координат задачи в системе координат canvas
  // Используем только координаты из задачи - они уже в правильной системе координат canvas
  const getTaskCanvasPosition = (task: Task, isDragging: boolean, dragPos: { x: number; y: number } | null) => {
    if (isDragging && dragPos) {
      return { x: dragPos.x, y: dragPos.y };
    }
    
    // Используем координаты напрямую из задачи - они уже в системе координат canvas
    return { x: task.position_x || 0, y: task.position_y || 0 };
  };

  // Функция для получения границ задачи (для проверки пересечений)
  const getTaskBounds = (task: Task, isDragging: boolean, dragPos: { x: number; y: number } | null) => {
    const pos = getTaskCanvasPosition(task, isDragging, dragPos);
    const height = taskHeightsRef.current.get(task.id) || 150;
    const padding = 10; // Отступ для обхода блоков
    
    return {
      left: pos.x - padding,
      top: pos.y - padding,
      right: pos.x + TASK_WIDTH + padding,
      bottom: pos.y + height + padding,
    };
  };

  // Функция для проверки пересечения горизонтальной или вертикальной линии с блоком задачи
  const lineSegmentIntersectsTask = (
    x1: number, y1: number, x2: number, y2: number,
    task: Task, excludeTaskIds: string[] = []
  ): boolean => {
    if (excludeTaskIds.includes(task.id)) return false;
    
    const bounds = getTaskBounds(task, false, null);
    
    // Проверяем только горизонтальные и вертикальные сегменты
    const isHorizontal = Math.abs(y2 - y1) < 0.001;
    const isVertical = Math.abs(x2 - x1) < 0.001;
    
    if (isHorizontal) {
      // Горизонтальная линия
      const minX = Math.min(x1, x2);
      const maxX = Math.max(x1, x2);
      return y1 >= bounds.top && y1 <= bounds.bottom && 
             maxX >= bounds.left && minX <= bounds.right;
    }
    
    if (isVertical) {
      // Вертикальная линия
      const minY = Math.min(y1, y2);
      const maxY = Math.max(y1, y2);
      return x1 >= bounds.left && x1 <= bounds.right && 
             maxY >= bounds.top && minY <= bounds.bottom;
    }
    
    return false;
  };

  // Функция для вычисления плавного пути с перпендикулярным выходом/входом
  const calculateOrthogonalPath = (
    startX: number, startY: number,
    endX: number, endY: number,
    excludeTaskIds: string[] = [],
    startDirection: 'top' | 'bottom' | 'left' | 'right' | null = null,
    endDirection: 'top' | 'bottom' | 'left' | 'right' | null = null
  ): string => {
    // Определяем точки выхода и входа перпендикулярно к граням
    let exitX = startX;
    let exitY = startY;
    let enterX = endX;
    let enterY = endY;
    
    // Выход перпендикулярно к грани
    if (startDirection === 'top') {
      exitY = startY - 1; // Небольшой отступ для плавности
    } else if (startDirection === 'bottom') {
      exitY = startY + 1;
    } else if (startDirection === 'left') {
      exitX = startX - 1;
    } else if (startDirection === 'right') {
      exitX = startX + 1;
    }
    
    // Вход перпендикулярно к грани
    if (endDirection === 'top') {
      enterY = endY - 1;
    } else if (endDirection === 'bottom') {
      enterY = endY + 1;
    } else if (endDirection === 'left') {
      enterX = endX - 1;
    } else if (endDirection === 'right') {
      enterX = endX + 1;
    }
    
    // Вычисляем расстояние и контрольные точки для плавной кривой
    const dx = enterX - exitX;
    const dy = enterY - exitY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Используем 15% расстояния для изгиба (более резкие повороты)
    const curveAmount = Math.min(distance * 0.15, 50);
    
    // Контрольные точки для кривой Безье (направлены перпендикулярно к граням)
    let controlX1: number, controlY1: number;
    let controlX2: number, controlY2: number;
    
    // Первая контрольная точка - продолжает перпендикулярный выход
    if (startDirection === 'top' || startDirection === 'bottom') {
      controlX1 = exitX;
      controlY1 = exitY + (dy > 0 ? curveAmount : -curveAmount);
    } else {
      controlX1 = exitX + (dx > 0 ? curveAmount : -curveAmount);
      controlY1 = exitY;
    }
    
    // Вторая контрольная точка - подходит перпендикулярно к входу
    if (endDirection === 'top' || endDirection === 'bottom') {
      controlX2 = enterX;
      controlY2 = enterY - (dy > 0 ? curveAmount : -curveAmount);
    } else {
      controlX2 = enterX - (dx > 0 ? curveAmount : -curveAmount);
      controlY2 = enterY;
    }
    
    // Строим путь: прямая линия от старта до выхода, затем плавная кривая до входа, затем прямая до конца
    const path = `M ${startX} ${startY} L ${exitX} ${exitY} C ${controlX1} ${controlY1}, ${controlX2} ${controlY2}, ${enterX} ${enterY} L ${endX} ${endY}`;
    
    return path;
  };

  useEffect(() => {
    if (!projectId) return;

    loadProject();
    loadTasks();
    loadMembers();
    loadTaskConnections();

    // WebSocket подписка
    const token = localStorage.getItem('token');
    if (token) {
      const socket = subscribeToProject(projectId, (data) => {
        if (data.event === 'UPDATE' || data.event === 'INSERT') {
          setTasks((prev) => {
            const existing = prev.find((t) => t.id === data.data.id);
            if (existing) {
              const updated = prev.map((t) => (t.id === data.data.id ? data.data : t));
              // Обновляем локальные названия
              setTaskTitles((titles) => ({
                ...titles,
                [data.data.id]: data.data.title || '',
              }));
              // Обновляем изображения (нормализуем формат)
              if (data.data.images !== undefined) {
                const images = Array.isArray(data.data.images) ? data.data.images : [];
                setTaskImages((prev) => ({
                  ...prev,
                  [data.data.id]: images
                    .map((img: string) => normalizeImageSrc(img) || img)
                    .filter(Boolean) as string[],
                }));
              }
              
              // Обновляем файлы
              if (data.data.files !== undefined) {
                setTaskFiles((prev) => ({
                  ...prev,
                  [data.data.id]: Array.isArray(data.data.files) ? data.data.files : [],
                }));
              }
              // Если у задачи появилось содержимое, загружаем его
              if (data.data.has_content && !taskContentItems[data.data.id]) {
                loadTaskContent(data.data.id);
              }
              return updated;
            }
            const newTasks = [...prev, data.data];
            setTaskTitles((titles) => ({
              ...titles,
              [data.data.id]: data.data.title || '',
            }));
            // Инициализируем изображения для новой задачи
            if (data.data.images) {
              setTaskImages((prev) => ({
                ...prev,
                [data.data.id]: Array.isArray(data.data.images) ? data.data.images : [],
              }));
            }
            // Инициализируем файлы для новой задачи
            if (data.data.files) {
              setTaskFiles((prev) => ({
                ...prev,
                [data.data.id]: Array.isArray(data.data.files) ? data.data.files : [],
              }));
            }
            // Если у новой задачи есть содержимое, загружаем его
            if (data.data.has_content) {
              loadTaskContent(data.data.id);
            }
            return newTasks;
          });
        } else if (data.event === 'DELETE') {
          setTasks((prev) => prev.filter((t) => t.id !== data.data.id));
          setTaskTitles((titles) => {
            const newTitles = { ...titles };
            delete newTitles[data.data.id];
            return newTitles;
          });
          // Удаляем содержимое удаленной задачи
          setTaskContentItems((prev) => {
            const newItems = { ...prev };
            delete newItems[data.data.id];
            return newItems;
          });
        }
      });
    }

    return () => {
      unsubscribeFromProject(projectId);
    };
  }, [projectId]);

  // Очистка таймера при размонтировании
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  // Обработка Space для панорамирования
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' && e.target === document.body) {
        e.preventDefault();
        setIsSpacePressed(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        setIsSpacePressed(false);
        setIsPanning(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Отслеживание высот задач через ResizeObserver
  useEffect(() => {
    const observers = new Map<string, ResizeObserver>();

    // Используем небольшую задержку для инициализации после рендера
    const timeoutId = setTimeout(() => {
      taskRefs.current.forEach((element, taskId) => {
        if (!element) return;
        
        // Инициализируем высоту сразу
        const height = element.offsetHeight;
        if (height > 0) {
          taskHeightsRef.current.set(taskId, height);
        }

        const observer = new ResizeObserver((entries) => {
          for (const entry of entries) {
            const height = entry.contentRect.height;
            if (height > 0) {
              taskHeightsRef.current.set(taskId, height);
            }
          }
        });
        observer.observe(element);
        observers.set(taskId, observer);
      });
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      observers.forEach((observer) => observer.disconnect());
    };
  }, [tasks.length]); // Обновляем только при изменении количества задач

  // Обработка Ctrl + колесо мыши для масштабирования
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey && canvasRef.current?.contains(e.target as Node)) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setScale((prev) => Math.max(0.3, Math.min(2, prev + delta)));
      } else if (!e.ctrlKey && isSpacePressed && canvasRef.current?.contains(e.target as Node)) {
        e.preventDefault();
        setOffset((prev) => ({
          x: prev.x - e.deltaX,
          y: prev.y - e.deltaY,
        }));
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, [isSpacePressed]);

  // Глобальные обработчики для перетаскивания задач
  useEffect(() => {
    if (!draggingTask) return;

    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!draggingTask || isPanning) return;
      
      // Определяем, началось ли перетаскивание (движение > 5px)
      const deltaX = Math.abs(e.clientX - clickStartPos.x);
      const deltaY = Math.abs(e.clientY - clickStartPos.y);
      
      if (deltaX > 5 || deltaY > 5) {
        setIsTaskDragging(true);
      }
      
      if (isTaskDragging || deltaX > 5 || deltaY > 5) {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
          const canvasX = (e.clientX - rect.left - offset.x) / scale;
          const canvasY = (e.clientY - rect.top - offset.y) / scale;
          
          // Вычисляем новую позицию БЕЗ привязки к сетке (для плавного движения)
          const newX = canvasX - dragOffset.x;
          const newY = canvasY - dragOffset.y;
          
          // Сохраняем визуальную позицию для плавного перетаскивания (без обновления tasks)
          setDragPosition({ x: newX, y: newY });
        }
      }
    };

    const handleGlobalMouseUp = (e: MouseEvent) => {
      if (draggingTask) {
        const wasDragging = isTaskDragging || 
          Math.abs(e.clientX - clickStartPos.x) > 5 || 
          Math.abs(e.clientY - clickStartPos.y) > 5;
          
        if (wasDragging) {
          // Это было перетаскивание - сохраняем позицию с привязкой к сетке
          const finalPosition = dragPosition || tasks.find((t) => t.id === draggingTask.id);
          if (finalPosition && 'x' in finalPosition) {
            // Используем позицию из dragPosition (плавное движение без сетки)
            const snappedX = Math.round(finalPosition.x / GRID_SIZE) * GRID_SIZE;
            const snappedY = Math.round(finalPosition.y / GRID_SIZE) * GRID_SIZE;
            
            handleUpdateTask(draggingTask.id, {
              position_x: snappedX,
              position_y: snappedY,
            });
          } else if (finalPosition && 'position_x' in finalPosition) {
            // Fallback: используем позицию из tasks
            const snappedX = Math.round((finalPosition as Task).position_x / GRID_SIZE) * GRID_SIZE;
            const snappedY = Math.round((finalPosition as Task).position_y / GRID_SIZE) * GRID_SIZE;
            
            handleUpdateTask(draggingTask.id, {
              position_x: snappedX,
              position_y: snappedY,
            });
          }
        } else {
          // Это был клик - НЕ открываем панель настроек автоматически
          // Панель открывается только при клике в правой зоне
        }
        setDraggingTask(null);
        setIsTaskDragging(false);
        setDragPosition(null);
      }
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [draggingTask, dragOffset, offset, scale, tasks, isTaskDragging, clickStartPos, isPanning, dragPosition]);

  // Обработчики для перетаскивания линии соединения
  useEffect(() => {
    if (!connectingFrom) return;

    const handleGlobalMouseMove = (e: MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const canvasX = (e.clientX - rect.left - offset.x) / scale;
        const canvasY = (e.clientY - rect.top - offset.y) / scale;
        setConnectingTo({ x: canvasX, y: canvasY });
      }
    };

    const handleGlobalMouseUp = async (e: MouseEvent) => {
      // Проверяем, был ли клик на кружке соединения другой задачи
      const target = e.target as HTMLElement;
      const connectionPoint = target.closest('[data-connection-point]');
      
      if (connectionPoint && connectingFrom) {
        const toTaskId = connectionPoint.getAttribute('data-task-id');
        const toEdge = connectionPoint.getAttribute('data-edge') as 'top' | 'bottom' | 'left' | 'right';
        
        if (toTaskId && toEdge && toTaskId !== connectingFrom.taskId) {
          // Создаем соединение
          try {
            await createTaskConnection(
              projectId,
              connectingFrom.taskId,
              toTaskId,
              connectingFrom.edge,
              toEdge
            );
            // Обновляем список соединений
            await loadTaskConnections();
            toast.success('Задачи соединены');
          } catch (error: any) {
            console.error('Error creating connection:', error);
            // Проверяем, нужна ли миграция
            if (error.needsMigration) {
              toast.error(
                `Ошибка: требуется миграция базы данных. Выполните SQL из файла: ${error.migrationFile}`,
                {
                  duration: 10000,
                  description: `Файл миграции: backend/migrations/${error.migrationFile}`
                }
              );
            } else {
              const errorMessage = error.message || error.error || 'Ошибка при создании соединения';
              toast.error(errorMessage);
            }
          }
        }
      }
      
      setConnectingFrom(null);
      setConnectingTo(null);
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [connectingFrom, offset, scale, projectId]);

  // Закрытие модального окна изображения по Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedImage) {
        setSelectedImage(null);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [selectedImage]);

  // Закрытие контекстного меню при клике вне его
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenu.type) {
        setContextMenu({ x: 0, y: 0, type: null, taskId: undefined });
      }
      // Закрываем меню выбора исполнителя
      if (openAssigneeMenu) {
        const target = e.target as HTMLElement;
        // Проверяем, что клик не был на элементе внутри меню или на кнопке
        const isInsideMenu = target.closest('[data-assignee-menu]');
        const isOnButton = target.closest('[data-assignee-button]');
        // Также проверяем, что это не кнопка внутри меню
        const isMenuButton = target.closest('[data-assignee-menu] button');
        // Проверяем, что это не элемент внутри кнопки (например, span или img)
        const isInsideButton = target.closest('[data-assignee-button]') && target !== target.closest('[data-assignee-button]');
        
        if (!isInsideMenu && !isOnButton && !isMenuButton && !isInsideButton) {
          setOpenAssigneeMenu(null);
        }
      }
    };

    if (contextMenu.type || openAssigneeMenu) {
      window.addEventListener('click', handleClickOutside);
      return () => window.removeEventListener('click', handleClickOutside);
    }
  }, [contextMenu.type, openAssigneeMenu]);

  // Обработка изменения размера задачи
  useEffect(() => {
    if (!isResizing || !resizingTask) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = (e.clientX - resizeStart.x) / scale;
      const deltaY = (e.clientY - resizeStart.y) / scale;
      
      const newWidth = Math.max(120, Math.round(resizeStart.width + deltaX));
      const newHeight = Math.max(30, Math.round(resizeStart.height + deltaY));
      
      // Обновляем задачу в UI
      setTasks((prev) =>
        prev.map((t) =>
          t.id === resizingTask.id
            ? { ...t, width: newWidth, height: newHeight }
            : t
        )
      );
    };

    const handleMouseUp = async () => {
      if (resizingTask) {
        // Получаем актуальное состояние задачи
        const currentTask = tasks.find((t) => t.id === resizingTask.id);
        if (currentTask) {
          // Сохраняем размер в базу
          await handleUpdateTask(resizingTask.id, {
            width: currentTask.width,
            height: currentTask.height,
          });
        }
      }
      setIsResizing(false);
      setResizingTask(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, resizingTask, resizeStart, scale, tasks]);

  // Вычисляем canEdit до условных возвратов
  // Получаем ID текущего пользователя из localStorage
  const currentUserId = typeof window !== 'undefined' 
    ? JSON.parse(localStorage.getItem('user') || '{}').id 
    : null;
  
  // Определяем роль: если не пришла с сервера, проверяем по owner_id
  const userRole = project?.role || (project?.owner_id === currentUserId ? 'owner' : undefined);
  
  const isOwner = userRole === 'owner';
  const canEdit = userRole === 'owner' || userRole === 'editor';
  
  // Фильтрация задач (вычисляем до хуков)
  const filteredTasks = tasks.filter((task) => {
    // Фильтр по исполнителям
    if (filters.assignees.length > 0 && !filters.assignees.includes(task.assignee_id || '')) {
      return false;
    }

    // Фильтр по статусам
    if (filters.statuses.length > 0 && !filters.statuses.includes(task.status)) {
      return false;
    }

    // Фильтр по дедлайнам
    if (filters.deadlineFilter !== 'all' && task.deadline) {
      const deadline = new Date(task.deadline);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const taskDate = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());

      if (filters.deadlineFilter === 'overdue' && taskDate >= today) return false;
      if (filters.deadlineFilter === 'today' && taskDate.getTime() !== today.getTime()) return false;
      if (filters.deadlineFilter === 'week') {
        const weekFromNow = new Date(today);
        weekFromNow.setDate(weekFromNow.getDate() + 7);
        if (taskDate < today || taskDate > weekFromNow) return false;
      }
    }

    return true;
  });

  // Отладка
  useEffect(() => {
    console.log('Project role:', project?.role, 'canEdit:', canEdit);
    console.log('Tasks count:', tasks.length, 'Filtered tasks count:', filteredTasks.length);
  }, [project?.role, canEdit, tasks.length, filteredTasks.length]);
  
  useEffect(() => {
    if (contextMenu.type) {
      console.log('Context menu state:', contextMenu);
    }
  }, [contextMenu]);

  // Функция для вычисления и установки позиции панели настроек
  const openSettingsPanel = (task: Task) => {
    if (!canvasRef.current) {
      return;
    }
    
    const taskX = task.position_x || 0;
    const taskY = task.position_y || 0;
    const taskWidth = 240; // ширина карточки задачи
    
    // Преобразуем координаты канваса в экранные координаты
    const rect = canvasRef.current.getBoundingClientRect();
    if (!rect) {
      return;
    }
    
    const screenX = rect.left + (taskX * scale) + offset.x + taskWidth + 20; // справа от задачи + отступ
    const screenY = rect.top + (taskY * scale) + offset.y;
    
    // Проверяем, не выходит ли панель за границы экрана
    const panelWidth = 320; // w-80 = 320px
    const panelHeight = 400; // примерная высота
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1920;
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 1080;
    
    let finalX = screenX;
    let finalY = screenY;
    
    // Если панель выходит за правый край, размещаем слева от задачи
    if (screenX + panelWidth > viewportWidth) {
      finalX = rect.left + (taskX * scale) + offset.x - panelWidth - 20; // слева от задачи
    }
    
    // Если панель выходит за нижний край, выравниваем по верху
    if (screenY + panelHeight > viewportHeight) {
      finalY = Math.max(80, viewportHeight - panelHeight - 20);
    }
    
    // Если панель выходит за верхний край
    if (screenY < 80) {
      finalY = 80;
    }
    
    setSettingsPanelPosition({ x: finalX, y: finalY });
  };

  const loadProject = async () => {
    try {
      const data = await getProject(projectId);
      setProject(data);
      setEditedName(data.name);
    } catch (error: any) {
      console.error('Error loading project:', error);
    }
  };

  const loadMembers = async () => {
    try {
      const data = await getProjectMembers(projectId);
      console.log('Loaded members:', data);
      setMembers(data || []);
    } catch (error: any) {
      console.error('Error loading members:', error);
      setMembers([]);
    }
  };

  const loadTasks = async () => {
    try {
      setError(null);
      const data = await getTasks(projectId);
      setTasks(data || []);
      // Инициализируем локальные названия задач (сохраняем как HTML для форматирования)
      const titles: Record<string, string> = {};
      (data || []).forEach((task: Task) => {
        // Если title содержит HTML теги, сохраняем их, иначе оборачиваем в текст
        titles[task.id] = task.title || '';
      });
      setTaskTitles(titles);
      
      // Инициализируем изображения задач (всегда, даже если массив пустой)
      // Нормализуем формат изображений при загрузке
      setTaskImages(
        data.reduce((acc: Record<string, string[]>, task: Task) => {
          const images = Array.isArray(task.images) ? task.images : [];
          // Нормализуем каждое изображение
          acc[task.id] = images
            .map((img: string) => normalizeImageSrc(img) || img)
            .filter(Boolean) as string[];
          return acc;
        }, {})
      );
      
      // Инициализируем файлы задач (всегда, даже если массив пустой)
      setTaskFiles(
        data.reduce((acc: Record<string, Array<{ name: string; data: string; type: string }>>, task: Task) => {
          acc[task.id] = Array.isArray(task.files) ? task.files : [];
          return acc;
        }, {})
      );
      
      // Загружаем содержимое для задач с has_content = true
      const tasksWithContent = (data || []).filter((task: Task) => task.has_content);
      for (const task of tasksWithContent) {
        loadTaskContent(task.id);
      }
    } catch (error: any) {
      console.error('Error loading tasks:', error);
      if (error.message.includes('401') || error.message.includes('403')) {
        router.push('/auth/login');
        return;
      }
      setError(error.message || 'Ошибка загрузки задач');
    } finally {
      setLoading(false);
    }
  };

  const loadTaskConnections = async () => {
    try {
      const connections = await getTaskConnections(projectId);
      setTaskConnections(connections || []);
    } catch (error: any) {
      console.error('Error loading task connections:', error);
    }
  };

  const handleCreateTask = async (x: number, y: number, parentId?: string) => {
    try {
      const newTask = await createTask(projectId, {
        title: '',
        positionX: x,
        positionY: y,
        parentId: parentId || null,
      });
      setTasks([...tasks, newTask]);
      setTaskTitles((prev) => ({
        ...prev,
        [newTask.id]: newTask.title || '',
      }));
      return newTask;
    } catch (error: any) {
      console.error('Error creating task:', error);
      return null;
    }
  };

  const handleUpdateTask = async (taskId: string, updates: any) => {
    try {
      const updated = await updateTask(taskId, updates);
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
      
      // Обновляем изображения в локальном состоянии, если они были обновлены
      if (updates.images !== undefined) {
        setTaskImages((prev) => ({
          ...prev,
          [taskId]: Array.isArray(updates.images) ? updates.images : (updates.images === null ? [] : prev[taskId] || []),
        }));
      }
      
      // Обновляем файлы в локальном состоянии, если они были обновлены
      if (updates.files !== undefined) {
        setTaskFiles((prev) => ({
          ...prev,
          [taskId]: Array.isArray(updates.files) ? updates.files : (updates.files === null ? [] : prev[taskId] || []),
        }));
      }
    } catch (error: any) {
      console.error('Error updating task:', error);
      console.error('Error details:', error.details);
      console.error('Error pgError:', error.pgError);
      
      // Используем понятное сообщение для пользователя, если оно есть
      const userMessage = error.userMessage || error.message || error.details || 'Ошибка обновления задачи';
      
      // Если нужна миграция, показываем специальное сообщение
      if (error.needsMigration && error.migrationFile) {
        const migrationName = error.migrationFile.replace('.sql', '');
        toast.error(
          `Поле не найдено в базе данных. Примените миграцию: ${error.migrationFile}`,
          {
            duration: 10000,
            description: `Выполните SQL из файла backend/migrations/${error.migrationFile} или запустите: node backend/scripts/check-migrations.js`
          }
        );
      } else {
        toast.error(userMessage);
      }
    }
  };

  // Загрузка содержимого задачи
  const loadTaskContent = async (taskId: string) => {
    try {
      const content = await getTaskContent(taskId);
      setTaskContentItems((prev) => ({
        ...prev,
        [taskId]: content,
      }));
    } catch (error: any) {
      console.error('Error loading task content:', error);
    }
  };

  // Добавление элемента содержимого
  const handleAddContentItem = async (taskId: string) => {
    try {
      const items = taskContentItems[taskId] || [];
      const newItem = await createTaskContentItem(taskId, {
        content: '',
        position: items.length,
      });
      setTaskContentItems((prev) => ({
        ...prev,
        [taskId]: [...(prev[taskId] || []), newItem],
      }));
    } catch (error: any) {
      toast.error(error.message || 'Ошибка добавления элемента');
    }
  };

  // Обновление элемента содержимого
  const handleUpdateContentItem = async (taskId: string, itemId: string, updates: { content?: string; completed?: boolean }) => {
    try {
      const updated = await updateTaskContentItem(taskId, itemId, updates);
      setTaskContentItems((prev) => ({
        ...prev,
        [taskId]: (prev[taskId] || []).map((item) => (item.id === itemId ? updated : item)),
      }));
    } catch (error: any) {
      console.error('Error updating content item:', error);
    }
  };

  // Удаление элемента содержимого
  const handleDeleteContentItem = async (taskId: string, itemId: string) => {
    try {
      await deleteTaskContentItem(taskId, itemId);
      setTaskContentItems((prev) => ({
        ...prev,
        [taskId]: (prev[taskId] || []).filter((item) => item.id !== itemId),
      }));
      // Обновляем задачу в списке
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id === taskId) {
            const remaining = (taskContentItems[taskId] || []).filter((item) => item.id !== itemId);
            return { ...t, has_content: remaining.length > 0 };
          }
          return t;
        })
      );
    } catch (error: any) {
      toast.error(error.message || 'Ошибка удаления элемента');
    }
  };

  // Переключение состояния выполнения элемента
  const handleToggleContentComplete = async (taskId: string, itemId: string, completed: boolean) => {
    await handleUpdateContentItem(taskId, itemId, { completed });
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Удалить задачу?')) return;

    try {
      await deleteTask(taskId);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      setSelectedTask(null);
    } catch (error: any) {
      alert(error.message || 'Ошибка удаления задачи');
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Не начинаем панорамирование, если клик был на задаче
    if ((e.target as HTMLElement).closest('[data-task-id]')) {
      return;
    }
    
    // Средняя кнопка мыши (колесико) для панорамирования
    if (e.button === 1) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
      return;
    }
    // Space + левая кнопка для панорамирования
    if (isSpacePressed && e.button === 0) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    // Не панорамируем, если перетаскиваем задачу
    if (isPanning && !draggingTask && !isTaskDragging) {
      setOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (e.button === 1 || isPanning) {
      setIsPanning(false);
    }
  };

  const handleCanvasDoubleClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.canvasContent) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        handleCreateTask(e.clientX - rect.left, e.clientY - rect.top);
      }
    }
  };

  const handleContextMenu = (e: React.MouseEvent, taskId?: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Для задач нужны права редактирования
    if (taskId && !canEdit) {
      return;
    }
    
    console.log('Setting context menu:', { x: e.clientX, y: e.clientY, type: taskId ? 'task' : 'canvas', taskId });
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      type: taskId ? 'task' : 'canvas',
      taskId: taskId,
    });
  };

  const handleCreateTaskFromContext = async (screenX: number, screenY: number, withContent: boolean = false) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      const canvasX = (screenX - rect.left - offset.x) / scale;
      const canvasY = (screenY - rect.top - offset.y) / scale;
      const snappedX = Math.round(canvasX / GRID_SIZE) * GRID_SIZE;
      const snappedY = Math.round(canvasY / GRID_SIZE) * GRID_SIZE;

      const newTask = await handleCreateTask(snappedX, snappedY);
      if (newTask && withContent) {
        try {
          await enableTaskContent(newTask.id);
          // Обновляем задачу в списке
          setTasks((prev) =>
            prev.map((t) => (t.id === newTask.id ? { ...t, has_content: true } : t))
          );
        } catch (error: any) {
          console.error('Error enabling content:', error);
        }
      }
    }
    setContextMenu({ x: 0, y: 0, type: null, taskId: undefined });
  };


  const handleTaskMouseDown = (e: React.MouseEvent, task: Task) => {
    console.log('handleTaskMouseDown called', { button: e.button, canEdit, taskId: task.id });
    
    // Перемещение задачи работает при нажатии колесиком мыши (button === 1)
    if (e.button !== 1) {
      console.log('Not middle button, ignoring');
      return;
    }
    
    if (!canEdit) {
      console.log('No edit permission, ignoring');
      return;
    }
    
    // Не начинаем drag при клике на textarea или кнопке
    const target = e.target as HTMLElement;
    if (target.tagName === 'TEXTAREA' || 
        target.tagName === 'BUTTON' || 
        target.closest('button') ||
        target.closest('textarea') ||
        target.closest('[data-resize-handle]')) {
      console.log('Clicked on interactive element, ignoring drag');
      return;
    }
    
    e.preventDefault();
    e.stopPropagation();
    
    console.log('Starting task drag', task.id);
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      const screenX = e.clientX;
      const screenY = e.clientY;
      const canvasX = (screenX - rect.left - offset.x) / scale;
      const canvasY = (screenY - rect.top - offset.y) / scale;
      
      // Сохраняем начальную позицию для определения клика vs перетаскивания
      setClickStartPos({ x: screenX, y: screenY });
      setDraggingTask(task);
      setDragStartPos({ x: canvasX, y: canvasY });
      setDragOffset({
        x: canvasX - (task.position_x || 0),
        y: canvasY - (task.position_y || 0),
      });
      setIsTaskDragging(false);
    }
  };

  const handleTaskClick = (e: React.MouseEvent, task: Task, isFiltered: boolean) => {
    // Если это был клик (не перетаскивание), выбираем задачу
    if (!isTaskDragging && !isFiltered) {
      setSelectedTask(task);
    }
  };


  const snapToGrid = (value: number) => {
    return Math.round(value / GRID_SIZE) * GRID_SIZE;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-neutral-950 via-zinc-950 to-neutral-900">
        <div className="text-center">
          <p className="text-white text-lg">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (error) {
  return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-zinc-950 to-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-lg mb-4">Ошибка: {error}</p>
          <button
            onClick={() => {
              setError(null);
              setLoading(true);
              loadTasks();
            }}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          >
            Попробовать снова
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-neutral-950 via-zinc-950 to-neutral-900">
      {/* Верхняя панель (Header) */}
      <header className="fixed top-0 left-0 right-0 h-16 z-50 border-b border-white/[0.08] bg-zinc-950/60 backdrop-blur-2xl px-6 py-3.5">
        <div className="flex items-center justify-between h-full">
          {/* Левая часть */}
          <div className="flex items-center gap-4">
        <button
          onClick={() => router.push('/projects')}
              className="rounded-xl p-2 text-white/50 transition-all hover:bg-white/[0.06] hover:text-white"
        >
              <ArrowLeft className="h-5 w-5" />
        </button>

            {!isEditingName ? (
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight text-white">
                  {project?.name || 'Проект'}
                </h1>
                {isOwner && (
                  <button
                    onClick={() => setIsEditingName(true)}
                    className="rounded-lg p-1.5 text-white/30 hover:bg-white/[0.06] hover:text-white/70"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                )}
      </div>
            ) : (
              <div className="flex items-center gap-2">
                <Input
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter') {
                      if (project && editedName.trim() && editedName !== project.name) {
                        try {
                          const updated = await updateProject(project.id, { name: editedName.trim() });
                          setProject(updated);
                          setIsEditingName(false);
                        } catch (error: any) {
                          alert(error.message || 'Ошибка обновления названия');
                          setEditedName(project.name);
                        }
                      } else {
                        setIsEditingName(false);
                      }
                    }
                    if (e.key === 'Escape') {
                      setIsEditingName(false);
                      setEditedName(project?.name || '');
                    }
                  }}
                  className="h-9 w-64 border-white/[0.12] bg-white/[0.04] text-white placeholder:text-white/40"
                  autoFocus
                />
                <button
                  onClick={async () => {
                    if (project && editedName.trim() && editedName !== project.name) {
                      try {
                        const updated = await updateProject(project.id, { name: editedName.trim() });
                        setProject(updated);
                        setIsEditingName(false);
                      } catch (error: any) {
                        alert(error.message || 'Ошибка обновления названия');
                        setEditedName(project.name);
                      }
                    } else {
                      setIsEditingName(false);
                    }
                  }}
                  className="rounded-lg p-2 text-emerald-400 hover:bg-emerald-500/10"
                >
                  <Check className="h-4 w-4" />
                </button>
              </div>
            )}

            {project?.is_public && (
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/[0.15] px-3 py-1.5 text-xs font-medium text-emerald-400 ring-1 ring-emerald-500/20">
                <Globe className="h-3 w-3" />
                Публичный
              </span>
            )}

            {!canEdit && (
              <span className="flex items-center gap-1.5 rounded-full bg-amber-500/[0.15] px-3 py-1.5 text-xs font-medium text-amber-400 ring-1 ring-amber-500/20">
                <Lock className="h-3 w-3" />
                Только просмотр
              </span>
            )}
          </div>

          {/* Правая часть */}
          <div className="flex items-center gap-3">
            <OnlineUsersDropdown
              projectId={projectId}
              members={members}
              currentUserId={currentUserId || ''}
              isOwner={isOwner}
              onMemberRemoved={() => {
                loadMembers();
              }}
            />

            {isOwner && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 hover:bg-white/[0.06]"
                onClick={() => setShowSettingsDialog(true)}
              >
                <Settings className="h-4 w-4" />
              </Button>
            )}

            {/* Контрол масштабирования */}
            <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-2 py-1">
              <button
                onClick={() => setScale((s) => Math.min(2, s + 0.1))}
                className="rounded-lg p-1.5 text-white/70 hover:bg-white/[0.08] hover:text-white transition-all"
              >
                <ChevronUp className="h-4 w-4" />
              </button>
              <span className="min-w-[56px] text-center text-sm font-medium text-white/90">
                {Math.round(scale * 100)}%
              </span>
              <button
                onClick={() => setScale((s) => Math.max(0.3, s - 0.1))}
                className="rounded-lg p-1.5 text-white/70 hover:bg-white/[0.08] hover:text-white transition-all"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Основная область - Канвас */}
      <div className="flex-1 overflow-hidden mt-16 relative">
        {/* Панель фильтров */}
        <FiltersPanel
          isOpen={isFilterOpen}
          onToggle={() => setIsFilterOpen(!isFilterOpen)}
          tasks={tasks}
          members={members}
          filters={filters}
          onFiltersChange={setFilters}
          currentUserId={currentUserId}
          taskContentItems={taskContentItems}
          onLoadTaskContent={loadTaskContent}
          onTaskClick={(task) => {
            setSelectedTask(task);
            // Центрируем задачу на канвасе
            if (canvasRef.current) {
              const canvasRect = canvasRef.current.getBoundingClientRect();
              const centerX = canvasRect.width / 2;
              const centerY = canvasRect.height / 2;
              const taskX = task.position_x * scale + offset.x;
              const taskY = task.position_y * scale + offset.y;
              const newOffsetX = offset.x + (centerX - taskX);
              const newOffsetY = offset.y + (centerY - taskY);
              setOffset({ x: newOffsetX, y: newOffsetY });
            }
          }}
        />

        <div
          ref={canvasRef}
          className="relative w-full h-full overflow-hidden"
          style={{
            cursor: isPanning ? 'grabbing' : isSpacePressed ? 'grab' : 'default',
            backgroundImage: `
              linear-gradient(to right, rgba(255, 255, 255, 0.01) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(255, 255, 255, 0.01) 1px, transparent 1px)
            `,
            backgroundSize: `${GRID_SIZE * scale}px ${GRID_SIZE * scale}px`,
            backgroundPosition: `${offset.x}px ${offset.y}px`,
          }}
          onMouseDown={(e) => {
            // Не обрабатываем, если клик на задаче
            if ((e.target as HTMLElement).closest('[data-task-id]')) {
              return;
            }
            // Обрабатываем среднюю кнопку мыши для панорамирования
            if (e.button === 1) {
              e.preventDefault();
            }
            handleMouseDown(e);
          }}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onDoubleClick={handleCanvasDoubleClick}
          onContextMenu={(e) => {
            // Не обрабатываем, если клик на задаче
            if ((e.target as HTMLElement).closest('[data-task-id]')) {
              return;
            }
            handleContextMenu(e);
          }}
          onAuxClick={(e) => {
            // Предотвращаем прокрутку при клике средней кнопкой
            if (e.button === 1) {
              e.preventDefault();
            }
          }}
        >
          <div
            data-canvas-content
            className="relative"
            style={{
              transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})`,
              transformOrigin: '0 0',
              width: `${CANVAS_WIDTH}px`,
              height: `${CANVAS_HEIGHT}px`,
              willChange: 'transform',
              imageRendering: 'crisp-edges',
              WebkitFontSmoothing: 'antialiased',
              MozOsxFontSmoothing: 'grayscale',
              textRendering: 'optimizeLegibility',
              backfaceVisibility: 'hidden',
            }}
          >
            {/* Связи между задачами (нити) */}
            <svg
              className="absolute left-0 top-0"
              style={{
                width: `${CANVAS_WIDTH}px`,
                height: `${CANVAS_HEIGHT}px`,
                overflow: 'visible',
                zIndex: 1,
                willChange: 'transform',
                transform: 'translate3d(0, 0, 0)',
              }}
            >
              {tasks
                .filter((task) => task.parent_id)
                .map((task) => {
                  const parent = tasks.find((t) => t.id === task.parent_id);
                  if (!parent) return null;

                  // Проверяем фильтры для обоих блоков
                  const isParentFiltered = !filteredTasks.find((t) => t.id === parent.id);
                  const isChildFiltered = !filteredTasks.find((t) => t.id === task.id);
                  const isConnectionFiltered = isParentFiltered || isChildFiltered;

                  // Проверяем, перетаскивается ли родитель или дочерняя задача
                  const isParentDragging = draggingTask?.id === parent.id;
                  const isChildDragging = draggingTask?.id === task.id;
                  
                  // Получаем координаты задачи
                  const parentPos = getTaskCanvasPosition(parent, isParentDragging, dragPosition);
                  const parentCanvasX = parentPos.x;
                  const parentCanvasY = parentPos.y;
                  const parentCanvasWidth = parent.width || TASK_WIDTH;
                  // Используем только кэшированную высоту (обновляется через ResizeObserver)
                  const parentCanvasHeight = taskHeightsRef.current.get(parent.id) || (parent.height || 150);

                  const childPos = getTaskCanvasPosition(task, isChildDragging, dragPosition);
                  const childCanvasX = childPos.x;
                  const childCanvasY = childPos.y;
                  const childCanvasWidth = task.width || TASK_WIDTH;
                  // Используем только кэшированную высоту (обновляется через ResizeObserver)
                  const childCanvasHeight = taskHeightsRef.current.get(task.id) || (task.height || 150);

                  // Точка выхода: нижний центр родительской задачи
                  const startX = parentCanvasX + parentCanvasWidth / 2;
                  const startY = parentCanvasY + parentCanvasHeight;
                  
                  // Точка входа: верхний центр дочерней задачи
                  const endX = childCanvasX + childCanvasWidth / 2;
                  const endY = childCanvasY;
                  
                  // Вычисляем ортогональный путь с обходом препятствий
                  // Родитель выходит снизу (bottom), дочерняя задача входит сверху (top)
                  const path = calculateOrthogonalPath(startX, startY, endX, endY, [parent.id, task.id], 'bottom', 'top');

                  // Получаем цвета для линии соединения
                  const connectionColor = getConnectionColor(parent, task);
                  const circleColor = getConnectionCircleColor(parent, task);
                  const hoverColor = getConnectionHoverColor(parent, task);
                  const circleHoverColor = getConnectionCircleHoverColor(parent, task);

                  const handleDeleteParentConnection = async (e: React.MouseEvent) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    if (!canEdit) return;
                    
                    try {
                      // Удаляем parent_id у дочерней задачи
                      await updateTask(task.id, { parent_id: null });
                      toast.success('Связь удалена');
                    } catch (error) {
                      console.error('Ошибка при удалении связи:', error);
                      toast.error('Не удалось удалить связь');
                    }
                  };

                  return (
                    <g 
                      key={`parent-child-${task.id}`}
                      className="group cursor-pointer"
                      style={{ pointerEvents: canEdit ? 'auto' : 'none' }}
                    >
                      <path
                        d={path}
                        stroke={connectionColor}
                        strokeWidth="2"
                        fill="none"
                        className="transition-all"
                        onClick={handleDeleteParentConnection}
                        style={{ 
                          cursor: canEdit ? 'pointer' : 'default',
                          pointerEvents: 'stroke',
                          opacity: isConnectionFiltered ? 0.25 : 1,
                          filter: isConnectionFiltered ? 'grayscale(0.8)' : 'none',
                        }}
                        onMouseEnter={(e) => {
                          if (!isConnectionFiltered) {
                            e.currentTarget.setAttribute('stroke', hoverColor);
                            e.currentTarget.setAttribute('stroke-width', '3');
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.setAttribute('stroke', connectionColor);
                          e.currentTarget.setAttribute('stroke-width', '2');
                        }}
                      />
                      <circle 
                        cx={startX} 
                        cy={startY} 
                        r="4" 
                        fill={circleColor}
                        className="transition-all"
                        onClick={handleDeleteParentConnection}
                        style={{ 
                          pointerEvents: 'all',
                          opacity: isConnectionFiltered ? 0.25 : 1,
                          filter: isConnectionFiltered ? 'grayscale(0.8)' : 'none',
                        }}
                        onMouseEnter={(e) => {
                          if (!isConnectionFiltered) {
                            e.currentTarget.setAttribute('fill', circleHoverColor);
                            e.currentTarget.setAttribute('r', '5');
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.setAttribute('fill', circleColor);
                          e.currentTarget.setAttribute('r', '4');
                        }}
                      />
                      <circle 
                        cx={endX} 
                        cy={endY} 
                        r="4" 
                        fill={circleColor}
                        className="transition-all"
                        onClick={handleDeleteParentConnection}
                        style={{ 
                          pointerEvents: 'all',
                          opacity: isConnectionFiltered ? 0.25 : 1,
                          filter: isConnectionFiltered ? 'grayscale(0.8)' : 'none',
                        }}
                        onMouseEnter={(e) => {
                          if (!isConnectionFiltered) {
                            e.currentTarget.setAttribute('fill', circleHoverColor);
                            e.currentTarget.setAttribute('r', '5');
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.setAttribute('fill', circleColor);
                          e.currentTarget.setAttribute('r', '4');
                        }}
                      />
                    </g>
                  );
                })}
              
              {/* Соединения через кружки */}
              {taskConnections.map((connection) => {
                const fromTask = tasks.find((t) => t.id === connection.from_task_id);
                const toTask = tasks.find((t) => t.id === connection.to_task_id);
                if (!fromTask || !toTask) return null;

                // Проверяем фильтры для обоих блоков
                const isFromFiltered = !filteredTasks.find((t) => t.id === fromTask.id);
                const isToFiltered = !filteredTasks.find((t) => t.id === toTask.id);
                const isConnectionFiltered = isFromFiltered || isToFiltered;

                // Проверяем, перетаскивается ли fromTask
                const isFromDragging = draggingTask?.id === fromTask.id;
                const isToDragging = draggingTask?.id === toTask.id;

                // Получаем координаты задач
                const fromPos = getTaskCanvasPosition(fromTask, isFromDragging, dragPosition);
                const fromCanvasX = fromPos.x;
                const fromCanvasY = fromPos.y;
                const fromWidth = fromTask.width || TASK_WIDTH;
                // Используем только кэшированную высоту (обновляется через ResizeObserver)
                const fromHeight = taskHeightsRef.current.get(fromTask.id) || (fromTask.height || 150);

                const toPos = getTaskCanvasPosition(toTask, isToDragging, dragPosition);
                const toCanvasX = toPos.x;
                const toCanvasY = toPos.y;
                const toWidth = toTask.width || TASK_WIDTH;
                // Используем только кэшированную высоту (обновляется через ResizeObserver)
                const toHeight = taskHeightsRef.current.get(toTask.id) || (toTask.height || 150);

                // Вычисляем координаты кружков в зависимости от грани
                let startX = 0, startY = 0, endX = 0, endY = 0;

                switch (connection.from_edge) {
                  case 'top':
                    startX = fromCanvasX + fromWidth / 2;
                    startY = fromCanvasY;
                    break;
                  case 'bottom':
                    startX = fromCanvasX + fromWidth / 2;
                    startY = fromCanvasY + fromHeight;
                    break;
                  case 'left':
                    startX = fromCanvasX;
                    startY = fromCanvasY + fromHeight / 2;
                    break;
                  case 'right':
                    startX = fromCanvasX + fromWidth;
                    startY = fromCanvasY + fromHeight / 2;
                    break;
                }

                switch (connection.to_edge) {
                  case 'top':
                    endX = toCanvasX + toWidth / 2;
                    endY = toCanvasY;
                    break;
                  case 'bottom':
                    endX = toCanvasX + toWidth / 2;
                    endY = toCanvasY + toHeight;
                    break;
                  case 'left':
                    endX = toCanvasX;
                    endY = toCanvasY + toHeight / 2;
                    break;
                  case 'right':
                    endX = toCanvasX + toWidth;
                    endY = toCanvasY + toHeight / 2;
                    break;
                }

                // Вычисляем ортогональный путь с обходом препятствий
                const path = calculateOrthogonalPath(startX, startY, endX, endY, [fromTask.id, toTask.id], connection.from_edge, connection.to_edge);

                // Получаем цвета для линии соединения
                const connectionColor = getConnectionColor(fromTask, toTask);
                const circleColor = getConnectionCircleColor(fromTask, toTask);
                const hoverColor = getConnectionHoverColor(fromTask, toTask);
                const circleHoverColor = getConnectionCircleHoverColor(fromTask, toTask);

                const handleDeleteConnection = async (e: React.MouseEvent) => {
                  e.preventDefault();
                  e.stopPropagation();
                  
                  if (!canEdit || !connection.id) return;
                  
                  // Оптимистичное обновление - удаляем из UI сразу
                  setTaskConnections((prev) => prev.filter((c) => c.id !== connection.id));
                  
                  try {
                    await deleteTaskConnection(projectId, connection.id);
                    toast.success('Соединение удалено');
                  } catch (error: any) {
                    // Если соединение уже не найдено, это нормально - оно уже удалено
                    if (error?.message?.includes('not found') || 
                        error?.message?.includes('Connection not found') ||
                        error?.message?.toLowerCase().includes('connection')) {
                      // Соединение уже не существует, ничего не делаем
                      return;
                    }
                    // Если другая ошибка, возвращаем соединение в список
                    setTaskConnections((prev) => {
                      if (!prev.find((c) => c.id === connection.id)) {
                        return [...prev, connection];
                      }
                      return prev;
                    });
                    console.error('Ошибка при удалении соединения:', error);
                    toast.error('Не удалось удалить соединение');
                  }
                };

                return (
                  <g 
                    key={`connection-${connection.id}`}
                    className="group cursor-pointer"
                    style={{ pointerEvents: canEdit ? 'auto' : 'none' }}
                  >
                    <path
                      d={path}
                      stroke={connectionColor}
                      strokeWidth="2"
                      fill="none"
                      className="transition-all"
                      onClick={handleDeleteConnection}
                      style={{ 
                        cursor: canEdit ? 'pointer' : 'default',
                        pointerEvents: 'stroke',
                        opacity: isConnectionFiltered ? 0.25 : 1,
                        filter: isConnectionFiltered ? 'grayscale(0.8)' : 'none',
                      }}
                      onMouseEnter={(e) => {
                        if (!isConnectionFiltered) {
                          e.currentTarget.setAttribute('stroke', hoverColor);
                          e.currentTarget.setAttribute('stroke-width', '3');
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.setAttribute('stroke', connectionColor);
                        e.currentTarget.setAttribute('stroke-width', '2');
                      }}
                    />
                    <circle 
                      cx={startX} 
                      cy={startY} 
                      r="4" 
                      fill={circleColor}
                      className="transition-all"
                      onClick={handleDeleteConnection}
                      style={{ 
                        pointerEvents: 'all',
                        opacity: isConnectionFiltered ? 0.25 : 1,
                        filter: isConnectionFiltered ? 'grayscale(0.8)' : 'none',
                      }}
                      onMouseEnter={(e) => {
                        if (!isConnectionFiltered) {
                          e.currentTarget.setAttribute('fill', circleHoverColor);
                          e.currentTarget.setAttribute('r', '5');
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.setAttribute('fill', circleColor);
                        e.currentTarget.setAttribute('r', '4');
                      }}
                    />
                    <circle 
                      cx={endX} 
                      cy={endY} 
                      r="4" 
                      fill={circleColor}
                      className="transition-all"
                      onClick={handleDeleteConnection}
                      style={{ 
                        pointerEvents: 'all',
                        opacity: isConnectionFiltered ? 0.25 : 1,
                        filter: isConnectionFiltered ? 'grayscale(0.8)' : 'none',
                      }}
                      onMouseEnter={(e) => {
                        if (!isConnectionFiltered) {
                          e.currentTarget.setAttribute('fill', circleHoverColor);
                          e.currentTarget.setAttribute('r', '5');
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.setAttribute('fill', circleColor);
                        e.currentTarget.setAttribute('r', '4');
                      }}
                    />
                  </g>
                );
              })}

              {/* Временная линия при перетаскивании */}
              {connectingFrom && connectingTo && (() => {
                const fromTask = tasks.find((t) => t.id === connectingFrom.taskId);
                if (!fromTask) return null;

                // Используем координаты напрямую из задачи
                const fromCanvasX = fromTask.position_x || 0;
                const fromCanvasY = fromTask.position_y || 0;
                const fromWidth = fromTask.width || TASK_WIDTH;
                // Используем только кэшированную высоту (обновляется через ResizeObserver)
                const fromHeight = taskHeightsRef.current.get(fromTask.id) || (fromTask.height || 150);

                let startX = 0, startY = 0;

                switch (connectingFrom.edge) {
                  case 'top':
                    startX = fromCanvasX + fromWidth / 2;
                    startY = fromCanvasY;
                    break;
                  case 'bottom':
                    startX = fromCanvasX + fromWidth / 2;
                    startY = fromCanvasY + fromHeight;
                    break;
                  case 'left':
                    startX = fromCanvasX;
                    startY = fromCanvasY + fromHeight / 2;
                    break;
                  case 'right':
                    startX = fromCanvasX + fromWidth;
                    startY = fromCanvasY + fromHeight / 2;
                    break;
                }

                const endX = connectingTo.x;
                const endY = connectingTo.y;

                // Вычисляем ортогональный путь с перпендикулярным выходом (без обхода для временной линии)
                const path = calculateOrthogonalPath(startX, startY, endX, endY, [fromTask.id], connectingFrom.edge, null);

                return (
                  <g key="temp-connection">
                    <path
                      d={path}
                      stroke="rgba(59, 130, 246, 0.8)"
                      strokeWidth="2"
                      strokeDasharray="5,5"
                      fill="none"
                    />
                    <circle cx={startX} cy={startY} r="4" fill="rgba(59, 130, 246, 1)" />
                    <circle cx={endX} cy={endY} r="4" fill="rgba(59, 130, 246, 1)" />
                  </g>
                );
              })()}
            </svg>

            {/* Задачи */}
            {tasks.map((task) => {
              const taskColor = task.color ? task.color.split(',').map(Number) : [107, 114, 128];
              const isSelected = selectedTask?.id === task.id;
              const isFiltered = !filteredTasks.find((t) => t.id === task.id);
              const assignee = members.find((m) => m.user_id === task.assignee_id);
              const isDragging = draggingTask?.id === task.id;
              const localTitle = taskTitles[task.id] || task.title || '';
              
              // Используем dragPosition во время перетаскивания для плавного движения
              const displayX = isDragging && dragPosition ? dragPosition.x : (task.position_x || 0);
              const displayY = isDragging && dragPosition ? dragPosition.y : (task.position_y || 0);

              // Определяем цвет обводки: приоритет маркера над выбранной задачей
              const getBorderColor = () => {
                if (task.marker_type === 'urgent') {
                  return 'rgba(239, 68, 68, 0.4)'; // red-500
                } else if (task.marker_type === 'warning') {
                  return 'rgba(234, 179, 8, 0.4)'; // yellow-500
                } else if (task.marker_type === 'time') {
                  return 'rgba(59, 130, 246, 0.4)'; // blue-500
                } else if (isSelected) {
                  return `rgba(${taskColor.join(',')}, 0.4)`;
                } else {
                  return `rgba(${taskColor.join(',')}, 0.3)`;
                }
              };

              return (
          <div
            key={task.id}
                  ref={(el) => {
                    if (el) {
                      taskRefs.current.set(task.id, el);
                    } else {
                      taskRefs.current.delete(task.id);
                    }
                  }}
                  data-task-id={task.id}
                  className="glass-card rounded-2xl border backdrop-blur-xl transition-all duration-200 shadow-lg group"
            style={{
                    position: 'absolute',
                    left: displayX,
                    top: displayY,
                    width: task.width ? `${task.width}px` : '240px',
                    height: isResizing && resizingTask?.id === task.id ? undefined : (task.height ? `${task.height}px` : undefined),
                    minHeight: '30px',
                    borderColor: getBorderColor(),
                    borderWidth: '1px', // Всегда тонкая обводка
                    boxShadow: isSelected
                      ? 'none'
                      : `0 4px 16px rgba(0, 0, 0, 0.4)`,
                    background: `linear-gradient(135deg, rgba(${taskColor.join(',')}, ${isSelected ? 0.22 : 0.18}) 0%, rgba(${taskColor.join(',')}, ${isSelected ? 0.16 : 0.12}) 100%)`,
                    zIndex: isSelected || isDragging ? 30 : 10,
                    opacity: isFiltered ? 0.25 : 1,
                    filter: isFiltered ? 'grayscale(0.8)' : 'none',
                    cursor: 'default',
                    backfaceVisibility: 'hidden',
                    WebkitFontSmoothing: 'antialiased',
                    MozOsxFontSmoothing: 'grayscale',
                    textRendering: 'optimizeLegibility',
                    transform: 'translate3d(0, 0, 0)',
                  }}
                  onMouseMove={(e) => {
                    // Меняем курсор в зависимости от области
                    const target = e.target as HTMLElement;
                    const taskElement = e.currentTarget as HTMLElement;
                    
                    // Если наведены на всплывающие меню - не активируем обводку
                    if (target.closest('[data-format-menu]') || target.closest('[data-info-menu]')) {
                      setHoveredBorder(null);
                      return;
                    }
                    
                    // Если наведены на блок перетаскивания - курсор move
                    if (target.closest('[data-drag-handle]')) {
                      taskElement.style.cursor = 'move';
                      setHoveredBorder(null);
                    }
                    // Если наведены на текст (название, описание, содержимое) — курсор text
                    else if (target.closest('[contenteditable]') || target.closest('textarea')) {
                      taskElement.style.cursor = 'text';
                      setHoveredBorder(null);
                    }
                    // Если наведены на зону настроек - курсор pointer
                    else if (target.closest('[data-settings-zone]')) {
                      taskElement.style.cursor = 'pointer';
                      setHoveredBorder(null);
                    }
                    // Если наведены на resize handle - курсор nwse-resize
                    else if (target.closest('[data-resize-handle]')) {
                      taskElement.style.cursor = 'nwse-resize';
                      setHoveredBorder(null);
                    }
                    // Проверяем, наведен ли курсор на обводку (в пределах 2px от края)
                    else if (canEdit && !isFiltered) {
                      const rect = taskElement.getBoundingClientRect();
                      const mouseX = e.clientX - rect.left;
                      const mouseY = e.clientY - rect.top;
                      const borderThreshold = 2; // 2px от края
                      const width = rect.width;
                      const height = rect.height;
                      
                      // Определяем, на какую грань наведен курсор
                      if (mouseY <= borderThreshold) {
                        // Верхняя грань
                        setHoveredBorder({ taskId: task.id, edge: 'top' });
                        taskElement.style.cursor = 'default';
                      } else if (mouseY >= height - borderThreshold) {
                        // Нижняя грань
                        setHoveredBorder({ taskId: task.id, edge: 'bottom' });
                        taskElement.style.cursor = 'default';
                      } else if (mouseX <= borderThreshold) {
                        // Левая грань
                        setHoveredBorder({ taskId: task.id, edge: 'left' });
                        taskElement.style.cursor = 'default';
                      } else if (mouseX >= width - borderThreshold) {
                        // Правая грань
                        setHoveredBorder({ taskId: task.id, edge: 'right' });
                        taskElement.style.cursor = 'default';
                      } else {
                        // Не на обводке
                        setHoveredBorder(null);
                        taskElement.style.cursor = 'default';
                      }
                    }
                    else {
                      taskElement.style.cursor = 'default';
                      setHoveredBorder(null);
                    }
                  }}
                  onMouseDown={(e) => {
                    console.log('Task onMouseDown', { canEdit, isFiltered, taskId: task.id, button: e.button });
                    e.stopPropagation();
                    // Перемещение задачи работает при нажатии колесиком мыши (button === 1)
                    if (canEdit && !isFiltered && e.button === 1) {
                      // Проверяем, что клик не на интерактивных элементах
                      const target = e.target as HTMLElement;
                      if (!target.closest('[contenteditable]') && 
                          !target.closest('textarea') &&
                          !target.closest('[data-settings-zone]') && 
                          !target.closest('[data-resize-handle]') &&
                          !target.closest('button')) {
                        handleTaskMouseDown(e, task);
                        (e.currentTarget as HTMLElement).style.cursor = 'move';
                      }
                    }
                  }}
                  onClick={(e) => {
                    // Не обрабатываем клик, если он на меню выбора исполнителя
                    const target = e.target as HTMLElement;
                    if (target.closest('[data-assignee-menu]') || target.closest('[data-assignee-button]')) {
                      return;
                    }
                    // Не активируем, если клик на кружок статуса (там своя логика)
                    if (target.closest('[data-status-circle]')) {
                      return;
                    }
                    e.stopPropagation();
                    // Активируем задачу при любом клике
                    if (!isFiltered) {
                      setSelectedTask(task);
                    }
                  }}
                  onAuxClick={(e) => {
                    // Предотвращаем прокрутку при клике средней кнопкой
                    if (e.button === 1) {
                      e.preventDefault();
                    }
                  }}
                  onContextMenu={(e) => {
                    console.log('Task onContextMenu', { canEdit, isFiltered, taskId: task.id });
                    e.preventDefault();
                    e.stopPropagation();
                    if (canEdit && !isFiltered) {
                      console.log('Calling handleContextMenu for task:', task.id);
                      handleContextMenu(e, task.id);
                    } else {
                      console.log('Context menu blocked', { canEdit, isFiltered });
                    }
                  }}
                  onMouseEnter={(e) => {
                    // Предотвращаем панорамирование при наведении на задачу
                    e.stopPropagation();
                    // Очищаем таймер, если он был установлен
                    if (hoverTimeoutRef.current) {
                      clearTimeout(hoverTimeoutRef.current);
                      hoverTimeoutRef.current = null;
                    }
                    if (canEdit && !isFiltered) {
                      setHoveredTask(task.id);
                    } else if (!isFiltered) {
                      setHoveredTask(task.id);
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.stopPropagation();
                    // Сбрасываем наведение на обводку
                    setHoveredBorder(null);
                    // Не скрываем меню, если курсор на меню
                    const relatedTarget = e.relatedTarget;
                    // Проверяем, что relatedTarget существует и является элементом с методом closest
                    if (!relatedTarget || !(relatedTarget instanceof Element)) {
                      // Добавляем задержку перед скрытием
                      hoverTimeoutRef.current = setTimeout(() => {
                        setHoveredTask(null);
                        hoverTimeoutRef.current = null;
                      }, 200); // 200ms задержка
                      return;
                    }
                    if (!relatedTarget.closest('[data-format-menu]') && !relatedTarget.closest('[data-info-menu]')) {
                      // Добавляем задержку перед скрытием
                      hoverTimeoutRef.current = setTimeout(() => {
                        setHoveredTask(null);
                        hoverTimeoutRef.current = null;
                      }, 200); // 200ms задержка
                    }
                  }}
                >
                  {/* Блок для перетаскивания задачи (левая граница) */}
                  <div
                    data-drag-handle
                    className="absolute left-0 top-0 h-full w-[10px] cursor-move opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-30 rounded-l-2xl"
                    style={{
                      backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    }}
                    onMouseDown={(e) => {
                      // Разрешаем перетаскивание ЛКМ только на этом блоке
                      if (e.button === 0 && canEdit && !isFiltered) {
                        e.preventDefault();
                        e.stopPropagation();
                        
                        const rect = canvasRef.current?.getBoundingClientRect();
                        if (rect) {
                          const screenX = e.clientX;
                          const screenY = e.clientY;
                          const canvasX = (screenX - rect.left - offset.x) / scale;
                          const canvasY = (screenY - rect.top - offset.y) / scale;
                          
                          setClickStartPos({ x: screenX, y: screenY });
                          setDraggingTask(task);
                          setDragStartPos({ x: canvasX, y: canvasY });
                          setDragOffset({
                            x: canvasX - (task.position_x || 0),
                            y: canvasY - (task.position_y || 0),
                          });
                          setIsTaskDragging(false);
                        }
                      }
                    }}
                    onMouseEnter={(e) => {
                      const taskElement = (e.currentTarget as HTMLElement).closest('[data-task-id]') as HTMLElement;
                      if (taskElement) {
                        taskElement.style.cursor = 'move';
                      }
                    }}
                    onMouseLeave={(e) => {
                      const taskElement = (e.currentTarget as HTMLElement).closest('[data-task-id]') as HTMLElement;
                      if (taskElement) {
                        taskElement.style.cursor = 'default';
                      }
                    }}
                  />
                  {/* Пометка в левом верхнем углу (наполовину вылазит) */}
                  {task.marker_type && (
                    <div className="absolute -top-1.5 -left-1.5 z-40">
                      {task.marker_type === 'urgent' && (
                        <div className="bg-red-500 rounded-full p-0.5 shadow-lg ring-2 ring-red-500/30">
                          <AlertCircle className="h-4 w-4 text-white" strokeWidth={2.5} />
                        </div>
                      )}
                      {task.marker_type === 'warning' && (
                        <div className="bg-yellow-500 rounded-full p-0.5 shadow-lg ring-2 ring-yellow-500/30">
                          <AlertTriangle className="h-4 w-4 text-white" strokeWidth={2} />
                        </div>
                      )}
                      {task.marker_type === 'time' && (
                        <div className="bg-blue-500 rounded-full p-0.5 shadow-lg ring-2 ring-blue-500/30">
                          <Clock className="h-4 w-4 text-white" strokeWidth={2} />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Кружок статуса в верхнем правом углу */}
                  <div
                    className="absolute top-2 right-2 h-[7px] w-[7px] rounded-full cursor-pointer z-20"
                    data-status-circle
                    style={{
                      backgroundColor: task.status === 'todo' ? 'rgb(156, 163, 175)' :
                                       task.status === 'in_progress' ? 'rgb(245, 158, 11)' :
                                       task.status === 'completed' ? 'rgb(34, 197, 94)' :
                                       'rgb(239, 68, 68)',
                    }}
                    title={task.status === 'todo' ? 'К выполнению' :
                           task.status === 'in_progress' ? 'В работе' :
                           task.status === 'completed' ? 'Выполнено' :
                           'Заблокировано'}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isFiltered) {
                        setSelectedTask(task);
                        openSettingsPanel(task);
                      }
                    }}
                  />
                  {/* Всплывающее меню форматирования (сверху) */}
                  {hoveredTask === task.id && canEdit && !isFiltered && (
                    <div
                      data-format-menu
                      className="absolute z-50 w-full flex items-center gap-1 rounded-lg border border-white/[0.12] bg-zinc-900/95 px-1 py-1 pr-2.5 shadow-xl backdrop-blur-xl"
                      style={{ left: 0, bottom: '100%', marginBottom: '5px' }}
                      onMouseEnter={() => {
                        // Очищаем таймер при наведении на меню
                        if (hoverTimeoutRef.current) {
                          clearTimeout(hoverTimeoutRef.current);
                          hoverTimeoutRef.current = null;
                        }
                        setHoveredTask(task.id);
                      }}
                      onMouseLeave={(e) => {
                        const relatedTarget = e.relatedTarget;
                        // Проверяем, что relatedTarget существует и является элементом с методом closest
                        if (!relatedTarget || !(relatedTarget instanceof Element)) {
                          // Добавляем задержку перед скрытием
                          hoverTimeoutRef.current = setTimeout(() => {
                            setHoveredTask(null);
                            hoverTimeoutRef.current = null;
                          }, 200);
                          return;
                        }
                        // Проверяем, не переходим ли мы на задачу или информационное меню
                        if (!relatedTarget.closest('[data-task-id]') && !relatedTarget.closest('[data-info-menu]')) {
                          // Добавляем задержку перед скрытием
                          hoverTimeoutRef.current = setTimeout(() => {
                            setHoveredTask(null);
                            hoverTimeoutRef.current = null;
                          }, 200);
                        }
                      }}
                    >
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const contentEditable = e.currentTarget.closest('[data-task-id]')?.querySelector('[contenteditable]') as HTMLElement;
                          if (contentEditable) {
                            contentEditable.focus();
                            document.execCommand('bold', false);
                            // Сохраняем HTML содержимое
                            const html = contentEditable.innerHTML;
                            setTaskTitles((prev) => ({ ...prev, [task.id]: html }));
                          }
                        }}
                        className="flex h-7 w-7 items-center justify-center rounded text-white/70 transition-all hover:bg-white/[0.1] hover:text-white"
                        title="Жирный (Bold)"
                      >
                        <Bold className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const contentEditable = e.currentTarget.closest('[data-task-id]')?.querySelector('[contenteditable]') as HTMLElement;
                          if (contentEditable) {
                            contentEditable.focus();
                            document.execCommand('italic', false);
                            // Сохраняем HTML содержимое
                            const html = contentEditable.innerHTML;
                            setTaskTitles((prev) => ({ ...prev, [task.id]: html }));
                          }
                        }}
                        className="flex h-7 w-7 items-center justify-center rounded text-white/70 transition-all hover:bg-white/[0.1] hover:text-white"
                        title="Курсив (Italic)"
                      >
                        <Italic className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          // Открываем диалог выбора файла
                          const fileInput = fileInputRefs.current[task.id];
                          if (fileInput) {
                            fileInput.click();
                          }
                        }}
                        className="flex h-7 w-7 items-center justify-center rounded text-white/70 transition-all hover:bg-white/[0.1] hover:text-white"
                        title="Прикрепить файл"
                      >
                        <Paperclip className="h-3.5 w-3.5" />
                      </button>
                      <input
                        ref={(el) => {
                          if (el) fileInputRefs.current[task.id] = el;
                        }}
                        type="file"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          
                          try {
                            // Читаем файл как base64
                            const reader = new FileReader();
                            reader.onload = async (event) => {
                              const base64Data = event.target?.result as string;
                              const fileData = {
                                name: file.name,
                                data: base64Data,
                                type: file.type || 'application/octet-stream',
                              };
                              
                              const currentFiles = taskFiles[task.id] || task.files || [];
                              const newFiles = [...currentFiles, fileData];
                              
                              setTaskFiles((prev) => ({
                                ...prev,
                                [task.id]: newFiles,
                              }));
                              
                              await handleUpdateTask(task.id, { files: newFiles });
                              toast.success('Файл прикреплен');
                            };
                            reader.readAsDataURL(file);
                          } catch (error: any) {
                            console.error('Error processing file:', error);
                            toast.error('Ошибка при прикреплении файла');
                          }
                          
                          // Сбрасываем input для возможности повторной загрузки того же файла
                          e.target.value = '';
                        }}
                      />
                      {/* Быстрый выбор статуса */}
                      <div className="flex items-center gap-2.5 ml-auto">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleUpdateTask(task.id, { status: 'todo' });
                          }}
                          className="h-[15px] w-[15px] rounded-full bg-gray-400 transition-all hover:scale-110 hover:ring-2 hover:ring-white/30"
                          title="К выполнению"
                        />
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleUpdateTask(task.id, { status: 'in_progress' });
                          }}
                          className="h-[15px] w-[15px] rounded-full bg-amber-500 transition-all hover:scale-110 hover:ring-2 hover:ring-white/30"
                          title="В работе"
                        />
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleUpdateTask(task.id, { status: 'completed' });
                          }}
                          className="h-[15px] w-[15px] rounded-full bg-green-500 transition-all hover:scale-110 hover:ring-2 hover:ring-white/30"
                          title="Завершено"
                        />
                      </div>
            </div>
                  )}
                  {/* Всплывающий блок с информацией (снизу) */}
                  {hoveredTask === task.id && !isFiltered && (
                    <div
                      data-info-menu
                      className="absolute z-50 w-full flex items-center justify-between gap-2 rounded-lg border border-white/[0.12] bg-zinc-900/95 px-2 py-1.5 shadow-xl backdrop-blur-xl"
                      style={{ left: 0, top: '100%', marginTop: '5px' }}
                      onMouseEnter={() => {
                        // Очищаем таймер при наведении на меню
                        if (hoverTimeoutRef.current) {
                          clearTimeout(hoverTimeoutRef.current);
                          hoverTimeoutRef.current = null;
                        }
                        setHoveredTask(task.id);
                      }}
                      onMouseLeave={(e) => {
                        const relatedTarget = e.relatedTarget;
                        // Проверяем, что relatedTarget существует и является элементом с методом closest
                        if (!relatedTarget || !(relatedTarget instanceof Element)) {
                          // Добавляем задержку перед скрытием
                          hoverTimeoutRef.current = setTimeout(() => {
                            setHoveredTask(null);
                            hoverTimeoutRef.current = null;
                          }, 200);
                          return;
                        }
                        // Проверяем, не переходим ли мы на задачу или меню форматирования
                        if (!relatedTarget.closest('[data-task-id]') && !relatedTarget.closest('[data-format-menu]')) {
                          // Добавляем задержку перед скрытием
                          hoverTimeoutRef.current = setTimeout(() => {
                            setHoveredTask(null);
                            hoverTimeoutRef.current = null;
                          }, 200);
                        }
                      }}
                    >
                      {/* Дедлайн */}
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const input = document.getElementById(`deadline-${task.id}`) as HTMLInputElement;
                            if (input) {
                              input.showPicker?.();
                              input.focus();
                            }
                          }}
                          className="flex items-center justify-center"
                        >
                          <Calendar className="h-3.5 w-3.5 text-white/70" />
                        </button>
                        <input
                          type="date"
                          id={`deadline-${task.id}`}
                          value={task.deadline ? new Date(task.deadline).toISOString().split('T')[0] : ''}
                          onChange={(e) => {
                            const newDate = e.target.value ? new Date(e.target.value).toISOString() : null;
                            handleUpdateTask(task.id, { deadline: newDate });
                          }}
                          className="h-6 border-0 bg-transparent p-0 text-xs text-white/80 focus:outline-none [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                          style={{ 
                            fontSize: '12px',
                            color: 'rgba(255, 255, 255, 0.8)',
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            // Открываем date picker программно
                            (e.target as HTMLInputElement).showPicker?.();
                          }}
                          onMouseDown={(e) => e.stopPropagation()}
                        />
          </div>
                      {/* Исполнитель */}
                      <div className="relative flex items-center gap-1.5">
                        <button
                          data-assignee-button
                          onMouseEnter={(e) => {
                            e.stopPropagation();
                            // При наведении на кнопку открываем меню, если оно закрыто
                            if (openAssigneeMenu !== task.id) {
                              setOpenAssigneeMenu(task.id);
                            }
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenAssigneeMenu(openAssigneeMenu === task.id ? null : task.id);
                          }}
                          className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white shadow-sm overflow-hidden ring-1 ring-white/20 transition-all hover:scale-110"
                          style={{ 
                            backgroundColor: assignee?.avatar_color || '#6b7280',
                          }}
                          title={assignee?.display_name || 'Не назначен'}
                        >
                          {assignee?.avatar_image ? (
                            <img
                              src={assignee.avatar_image}
                              alt={assignee.display_name || 'Avatar'}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span>{assignee?.display_name?.[0]?.toUpperCase() || '?'}</span>
                          )}
                        </button>
                        {/* Выпадающий список участников */}
                        {openAssigneeMenu === task.id && (
                          <div
                            data-assignee-menu
                            className="absolute bottom-full right-0 mb-0.5 z-50 min-w-[180px] rounded-lg border border-white/[0.12] bg-zinc-900/95 p-1.5 shadow-xl backdrop-blur-xl"
                            onMouseEnter={(e) => {
                              e.stopPropagation();
                              setOpenAssigneeMenu(task.id);
                            }}
                            onMouseLeave={(e) => {
                              e.stopPropagation();
                              // Проверяем, что мышь действительно покинула область меню и кнопки
                              const relatedTarget = e.relatedTarget as HTMLElement;
                              if (relatedTarget) {
                                const isMovingToButton = relatedTarget.closest('[data-assignee-button]');
                                const isMovingToMenu = relatedTarget.closest('[data-assignee-menu]');
                                if (isMovingToButton || isMovingToMenu) {
                                  return; // Не закрываем, если переходим на кнопку или меню
                                }
                              }
                              // Закрываем только если мышь действительно ушла
                              const timeoutId = setTimeout(() => {
                                const menuElement = document.querySelector('[data-assignee-menu]');
                                const buttonElement = document.querySelector('[data-assignee-button]');
                                if (menuElement && !menuElement.matches(':hover') && 
                                    buttonElement && !buttonElement.matches(':hover')) {
                                  setOpenAssigneeMenu(null);
                                }
                              }, 300);
                              // Сохраняем timeout для очистки
                              (e.currentTarget as any)._closeTimeout = timeoutId;
                            }}
                          >
                            <div className="max-h-48 overflow-y-auto space-y-1">
                              <button
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                }}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleUpdateTask(task.id, { assignee_id: null });
                                  setOpenAssigneeMenu(null);
                                }}
                                className={`w-full flex items-center gap-2 rounded px-2 py-1.5 text-xs transition-all ${
                                  !task.assignee_id
                                    ? 'bg-white/[0.1] text-white'
                                    : 'text-white/70 hover:bg-white/[0.08] hover:text-white'
                                }`}
                              >
                                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-[9px] font-bold text-white/40 ring-1 ring-white/10">
                                  ?
                                </div>
                                <span>Не назначен</span>
                              </button>
                              {members.map((member) => (
                                <button
                                  key={member.user_id}
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                  }}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleUpdateTask(task.id, { assignee_id: member.user_id });
                                    setOpenAssigneeMenu(null);
                                  }}
                                  className={`w-full flex items-center gap-2 rounded px-2 py-1.5 text-xs transition-all ${
                                    task.assignee_id === member.user_id
                                      ? 'bg-white/[0.1] text-white'
                                      : 'text-white/70 hover:bg-white/[0.08] hover:text-white'
                                  }`}
                                >
                                  <div
                                    className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white shadow-sm overflow-hidden ring-1 ring-white/20"
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
                                  <span>{member.display_name || 'Без имени'}</span>
                                </button>
        ))}
      </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-2 px-3 py-2">
                    <div className="flex-1 relative">
                      <div
                        contentEditable
                        suppressContentEditableWarning
                        spellCheck={true}
                        onInput={(e) => {
                          const html = e.currentTarget.innerHTML;
                          const text = e.currentTarget.innerText || '';
                          setTaskTitles((prev) => ({ ...prev, [task.id]: html }));
                          // Обновляем цвет при вводе
                          if (text.trim()) {
                            e.currentTarget.style.color = 'rgba(255, 255, 255, 1)';
                          }
                        }}
                        data-placeholder="Название задачи..."
                        className="min-h-[20px] resize-none border-0 bg-transparent p-0 text-sm font-normal leading-relaxed text-white focus-visible:ring-0 w-full outline-none"
                        style={{
                          color: localTitle ? 'rgba(255, 255, 255, 1)' : 'rgba(255, 255, 255, 0.35)',
                          cursor: 'text',
                        }}
                        onFocus={(e) => {
                          // Включаем подчеркивание ошибок при фокусе
                          e.currentTarget.setAttribute('spellcheck', 'true');
                          e.currentTarget.classList.add('spellcheck-active');

                          const text = (e.currentTarget.innerText || e.currentTarget.textContent || '').trim();
                          // Если это placeholder текст, пусто, или "New Task", очищаем
                          if (text === 'Название задачи...' || text === 'New Task' || text === 'Новая задача' || !text) {
                            e.currentTarget.innerHTML = '';
                            e.currentTarget.style.color = 'rgba(255, 255, 255, 1)';
                            // Устанавливаем курсор в начало
                            const element = e.currentTarget;
                            setTimeout(() => {
                              // Проверяем, что элемент все еще существует и является валидным Node
                              if (!element || !element.parentNode || !document.contains(element)) {
                                return;
                              }
                              try {
                                const range = document.createRange();
                                const sel = window.getSelection();
                                if (element.firstChild) {
                                  range.setStartBefore(element.firstChild);
                                  range.setEndAfter(element.firstChild);
                                } else {
                                  range.selectNodeContents(element);
                                }
                                if (sel) {
                                  sel.removeAllRanges();
                                  sel.addRange(range);
                                }
                              } catch (error) {
                                console.error('Error setting cursor position:', error);
                              }
                            }, 0);
                          }
                        }}
                        onBlurCapture={(e) => {
                          // Отключаем подчеркивание ошибок при потере фокуса
                          e.currentTarget.setAttribute('spellcheck', 'false');
                          e.currentTarget.classList.remove('spellcheck-active');
                          // Принудительно перерисовываем элемент для скрытия подчеркивания
                          const element = e.currentTarget;
                          const display = element.style.display;
                          element.style.display = 'none';
                          element.offsetHeight; // Принудительный reflow
                          element.style.display = display;
                        }}
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          // Предотвращаем начало перетаскивания при клике на текст
                          if (e.button === 1) {
                            e.preventDefault();
                          }
                        }}
                        onMouseEnter={(e) => {
                          // Курсор text при наведении на текст
                          (e.currentTarget as HTMLElement).style.cursor = 'text';
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.cursor = 'text';
                        }}
                        onContextMenu={(e) => {
                          e.stopPropagation();
                        }}
                        ref={(el) => {
                          if (el && document.activeElement !== el) {
                            const currentText = (el.innerText || el.textContent || '').trim();
                            // Получаем текст из localTitle (без HTML тегов)
                            const taskText = task.title || '';
                            const shouldShowPlaceholder = !taskText || taskText === 'New Task' || taskText === 'Новая задача';
                            
                            // Если задача пустая, показываем placeholder
                            if (shouldShowPlaceholder) {
                              if (currentText !== 'Название задачи...') {
                                el.innerHTML = '';
                                el.innerText = 'Название задачи...';
                                el.style.color = 'rgba(255, 255, 255, 0.35)';
                              }
                            } else {
                              // Если есть текст, показываем его
                              const newText = localTitle ? (() => {
                                const temp = document.createElement('div');
                                temp.innerHTML = localTitle;
                                return (temp.innerText || temp.textContent || '').trim();
                              })() : taskText;
                              
                              if (newText && currentText !== newText && currentText !== 'Название задачи...') {
                                el.innerHTML = localTitle || taskText;
                                el.style.color = 'rgba(255, 255, 255, 1)';
                              }
                            }
                          }
                        }}
                        onPaste={async (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          
                          const clipboardData = e.clipboardData;
                          if (!clipboardData) return;
                          
                          // Проверяем, есть ли изображение в буфере обмена
                          const imageFile = await getImageFromClipboard(clipboardData);
                          
                          if (imageFile) {
                            try {
                              // Проверяем размер файла перед обработкой (максимум 10MB)
                              const maxFileSize = 10 * 1024 * 1024; // 10MB
                              if (imageFile.size > maxFileSize) {
                                toast.error('Изображение слишком большое. Максимальный размер: 10MB');
                                return;
                              }
                              
                              // Сжимаем изображение (уменьшаем качество до 0.85 для больших файлов)
                              const quality = imageFile.size > 5 * 1024 * 1024 ? 0.85 : 0.92;
                              const compressedImage = await compressImage(imageFile, 800, 800, quality);
                              
                              // Проверяем размер сжатого изображения (base64 примерно на 33% больше оригинала)
                              const base64Size = compressedImage.length * 0.75; // Примерный размер в байтах
                              if (base64Size > 40 * 1024 * 1024) { // 40MB лимит для base64
                                toast.error('Изображение слишком большое даже после сжатия. Попробуйте другое изображение.');
                                return;
                              }
                              
                              // Добавляем изображение к задаче
                              const currentImages = taskImages[task.id] || task.images || [];
                              const newImages = [...currentImages, compressedImage];
                              setTaskImages((prev) => ({
                                ...prev,
                                [task.id]: newImages,
                              }));
                              
                              // Сохраняем в базу данных
                              await handleUpdateTask(task.id, { images: newImages });
                              
                              toast.success('Изображение добавлено');
                            } catch (error: any) {
                              console.error('Error processing image:', error);
                              console.error('Error details:', error.details);
                              console.error('Error pgError:', error.pgError);
                              
                              // Используем понятное сообщение для пользователя, если оно есть
                              const userMessage = error.userMessage || error.message || error.details || 'Ошибка при добавлении изображения';
                              
                              // Обработка различных типов ошибок
                              if (userMessage.includes('Payload Too Large') || userMessage.includes('413')) {
                                toast.error('Изображение слишком большое. Попробуйте уменьшить размер изображения.');
                              } else if (error.needsMigration && error.migrationFile) {
                                toast.error(
                                  `Поле не найдено в базе данных. Примените миграцию: ${error.migrationFile}`,
                                  {
                                    duration: 10000,
                                    description: `Выполните SQL из файла backend/migrations/${error.migrationFile} или запустите: node backend/scripts/check-migrations.js`
                                  }
                                );
                              } else {
                                toast.error(userMessage);
                              }
                            }
                          } else {
                            // Если это не изображение, вставляем текст как обычно
                            const text = clipboardData.getData('text/plain');
                            if (text) {
                              const selection = window.getSelection();
                              if (selection && selection.rangeCount > 0) {
                                const range = selection.getRangeAt(0);
                                range.deleteContents();
                                const textNode = document.createTextNode(text);
                                range.insertNode(textNode);
                                range.setStartAfter(textNode);
                                range.collapse(true);
                                selection.removeAllRanges();
                                selection.addRange(range);
                                
                                // Обновляем состояние
                                const html = e.currentTarget.innerHTML;
                                const textContent = e.currentTarget.innerText || '';
                                setTaskTitles((prev) => ({ ...prev, [task.id]: html }));
                                if (textContent.trim()) {
                                  handleUpdateTask(task.id, { title: textContent });
                                }
                              }
                            }
                          }
                        }}
                        onBlur={(e) => {
                          const html = e.currentTarget.innerHTML;
                          const text = (e.currentTarget.innerText || e.currentTarget.textContent || '').trim();
                          // Если пусто или это дефолтные значения, показываем placeholder и сохраняем пустой title
                          if (!text || text === 'New Task' || text === 'Новая задача' || text === 'Название задачи...') {
                            e.currentTarget.innerHTML = '';
                            e.currentTarget.innerText = 'Название задачи...';
                            e.currentTarget.style.color = 'rgba(255, 255, 255, 0.35)';
                            // Сохраняем пустой title
                            if (task.title && task.title !== 'New Task' && task.title !== 'Новая задача') {
                              handleUpdateTask(task.id, { title: '' });
                            }
                          } else {
                            e.currentTarget.style.color = 'rgba(255, 255, 255, 1)';
                            // Сохраняем только текст без HTML тегов в базу данных
                            if (text !== task.title && text !== 'New Task' && text !== 'Новая задача') {
                              handleUpdateTask(task.id, { title: text });
                            }
                          }
                        }}
                      />
                    </div>
                  </div>

                  {/* Изображения и файлы задачи */}
                  {(((taskImages[task.id] && taskImages[task.id].length > 0) || (task.images && task.images.length > 0)) ||
                    ((taskFiles[task.id] && taskFiles[task.id].length > 0) || (task.files && task.files.length > 0))) && (
                    <div className="px-3 pt-0 pb-3">
                      <div className="flex flex-wrap gap-2">
                        {/* Изображения */}
                        {((taskImages[task.id] && taskImages[task.id].length > 0) ? taskImages[task.id] : (task.images || [])).map((image, index) => {
                          // Нормализуем формат изображения
                          const imageSrc = normalizeImageSrc(image);
                          if (!imageSrc) return null;
                          
                          return (
                            <div
                              key={`img-${index}`}
                              className="group relative aspect-square w-[50px] rounded-lg overflow-hidden bg-white/[0.06] border border-white/[0.08] cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedImage(imageSrc);
                              }}
                            >
                              <img
                                src={imageSrc}
                                alt={`Изображение ${index + 1}`}
                                className="h-full w-full object-cover"
                                onError={(e) => {
                                  // Если изображение не загрузилось, показываем placeholder
                                  console.error('Image load error for task:', task.id, 'index:', index);
                                  const target = e.currentTarget;
                                  const parent = target.parentElement;
                                  if (parent) {
                                    target.style.display = 'none';
                                    const placeholder = document.createElement('div');
                                    placeholder.className = 'flex items-center justify-center h-full w-full text-white/40 text-[8px]';
                                    placeholder.textContent = 'Ошибка';
                                    parent.appendChild(placeholder);
                                  }
                                }}
                                loading="lazy"
                              />
                              {canEdit && (
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    const currentImages = taskImages[task.id] || task.images || [];
                                    const newImages = currentImages.filter((_, i) => i !== index);
                                    setTaskImages((prev) => ({
                                      ...prev,
                                      [task.id]: newImages,
                                    }));
                                    await handleUpdateTask(task.id, { images: newImages.length > 0 ? newImages : null });
                                    toast.success('Изображение удалено');
                                  }}
                                  className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 rounded-full p-1 bg-red-500/90 hover:bg-red-500 text-white transition-opacity shadow-lg z-10"
                                  title="Удалить изображение"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                        {/* Файлы */}
                        {(taskFiles[task.id] || task.files || []).map((file, index) => (
                          <div
                            key={`file-${index}`}
                            className="group relative flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.08] hover:bg-white/[0.1] transition-colors"
                          >
                            <Paperclip className="h-3 w-3 text-white/60" />
                            <a
                              href={file.data}
                              download={file.name}
                              onClick={(e) => e.stopPropagation()}
                              className="text-xs text-white/80 hover:text-white truncate max-w-[100px]"
                              title={file.name}
                            >
                              {file.name}
                            </a>
                            {canEdit && (
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  const currentFiles = taskFiles[task.id] || task.files || [];
                                  const newFiles = currentFiles.filter((_, i) => i !== index);
                                  setTaskFiles((prev) => ({
                                    ...prev,
                                    [task.id]: newFiles,
                                  }));
                                  await handleUpdateTask(task.id, { files: newFiles.length > 0 ? newFiles : null });
                                  toast.success('Файл удален');
                                }}
                                className="opacity-0 group-hover:opacity-100 rounded p-0.5 bg-red-500/80 hover:bg-red-500 text-white transition-opacity ml-1"
                                title="Удалить файл"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Содержимое задачи */}
                  {task.has_content && (
                    <TaskContentSection
                      task={task}
                      contentItems={taskContentItems[task.id] || []}
                      isExpanded={expandedContentTasks.has(task.id)}
                      onToggleExpand={() => {
                        const newExpanded = new Set(expandedContentTasks);
                        if (newExpanded.has(task.id)) {
                          newExpanded.delete(task.id);
                        } else {
                          newExpanded.add(task.id);
                          // Загружаем содержимое при первом раскрытии
                          if (!taskContentItems[task.id]) {
                            loadTaskContent(task.id);
                          }
                        }
                        setExpandedContentTasks(newExpanded);
                      }}
                      onAddItem={() => handleAddContentItem(task.id)}
                      onUpdateItem={(itemId, updates) => handleUpdateContentItem(task.id, itemId, updates)}
                      onDeleteItem={(itemId) => handleDeleteContentItem(task.id, itemId)}
                      onToggleComplete={(itemId, completed) => handleToggleContentComplete(task.id, itemId, completed)}
                      canEdit={canEdit}
                    />
                  )}

                  {/* Описание задачи */}
                  {(task.description || expandedDescriptionTasks.has(task.id)) && (
                    <TaskDescriptionSection
                      task={task}
                      isExpanded={expandedDescriptionTasks.has(task.id)}
                      onToggleExpand={() => {
                        const newExpanded = new Set(expandedDescriptionTasks);
                        if (newExpanded.has(task.id)) {
                          newExpanded.delete(task.id);
                        } else {
                          newExpanded.add(task.id);
                        }
                        setExpandedDescriptionTasks(newExpanded);
                      }}
                      onUpdateDescription={(description) => handleUpdateTask(task.id, { description })}
                      canEdit={canEdit}
                    />
                  )}

                  {/* Зона открытия панели настроек (справа) */}
                  <div
                    data-settings-zone
                    className="absolute top-0 right-0 w-12 h-full z-10"
                    onClick={(e) => {
                      e.stopPropagation();
                      const target = e.target as HTMLElement;
                      if (target.closest('[data-description-toggle]') || target.closest('[data-content-toggle]')) {
                        return;
                      }
                    }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      const target = e.target as HTMLElement;
                      if (target.closest('[data-description-toggle]') || target.closest('[data-content-toggle]')) {
                        return;
                      }
                      // Не открываем при нажатии колесиком (для перетаскивания)
                      if (e.button === 1) {
                        e.preventDefault();
                        return;
                      }
                    }}
                    onMouseEnter={(e) => {
                      // Меняем курсор на pointer при наведении на зону настроек
                      const taskElement = (e.currentTarget as HTMLElement).closest('[data-task-id]') as HTMLElement;
                      if (taskElement) {
                        taskElement.style.cursor = 'pointer';
                      }
                    }}
                    onMouseLeave={(e) => {
                      const taskElement = (e.currentTarget as HTMLElement).closest('[data-task-id]') as HTMLElement;
                      if (taskElement) {
                        taskElement.style.cursor = 'default';
                      }
                    }}
                  />
                  {/* Resize handle */}
                  {canEdit && (
                    <div
                      data-resize-handle
                      className="absolute bottom-0 right-0 h-4 w-4 cursor-nwse-resize opacity-0 group-hover:opacity-100 transition-opacity z-10"
                      style={{
                        background: `linear-gradient(135deg, transparent 0%, transparent 50%, rgba(${taskColor.join(',')}, 0.6) 50%, rgba(${taskColor.join(',')}, 0.8) 100%)`,
                        borderBottomRightRadius: '0.75rem',
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        // TODO: Реализовать изменение размера
                      }}
                    />
      )}
                  {/* Кружки по центру каждой грани для соединения */}
                  <div
                    data-connection-point="top"
                    data-task-id={task.id}
                    data-edge="top"
                    className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 h-4 w-4 rounded-full bg-blue-500 opacity-0 transition-opacity duration-200 z-30 cursor-crosshair hover:scale-125 hover:bg-blue-400"
                    style={{
                      opacity: hoveredBorder?.taskId === task.id && hoveredBorder?.edge === 'top' ? 1 : 0,
                      pointerEvents: hoveredBorder?.taskId === task.id && hoveredBorder?.edge === 'top' ? 'auto' : 'none',
                    }}
                    onMouseDown={(e) => {
                      if (e.button === 0 && canEdit && !isFiltered) {
                        e.preventDefault();
                        e.stopPropagation();
                        setConnectingFrom({ taskId: task.id, edge: 'top' });
                      }
                    }}
                  />
                  <div
                    data-connection-point="bottom"
                    data-task-id={task.id}
                    data-edge="bottom"
                    className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 h-4 w-4 rounded-full bg-blue-500 opacity-0 transition-opacity duration-200 z-30 cursor-crosshair hover:scale-125 hover:bg-blue-400"
                    style={{
                      opacity: hoveredBorder?.taskId === task.id && hoveredBorder?.edge === 'bottom' ? 1 : 0,
                      pointerEvents: hoveredBorder?.taskId === task.id && hoveredBorder?.edge === 'bottom' ? 'auto' : 'none',
                    }}
                    onMouseDown={(e) => {
                      if (e.button === 0 && canEdit && !isFiltered) {
                        e.preventDefault();
                        e.stopPropagation();
                        setConnectingFrom({ taskId: task.id, edge: 'bottom' });
                      }
                    }}
                  />
                  <div
                    data-connection-point="left"
                    data-task-id={task.id}
                    data-edge="left"
                    className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 h-4 w-4 rounded-full bg-blue-500 opacity-0 transition-opacity duration-200 z-30 cursor-crosshair hover:scale-125 hover:bg-blue-400"
                    style={{
                      opacity: hoveredBorder?.taskId === task.id && hoveredBorder?.edge === 'left' ? 1 : 0,
                      pointerEvents: hoveredBorder?.taskId === task.id && hoveredBorder?.edge === 'left' ? 'auto' : 'none',
                    }}
                    onMouseDown={(e) => {
                      if (e.button === 0 && canEdit && !isFiltered) {
                        e.preventDefault();
                        e.stopPropagation();
                        setConnectingFrom({ taskId: task.id, edge: 'left' });
                      }
                    }}
                  />
                  <div
                    data-connection-point="right"
                    data-task-id={task.id}
                    data-edge="right"
                    className="absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 h-4 w-4 rounded-full bg-blue-500 opacity-0 transition-opacity duration-200 z-30 cursor-crosshair hover:scale-125 hover:bg-blue-400"
                    style={{
                      opacity: hoveredBorder?.taskId === task.id && hoveredBorder?.edge === 'right' ? 1 : 0,
                      pointerEvents: hoveredBorder?.taskId === task.id && hoveredBorder?.edge === 'right' ? 'auto' : 'none',
                    }}
                    onMouseDown={(e) => {
                      if (e.button === 0 && canEdit && !isFiltered) {
                        e.preventDefault();
                        e.stopPropagation();
                        setConnectingFrom({ taskId: task.id, edge: 'right' });
                      }
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Панель настроек задачи */}
      {selectedTask && settingsPanelPosition && (
        <div
          className="fixed z-[110] w-80 rounded-xl border border-white/[0.12] bg-zinc-900/98 shadow-2xl backdrop-blur-2xl"
          style={{
            left: `${settingsPanelPosition.x}px`,
            top: `${settingsPanelPosition.y}px`,
          }}
        >
          <div className="flex items-center justify-between border-b border-white/[0.08] p-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-white/60">Настройки</h3>
            <button onClick={() => setSelectedTask(null)} className="text-white/60 hover:text-white">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="p-3 space-y-3 max-h-[70vh] overflow-y-auto">
            {/* Исполнитель */}
            <div className="pb-3 border-b border-white/[0.06]">
              <label className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-white/40">
                Исполнитель
              </label>
              <div className="relative">
                <button
                  data-assignee-button
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenAssigneeMenu(openAssigneeMenu === selectedTask.id ? null : selectedTask.id);
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-bold text-white shadow-sm overflow-hidden ring-1 ring-white/20 transition-all hover:scale-110"
                  style={{ 
                    backgroundColor: (() => {
                      const assignee = members.find((m) => m.user_id === selectedTask.assignee_id);
                      return assignee?.avatar_color || '#6b7280';
                    })(),
                  }}
                  title={(() => {
                    const assignee = members.find((m) => m.user_id === selectedTask.assignee_id);
                    return assignee?.display_name || 'Не назначен';
                  })()}
                >
                  {(() => {
                    const assignee = members.find((m) => m.user_id === selectedTask.assignee_id);
                    if (assignee?.avatar_image) {
                      return (
                        <img
                          src={assignee.avatar_image}
                          alt={assignee.display_name || 'Avatar'}
                          className="h-full w-full object-cover"
                        />
                      );
                    }
                    return <span>{assignee?.display_name?.[0]?.toUpperCase() || '?'}</span>;
                  })()}
                </button>
                {/* Выпадающий список участников */}
                {openAssigneeMenu === selectedTask.id && (
                  <div
                    data-assignee-menu
                    className="absolute top-full left-0 mt-1 z-50 min-w-[180px] rounded-lg border border-white/[0.12] bg-zinc-900/95 p-1.5 shadow-xl backdrop-blur-xl"
                    onMouseEnter={(e) => {
                      e.stopPropagation();
                      setOpenAssigneeMenu(selectedTask.id);
                    }}
                    onMouseLeave={(e) => {
                      e.stopPropagation();
                      const relatedTarget = e.relatedTarget as HTMLElement;
                      if (relatedTarget) {
                        const isMovingToButton = relatedTarget.closest('[data-assignee-button]');
                        const isMovingToMenu = relatedTarget.closest('[data-assignee-menu]');
                        if (isMovingToButton || isMovingToMenu) {
                          return;
                        }
                      }
                      setTimeout(() => {
                        const menuElement = document.querySelector('[data-assignee-menu]');
                        const buttonElement = document.querySelector('[data-assignee-button]');
                        if (menuElement && !menuElement.matches(':hover') && 
                            buttonElement && !buttonElement.matches(':hover')) {
                          setOpenAssigneeMenu(null);
                        }
                      }, 300);
                    }}
                  >
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      <button
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleUpdateTask(selectedTask.id, { assignee_id: null });
                          setOpenAssigneeMenu(null);
                        }}
                        className={`w-full flex items-center gap-2 rounded px-2 py-1.5 text-xs transition-all ${
                          !selectedTask.assignee_id
                            ? 'bg-white/[0.1] text-white'
                            : 'text-white/70 hover:bg-white/[0.08] hover:text-white'
                        }`}
                      >
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-[9px] font-bold text-white/40 ring-1 ring-white/10">
                          ?
                        </div>
                        <span>Не назначен</span>
                      </button>
                      {members.map((member) => (
                        <button
                          key={member.user_id}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleUpdateTask(selectedTask.id, { assignee_id: member.user_id });
                            setOpenAssigneeMenu(null);
                          }}
                          className={`w-full flex items-center gap-2 rounded px-2 py-1.5 text-xs transition-all ${
                            selectedTask.assignee_id === member.user_id
                              ? 'bg-white/[0.1] text-white'
                              : 'text-white/70 hover:bg-white/[0.08] hover:text-white'
                          }`}
                        >
                          <div
                            className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white shadow-sm overflow-hidden ring-1 ring-white/20"
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
                          <span>{member.display_name || 'Без имени'}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Пометка задачи */}
            <div className="pb-3 border-b border-white/[0.06]">
              <label className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-white/40">
                Пометка
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUpdateTask(selectedTask.id, { marker_type: selectedTask.marker_type === 'urgent' ? null : 'urgent' });
                  }}
                  className={`flex items-center justify-center h-8 w-8 rounded-lg border-2 transition-all hover:scale-110 ${
                    selectedTask.marker_type === 'urgent' ? 'border-red-500 ring-2 ring-red-500/30 bg-red-500/20' : 'border-white/20'
                  }`}
                  title="Срочно"
                >
                  <AlertCircle className={`h-4 w-4 ${selectedTask.marker_type === 'urgent' ? 'text-red-500' : 'text-white/40'}`} strokeWidth={3} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUpdateTask(selectedTask.id, { marker_type: selectedTask.marker_type === 'warning' ? null : 'warning' });
                  }}
                  className={`flex items-center justify-center h-8 w-8 rounded-lg border-2 transition-all hover:scale-110 ${
                    selectedTask.marker_type === 'warning' ? 'border-yellow-500 ring-2 ring-yellow-500/30 bg-yellow-500/20' : 'border-white/20'
                  }`}
                  title="Внимание"
                >
                  <AlertTriangle className={`h-4 w-4 ${selectedTask.marker_type === 'warning' ? 'text-yellow-500' : 'text-white/40'}`} strokeWidth={2.5} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUpdateTask(selectedTask.id, { marker_type: selectedTask.marker_type === 'time' ? null : 'time' });
                  }}
                  className={`flex items-center justify-center h-8 w-8 rounded-lg border-2 transition-all hover:scale-110 ${
                    selectedTask.marker_type === 'time' ? 'border-blue-500 ring-2 ring-blue-500/30 bg-blue-500/20' : 'border-white/20'
                  }`}
                  title="Тайминг"
                >
                  <Clock className={`h-4 w-4 ${selectedTask.marker_type === 'time' ? 'text-blue-500' : 'text-white/40'}`} strokeWidth={2} />
                </button>
              </div>
            </div>

            {/* Цвет задачи */}
            <div className="pb-3 border-b border-white/[0.06]">
              <label className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-white/40">
                Цвет
              </label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { name: 'Серый', color: '107,114,128' },
                  { name: 'Синий', color: '59,130,246' },
                  { name: 'Голубой', color: '14,165,233' },
                  { name: 'Индиго', color: '99,102,241' },
                  { name: 'Фиолетовый', color: '168,85,247' },
                  { name: 'Розовый', color: '236,72,153' },
                  { name: 'Красный', color: '239,68,68' },
                  { name: 'Темно-красный', color: '185,28,28' },
                  { name: 'Оранжевый', color: '249,115,22' },
                  { name: 'Желтый', color: '234,179,8' },
                  { name: 'Лайм', color: '132,204,22' },
                  { name: 'Зеленый', color: '34,197,94' },
                  { name: 'Темно-зеленый', color: '22,163,74' },
                  { name: 'Бирюзовый', color: '20,184,166' },
                  { name: 'Коричневый', color: '180,83,9' },
                  { name: 'Бежевый', color: '217,119,6' },
                ].map((colorOption) => {
                  const isSelected = selectedTask.color === colorOption.color;
                  return (
                    <button
                      key={colorOption.color}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUpdateTask(selectedTask.id, { color: colorOption.color });
                      }}
                      className={`h-5 w-5 rounded-md border-2 transition-all hover:scale-110 ${
                        isSelected ? 'border-white ring-2 ring-white/30' : 'border-white/20'
                      }`}
                      style={{ backgroundColor: `rgb(${colorOption.color})` }}
                      title={colorOption.name}
                    />
                  );
                })}
              </div>
            </div>

            {/* Даты */}
            <div className="grid grid-cols-2 gap-2 pb-3 border-b border-white/[0.06]">
              <div>
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-white/40">
                  Создано
                </label>
                <div className="text-xs text-white/60">
                  {selectedTask.created_at
                    ? new Date(selectedTask.created_at).toLocaleDateString('ru-RU')
                    : '—'}
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-white/40">
                  Дедлайн
                </label>
                <input
                  type="date"
                  value={selectedTask.deadline ? new Date(selectedTask.deadline).toISOString().split('T')[0] : ''}
                  onChange={(e) => {
                    const newDate = e.target.value ? new Date(e.target.value).toISOString() : null;
                    handleUpdateTask(selectedTask.id, { deadline: newDate });
                  }}
                  className="w-full h-7 border border-white/[0.12] bg-white/[0.05] rounded px-2 text-xs text-white/80 focus:outline-none focus:ring-1 focus:ring-white/20"
                />
              </div>
            </div>

            {/* Кнопка удаления */}
            {canEdit && (
              <div className="pt-2">
                <Button
                  variant="destructive"
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (confirm('Удалить задачу?')) {
                      await handleDeleteTask(selectedTask.id);
                      setSelectedTask(null);
                      setSettingsPanelPosition(null);
                    }
                  }}
                  className="w-full"
                  size="sm"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-2" />
                  Удалить задачу
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Контекстное меню */}
      {contextMenu.type && (
        <div
          className="fixed z-[100] min-w-[220px] rounded-xl border border-white/[0.12] bg-zinc-900/98 p-1.5 shadow-2xl backdrop-blur-2xl"
          style={{
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
          }}
          onClick={(e) => {
            e.stopPropagation();
            setContextMenu({ x: 0, y: 0, type: null, taskId: undefined });
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          {contextMenu.type === 'canvas' && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleCreateTaskFromContext(e.clientX, e.clientY, false);
                }}
                className="w-full rounded-lg px-4 py-2.5 text-left text-sm font-medium text-white transition-all hover:bg-white/[0.08]"
              >
                Создать задачу
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleCreateTaskFromContext(e.clientX, e.clientY, true);
                }}
                className="w-full rounded-lg px-4 py-2.5 text-left text-sm font-medium text-white transition-all hover:bg-white/[0.08]"
              >
                Создать задачу с содержимым
              </button>
            </>
          )}
          {contextMenu.type === 'task' && contextMenu.taskId && (() => {
            const task = tasks.find((t) => t.id === contextMenu.taskId);
            if (!task) return null;
            
            return (
              <>
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    const newX = (task.position_x || 0) - 20;
                    const newY = (task.position_y || 0) + 120;
                    const snappedX = Math.round(newX / GRID_SIZE) * GRID_SIZE;
                    const snappedY = Math.round(newY / GRID_SIZE) * GRID_SIZE;
                    await handleCreateTask(snappedX, snappedY, task.id);
                    setContextMenu({ x: 0, y: 0, type: null, taskId: undefined });
                  }}
                  className="w-full rounded-lg px-4 py-2.5 text-left text-sm font-medium text-white transition-all hover:bg-white/[0.08]"
                >
                  Создать связанную задачу
                </button>
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (task) {
                      try {
                        await enableTaskContent(task.id);
                        const updatedTasks = tasks.map((t) =>
                          t.id === task.id ? { ...t, has_content: true } : t
                        );
                        setTasks(updatedTasks);
                        toast.success('Содержимое добавлено');
                      } catch (error: any) {
                        toast.error(error.message || 'Ошибка добавления содержимого');
                      }
                    }
                    setContextMenu({ x: 0, y: 0, type: null, taskId: undefined });
                  }}
                  className="w-full rounded-lg px-4 py-2.5 text-left text-sm font-medium text-white transition-all hover:bg-white/[0.08]"
                >
                  Добавить содержимое
                </button>
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (task) {
                      // Раскрываем описание если оно скрыто
                      const newExpanded = new Set(expandedDescriptionTasks);
                      if (!newExpanded.has(task.id)) {
                        newExpanded.add(task.id);
                        setExpandedDescriptionTasks(newExpanded);
                      }
                      // Если описания нет, добавляем пустое
                      if (!task.description) {
                        await handleUpdateTask(task.id, { description: '' });
                      }
                    }
                    setContextMenu({ x: 0, y: 0, type: null, taskId: undefined });
                  }}
                  className="w-full rounded-lg px-4 py-2.5 text-left text-sm font-medium text-white transition-all hover:bg-white/[0.08]"
                >
                  {task?.description ? 'Редактировать описание' : 'Добавить описание'}
                </button>
              </>
            );
          })()}
        </div>
      )}

      {/* Диалог настроек проекта */}
      <ProjectSettingsDialog
        project={project}
        open={showSettingsDialog}
        onOpenChange={setShowSettingsDialog}
        onProjectUpdate={async (updatedProject) => {
          setProject(updatedProject);
          if (updatedProject.name !== project?.name) {
            setEditedName(updatedProject.name);
          }
        }}
      />

      {/* Модальное окно для просмотра изображения */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-sm"
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
              className="absolute -top-3 -right-3 rounded-full p-2.5 bg-red-500/90 hover:bg-red-500 text-white transition-all shadow-lg z-10 border-2 border-white/20"
              title="Закрыть (Esc)"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Компонент содержимого задачи
function TaskContentSection({
  task,
  contentItems,
  isExpanded,
  onToggleExpand,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
  onToggleComplete,
  canEdit,
}: {
  task: Task;
  contentItems: TaskContentItem[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  onAddItem: () => void;
  onUpdateItem: (itemId: string, updates: { content?: string; completed?: boolean }) => void;
  onDeleteItem: (itemId: string) => void;
  onToggleComplete: (itemId: string, completed: boolean) => void;
  canEdit: boolean;
}) {
  const completedCount = contentItems.filter((item) => item.completed).length;
  const totalCount = contentItems.length;
  const [editingContentId, setEditingContentId] = useState<string | null>(null);
  const [editingContentValue, setEditingContentValue] = useState('');
  const contentInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editingContentId && contentInputRef.current) {
      contentInputRef.current.focus();
      contentInputRef.current.setSelectionRange(editingContentValue.length, editingContentValue.length);
    }
  }, [editingContentId]);

  // Авто-высота textarea при вводе
  useEffect(() => {
    const ta = contentInputRef.current;
    if (!ta || editingContentId === null) return;
    ta.style.height = 'auto';
    ta.style.height = Math.max(24, ta.scrollHeight) + 'px';
  }, [editingContentValue, editingContentId]);

  if (!isExpanded) {
    return (
      <div className="border-t border-white/[0.08] px-3 py-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand();
          }}
          className="flex w-full items-center justify-between text-xs font-semibold text-white/50 hover:text-white/70 transition-colors"
        >
          <span className="uppercase tracking-wider flex items-center gap-2">
            <List className="h-3.5 w-3.5" />
            Содержимое ({completedCount}/{totalCount})
          </span>
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="border-t border-white/[0.08] p-3 space-y-2">
      {/* Заголовок секции — весь ряд кликабелен для сворачивания, z-20 поверх зоны настроек */}
      <button
        type="button"
        data-content-toggle
        onClick={(e) => {
          e.stopPropagation();
          onToggleExpand();
        }}
        onMouseDown={(e) => e.stopPropagation()}
        className="flex w-full items-center justify-between mb-2 relative z-20 text-left"
      >
        <span className="text-xs font-semibold uppercase tracking-wider text-white/50 flex items-center gap-2">
          <List className="h-3.5 w-3.5" />
          Содержимое
        </span>
        <ChevronUp className="h-3.5 w-3.5 text-white/40 hover:text-white/70 transition-colors shrink-0" />
      </button>

      {/* Список: круг слева (серый/зелёный), текст справа */}
      <div className="space-y-1 max-h-[320px] overflow-y-auto pr-1">
        {contentItems.length === 0 ? (
          <div className="text-center py-3 text-xs text-white/40">
            Нет элементов. Добавьте первый пункт.
          </div>
        ) : (
          contentItems
            .sort((a, b) => a.position - b.position)
            .map((item) => (
              <div key={item.id} className="group relative flex items-start gap-2 min-h-[28px] pr-6">
                {/* Кружок: серый — не выполнено, зелёный — выполнено */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (canEdit) onToggleComplete(item.id, !item.completed);
                  }}
                  disabled={!canEdit}
                  className={`mt-0.5 shrink-0 rounded-full border transition-colors ${
                    item.completed
                      ? 'h-4 w-4 bg-emerald-500 border-emerald-400'
                      : 'h-4 w-4 bg-white/[0.12] border-white/30 hover:bg-white/[0.2]'
                  } ${!canEdit ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                  title={item.completed ? 'Отметить невыполненным' : 'Выполнено'}
                />
                {/* Текст */}
                {canEdit && editingContentId === item.id ? (
                  <textarea
                    ref={contentInputRef}
                    value={editingContentValue}
                    onChange={(e) => setEditingContentValue(e.target.value)}
                    onBlur={() => {
                      const trimmed = editingContentValue.trim();
                      if (trimmed !== item.content) {
                        onUpdateItem(item.id, { content: trimmed || item.content });
                      }
                      setEditingContentId(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    className={`flex-1 min-w-0 min-h-[24px] resize-none border-0 bg-transparent px-1 py-0.5 text-xs leading-relaxed text-white/60 placeholder:text-white/30 focus:outline-none overflow-hidden ${
                      item.completed ? 'line-through opacity-60' : ''
                    }`}
                    style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                    placeholder="Текст пункта..."
                    rows={1}
                  />
                ) : (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      const target = e.target as HTMLElement;
                      if (target.tagName === 'A') {
                        const href = target.getAttribute('href');
                        if (href) window.open(href, '_blank', 'noopener,noreferrer');
                        return;
                      }
                      if (canEdit) {
                        setEditingContentId(item.id);
                        setEditingContentValue(item.content);
                      }
                    }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      const target = e.target as HTMLElement;
                      if (target.tagName === 'A') return;
                    }}
                    className={`flex-1 min-w-0 px-1 py-0.5 text-xs leading-relaxed text-white/60 ${
                      item.completed ? 'line-through opacity-60' : ''
                    } ${canEdit ? 'cursor-text' : 'cursor-default opacity-80'}`}
                    style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                    dangerouslySetInnerHTML={{ __html: item.content ? linkifyText(item.content) : (canEdit ? '<span class="text-white/30">Добавить текст...</span>' : '&nbsp;') }}
                  />
                )}
                {/* Удаление — absolute вверху справа, не занимает место */}
                {canEdit && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteItem(item.id);
                    }}
                    className="absolute right-0 top-0 p-0.5 rounded opacity-0 group-hover:opacity-100 text-white/40 hover:text-red-400 transition-all z-10"
                    title="Удалить пункт"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))
        )}
      </div>

      {canEdit && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onAddItem();
          }}
          className="w-full mt-1.5 flex items-center justify-center gap-1.5 py-1.5 text-xs text-white/50 hover:text-white/70 hover:bg-white/[0.06] rounded transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Добавить пункт
        </button>
      )}
    </div>
  );
}

// Компонент описания задачи (textarea при редактировании, div с linkify при просмотре)
function TaskDescriptionSection({
  task,
  isExpanded,
  onToggleExpand,
  onUpdateDescription,
  canEdit,
}: {
  task: Task;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onUpdateDescription: (description: string) => void;
  canEdit: boolean;
}) {
  const [localDescription, setLocalDescription] = useState(task.description || '');
  const [isDescriptionFocused, setIsDescriptionFocused] = useState(false);
  const descriptionInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setLocalDescription(task.description || '');
  }, [task.description]);

  useEffect(() => {
    if (isDescriptionFocused && descriptionInputRef.current) {
      descriptionInputRef.current.focus();
      const len = localDescription.length;
      descriptionInputRef.current.setSelectionRange(len, len);
    }
  }, [isDescriptionFocused]);

  if (!isExpanded) {
    return (
      <div className="border-t border-white/[0.08] px-3 py-2 relative z-20">
        <button
          data-description-toggle
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onToggleExpand();
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
          className="flex w-full items-center justify-between text-xs font-semibold text-white/50 hover:text-white/70 transition-colors relative z-30"
          style={{ pointerEvents: 'auto' }}
        >
          <span className="uppercase tracking-wider flex items-center gap-2">
            <Edit2 className="h-3.5 w-3.5" />
            Описание
          </span>
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="border-t border-white/[0.08] p-3 space-y-2 relative z-20">
      {/* Заголовок секции */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-white/50 flex items-center gap-2">
          <Edit2 className="h-3.5 w-3.5" />
          Описание
        </span>
        <button
          data-description-toggle
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onToggleExpand();
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
          className="text-white/40 hover:text-white/70 transition-colors relative z-30"
          style={{ pointerEvents: 'auto' }}
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Описание: при редактировании — textarea, иначе — div с ссылками */}
      {canEdit && isDescriptionFocused ? (
        <textarea
          ref={descriptionInputRef}
          value={localDescription}
          onChange={(e) => setLocalDescription(e.target.value)}
          onBlur={() => {
            onUpdateDescription(localDescription);
            setIsDescriptionFocused(false);
          }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          className="w-full min-h-[60px] resize-none border-0 bg-transparent px-0 py-0 text-xs leading-relaxed text-white/60 placeholder:text-white/30 focus:outline-none focus:ring-0"
          style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
          placeholder="Введите описание задачи..."
          rows={4}
        />
      ) : (
        <div
          onClick={(e) => {
            e.stopPropagation();
            const target = e.target as HTMLElement;
            if (target.tagName === 'A') {
              const href = target.getAttribute('href');
              if (href) window.open(href, '_blank', 'noopener,noreferrer');
              return;
            }
            if (canEdit) {
              setIsDescriptionFocused(true);
            }
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
            const target = e.target as HTMLElement;
            if (target.tagName === 'A') return;
          }}
          className={`w-full min-h-[60px] text-xs leading-relaxed text-white/60 focus:outline-none ${
            canEdit ? 'cursor-text' : 'cursor-default opacity-50'
          }`}
          style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
          dangerouslySetInnerHTML={{
            __html: localDescription ? linkifyText(localDescription) : (canEdit ? '<span class="text-white/30">Введите описание задачи...</span>' : '<span class="text-white/30">Нет описания</span>'),
          }}
        />
      )}
    </div>
  );
}
