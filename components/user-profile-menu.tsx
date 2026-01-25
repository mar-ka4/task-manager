'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser, logout } from '@/lib/api/client';
import { ProfileEditorDialog } from '@/components/profile-editor-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { User, Settings, LogOut, Edit } from 'lucide-react';
import { toast } from 'sonner';
import { Profile } from '@/lib/types';

interface UserProfileMenuProps {
  onProfileUpdate?: (profile: Profile) => void;
}

export function UserProfileMenu({ onProfileUpdate }: UserProfileMenuProps) {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const userData = typeof window !== 'undefined' 
        ? JSON.parse(localStorage.getItem('user') || '{}')
        : null;
      
      if (userData?.id) {
        setUser(userData);
        // Загружаем полный профиль
        const profileData = await getCurrentUser();
        setProfile({
          id: profileData.id,
          display_name: profileData.displayName,
          avatar_color: profileData.avatarColor || '#ef4444',
          avatar_image: profileData.avatarImage,
        });
      }
    } catch (error: any) {
      console.error('Error loading user:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Вы вышли из системы');
      router.push('/auth/login');
    } catch (error: any) {
      toast.error('Ошибка выхода');
    }
  };

  const handleProfileUpdate = (updatedProfile: Profile) => {
    setProfile(updatedProfile);
    // Обновляем данные в localStorage
    if (typeof window !== 'undefined') {
      const userData = JSON.parse(localStorage.getItem('user') || '{}');
      localStorage.setItem('user', JSON.stringify({
        ...userData,
        displayName: updatedProfile.display_name,
        avatarColor: updatedProfile.avatar_color,
        avatarImage: updatedProfile.avatar_image,
      }));
    }
    onProfileUpdate?.(updatedProfile);
    loadUser(); // Перезагружаем данные
  };

  if (loading) {
    return (
      <div className="h-8 w-8 rounded-full bg-white/10 animate-pulse" />
    );
  }

  if (!user || !profile) {
    return null;
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-full overflow-hidden ring-2 ring-white/20 hover:ring-white/40 transition-all"
            style={{ backgroundColor: profile.avatar_color }}
          >
            {profile.avatar_image ? (
              <img
                src={profile.avatar_image}
                alt={profile.display_name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm font-bold text-white">
                {profile.display_name[0]?.toUpperCase() || '?'}
              </div>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-64 border-white/10 bg-slate-900/95 backdrop-blur-xl">
          <div className="px-3 py-2">
            <div className="flex items-center gap-3">
              <div
                className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold text-white overflow-hidden ring-2 ring-white/20"
                style={{ backgroundColor: profile.avatar_color }}
              >
                {profile.avatar_image ? (
                  <img
                    src={profile.avatar_image}
                    alt={profile.display_name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span>{profile.display_name[0]?.toUpperCase() || '?'}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {profile.display_name}
                </p>
                <p className="text-xs text-white/60 truncate">
                  {user.email}
                </p>
              </div>
            </div>
          </div>
          <DropdownMenuSeparator className="bg-white/10" />
          <DropdownMenuItem
            onClick={() => setShowProfileDialog(true)}
            className="flex items-center gap-2"
          >
            <Edit className="h-4 w-4" />
            Редактировать профиль
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-white/10" />
          <DropdownMenuItem
            onClick={handleLogout}
            className="flex items-center gap-2 text-red-400 hover:text-red-300 focus:text-red-300"
          >
            <LogOut className="h-4 w-4" />
            Выйти
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ProfileEditorDialog
        userId={user.id}
        open={showProfileDialog}
        onOpenChange={setShowProfileDialog}
        onProfileUpdate={handleProfileUpdate}
      />
    </>
  );
}
