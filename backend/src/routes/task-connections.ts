import express from 'express';
import pool from '../db/connection';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { checkProjectAccess, canEdit } from '../utils/access';

const router = express.Router();

// Получить все соединения проекта
router.get(
  '/projects/:projectId/task-connections',
  authenticateToken,
  async (req: AuthRequest, res) => {
    try {
      const { projectId } = req.params;
      const userId = req.user!.id;

      const role = await checkProjectAccess(projectId, userId);

      if (!role) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const result = await pool.query(
        'SELECT * FROM task_connections WHERE project_id = $1 ORDER BY created_at',
        [projectId]
      );

      res.json(result.rows);
    } catch (error) {
      console.error('Get task connections error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Создать соединение между задачами
router.post(
  '/projects/:projectId/task-connections',
  authenticateToken,
  async (req: AuthRequest, res) => {
    try {
      const { projectId } = req.params;
      const userId = req.user!.id;
      const { from_task_id, to_task_id, from_edge, to_edge } = req.body;

      // Проверяем доступ к проекту и права на редактирование
      const role = await checkProjectAccess(projectId, userId);
      if (!role || !canEdit(role)) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Валидация входных данных
      if (!from_task_id || !to_task_id || !from_edge || !to_edge) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const validEdges = ['top', 'bottom', 'left', 'right'];
      if (!validEdges.includes(from_edge) || !validEdges.includes(to_edge)) {
        return res.status(400).json({ error: 'Invalid edge value' });
      }

      // Проверяем, что задачи существуют и принадлежат проекту
      const fromTaskResult = await pool.query(
        'SELECT id FROM tasks WHERE id = $1 AND project_id = $2',
        [from_task_id, projectId]
      );

      const toTaskResult = await pool.query(
        'SELECT id FROM tasks WHERE id = $1 AND project_id = $2',
        [to_task_id, projectId]
      );

      if (fromTaskResult.rows.length === 0 || toTaskResult.rows.length === 0) {
        return res.status(404).json({ error: 'Task not found' });
      }

      // Проверяем существование полей from_edge и to_edge в таблице
      const columnsCheck = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'task_connections' 
        AND column_name IN ('from_edge', 'to_edge')
      `);
      
      if (columnsCheck.rows.length < 2) {
        return res.status(500).json({ 
          error: 'Database schema error: missing columns from_edge or to_edge',
          message: 'Please run migration: backend/migrations/add_edges_to_task_connections.sql',
          needsMigration: true,
          migrationFile: 'add_edges_to_task_connections.sql'
        });
      }

      // Проверяем, не существует ли уже такое соединение
      const existingConnection = await pool.query(
        'SELECT id FROM task_connections WHERE from_task_id = $1 AND to_task_id = $2 AND from_edge = $3 AND to_edge = $4',
        [from_task_id, to_task_id, from_edge, to_edge]
      );

      if (existingConnection.rows.length > 0) {
        return res.status(409).json({ error: 'Connection already exists' });
      }

      // Создаем соединение
      const result = await pool.query(
        `INSERT INTO task_connections (from_task_id, to_task_id, from_edge, to_edge, project_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [from_task_id, to_task_id, from_edge, to_edge, projectId]
      );

      res.status(201).json(result.rows[0]);
    } catch (error: any) {
      console.error('Create task connection error:', error);
      // Возвращаем более детальную информацию об ошибке
      const errorMessage = error.message || 'Internal server error';
      const errorCode = error.code;
      
      // Если ошибка связана с отсутствием колонок, возвращаем понятное сообщение
      if (errorMessage.includes('column') && errorMessage.includes('does not exist')) {
        return res.status(500).json({ 
          error: 'Database schema error: missing columns. Please run migration add_edges_to_task_connections.sql',
          details: errorMessage,
          needsMigration: true,
          migrationFile: 'add_edges_to_task_connections.sql'
        });
      }
      
      res.status(500).json({ 
        error: 'Internal server error',
        message: errorMessage,
        code: errorCode
      });
    }
  }
);

// Удалить соединение
router.delete(
  '/projects/:projectId/task-connections/:connectionId',
  authenticateToken,
  async (req: AuthRequest, res) => {
    try {
      const { projectId, connectionId } = req.params;
      const userId = req.user!.id;

      // Проверяем доступ к проекту и права на редактирование
      const role = await checkProjectAccess(projectId, userId);
      if (!role || !canEdit(role)) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Проверяем, что соединение принадлежит проекту
      const connectionResult = await pool.query(
        'SELECT id FROM task_connections WHERE id = $1 AND project_id = $2',
        [connectionId, projectId]
      );

      if (connectionResult.rows.length === 0) {
        return res.status(404).json({ error: 'Connection not found' });
      }

      // Удаляем соединение
      await pool.query(
        'DELETE FROM task_connections WHERE id = $1',
        [connectionId]
      );

      res.status(204).send();
    } catch (error) {
      console.error('Delete task connection error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;
