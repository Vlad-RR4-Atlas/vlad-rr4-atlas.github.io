import { existsSync } from 'node:fs';
import path from 'node:path';
import { ROOT, readAll } from './lib/data-io.mjs';
import { validate } from './lib/validate.mjs';

const data = await readAll();
const errors = validate(data);
for (const spot of data.spots) {
  for (const photo of spot.photos ?? []) {
    if (photo.startsWith('data/') && !existsSync(path.join(ROOT, photo))) errors.push(`spots[${spot.id}]: нет файла ${photo}`);
  }
}
if (errors.length) {
  console.error(`Найдено ошибок: ${errors.length}`);
  for (const e of errors) console.error(' - ' + e);
  process.exit(1);
}
console.log(`Данные в порядке: точек ${data.spots.length}, водоёмов ${data.waters.length}, катушек ${data.reels.length}, удилищ ${data.rods.length}, сборок ${data.builds.length}.`);
