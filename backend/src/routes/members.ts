import express from 'express';
import pool from '../db/connection';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { checkProjectAccess, canDelete } from '../utils/access';

const router = express.Router();

// Получить участников проекта
router.get(
  '/projects/:projectId/members',
  authenticateToken,
  async (req: AuthRequest, res) => {
    try {
      const projectId = Array.isArray(req.params.projectId)
        ? req.params.projectId[0]
        : req.params.projectId;
      const userId = req.user!.id;

      const role = await checkProjectAccess(projectId, userId);

      if (!role) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Получаем участников проекта из project_members
      const membersResult = await pool.query(
        `SELECT pm.*, p.display_name, p.avatar_color, p.avatar_image
         FROM project_members pm
         JOIN profiles p ON pm.user_id = p.id
         WHERE pm.project_id = $1
         ORDER BY pm.joined_at`,
        [projectId]
      );

      // Если владелец не в project_members, добавляем его
      const projectResult = await pool.query(
        'SELECT owner_id, created_at FROM projects WHERE id = $1',
        [projectId]
      );

      if (projectResult.rows.length > 0) {
        const ownerId = projectResult.rows[0].owner_id;
        const ownerExists = membersResult.rows.some((m: any) => m.user_id === ownerId);

        if (!ownerExists) {
          const ownerProfile = await pool.query(
            'SELECT display_name, avatar_color, avatar_image FROM profiles WHERE id = $1',
            [ownerId]
          );

          if (ownerProfile.rows.length > 0) {
            const owner = ownerProfile.rows[0];
            membersResult.rows.unshift({
              id: `owner-${ownerId}`, // Генерируем временный ID для владельца
              project_id: projectId,
              user_id: ownerId,
              role: 'owner',
              joined_at: projectResult.rows[0].created_at,
              display_name: owner.display_name,
              avatar_color: owner.avatar_color,
              avatar_image: owner.avatar_image,
            });
          }
        }
      }

      const result = membersResult;

      res.json(result.rows);
    } catch (error) {
      console.error('Get members error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Удалить участника
router.delete(
  '/projects/:projectId/members/:memberId',
  authenticateToken,
  async (req: AuthRequest, res) => {
    try {
      const projectId = Array.isArray(req.params.projectId)
        ? req.params.projectId[0]
        : req.params.projectId;
      const memberId = Array.isArray(req.params.memberId)
        ? req.params.memberId[0]
        : req.params.memberId;
      const userId = req.user!.id;

      const role = await checkProjectAccess(projectId, userId);

      if (!canDelete(role)) {
        return res.status(403).json({ error: 'Only owner can remove members' });
      }

      // Нельзя удалить владельца
      const memberResult = await pool.query(
        'SELECT role FROM project_members WHERE id = $1',
        [memberId]
      );

      if (memberResult.rows.length === 0) {
        return res.status(404).json({ error: 'Member not found' });
      }

      if (memberResult.rows[0].role === 'owner') {
        return res.status(400).json({ error: 'Cannot remove owner' });
      }

      await pool.query('DELETE FROM project_members WHERE id = $1', [memberId]);

      res.json({ success: true });
    } catch (error) {
      console.error('Remove member error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;
