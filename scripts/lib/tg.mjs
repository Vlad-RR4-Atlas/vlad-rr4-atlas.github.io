// Разбор публичной веб-версии канала (https://t.me/s/<канал>) и поиск в постах точек клёва.
// Сохраняем только факты (водоём, рыба, координата, наживка) и ссылку на пост, а не текст целиком.
import { dedupeKey, slug } from './merge.mjs';

const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' };
const decode = (s) => s.replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g, (m) => ENTITIES[m]).replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
const toText = (html) => decode(html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div)>/gi, '\n').replace(/<[^>]+>/g, '')).replace(/[ \t]+/g, ' ').trim();

/** Адреса картинок поста (скриншоты). Сами файлы не скачиваются: на сайте это ссылки на CDN Telegram. */
function photoUrls(block) {
  const urls = [];
  for (const m of block.matchAll(/tgme_widget_message_photo_wrap[^>]*style="[^"]*?background-image:\s*url\((?:'|&#39;|&quot;)?([^'")&]+(?:&amp;[^'")&]+)*)/g)) {
    const url = decode(m[1]);
    if (/^https:\/\//.test(url) && !urls.includes(url)) urls.push(url);
  }
  return urls.slice(0, 8);
}

/** @returns {{id: number, post: string, url: string, date: string|null, text: string, photos: string[]}[]} */
export function parseChannelHtml(html) {
  const posts = [];
  const blocks = html.split('tgme_widget_message_wrap').slice(1);
  for (const block of blocks) {
    const ref = /data-post="([^"\/]+\/(\d+))"/.exec(block);
    if (!ref) continue;
    const text = /class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/.exec(block);
    if (!text) continue;
    const date = /<time[^>]*datetime="([^"]+)"/.exec(block);
    posts.push({ id: Number(ref[2]), post: ref[1], url: `https://t.me/${ref[1]}`, date: date ? date[1] : null, text: toText(text[1]), photos: photoUrls(block) });
  }
  return posts;
}

const norm = (s) => s.toLowerCase().replace(/ё/g, 'е');
const stem = (word) => (word.length > 5 ? word.slice(0, -2) : word);

/** Водоём найден, если в тексте есть название целиком или основы всех его слов («старом остроге» -> «стар» и «остр»). */
function mentions(text, w) {
  const name = norm(w.name);
  if (text.includes(name)) return true;
  return name.split(/\s+/).every((word) => text.includes(stem(word)));
}

// Координата принимается, только если рядом есть слово «коорд» или «точка»: иначе «в 21:30» было бы временем.
const COORD_NEAR = /(?:коорд\p{L}*\.?|точк\p{L}*)\W{0,12}(\d{1,3})\s*[:;хx]\s*(\d{1,3})/giu;

/**
 * Рыбы, названные в тексте. Это разные рыбы: «Усач» и «Усач короткоголовый». Сначала ищем длинные названия
 * и вычёркиваем их из текста, чтобы короткое не нашлось внутри длинного.
 */
export function matchFish(normText, fishNames) {
  let rest = normText;
  const found = [];
  for (const name of [...fishNames].sort((a, b) => b.length - a.length)) {
    const n = norm(name);
    if (rest.includes(n)) { found.push(name); rest = rest.split(n).join(' '); }
  }
  return found;
}

/** Значение после «Название: …» до конца строки. */
function field(text, label) {
  const re = new RegExp(`(?:${label.source})\\s*[:\\-–—]\\s*([^\\n]{2,160})`, 'iu');
  return re.exec(text)?.[1]?.trim() || null;
}

/**
 * Находит в посте кандидатов в точки. Это эвристика: результат всегда идёт на проверку человеку.
 * @returns {object[]} объекты в формате spots.json, но с verified:false и полем post
 */
export function extractSpots(post, { waters, fishNames, sourceId }) {
  const text = norm(post.text);
  const water = waters.find((w) => mentions(text, w));
  if (!water) return [];
  const coords = [...post.text.matchAll(COORD_NEAR)].map((m) => `${m[1]}:${m[2]}`);
  if (!coords.length) return [];
  const fish = matchFish(text, fishNames);
  const bait = field(post.text, /наживк\p{L}*|насадк\p{L}*/iu);
  const groundbait = field(post.text, /прикорм\p{L}*/iu);
  const out = [];
  const unique = [...new Set(coords)];
  for (const coord of unique) {
    for (const f of fish.length ? fish.slice(0, 3) : [null]) {
      const spot = { id: '', water: water.id, fish: f, coord, place: null, bait, groundbait, clip: null, note: null, verified: false, sources: [sourceId], post: post.url, postText: post.text, postDate: post.date ?? null, photos: post.photos ?? [] };
      spot.id = slug([water.id, f ?? 'ryba', coord, 'tg', post.id].join(' '));
      out.push(spot);
    }
  }
  return out;
}

/** Отбрасывает то, что уже есть в справочнике или во входящих. */
export function filterNew(candidates, known) {
  const keys = new Set(known.map(dedupeKey));
  const ids = new Set(known.map((s) => s.id));
  return candidates.filter((c) => {
    const k = dedupeKey(c);
    if (keys.has(k) || ids.has(c.id)) return false;
    keys.add(k); ids.add(c.id);
    return true;
  });
}

/**
 * Делит кандидатов на «обновления существующих точек» и «остальные».
 * Обновление: тот же водоём, рыба и координата, но пост другой и новее. Тогда точка получает
 * новый пост (текст, дата, скриншоты) и поднимается вверх списка. Наживку и прикормку берём из
 * нового поста, если они там есть, иначе оставляем прежние. Id точки не меняется.
 * @returns {{spots: object[], rest: object[], updated: string[]}}
 */
export function splitUpdates(candidates, spots) {
  const byKey = new Map(spots.map((s, i) => [dedupeKey(s), i]));
  const next = [...spots];
  const rest = [];
  const updated = [];
  for (const c of candidates) {
    const i = byKey.get(dedupeKey(c));
    if (i === undefined) { rest.push(c); continue; }
    const old = next[i];
    const newer = c.postDate && (!old.postDate || c.postDate > old.postDate);
    if (!newer || old.post === c.post) continue;
    next[i] = {
      ...old,
      bait: c.bait ?? old.bait,
      groundbait: c.groundbait ?? old.groundbait,
      post: c.post, postText: c.postText, postDate: c.postDate,
      photos: c.photos?.length ? c.photos : old.photos ?? [],
      sources: [...new Set([...old.sources, ...c.sources])],
    };
    updated.push(old.id);
  }
  return { spots: next, rest, updated };
}
