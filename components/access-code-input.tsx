'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { joinByCode } from '@/lib/api/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { X } from 'lucide-react';

interface AccessCodeInputProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AccessCodeInput({ open, onOpenChange }: AccessCodeInputProps) {
  const router = useRouter();
  const [code, setCode] = useState<string[]>(Array(8).fill(''));
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (open) {
      setCode(Array(8).fill(''));
      inputRefs.current[0]?.focus();
    }
  }, [open]);

  const handleChange = (index: number, value: string) => {
    // Разрешаем только буквы и цифры
    const sanitized = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    
    if (sanitized.length > 1) {
      // Вставка из буфера обмена
      const chars = sanitized.slice(0, 8).split('');
      const newCode = [...code];
      chars.forEach((char, i) => {
        if (index + i < 8) {
          newCode[index + i] = char;
        }
      });
      setCode(newCode);
      
      // Фокус на последнее заполненное поле
      const nextIndex = Math.min(index + chars.length, 7);
      inputRefs.current[nextIndex]?.focus();
    } else {
      const newCode = [...code];
      newCode[index] = sanitized;
      setCode(newCode);
      
      // Автопереход к следующему полю
      if (sanitized && index < 7) {
        inputRefs.current[index + 1]?.focus();
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 7) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 8);
    const chars = pasted.split('');
    const newCode = [...code];
    chars.forEach((char, i) => {
      if (i < 8) {
        newCode[i] = char;
      }
    });
    setCode(newCode);
    
    // Фокус на последнее заполненное поле
    const nextIndex = Math.min(chars.length, 7);
    inputRefs.current[nextIndex]?.focus();
  };

  const handleSubmit = async () => {
    const fullCode = code.join('');
    if (fullCode.length !== 8) {
      toast.error('Код доступа должен содержать 8 символов');
      return;
    }

    setLoading(true);
    try {
      const result = await joinByCode(fullCode);
      toast.success(`Вы присоединились к проекту "${result.projectName}"`);
      onOpenChange(false);
      router.push(`/board/${result.projectId}`);
    } catch (error: any) {
      toast.error(error.message || 'Неверный код доступа');
      setCode(Array(8).fill(''));
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const fullCode = code.join('');
  const isComplete = fullCode.length === 8;

  useEffect(() => {
    if (isComplete && !loading) {
      handleSubmit();
    }
  }, [isComplete]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/[0.12] bg-zinc-900/98 backdrop-blur-2xl sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-white">
            Введите код доступа
          </DialogTitle>
          <DialogDescription className="text-sm text-white/60">
            Введите 8-значный код доступа для присоединения к проекту
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-0.5 w-full">
            {code.map((char, index) => (
              <Input
                key={index}
                ref={(el) => {
                  inputRefs.current[index] = el;
                }}
                type="text"
                maxLength={1}
                value={char}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={handlePaste}
                className="h-12 w-9 text-center text-lg font-bold tracking-wider border-white/[0.12] bg-white/[0.05] text-white focus:border-white/[0.2] focus:ring-white/10 focus:bg-white/[0.08] flex-shrink-0"
                autoFocus={index === 0}
              />
            ))}
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Отмена
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!isComplete || loading}
              className="flex-1 bg-gradient-to-r from-blue-500 to-cyan-500"
            >
              {loading ? 'Присоединение...' : 'Присоединиться'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
