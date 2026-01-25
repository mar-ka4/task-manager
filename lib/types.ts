// Задача
export interface Task {
  id: string;
  project_id: string;
  parent_id: string | null;
  title: string;
  description: string | null;
  assignee_id: string | null;
  status: 'todo' | 'in_progress' | 'completed' | 'blocked';
  deadline: string | null;
  position_x: number;
  position_y: number;
  width?: number; // Ширина задачи в пикселях
  height?: number; // Высота задачи в пикселях
  created_at?: string;
  updated_at?: string;
  owner_id?: string;
  has_content?: boolean;
  color?: string; // RGB формат: "107, 114, 128"
  marker_type?: 'urgent' | 'warning' | 'time' | null; // Тип пометки: urgent (красный), warning (желтый), time (будильник)
  images?: string[]; // Массив base64 изображений
  files?: Array<{ name: string; data: string; type: string }>; // Массив файлов (name, base64 data, mime type)
}

// Профиль пользователя
export interface Profile {
  id: string;
  display_name: string;
  avatar_color: string;
  avatar_image?: string | null; // Base64 изображение
  created_at?: string;
}

// Проект
export interface Project {
  id: string;
  name: string;
  owner_id: string;
  is_public: boolean;
  access_code: string | null;
  created_at?: string;
  updated_at?: string;
  role?: 'owner' | 'editor' | 'viewer';
}

// Участник проекта
export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: 'owner' | 'editor' | 'viewer';
  joined_at: string;
  display_name?: string;
  avatar_color?: string;
  avatar_image?: string | null;
}

// Элемент содержимого задачи
export interface TaskContentItem {
  id: string;
  task_id: string;
  content: string;
  position: number;
  completed?: boolean;
  created_at?: string;
  updated_at?: string;
}

// Связь между задачами
export interface TaskConnection {
  id: string;
  from_task_id: string;
  to_task_id: string;
  from_edge: 'top' | 'bottom' | 'left' | 'right';
  to_edge: 'top' | 'bottom' | 'left' | 'right';
  project_id: string;
  created_at?: string;
}

// Пользователь
export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarColor?: string;
  avatarImage?: string | null;
}
