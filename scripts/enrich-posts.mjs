// Дозагружает для точек из Telegram полный текст поста и картинки: скачивает их в data/photos/,
// чтобы сайт не зависел от временных адресов CDN Telegram. Запускается после fetch-telegram.
//   node scripts/enrich-posts.mjs
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { DATA_DIR, ROOT, writeJson } from './lib/data-io.mjs';
import { applyPost, downloadPhoto, needsEnrich } from './lib/photos.mjs';
import { parseChannelHtml } from './lib/tg.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const read = async (name) => JSON.parse(await readFile(path.join(DATA_DIR, `${name}.json`), 'utf8').catch(() => '[]'));
const photosDir = path.join(DATA_DIR, 'photos');

async function loadPost(url) {
  const m = /^https:\/\/t\.me\/([^/]+)\/(\d+)$/.exec(url);
  if (!m) return null;
  const [, channel, id] = m;
  const res = await fetch(`https://t.me/s/${encodeURIComponent(channel)}?before=${Number(id) + 1}`, {
    headers: { 'user-agent': 'vlad-rr4-atlas/1.0 (+personal non-commercial reference)' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return { channel, id: Number(id), post: parseChannelHtml(await res.text()).find((p) => p.id === Number(id)) ?? null };
}

async function enrich(list, label) {
  let changed = 0;
  const out = [];
  for (const spot of list) {
    if (!needsEnrich(spot)) { out.push(spot); continue; }
    try {
      const { channel, id, post } = (await loadPost(spot.post)) ?? {};
      if (!post) { console.log(`${label} ${spot.id}: пост не найден`); out.push(spot); continue; }
      const saved = [];
      const have = (spot.photos ?? []).filter((p) => p.startsWith('data/')).length;
      if (have === 0 || (spot.photos ?? []).some((p) => !p.startsWith('data/'))) {
        for (const [i, url] of post.photos.slice(0, 6).entries()) {
          const file = await downloadPhoto(url, photosDir, `${channel}-${id}-${i + 1}`);
          if (file) saved.push(file);
          await sleep(300);
        }
      }
      out.push(applyPost(spot, post, saved));
      changed++;
      console.log(`${label} ${spot.id}: текст ${post.text.length} симв., картинок сохранено ${saved.length} из ${post.photos.length}`);
    } catch (error) {
      console.log(`${label} ${spot.id}: ошибка (${error.message})`);
      out.push(spot);
    }
    await sleep(800);
  }
  return { out, changed };
}

const spots = await enrich(await read('spots'), 'точка');
const inbox = await enrich(await read('inbox'), 'очередь');
if (spots.changed) await writeJson('spots', spots.out);
if (inbox.changed) await writeJson('inbox', inbox.out);
console.log(`Обновлено записей: точки ${spots.changed}, очередь ${inbox.changed}. Папка: ${path.relative(ROOT, photosDir)}`);
