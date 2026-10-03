/** Compresses a user photo to WebP on the device (SPEC §3.3). */
export async function compressToWebP(file: File, maxSize: number, maxSizeMB = 1): Promise<Blob> {
  const { default: imageCompression } = await import('browser-image-compression');
  return imageCompression(file, {
    maxWidthOrHeight: maxSize,
    maxSizeMB,
    fileType: 'image/webp',
    initialQuality: 0.85,
    useWebWorker: true,
  });
}

export const AVATAR_MAX_PX = 512;
export const POST_PHOTO_MAX_PX = 1600;
