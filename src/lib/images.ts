/** Image intake shared by the upload tool, drag-and-drop, and cmd+v paste. */

const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const MAX_BYTES = 10 * 1024 * 1024;
const DEFAULT_WIDTH = 360; // canvas units an image spawns at

export interface LoadedImage {
  src: string;
  width: number;
  aspectRatio: number;
}

export async function loadImageFile(file: File): Promise<LoadedImage> {
  if (!ACCEPTED.includes(file.type)) {
    throw new Error(`Unsupported image type: ${file.type || 'unknown'}`);
  }
  if (file.size > MAX_BYTES) {
    throw new Error('Image is larger than 10MB');
  }
  const src = URL.createObjectURL(file);
  const { width, height } = await new Promise<{ width: number; height: number }>(
    (resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => reject(new Error('Could not read image'));
      img.src = src;
    },
  );
  const aspectRatio = width / height;
  return { src, width: Math.min(DEFAULT_WIDTH, width), aspectRatio };
}

export function imageFilesFrom(dt: DataTransfer | null): File[] {
  if (!dt) return [];
  return [...dt.files].filter((f) => ACCEPTED.includes(f.type));
}
