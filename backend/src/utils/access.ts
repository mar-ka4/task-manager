import pool from '../db/connection';

export type ProjectRole = 'owner' | 'editor' | 'viewer';

export async function checkProjectAccess(
  projectId: string,
  userId: string
): Promise<ProjectRole | null> {
  // Проверка владельца
  const projectResult = await pool.query(
    'SELECT owner_id, is_public FROM projects WHERE id = $1',
    [projectId]
  );

  if (projectResult.rows.length === 0) {
    return null;
  }

  const project = projectResult.rows[0];

  if (project.owner_id === userId) {
    return 'owner';
  }

  // Проверка участия
  const memberResult = await pool.query(
    'SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2',
    [projectId, userId]
  );

  if (memberResult.rows.length > 0) {
    return memberResult.rows[0].role;
  }

  // Публичные проекты доступны только после присоединения по коду доступа
  // (когда пользователь уже добавлен в project_members)
  // Без присоединения доступ запрещен, даже если проект публичный
  return null;
}

export function canEdit(role: ProjectRole | null): boolean {
  return role === 'owner' || role === 'editor';
}

export function canDelete(role: ProjectRole | null): boolean {
  return role === 'owner';
}
