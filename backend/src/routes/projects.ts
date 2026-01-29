import express from 'express';
import pool from '../db/connection';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { checkProjectAccess, canEdit, canDelete } from '../utils/access';
import { broadcastProjectUpdate } from '../websocket/broadcast';

const router = express.Router();

// Получить все проекты пользователя
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;

    // Получаем проекты с правильной ролью
    // Показываем только проекты, где пользователь является владельцем или участником
    // Публичные проекты появляются только после присоединения по коду доступа
    const result = await pool.query(
      `SELECT 
        p.*,
        CASE 
          WHEN p.owner_id = $1 THEN 'owner'
          WHEN pm.user_id = $1 THEN pm.role
          ELSE NULL
        END as role
       FROM projects p
       LEFT JOIN project_members pm ON p.id = pm.project_id AND pm.user_id = $1
       WHERE p.owner_id = $1 OR pm.user_id = $1
       ORDER BY 
         CASE WHEN p.owner_id = $1 THEN 0 ELSE 1 END,
         p.updated_at DESC`,
      [userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Создать проект
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { name, isPublic } = req.body;
    const userId = req.user!.id;

    if (!name) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    const result = await pool.query(
      'INSERT INTO projects (name, owner_id, is_public) VALUES ($1, $2, $3) RETURNING *',
      [name, userId, isPublic || false]
    );

    const newProject = result.rows[0];

    // Автоматически добавляем владельца в project_members
    await pool.query(
      'INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT (project_id, user_id) DO NOTHING',
      [newProject.id, userId, 'owner']
    );

    broadcastProjectUpdate(newProject.id, 'INSERT', newProject);
    res.status(201).json(newProject);
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Получить проект по ID
router.get('/:projectId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const projectId = Array.isArray(req.params.projectId)
      ? req.params.projectId[0]
      : req.params.projectId;
    const userId = req.user!.id;

    const role = await checkProjectAccess(projectId, userId);

    if (!role) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await pool.query('SELECT * FROM projects WHERE id = $1', [
      projectId,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Добавляем роль пользователя в ответ
    const project = result.rows[0];
    res.json({ ...project, role });
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Обновить проект
router.put('/:projectId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const projectId = Array.isArray(req.params.projectId)
      ? req.params.projectId[0]
      : req.params.projectId;
    const { name, isPublic } = req.body;
    const userId = req.user!.id;

    const role = await checkProjectAccess(projectId, userId);

    if (!canEdit(role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await pool.query(
      'UPDATE projects SET name = $1, is_public = $2 WHERE id = $3 RETURNING *',
      [name, isPublic, projectId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

      const updatedProject = result.rows[0];
      broadcastProjectUpdate(projectId, 'UPDATE', updatedProject);
      res.json(updatedProject);
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Удалить проект
router.delete(
  '/:projectId',
  authenticateToken,
  async (req: AuthRequest, res) => {
    try {
      const projectId = Array.isArray(req.params.projectId)
        ? req.params.projectId[0]
        : req.params.projectId;
      const userId = req.user!.id;

      const role = await checkProjectAccess(projectId, userId);

      if (!canDelete(role)) {
        return res.status(403).json({ error: 'Access denied' });
      }

      await pool.query('DELETE FROM projects WHERE id = $1', [projectId]);

      res.json({ success: true });
    } catch (error) {
      console.error('Delete project error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Генерация кода доступа
router.post(
  '/:projectId/generate-code',
  authenticateToken,
  async (req: AuthRequest, res) => {
    try {
      const projectId = Array.isArray(req.params.projectId)
        ? req.params.projectId[0]
        : req.params.projectId;
      const userId = req.user!.id;

      const role = await checkProjectAccess(projectId, userId);

      if (role !== 'owner') {
        return res.status(403).json({ error: 'Only owner can generate code' });
      }

      // Генерация уникального 8-значного кода доступа
      const generateAccessCode = (): string => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Исключаем похожие символы (0, O, I, 1)
        let result = '';
        for (let i = 0; i < 8; i++) {
          result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
      };

      // Генерируем код и проверяем уникальность
      let code = '';
      let isUnique = false;
      let attempts = 0;
      const maxAttempts = 10;

      while (!isUnique && attempts < maxAttempts) {
        code = generateAccessCode();
        const checkResult = await pool.query(
          'SELECT id FROM projects WHERE access_code = $1',
          [code]
        );
        if (checkResult.rows.length === 0) {
          isUnique = true;
        }
        attempts++;
      }

      if (!isUnique) {
        return res.status(500).json({ error: 'Failed to generate unique code' });
      }

      await pool.query('UPDATE projects SET access_code = $1 WHERE id = $2', [
        code!,
        projectId,
      ]);

      res.json({ accessCode: code });
    } catch (error) {
      console.error('Generate code error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Удаление кода доступа
router.post(
  '/:projectId/delete-code',
  authenticateToken,
  async (req: AuthRequest, res) => {
    try {
      const projectId = Array.isArray(req.params.projectId)
        ? req.params.projectId[0]
        : req.params.projectId;
      const userId = req.user!.id;

      const role = await checkProjectAccess(projectId, userId);

      if (role !== 'owner') {
        return res.status(403).json({ error: 'Only owner can delete code' });
      }

      await pool.query('UPDATE projects SET access_code = NULL WHERE id = $1', [
        projectId,
      ]);

      res.json({ success: true });
    } catch (error) {
      console.error('Delete code error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Присоединение по коду доступа
router.post('/join-by-code', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { accessCode } = req.body;
    const userId = req.user!.id;

    if (!accessCode) {
      return res.status(400).json({ error: 'Access code is required' });
    }

    // Поиск проекта по коду
    const projectResult = await pool.query(
      'SELECT * FROM projects WHERE access_code = $1 AND is_public = true',
      [accessCode]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid access code' });
    }

    const project = projectResult.rows[0];

    // Проверка, не является ли пользователь владельцем
    if (project.owner_id === userId) {
      return res.status(400).json({ error: 'You are already the owner' });
    }

    // Проверка, не является ли уже участником
    const memberCheck = await pool.query(
      'SELECT * FROM project_members WHERE project_id = $1 AND user_id = $2',
      [project.id, userId]
    );

    if (memberCheck.rows.length > 0) {
      return res.status(400).json({ error: 'You are already a member' });
    }

    // Добавление участника
    await pool.query(
      'INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, $3)',
      [project.id, userId, 'editor']
    );

    res.json({ projectId: project.id, projectName: project.name });
  } catch (error) {
    console.error('Join by code error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
