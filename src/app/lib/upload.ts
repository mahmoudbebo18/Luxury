// Admin image uploads (activity covers, coupon images, service photos) to the public "media" bucket.
// Photos from a phone are several MB: they are resized and re-encoded as WebP in the browser first.
import { supabase } from '../../lib/supabase';

const MAX_SIDE = 1600;

async function compress(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.82));
  // Very old Safari can't encode WebP: keep the original if it is small enough for the bucket.
  if (!blob || blob.type !== 'image/webp') return file;
  return blob;
}

/** Uploads an image and returns its public URL. */
export async function uploadImage(file: File, folder: 'activities' | 'coupons' | 'services') {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('type');
  const blob = await compress(file);
  if (blob.size > 5 * 1024 * 1024) throw new Error('size');
  const ext = blob.type === 'image/webp' ? 'webp' : file.type.split('/')[1];
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('media').upload(path, blob, { contentType: blob.type, cacheControl: '31536000' });
  if (error) throw error;
  return supabase.storage.from('media').getPublicUrl(path).data.publicUrl;
}

/** Best-effort removal of an image that was replaced (only files in our bucket). */
export async function removeImage(url: string | null | undefined) {
  const marker = '/storage/v1/object/public/media/';
  if (!url || !url.includes(marker)) return;
  await supabase.storage.from('media').remove([url.split(marker)[1]]);
}
