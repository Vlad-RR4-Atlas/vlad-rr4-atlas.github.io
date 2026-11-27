// Загрузка картинок поста в data/photos/ и обновление записи точки.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const MAX_BYTES = 3 * 1024 * 1024;
export const LOCAL_PHOTO = /^data\/photos\/[\w.-]+\.(?:jpg|png|webp)$/;

/** Скачивает одну картинку. Возвращает путь вида data/photos/имя.jpg или null, если скачать не вышло. */
export async function downloadPhoto(url, dir, baseName) {
  try {
    const res = await fetch(url, { headers: { 'user-agent': 'vlad-rr4-atlas/1.0 (+personal non-commercial reference)' } });
    const ext = TYPES[(res.headers.get('content-type') ?? '').split(';')[0].trim()];
    if (!res.ok || !ext) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    if (!bytes.length || bytes.length > MAX_BYTES) return null;
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, `${baseName}.${ext}`), bytes);
    return `data/photos/${baseName}.${ext}`;
  } catch {
    return null;
  }
}

/** Обновляет запись по свежим данным поста: текст, дата, локальные пути картинок. */
export function applyPost(spot, post, savedPaths) {
  const keep = (spot.photos ?? []).filter((p) => LOCAL_PHOTO.test(p));
  const photos = [...new Set([...keep, ...savedPaths])].slice(0, 6);
  return { ...spot, postText: post.text || spot.postText || null, postDate: post.date || spot.postDate || null, photos };
}

/** Записи, которым нужна дозагрузка: нет текста поста или есть картинки, которые не лежат у нас. */
export function needsEnrich(spot) {
  if (!spot.post) return false;
  const photos = spot.photos ?? [];
  return !spot.postText || photos.length === 0 || photos.some((p) => !LOCAL_PHOTO.test(p));
}
