import fs from 'fs';
import path from 'path';
import { SAMPLE_MEDIA_DIR } from '../config.js';

let _cached = null;

export function getImageList() {
  if (_cached) return _cached;
  if (!fs.existsSync(SAMPLE_MEDIA_DIR)) {
    console.warn(`  WARN: sample-media directory not found at ${SAMPLE_MEDIA_DIR}`);
    return (_cached = []);
  }
  _cached = fs.readdirSync(SAMPLE_MEDIA_DIR)
    .filter(f => /\.(jpe?g|png|gif|webp)$/i.test(f))
    .map(f => path.join(SAMPLE_MEDIA_DIR, f));
  return _cached;
}

export function pickImages(n) {
  const list = getImageList();
  if (!list.length) return [];
  const shuffled = [...list].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(n, list.length));
}
