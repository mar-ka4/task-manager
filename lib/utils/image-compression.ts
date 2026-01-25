/**
 * Сжимает изображение с максимальным качеством
 * @param file - Файл изображения
 * @param maxWidth - Максимальная ширина (по умолчанию 800px)
 * @param maxHeight - Максимальная высота (по умолчанию 800px)
 * @param quality - Качество JPEG (0-1, по умолчанию 0.92)
 * @returns Promise с base64 строкой сжатого изображения
 */
export async function compressImage(
  file: File,
  maxWidth: number = 800,
  maxHeight: number = 800,
  quality: number = 0.92
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        // Вычисляем новые размеры с сохранением пропорций
        let width = img.width;
        let height = img.height;
        
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = width * ratio;
          height = height * ratio;
        }
        
        // Создаем canvas для сжатия
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Не удалось получить контекст canvas'));
          return;
        }
        
        // Используем высокое качество рендеринга
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        // Рисуем изображение на canvas
        ctx.drawImage(img, 0, 0, width, height);
        
        // Конвертируем в base64 с указанным качеством
        const mimeType = file.type || 'image/jpeg';
        const base64 = canvas.toDataURL(mimeType, quality);
        
        resolve(base64);
      };
      
      img.onerror = () => {
        reject(new Error('Ошибка загрузки изображения'));
      };
      
      img.src = e.target?.result as string;
    };
    
    reader.onerror = () => {
      reject(new Error('Ошибка чтения файла'));
    };
    
    reader.readAsDataURL(file);
  });
}

/**
 * Получает изображение из буфера обмена
 * @param clipboardData - Данные из события clipboard
 * @returns Promise с File или null
 */
export async function getImageFromClipboard(
  clipboardData: DataTransfer
): Promise<File | null> {
  const items = clipboardData.items;
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    
    // Проверяем, является ли элемент изображением
    if (item.type.indexOf('image') !== -1) {
      const file = item.getAsFile();
      if (file) {
        return file;
      }
    }
  }
  
  return null;
}
