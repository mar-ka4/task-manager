'use client';

import { useState, useEffect, useRef } from 'react';
import { Profile } from '@/lib/types';
import { getProfile, updateProfile } from '@/lib/api/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { X, Upload, Trash2 } from 'lucide-react';

interface ProfileEditorDialogProps {
  userId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProfileUpdate?: (profile: Profile) => void;
}

const AVATAR_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#6b7280', // gray
];

export function ProfileEditorDialog({
  userId,
  open,
  onOpenChange,
  onProfileUpdate,
}: ProfileEditorDialogProps) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [avatarColor, setAvatarColor] = useState('#ef4444');
  const [avatarImage, setAvatarImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && userId) {
      loadProfile();
    }
  }, [open, userId]);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const data = await getProfile(userId);
      setProfile(data);
      setDisplayName(data.display_name || '');
      setAvatarColor(data.avatar_color || '#ef4444');
      setAvatarImage(data.avatar_image || null);
    } catch (error: any) {
      toast.error(error.message || 'Ошибка загрузки профиля');
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Проверка типа файла
    if (!file.type.startsWith('image/')) {
      toast.error('Выберите изображение');
      return;
    }

    // Проверка размера (макс 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Размер изображения не должен превышать 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setAvatarImage(base64);
    };
    reader.onerror = () => {
      toast.error('Ошибка чтения файла');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setAvatarImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    if (!displayName.trim()) {
      toast.error('Введите имя');
      return;
    }

    setSaving(true);
    try {
      const updated = await updateProfile(userId, {
        displayName: displayName.trim(),
        avatarColor,
        avatarImage,
      });
      toast.success('Профиль обновлен');
      onProfileUpdate?.(updated);
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Ошибка обновления профиля');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Редактировать профиль</DialogTitle>
          <DialogDescription>
            Измените имя, аватар и цвет профиля
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-primary" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Имя */}
            <div>
              <label className="block text-sm font-medium mb-1.5 text-white/70">
                Имя
              </label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Ваше имя"
                maxLength={50}
              />
            </div>

            {/* Аватар */}
            <div>
              <label className="block text-sm font-medium mb-1.5 text-white/70">
                Аватар
              </label>
              <div className="flex items-center gap-4">
                {/* Предпросмотр аватара */}
                <div className="relative">
                  <div
                    className="h-20 w-20 rounded-full flex items-center justify-center text-2xl font-bold text-foreground overflow-hidden ring-2 ring-border"
                    style={{ backgroundColor: avatarColor }}
                  >
                    {avatarImage ? (
                      <img
                        src={avatarImage}
                        alt="Avatar"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span>{displayName[0]?.toUpperCase() || '?'}</span>
                    )}
                  </div>
                </div>

                {/* Кнопки управления */}
                <div className="flex flex-col gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    Загрузить
                  </Button>
                  {avatarImage && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleRemoveImage}
                      className="flex items-center gap-2 text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="h-4 w-4" />
                      Удалить
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Цвет аватара */}
            <div>
              <label className="block text-sm font-medium mb-1.5 text-white/70">
                Цвет аватара
              </label>
              <div className="flex flex-wrap gap-2">
                {AVATAR_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setAvatarColor(color)}
                    className={`h-10 w-10 rounded-lg transition-all hover:scale-110 ${
                      avatarColor === color
                        ? 'ring-2 ring-white/50 ring-offset-2 ring-offset-zinc-900'
                        : ''
                    }`}
                    style={{ backgroundColor: color }}
                    aria-label={`Выбрать цвет ${color}`}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button onClick={handleSave} disabled={loading || saving}>
            {saving ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
