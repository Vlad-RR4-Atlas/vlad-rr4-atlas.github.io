// Логика раздела «Точки»: фильтрация, строка для чата, случайный выбор.

/**
 * @param {object[]} spots
 * @param {{water?: string, query?: string, favs?: Set<string>, favOnly?: boolean, photoOnly?: boolean}} opts
 */
export function filterSpots(spots, { water = '', query = '', favs = new Set(), favOnly = false, photoOnly = false } = {}) {
  const q = query.trim().toLowerCase();
  return spots.filter((s) => {
    if (water && s.water !== water) return false;
    if (favOnly && !favs.has(s.id)) return false;
    if (photoOnly && !(s.photos ?? []).some((u) => u.startsWith('data/'))) return false;
    if (q) {
      const haystack = [s.fish, s.bait, s.groundbait, s.note].filter(Boolean).join(' ').toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

/** Подпись точки, которую удобно вставить в чат стрима. */
export function lineFor(spot, waterName) {
  const parts = [waterName, spot.fish ?? 'Рыба не указана', spot.coord ?? spot.place];
  if (spot.bait) parts.push(spot.bait);
  if (spot.groundbait) parts.push(`прикормка: ${spot.groundbait}`);
  return parts.join(' · ');
}

/**
 * Выбирает случайную точку. Предпочитает записи, где известна рыба, и старается
 * не повторять предыдущий выбор.
 */
export function pickSpot(list, last = null, rnd = Math.random) {
  const named = list.filter((s) => s.fish);
  const pool = named.length ? named : list;
  if (!pool.length) return null;
  let spot = pool[Math.floor(rnd() * pool.length)];
  if (pool.length > 1 && spot === last) spot = pool[(pool.indexOf(spot) + 1) % pool.length];
  return spot;
}

/** Группа уровня водоёма: 1 стартовый, 2 средний, 3 поздний. */
export function tierOf(level) {
  if (!level || level < 12) return 1;
  return level <= 24 ? 2 : 3;
}

/** Дата записи для сортировки: дата поста-источника или дата добавления, иначе null. */
export function freshness(spot) {
  const t = Date.parse(spot.postDate ?? spot.addedAt ?? '');
  return Number.isNaN(t) ? null : t;
}

/** Самые свежие сверху. Записи без даты идут после датированных в прежнем порядке. */
export function sortByFreshness(spots) {
  return spots
    .map((spot, index) => ({ spot, index, t: freshness(spot) }))
    .sort((a, b) => (a.t === null) - (b.t === null) || (b.t ?? 0) - (a.t ?? 0) || a.index - b.index)
    .map((x) => x.spot);
}
