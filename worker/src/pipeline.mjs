// Автообновление точек без GitHub Actions: читает каналы Telegram, обновляет data/*.json и фото
// через GitHub API одним коммитом. Логика разбора постов общая с scripts/ (scripts/lib/tg.mjs).
// Все внешние вызовы идут через переданные функции, поэтому конвейер проверяется тестом без сети.
import { extractSpots, filterNew, parseChannelHtml, splitUpdates } from '../../scripts/lib/tg.mjs';
import { validate } from '../../scripts/lib/validate.mjs';

// У бесплатного Cloudflare Worker лимит 50 внешних запросов на запуск, держим запас.
export const LIMITS = { subrequests: 45, photosPerRun: 8, pages: 1 };
const LOCAL_PHOTO = /^data\/photos\/[\w.-]+\.(?:jpg|png|webp)$/;
const TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const MAX_BYTES = 3 * 1024 * 1024;
const json = (v) => JSON.stringify(v, null, 2) + '\n';

/**
 * @param {{readJson:(name:string,fallback:any)=>Promise<any>, readAllData:()=>Promise<object>, fetchText:(url:string)=>Promise<string>,
 *   fetchImage:(url:string)=>Promise<{type:string,bytes:Uint8Array}|null>, commit:(files:object[],message:string)=>Promise<void>, today:()=>string}} io
 * @returns {Promise<{report:string[], changed:boolean}>}
 */
export async function runPipeline(io, limits = LIMITS) {
  const report = [];
  const channels = await io.readJson('channels', []);
  const state = await io.readJson('inbox-state', {});
  let inbox = await io.readJson('inbox', []);
  const data = await io.readAllData();
  let spots = data.spots;
  const fishNames = [...new Set(spots.map((s) => s.fish?.replace(/\s*\(.*\)/, '').trim()).filter(Boolean))];
  const newState = { ...state };
  const updatedIds = [];
  let requests = 11, added = 0; // 11 чтений файлов из GitHub

  for (const ch of channels) {
    if (!(ch.sourceId in data.sources)) { report.push(`${ch.handle}: источник ${ch.sourceId} не описан, пропуск`); continue; }
    const lastSeen = state[ch.handle] ?? 0;
    let maxId = lastSeen, seen = 0;
    const found = [];
    try {
      let before = null;
      for (let p = 0; p < limits.pages; p++) {
        requests++;
        const posts = parseChannelHtml(await io.fetchText(`https://t.me/s/${encodeURIComponent(ch.handle)}${before ? `?before=${before}` : ''}`));
        if (!posts.length) break;
        for (const post of posts) {
          if (post.id <= lastSeen) continue;
          seen++; maxId = Math.max(maxId, post.id);
          found.push(...extractSpots(post, { waters: data.waters, fishNames, sourceId: ch.sourceId }));
        }
        before = Math.min(...posts.map((x) => x.id));
        if (before <= lastSeen) break;
      }
      const upd = splitUpdates(found, spots);
      spots = upd.spots;
      updatedIds.push(...upd.updated);
      const fresh = filterNew(upd.rest, [...spots, ...inbox]);
      inbox = [...inbox, ...fresh];
      newState[ch.handle] = maxId;
      report.push(`${ch.handle}: новых постов ${seen}, новых точек ${fresh.length}, обновлено ${upd.updated.length}`);
    } catch (error) {
      report.push(`${ch.handle}: ошибка (${error.message}), канал пропущен до следующего запуска`);
    }
  }

  // Кандидаты сразу попадают в справочник (как promote --all), если данные остаются валидными.
  const today = io.today();
  if (inbox.length) {
    const take = inbox.map((s) => ({ ...s, verified: false, addedAt: today }));
    if (validate({ ...data, spots: [...spots, ...take] }).length === 0) { spots = [...spots, ...take]; added = take.length; inbox = []; }
    else report.push('Новые точки не прошли проверку данных, остаются во входящих');
  }

  // Картинки: те, что ещё лежат на CDN Telegram, скачиваем и кладём в data/photos/.
  const files = [];
  let budget = limits.photosPerRun;
  const localize = async (spot) => {
    const m = /^https:\/\/t\.me\/([^/]+)\/(\d+)$/.exec(spot.post ?? '');
    if (!m) return spot;
    const photos = [];
    for (const [i, url] of (spot.photos ?? []).entries()) {
      if (LOCAL_PHOTO.test(url) || budget <= 0 || requests >= limits.subrequests - 12) { photos.push(url); continue; }
      budget--; requests += 2; // скачивание и blob в GitHub
      const img = await io.fetchImage(url).catch(() => null);
      const ext = img && TYPES[img.type];
      if (!ext || !img.bytes.length || img.bytes.length > MAX_BYTES) continue; // битую ссылку выбрасываем, иначе будем пробовать вечно
      const file = `data/photos/${m[1]}-${m[2]}-${i + 1}.${ext}`;
      files.push({ path: file, bytes: img.bytes });
      photos.push(file);
    }
    return { ...spot, photos: photos.slice(0, 6) };
  };
  const touched = new Set(updatedIds);
  const next = [];
  for (const s of spots) {
    const needs = touched.has(s.id) || s.addedAt === today || (s.photos ?? []).some((u) => !LOCAL_PHOTO.test(u));
    next.push(needs ? await localize(s) : s);
  }
  spots = next;

  const errors = validate({ ...data, spots });
  if (errors.length) { report.push(`Данные не прошли проверку, коммита нет: ${errors.slice(0, 3).join('; ')}`); return { report, changed: false }; }

  // Если ничего не менялось, не коммитим: так сайт не пересобирается зря.
  if (!added && !updatedIds.length && !files.length) { report.push('Изменений нет'); return { report, changed: false }; }
  const out = [
    { path: 'data/spots.json', text: json(spots) },
    { path: 'data/meta.json', text: json({ ...data.meta, updatedAt: today }) },
    { path: 'data/inbox.json', text: json(inbox) },
    { path: 'data/inbox-state.json', text: json(newState) },
    ...files,
  ];
  const upd = new Set(updatedIds).size;
  await io.commit(out, `Новые точки из Telegram (${added} новых, ${upd} обновлено)`);
  report.push(`Коммит: новых ${added}, обновлено ${upd}, картинок ${files.length}`);
  return { report, changed: true };
}
