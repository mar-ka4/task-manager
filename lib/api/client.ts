const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export async function apiRequest(
  endpoint: string,
  options: RequestInit = {}
): Promise<any> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    const errorMessage = error.error || error.message || `API error: ${response.statusText}`;
    const fullError = new Error(errorMessage);
    // Добавляем детали ошибки для отладки
    if (error.message) {
      (fullError as any).details = error.message;
    }
    if (error.details) {
      (fullError as any).stack = error.details;
    }
    // Добавляем информацию о PostgreSQL ошибках
    if (error.pgError) {
      (fullError as any).pgError = error.pgError;
    }
    
    // Добавляем информацию о миграциях, если она есть
    if (error.needsMigration) {
      (fullError as any).needsMigration = true;
      (fullError as any).migrationFile = error.migrationFile;
      if (error.message) {
        (fullError as any).userMessage = error.message;
      }
    }
    throw fullError;
  }

  // Проверяем, есть ли контент в ответе
  const contentType = response.headers.get('content-type');
  const contentLength = response.headers.get('content-length');
  
  // Если ответ пустой или нет контента, возвращаем null
  if (contentLength === '0' || !contentType?.includes('application/json')) {
    const text = await response.text();
    if (!text || text.trim() === '') {
      return null;
    }
    // Если есть текст, но не JSON, пытаемся распарсить
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  return response.json();
}

// Auth
export async function register(email: string, password: string, displayName: string) {
  return apiRequest('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, displayName }),
  });
}

export async function login(email: string, password: string) {
  return apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function getCurrentUser() {
  return apiRequest('/auth/me');
}

export async function logout() {
  // Очищаем токен на клиенте
  if (typeof window !== 'undefined') {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }
  return Promise.resolve();
}

// Projects
export async function getProjects() {
  return apiRequest('/projects');
}

export async function getProject(projectId: string) {
  return apiRequest(`/projects/${projectId}`);
}

export async function createProject(name: string, isPublic: boolean = false) {
  return apiRequest('/projects', {
    method: 'POST',
    body: JSON.stringify({ name, isPublic }),
  });
}

export async function updateProject(projectId: string, data: { name?: string; isPublic?: boolean }) {
  return apiRequest(`/projects/${projectId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteProject(projectId: string) {
  return apiRequest(`/projects/${projectId}`, {
    method: 'DELETE',
  });
}

export async function generateAccessCode(projectId: string) {
  return apiRequest(`/projects/${projectId}/generate-code`, {
    method: 'POST',
  });
}

export async function deleteAccessCode(projectId: string) {
  return apiRequest(`/projects/${projectId}/delete-code`, {
    method: 'POST',
  });
}

export async function joinByCode(accessCode: string) {
  return apiRequest('/projects/join-by-code', {
    method: 'POST',
    body: JSON.stringify({ accessCode }),
  });
}

// Tasks
export async function getTasks(projectId: string) {
  return apiRequest(`/projects/${projectId}/tasks`);
}

export async function createTask(projectId: string, taskData: any) {
  return apiRequest(`/projects/${projectId}/tasks`, {
    method: 'POST',
    body: JSON.stringify(taskData),
  });
}

export async function updateTask(taskId: string, taskData: any) {
  return apiRequest(`/tasks/${taskId}`, {
    method: 'PUT',
    body: JSON.stringify(taskData),
  });
}

export async function deleteTask(taskId: string) {
  return apiRequest(`/tasks/${taskId}`, {
    method: 'DELETE',
  });
}

// Task Content
export async function getTaskContent(taskId: string) {
  return apiRequest(`/tasks/${taskId}/content`);
}

export async function createTaskContentItem(taskId: string, data: { content?: string; position?: number }) {
  return apiRequest(`/tasks/${taskId}/content`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateTaskContentItem(taskId: string, itemId: string, data: { content?: string; position?: number; completed?: boolean }) {
  return apiRequest(`/tasks/${taskId}/content/${itemId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteTaskContentItem(taskId: string, itemId: string) {
  return apiRequest(`/tasks/${taskId}/content/${itemId}`, {
    method: 'DELETE',
  });
}

export async function enableTaskContent(taskId: string) {
  return apiRequest(`/tasks/${taskId}/enable-content`, {
    method: 'POST',
  });
}

// Profiles
export async function getProfile(userId: string) {
  return apiRequest(`/profiles/${userId}`);
}

export async function updateProfile(userId: string, data: {
  displayName?: string;
  avatarColor?: string;
  avatarImage?: string | null;
}) {
  return apiRequest(`/profiles/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// Members
export async function getProjectMembers(projectId: string) {
  return apiRequest(`/projects/${projectId}/members`);
}

export async function removeMember(projectId: string, memberId: string) {
  return apiRequest(`/projects/${projectId}/members/${memberId}`, {
    method: 'DELETE',
  });
}

// Task Connections
export async function getTaskConnections(projectId: string) {
  return apiRequest(`/projects/${projectId}/task-connections`);
}

export async function createTaskConnection(
  projectId: string,
  fromTaskId: string,
  toTaskId: string,
  fromEdge: 'top' | 'bottom' | 'left' | 'right',
  toEdge: 'top' | 'bottom' | 'left' | 'right'
) {
  return apiRequest(`/projects/${projectId}/task-connections`, {
    method: 'POST',
    body: JSON.stringify({
      from_task_id: fromTaskId,
      to_task_id: toTaskId,
      from_edge: fromEdge,
      to_edge: toEdge,
    }),
  });
}

export async function deleteTaskConnection(projectId: string, connectionId: string) {
  return apiRequest(`/projects/${projectId}/task-connections/${connectionId}`, {
    method: 'DELETE',
  });
}
