import express from 'express';
import pool from '../db/connection';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = express.Router();

// Получить профиль
router.get('/:userId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { userId } = req.params;

    const result = await pool.query(
      'SELECT id, display_name, avatar_color, avatar_image, created_at FROM profiles WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Обновить профиль
router.put('/:userId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user!.id;
    const { displayName, avatarColor, avatarImage } = req.body;

    // Проверка прав доступа
    if (userId !== currentUserId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updateFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (displayName !== undefined) {
      updateFields.push(`display_name = $${paramIndex}`);
      values.push(displayName);
      paramIndex++;
    }

    if (avatarColor !== undefined) {
      updateFields.push(`avatar_color = $${paramIndex}`);
      values.push(avatarColor);
      paramIndex++;
    }

    if (avatarImage !== undefined) {
      updateFields.push(`avatar_image = $${paramIndex}`);
      values.push(avatarImage);
      paramIndex++;
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(userId);

    const result = await pool.query(
      `UPDATE profiles SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
