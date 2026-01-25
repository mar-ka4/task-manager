'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getProjects, createProject } from '@/lib/api/client';
import { Project } from '@/lib/types';
import { ProjectsGrid } from '@/components/projects-grid';
import { AccessCodeInput } from '@/components/access-code-input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Key } from 'lucide-react';
import { UserProfileMenu } from '@/components/user-profile-menu';

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAccessCodeModal, setShowAccessCodeModal] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [creating, setCreating] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      setCurrentUserId(user.id || null);
    }
    loadProjects();
  }, []);

  // Разделяем проекты на категории
  const myProjects = projects.filter((p) => {
    // Проект считается "моим", если я владелец
    return p.role === 'owner' || (currentUserId && p.owner_id === currentUserId);
  });
  
  const sharedProjects = projects.filter((p) => {
    // Проект считается "общим", если я участник (editor/viewer), но не владелец
    return (p.role === 'editor' || p.role === 'viewer') && 
           currentUserId && 
           p.owner_id !== currentUserId;
  });

  const loadProjects = async () => {
    try {
      const data = await getProjects();
      setProjects(data);
    } catch (error: any) {
      if (error.message.includes('401') || error.message.includes('403')) {
        router.push('/auth/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) return;

    setCreating(true);
    try {
      const newProject = await createProject(projectName, isPublic);
      setProjects([newProject, ...projects]);
      setShowCreateModal(false);
      setProjectName('');
      setIsPublic(false);
      toast.success('Проект создан!');
      router.push(`/board/${newProject.id}`);
    } catch (error: any) {
      toast.error(error.message || 'Ошибка создания проекта');
    } finally {
      setCreating(false);
    }
  };

  const handleJoinByCode = () => {
    setShowAccessCodeModal(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-white">Проекты</h1>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={handleJoinByCode}
              className="flex items-center gap-2"
            >
              <Key className="h-4 w-4" />
              Присоединиться по коду
            </Button>
            <Button
              onClick={() => setShowCreateModal(true)}
              className="bg-gradient-to-r from-blue-500 to-cyan-500"
            >
              + Создать проект
            </Button>
            <UserProfileMenu />
          </div>
        </div>

        {/* Мои проекты */}
        {myProjects.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">Мои проекты</h2>
            <ProjectsGrid
              projects={myProjects}
              onCreateProject={() => setShowCreateModal(true)}
            />
          </div>
        )}

        {/* Проекты, где я участник */}
        {sharedProjects.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">Проекты, где я участник</h2>
            <ProjectsGrid
              projects={sharedProjects}
              onCreateProject={() => setShowCreateModal(true)}
            />
          </div>
        )}

        {/* Если нет проектов вообще */}
        {myProjects.length === 0 && sharedProjects.length === 0 && (
          <ProjectsGrid
            projects={[]}
            onCreateProject={() => setShowCreateModal(true)}
          />
        )}

        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogContent className="sm:max-w-[440px]">
            <DialogHeader>
              <DialogTitle>Создать проект</DialogTitle>
              <DialogDescription>
                Создайте новый проект для управления задачами
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-white/70">
                  Название проекта
                </label>
                <Input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  required
                  autoFocus
                  placeholder="Мой проект"
                />
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  id="public"
                  checked={isPublic}
                  onCheckedChange={setIsPublic}
                />
                <label htmlFor="public" className="text-sm text-white/70 cursor-pointer">
                  Публичный проект
                </label>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setShowCreateModal(false);
                    setProjectName('');
                    setIsPublic(false);
                  }}
                >
                  Отмена
                </Button>
                <Button type="submit" disabled={creating}>
                  {creating ? 'Создание...' : 'Создать'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <AccessCodeInput
          open={showAccessCodeModal}
          onOpenChange={(open) => {
            setShowAccessCodeModal(open);
            if (!open) {
              loadProjects();
            }
          }}
        />
      </div>
    </div>
  );
}
