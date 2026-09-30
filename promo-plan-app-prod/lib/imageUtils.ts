const MAX_SOURCE_BYTES = 8 * 1024 * 1024; // 8МБ — исходный файл крупнее отклоняем сразу
const MAX_DIMENSION = 1200;
const JPEG_QUALITY = 0.8;

export class ImageTooLargeError extends Error {}

/** Сжимает изображение и возвращает data URL, пригодный для хранения в localStorage */
export function fileToCompressedDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    return Promise.reject(new Error("Файл не является изображением"));
  }
  if (file.size > MAX_SOURCE_BYTES) {
    return Promise.reject(new ImageTooLargeError("Файл слишком большой (максимум 8МБ)"));
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Не удалось прочитать файл"));
    reader.onload = () => {
      const img = new window.Image();
      img.onerror = () => reject(new Error("Не удалось загрузить изображение"));
      img.onload = () => {
        let { width, height } = img;
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          const scale = MAX_DIMENSION / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas недоступен"));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
