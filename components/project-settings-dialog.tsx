'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Project } from '@/lib/types';
import { updateProject, deleteProject, generateAccessCode, deleteAccessCode } from '@/lib/api/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Globe, Lock, Trash2, Copy, Check } from 'lucide-react';

interface ProjectSettingsDialogProps {
  project: Project | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProjectUpdate?: (project: Project) => void;
}

export function ProjectSettingsDialog({ project, open, onOpenChange, onProjectUpdate }: ProjectSettingsDialogProps) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [accessCode, setAccessCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [deletingCode, setDeletingCode] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  useEffect(() => {
    if (project) {
      setName(project.name);
      setIsPublic(project.is_public);
      setAccessCode(project.access_code);
    }
  }, [project]);

  const handleSave = async () => {
    if (!project) return;

    setLoading(true);
    try {
      const updated = await updateProject(project.id, { name, isPublic });
      toast.success('Настройки проекта обновлены');
      onProjectUpdate?.(updated);
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Ошибка обновления проекта');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateCode = async () => {
    if (!project) return;

    setGeneratingCode(true);
    try {
      const result = await generateAccessCode(project.id);
      setAccessCode(result.accessCode);
      toast.success('Код доступа сгенерирован');
      if (onProjectUpdate && project) {
        onProjectUpdate({ ...project, access_code: result.accessCode });
      }
    } catch (error: any) {
      toast.error(error.message || 'Ошибка генерации кода');
    } finally {
      setGeneratingCode(false);
    }
  };

  const handleDeleteCode = async () => {
    if (!project) return;

    setDeletingCode(true);
    try {
      await deleteAccessCode(project.id);
      setAccessCode(null);
      toast.success('Код доступа удален');
      if (onProjectUpdate && project) {
        onProjectUpdate({ ...project, access_code: null });
      }
    } catch (error: any) {
      toast.error(error.message || 'Ошибка удаления кода');
    } finally {
      setDeletingCode(false);
    }
  };

  const handleCopyCode = async () => {
    if (!accessCode) return;

    try {
      await navigator.clipboard.writeText(accessCode);
      setCodeCopied(true);
      toast.success('Код скопирован в буфер обмена');
      setTimeout(() => setCodeCopied(false), 2000);
    } catch (error) {
      toast.error('Ошибка копирования кода');
    }
  };

  const handleDelete = async () => {
    if (!project) return;

    if (!confirm('Вы уверены, что хотите удалить проект? Это действие нельзя отменить.')) {
      return;
    }

    setLoading(true);
    try {
      await deleteProject(project.id);
      toast.success('Проект удален');
      onOpenChange(false);
      router.push('/projects');
    } catch (error: any) {
      toast.error(error.message || 'Ошибка удаления проекта');
    } finally {
      setLoading(false);
    }
  };

  const isOwner = project?.role === 'owner';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/[0.12] bg-zinc-900/98 backdrop-blur-2xl sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Настройки проекта</DialogTitle>
          <DialogDescription>
            Измените название проекта и настройки видимости
          </DialogDescription>
        </DialogHeader>

        {project ? (
          <div className="space-y-4">
          {/* Название проекта */}
          <div>
            <label className="block text-sm font-medium mb-1.5 text-white/70">
              Название проекта
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Название проекта"
              disabled={!isOwner}
              className="bg-white/[0.05] border-white/[0.12] text-white"
            />
          </div>

          {/* Публичность проекта */}
          <div className="flex items-center justify-between rounded-xl border border-white/[0.12] bg-white/[0.04] p-4">
            <div className="flex items-center gap-3">
              {isPublic ? (
                <Globe className="h-5 w-5 text-emerald-400" />
              ) : (
                <Lock className="h-5 w-5 text-amber-400" />
              )}
              <div>
                <p className="text-sm font-medium text-white">
                  {isPublic ? 'Публичный проект' : 'Приватный проект'}
                </p>
                <p className="text-xs text-white/60">
                  {isPublic
                    ? 'Проект виден всем пользователям'
                    : 'Проект виден только участникам'}
                </p>
              </div>
            </div>
            <Switch
              checked={isPublic}
              onCheckedChange={setIsPublic}
              disabled={!isOwner}
            />
          </div>

          {/* Код доступа */}
          {isPublic && isOwner && (
            <div className="rounded-xl border border-blue-500/[0.25] bg-blue-500/[0.08] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-white">Код доступа</p>
                {accessCode ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDeleteCode}
                    disabled={deletingCode}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    {deletingCode ? 'Удаление...' : 'Удалить'}
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleGenerateCode}
                    disabled={generatingCode}
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
                    {generatingCode ? 'Генерация...' : 'Сгенерировать'}
                  </Button>
                )}
              </div>

              {accessCode ? (
                <div className="space-y-2">
                  <div className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-blue-500/30 bg-blue-500/[0.15] p-3.5">
                    {accessCode.split('').map((char, index) => (
                      <span
                        key={index}
                        className="text-xl font-bold tracking-wider text-white"
                      >
                        {char}
                      </span>
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyCode}
                    className="w-full"
                  >
                    {codeCopied ? (
                      <>
                        <Check className="h-3.5 w-3.5 mr-2" />
                        Скопировано
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5 mr-2" />
                        Копировать код
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-white/50 text-center">
                    Поделитесь этим кодом, чтобы пригласить других пользователей в проект
                  </p>
                </div>
              ) : (
                <p className="text-xs text-white/50 text-center">
                  Сгенерируйте код доступа, чтобы другие пользователи могли присоединиться к проекту
                </p>
              )}
            </div>
          )}

          {/* Опасная зона */}
          {isOwner && (
            <div className="rounded-xl border border-red-500/[0.25] bg-red-500/[0.08] p-4">
              <p className="text-sm font-medium text-red-400 mb-2">Опасная зона</p>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={loading}
                className="w-full"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Удалить проект
              </Button>
            </div>
          )}
          </div>
        ) : (
          <div className="py-8 text-center text-white/60">
            Загрузка настроек проекта...
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          {isOwner && project && (
            <Button onClick={handleSave} disabled={loading}>
              {loading ? 'Сохранение...' : 'Сохранить'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
