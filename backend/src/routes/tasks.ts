import express from 'express';
import pool from '../db/connection';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { checkProjectAccess, canEdit } from '../utils/access';
import { broadcastTaskUpdate } from '../websocket/broadcast';

const router = express.Router();

// Получить задачи проекта
router.get(
  '/projects/:projectId/tasks',
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
        'SELECT * FROM tasks WHERE project_id = $1 ORDER BY created_at',
        [projectId]
      );

      // Преобразуем JSON поля images и files обратно в массивы
      const tasks = result.rows.map((task: any) => {
        if (task.images && typeof task.images === 'string') {
          try {
            task.images = JSON.parse(task.images);
          } catch (e) {
            task.images = [];
          }
        } else if (!task.images) {
          task.images = [];
        }
        if (task.files && typeof task.files === 'string') {
          try {
            task.files = JSON.parse(task.files);
          } catch (e) {
            task.files = [];
          }
        } else if (!task.files) {
          task.files = [];
        }
        return task;
      });

      res.json(tasks);
    } catch (error) {
      console.error('Get tasks error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Создать задачу
router.post(
  '/projects/:projectId/tasks',
  authenticateToken,
  async (req: AuthRequest, res) => {
    try {
      const { projectId } = req.params;
      const userId = req.user!.id;
      const {
        title,
        description,
        parentId,
        assigneeId,
        status,
        positionX,
        positionY,
        color,
      } = req.body;

      const role = await checkProjectAccess(projectId, userId);

      if (!canEdit(role)) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const result = await pool.query(
        `INSERT INTO tasks (
          project_id, parent_id, title, description, owner_id,
          assignee_id, status, position_x, position_y, color, marker_type, images, files
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
        [
          projectId,
          parentId || null,
          title || '',
          description || null,
          userId,
          assigneeId || null,
          status || 'todo',
          positionX || 0,
          positionY || 0,
          color || '107, 114, 128',
          null, // marker_type по умолчанию
          JSON.stringify([]), // Пустой массив изображений по умолчанию
          JSON.stringify([]), // Пустой массив файлов по умолчанию
        ]
      );

      const task = result.rows[0];
      // Преобразуем JSON поля images и files обратно в массивы
      if (task.images && typeof task.images === 'string') {
        try {
          task.images = JSON.parse(task.images);
        } catch (e) {
          task.images = [];
        }
      } else if (!task.images) {
        task.images = [];
      }
      if (task.files && typeof task.files === 'string') {
        try {
          task.files = JSON.parse(task.files);
        } catch (e) {
          task.files = [];
        }
      } else if (!task.files) {
        task.files = [];
      }

      res.status(201).json(task);
    } catch (error) {
      console.error('Create task error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Обновить задачу
router.put('/tasks/:taskId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { taskId } = req.params;
    const userId = req.user!.id;
    const updates = req.body;

    // Получение задачи для проверки проекта
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

    // Построение запроса обновления
    const fieldMapping: Record<string, string> = {
      'title': 'title',
      'description': 'description',
      'parent_id': 'parent_id',
      'parentId': 'parent_id',
      'assignee_id': 'assignee_id',
      'assigneeId': 'assignee_id',
      'status': 'status',
      'deadline': 'deadline',
      'position_x': 'position_x',
      'positionX': 'position_x',
      'position_y': 'position_y',
      'positionY': 'position_y',
      'width': 'width',
      'height': 'height',
      'color': 'color',
      'marker_type': 'marker_type',
      'images': 'images',
      'files': 'files',
    };

    const updateFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    for (const [clientField, dbField] of Object.entries(fieldMapping)) {
      if (updates[clientField] !== undefined) {
        if (dbField === 'images' || dbField === 'files') {
          // Преобразуем массив в JSON для PostgreSQL
          // Если null, устанавливаем пустой массив
          const jsonValue = updates[clientField] === null ? [] : updates[clientField];
          try {
            const jsonString = JSON.stringify(jsonValue);
            // Проверяем размер данных (PostgreSQL JSONB имеет ограничения)
            if (jsonString.length > 100 * 1024 * 1024) { // 100MB
              return res.status(400).json({ 
                error: 'Data too large', 
                message: `${dbField} data exceeds 100MB limit` 
              });
            }
            updateFields.push(`${dbField} = $${paramIndex}`);
            values.push(jsonString);
          } catch (jsonError: any) {
            console.error(`Error stringifying ${dbField}:`, jsonError);
            return res.status(400).json({ 
              error: 'Invalid data format', 
              message: `Failed to serialize ${dbField}: ${jsonError.message}` 
            });
          }
        } else {
          updateFields.push(`${dbField} = $${paramIndex}`);
          values.push(updates[clientField]);
        }
        paramIndex++;
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(taskId);

    // Добавляем обновление updated_at
    updateFields.push(`updated_at = now()`);

    // Логируем запрос для отладки
    console.log('Update query:', `UPDATE tasks SET ${updateFields.join(', ')} WHERE id = $${paramIndex}`);
    console.log('Update values count:', values.length);
    console.log('Update fields:', updateFields);
    if (updates.images) {
      console.log('Images array length:', Array.isArray(updates.images) ? updates.images.length : 'not an array');
      if (Array.isArray(updates.images) && updates.images.length > 0) {
        console.log('First image size (approx):', updates.images[0].length, 'chars');
      }
    }

    try {
      const result = await pool.query(
        `UPDATE tasks SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        values
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Task not found after update' });
      }

      const updatedTask = result.rows[0];
      // Преобразуем JSON поля images и files обратно в массивы
      if (updatedTask.images && typeof updatedTask.images === 'string') {
        try {
          updatedTask.images = JSON.parse(updatedTask.images);
        } catch (e) {
          console.error('Error parsing images JSON:', e);
          updatedTask.images = [];
        }
      } else if (!updatedTask.images) {
        updatedTask.images = [];
      }
      if (updatedTask.files && typeof updatedTask.files === 'string') {
        try {
          updatedTask.files = JSON.parse(updatedTask.files);
        } catch (e) {
          console.error('Error parsing files JSON:', e);
          updatedTask.files = [];
        }
      } else if (!updatedTask.files) {
        updatedTask.files = [];
      }
      broadcastTaskUpdate(projectId, 'UPDATE', updatedTask);
      res.json(updatedTask);
    } catch (queryError: any) {
      console.error('SQL Query error:', queryError);
      console.error('SQL Query:', `UPDATE tasks SET ${updateFields.join(', ')} WHERE id = $${paramIndex}`);
      console.error('SQL Values:', values.map((v, i) => {
        if (typeof v === 'string' && v.length > 100) {
          return `Value ${i}: [string length ${v.length}]`;
        }
        return `Value ${i}: ${JSON.stringify(v).substring(0, 100)}`;
      }));
      throw queryError; // Пробрасываем ошибку дальше
    }
  } catch (error: any) {
    console.error('Update task error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error code:', error.code);
    console.error('Error detail:', error.detail);
    console.error('Error message:', error.message);
    console.error('Error hint:', error.hint);
    
    // Более детальная информация об ошибке для отладки
    const errorMessage = error.message || 'Internal server error';
    const errorDetails = process.env.NODE_ENV === 'development' ? error.stack : undefined;
    
    // Если это ошибка PostgreSQL, включаем детали
    const pgError = error.code ? {
      code: error.code,
      detail: error.detail || error.message || null,
      hint: error.hint || null,
      where: error.where || null
    } : null;
    
    // Проверяем, является ли это ошибкой отсутствующего столбца
    let userMessage = errorMessage;
    let needsMigration = false;
    let migrationFile = '';
    
    // Проверяем ошибку отсутствующего столбца (код 42703)
    if (error.code === '42703' || (error.detail && error.detail.includes('column')) || (errorMessage && errorMessage.includes('column'))) {
      needsMigration = true;
      const detailText = error.detail || errorMessage || '';
      
      // Проверяем, какое именно поле отсутствует
      if (detailText.includes('"images"') || detailText.includes("'images'") || detailText.toLowerCase().includes('images')) {
        userMessage = 'Поле images не найдено в базе данных. Примените миграцию add_images_to_tasks.sql';
        migrationFile = 'add_images_to_tasks.sql';
      } else if (detailText.includes('"files"') || detailText.includes("'files'") || detailText.toLowerCase().includes('files')) {
        userMessage = 'Поле files не найдено в базе данных. Примените миграцию add_files_to_tasks.sql';
        migrationFile = 'add_files_to_tasks.sql';
      } else {
        userMessage = `Отсутствует поле в базе данных: ${detailText || errorMessage}`;
        // Пытаемся определить поле из сообщения об ошибке
        if (detailText.includes('column')) {
          const match = detailText.match(/column\s+["']?(\w+)["']?/i);
          if (match && match[1]) {
            if (match[1].toLowerCase() === 'images') {
              migrationFile = 'add_images_to_tasks.sql';
            } else if (match[1].toLowerCase() === 'files') {
              migrationFile = 'add_files_to_tasks.sql';
            }
          }
        }
      }
    }
    
    res.status(500).json({ 
      error: 'Internal server error',
      message: userMessage,
      needsMigration,
      migrationFile,
      ...(errorDetails && { details: errorDetails }),
      ...(pgError && { pgError }),
      ...(process.env.NODE_ENV === 'development' && { 
        originalError: errorMessage,
        stack: error.stack 
      })
    });
  }
});

// Удалить задачу
router.delete('/tasks/:taskId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { taskId } = req.params;
    const userId = req.user!.id;

    // Получение задачи для проверки проекта
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

    await pool.query('DELETE FROM tasks WHERE id = $1', [taskId]);

    broadcastTaskUpdate(projectId, 'DELETE', { id: taskId });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
