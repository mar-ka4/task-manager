'use client';

import { Project } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Globe, Lock, Users, Settings } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface ProjectsGridProps {
  projects: Project[];
  onCreateProject: () => void;
}

export function ProjectsGrid({ projects, onCreateProject }: ProjectsGridProps) {
  const router = useRouter();

  const handleSettingsClick = (e: React.MouseEvent, projectId: string) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/board/${projectId}?settings=true`);
  };

  return (
    <div className="space-y-6">
      {projects.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">У вас пока нет проектов</p>
          <Button onClick={onCreateProject} variant="outline">
            Создать первый проект
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/board/${project.id}`}
              className="glass-card rounded-2xl border border-border p-6 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200"
            >
              <div className="flex items-start justify-between mb-4">
                <h2 className="text-xl font-semibold text-foreground">{project.name}</h2>
                {project.role === 'owner' && (
                  <button
                    onClick={(e) => handleSettingsClick(e, project.id)}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Настройки проекта"
                  >
                    <Settings className="h-4 w-4" />
                  </button>
                )}
              </div>
              
              <div className="flex items-center gap-2 flex-wrap">
                {project.is_public ? (
                  <Badge variant="success" className="flex items-center gap-1.5">
                    <Globe className="h-3 w-3" />
                    Публичный
                  </Badge>
                ) : (
                  <Badge variant="warning" className="flex items-center gap-1.5">
                    <Lock className="h-3 w-3" />
                    Приватный
                  </Badge>
                )}
                
                {project.role && (
                  <Badge variant="info">
                    {project.role === 'owner' ? 'Владелец' : 
                     project.role === 'editor' ? 'Редактор' : 'Наблюдатель'}
                  </Badge>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
