'use client';

import { useState, useEffect } from 'react';
import { ProjectMember } from '@/lib/types';
import { removeMember } from '@/lib/api/client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Users, X, Link as LinkIcon } from 'lucide-react';
import { toast } from 'sonner';

interface OnlineUsersDropdownProps {
  projectId: string;
  members: ProjectMember[];
  currentUserId: string;
  isOwner: boolean;
  onMemberRemoved?: () => void;
}

export function OnlineUsersDropdown({
  projectId,
  members,
  currentUserId,
  isOwner,
  onMemberRemoved,
}: OnlineUsersDropdownProps) {
  const [open, setOpen] = useState(false);

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!confirm(`Удалить участника "${memberName}" из проекта?`)) {
      return;
    }

    try {
      await removeMember(projectId, memberId);
      toast.success('Участник удален');
      onMemberRemoved?.();
    } catch (error: any) {
      toast.error(error.message || 'Ошибка удаления участника');
    }
  };

  const handleCopyInviteLink = async () => {
    // TODO: Реализовать генерацию пригласительной ссылки
    toast.info('Функция пригласительных ссылок будет реализована позже');
  };

  // Показываем до 3 аватаров в кнопке
  const visibleMembers = members.slice(0, 3);
  const remainingCount = Math.max(0, members.length - 3);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button className="flex items-center gap-2 rounded-xl border border-border bg-muted/50 px-3 py-1.5">
          {members.length > 0 && (
            <>
              <div className="flex -space-x-2">
                {visibleMembers.map((member) => (
                  <div
                    key={member.user_id || member.id}
                    className="relative h-6 w-6 rounded-full ring-2 ring-background overflow-hidden"
                    style={{ backgroundColor: member.avatar_color || '#6b7280' }}
                  >
                    {member.avatar_image ? (
                      <img
                        src={member.avatar_image}
                        alt={member.display_name || 'Avatar'}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-foreground">
                        {member.display_name?.[0]?.toUpperCase() || '?'}
                      </div>
                    )}
                    {/* Индикатор онлайн (пока всегда показываем, можно добавить реальную проверку) */}
                    <div className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-slate-900 bg-green-500" />
                  </div>
                ))}
              </div>
              {remainingCount > 0 && (
                <span className="text-xs text-muted-foreground">+{remainingCount}</span>
              )}
            </>
          )}
          <Users className="h-4 w-4 text-muted-foreground" />
          {members.length > 0 && (
            <span className="text-xs text-muted-foreground">({members.length})</span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64 border-white/10 bg-slate-900/95 backdrop-blur-xl">
        <div className="px-2 py-2">
          <p className="text-xs font-semibold text-white/60">Участники проекта</p>
        </div>
        <DropdownMenuSeparator className="bg-border" />
        <div className="max-h-64 overflow-y-auto">
          {members.length === 0 ? (
            <div className="px-3 py-4 text-center text-sm text-muted-foreground">
              Нет участников
            </div>
          ) : (
            members.map((member) => {
              const isCurrentUser = member.user_id === currentUserId;
              const isOnline = true; // TODO: Реализовать проверку онлайн-статуса

              return (
                <DropdownMenuItem
                  key={member.user_id || member.id}
                  className="flex items-center gap-3 px-3 py-2"
                >
                <div className="relative">
                  <div
                    className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold text-foreground overflow-hidden"
                    style={{ backgroundColor: member.avatar_color || '#6b7280' }}
                  >
                    {member.avatar_image ? (
                      <img
                        src={member.avatar_image}
                        alt={member.display_name || 'Avatar'}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span>{member.display_name?.[0]?.toUpperCase() || '?'}</span>
                    )}
                  </div>
                  {isOnline && (
                    <div className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-slate-900 bg-green-500" />
                  )}
                </div>
                <div className="flex-1">
                  <p className={isOnline ? 'text-foreground' : 'text-muted-foreground'}>
                    {member.display_name || 'Без имени'}
                    {isCurrentUser && ' (Вы)'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {member.role === 'owner'
                      ? 'Владелец'
                      : member.role === 'editor'
                      ? 'Редактор'
                      : 'Наблюдатель'}
                  </p>
                </div>
                {isOwner && !isCurrentUser && member.role !== 'owner' && member.id && !member.id.startsWith('owner-') && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveMember(member.id, member.display_name || 'Участник');
                    }}
                    className="rounded-lg p-1 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </DropdownMenuItem>
              );
            })
          )}
        </div>
        {isOwner && (
          <>
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem
              onClick={handleCopyInviteLink}
              className="flex items-center gap-2"
            >
              <LinkIcon className="h-4 w-4" />
              Пригласить редактора
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
