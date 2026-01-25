import express from 'express';
import pool from '../db/connection';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { checkProjectAccess, canEdit } from '../utils/access';
import { broadcastTaskUpdate } from '../websocket/broadcast';

const router = express.Router();

// Получить содержимое задачи
router.get('/tasks/:taskId/content', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { taskId } = req.params;
    const userId = req.user!.id;

    // Получаем проект задачи
    const taskResult = await pool.query(
      'SELECT project_id FROM tasks WHERE id = $1',
      [taskId]
    );

    if (taskResult.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const projectId = taskResult.rows[0].project_id;
    const role = await checkProjectAccess(projectId, userId);

    if (!role) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await pool.query(
      'SELECT * FROM task_content_items WHERE task_id = $1 ORDER BY position, created_at',
      [taskId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get task content error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Создать элемент содержимого
router.post('/tasks/:taskId/content', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { taskId } = req.params;
    const userId = req.user!.id;
    const { content, position } = req.body;

    // Получаем проект задачи
    const taskResult = await pool.query(
      'SELECT project_id FROM tasks WHERE id = $1',
      [taskId]
    );

    if (taskResult.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const projectId = taskResult.rows[0].project_id;
    const role = await checkProjectAccess(projectId, userId);

    if (!canEdit(role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Создаем элемент содержимого
    const contentResult = await pool.query(
      'INSERT INTO task_content_items (task_id, content, position, completed) VALUES ($1, $2, $3, false) RETURNING *',
      [taskId, content || '', position || 0]
    );

    // Обновляем флаг has_content задачи
    await pool.query(
      'UPDATE tasks SET has_content = true WHERE id = $1',
      [taskId]
    );

    // Обновляем задачу через broadcast
    const updatedTask = await pool.query('SELECT * FROM tasks WHERE id = $1', [taskId]);
    if (updatedTask.rows.length > 0) {
      broadcastTaskUpdate(projectId, 'UPDATE', updatedTask.rows[0]);
    }

    res.status(201).json(contentResult.rows[0]);
  } catch (error) {
    console.error('Create task content error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Обновить элемент содержимого
router.put('/tasks/:taskId/content/:itemId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { taskId, itemId } = req.params;
    const userId = req.user!.id;
    const { content, position, completed } = req.body;

    // Получаем проект задачи
    const taskResult = await pool.query(
      'SELECT project_id FROM tasks WHERE id = $1',
      [taskId]
    );

    if (taskResult.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const projectId = taskResult.rows[0].project_id;
    const role = await checkProjectAccess(projectId, userId);

    if (!canEdit(role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updateFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (content !== undefined) {
      updateFields.push(`content = $${paramIndex}`);
      values.push(content);
      paramIndex++;
    }

    if (position !== undefined) {
      updateFields.push(`position = $${paramIndex}`);
      values.push(position);
      paramIndex++;
    }

    if (completed !== undefined) {
      updateFields.push(`completed = $${paramIndex}`);
      values.push(completed);
      paramIndex++;
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(itemId);

    const result = await pool.query(
      `UPDATE task_content_items SET ${updateFields.join(', ')}, updated_at = now() WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update task content error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Удалить элемент содержимого
router.delete('/tasks/:taskId/content/:itemId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { taskId, itemId } = req.params;
    const userId = req.user!.id;

    // Получаем проект задачи
    const taskResult = await pool.query(
      'SELECT project_id FROM tasks WHERE id = $1',
      [taskId]
    );

    if (taskResult.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const projectId = taskResult.rows[0].project_id;
    const role = await checkProjectAccess(projectId, userId);

    if (!canEdit(role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await pool.query('DELETE FROM task_content_items WHERE id = $1', [itemId]);

    // Проверяем, остались ли элементы содержимого
    const remainingResult = await pool.query(
      'SELECT COUNT(*) as count FROM task_content_items WHERE task_id = $1',
      [taskId]
    );

    const count = parseInt(remainingResult.rows[0].count);
    
    // Если элементов не осталось, сбрасываем флаг has_content
    if (count === 0) {
      await pool.query(
        'UPDATE tasks SET has_content = false WHERE id = $1',
        [taskId]
      );
    }

    // Обновляем задачу через broadcast
    const updatedTask = await pool.query('SELECT * FROM tasks WHERE id = $1', [taskId]);
    if (updatedTask.rows.length > 0) {
      broadcastTaskUpdate(projectId, 'UPDATE', updatedTask.rows[0]);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete task content error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Активировать содержимое задачи (создать первый элемент)
router.post('/tasks/:taskId/enable-content', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { taskId } = req.params;
    const userId = req.user!.id;

    // Получаем проект задачи
    const taskResult = await pool.query(
      'SELECT project_id FROM tasks WHERE id = $1',
      [taskId]
    );

    if (taskResult.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const projectId = taskResult.rows[0].project_id;
    const role = await checkProjectAccess(projectId, userId);

    if (!canEdit(role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Проверяем, есть ли уже содержимое
    const existingResult = await pool.query(
      'SELECT COUNT(*) as count FROM task_content_items WHERE task_id = $1',
      [taskId]
    );

    if (parseInt(existingResult.rows[0].count) > 0) {
      return res.status(400).json({ error: 'Content already exists' });
    }

    // Создаем первый элемент содержимого
    const contentResult = await pool.query(
      'INSERT INTO task_content_items (task_id, content, position, completed) VALUES ($1, $2, $3, false) RETURNING *',
      [taskId, '', 0]
    );

    // Обновляем флаг has_content
    await pool.query(
      'UPDATE tasks SET has_content = true WHERE id = $1',
      [taskId]
    );

    // Обновляем задачу через broadcast
    const updatedTask = await pool.query('SELECT * FROM tasks WHERE id = $1', [taskId]);
    if (updatedTask.rows.length > 0) {
      broadcastTaskUpdate(projectId, 'UPDATE', updatedTask.rows[0]);
    }

    res.status(201).json(contentResult.rows[0]);
  } catch (error) {
    console.error('Enable task content error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
